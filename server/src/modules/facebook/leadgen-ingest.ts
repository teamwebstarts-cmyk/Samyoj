import prisma from '../../config/database';
import { createModuleLogger } from '../../utils/logger';
import { normalizePhoneIdentity, validatePhone } from '../../utils/phone';
import { hasAuditableCampaignConsent } from '../campaigns/recipients';
import { MetaWhatsAppService } from '../whatsapp/meta.service';
import { fetchLeadgenLead, mapLeadgenFields } from './page-client';

const log = createModuleLogger('facebook-leadgen-ingest');

export const META_ADS_SOURCE = 'META_ADS';

export type LeadgenIngestResult = {
  leadId: string | null;
  created: boolean;
  contactId: string | null;
  whatsappSent: boolean;
  skippedReason?: string;
};

function leadTitle(name: string | null, email: string | null, metaLeadId: string): string {
  return name || email || `Meta lead ${metaLeadId}`;
}

/**
 * Upsert Lead from a claimed leadgen webhook. Does not create Conversations.
 * Phone-less: Lead with contactId null + metaLeadId (Contact.phone stays required).
 */
export async function ingestLeadgenForChannel(opts: {
  organizationId: string;
  channelId: string;
  pageAccessToken: string;
  leadgenId: string;
}): Promise<LeadgenIngestResult> {
  const existing = await prisma.lead.findFirst({
    where: {
      organizationId: opts.organizationId,
      metaLeadId: opts.leadgenId,
    },
    select: { id: true, contactId: true },
  });
  if (existing) {
    return {
      leadId: existing.id,
      created: false,
      contactId: existing.contactId,
      whatsappSent: false,
      skippedReason: 'duplicate_meta_lead_id',
    };
  }

  const graphLead = await fetchLeadgenLead(opts.leadgenId, opts.pageAccessToken);
  const mapped = mapLeadgenFields(graphLead.field_data);

  let contactId: string | null = null;
  let whatsappNumberId: string | null = null;
  let contactForSend: {
    id: string;
    phone: string;
    optedIn: boolean;
    consentSource: string | null;
    consentAt: Date | null;
    optOutAt: Date | null;
  } | null = null;

  const phoneCandidate = mapped.phone ? mapped.phone : null;
  const phoneOk = phoneCandidate ? validatePhone(normalizePhoneIdentity(phoneCandidate)) : null;
  const normalizedPhone = phoneOk?.ok ? phoneOk.phone : null;

  if (normalizedPhone) {
    // Number isolation: never pick “latest” when multiple active numbers exist.
    const activeNumbers = await prisma.whatsappNumber.findMany({
      where: { organizationId: opts.organizationId, isActive: true },
      take: 2,
      select: { id: true },
    });
    if (activeNumbers.length === 1) {
      const activeNumber = activeNumbers[0];
      whatsappNumberId = activeNumber.id;
      const contact = await prisma.contact.upsert({
        where: {
          organizationId_whatsappNumberId_normalizedPhone: {
            organizationId: opts.organizationId,
            whatsappNumberId: activeNumber.id,
            normalizedPhone,
          },
        },
        create: {
          organizationId: opts.organizationId,
          whatsappNumberId: activeNumber.id,
          phone: normalizedPhone,
          normalizedPhone,
          name: mapped.name || undefined,
          email: mapped.email || undefined,
          source: 'INBOUND',
        },
        update: {
          ...(mapped.name ? { name: mapped.name } : {}),
          ...(mapped.email ? { email: mapped.email } : {}),
        },
        select: {
          id: true,
          phone: true,
          optedIn: true,
          consentSource: true,
          consentAt: true,
          optOutAt: true,
        },
      });
      contactId = contact.id;
      contactForSend = contact;
    } else if (activeNumbers.length > 1) {
      log.info('Lead Ads contact skip — multiple active WhatsApp numbers', {
        organizationId: opts.organizationId,
        channelId: opts.channelId,
      });
    }
  }

  const noWaMessage =
    !normalizedPhone ||
    !contactForSend ||
    !hasAuditableCampaignConsent(contactForSend);
  const notesParts = [
    mapped.email ? `email: ${mapped.email}` : null,
    !normalizedPhone && mapped.phone ? `raw_phone: ${mapped.phone}` : null,
    noWaMessage ? 'No WhatsApp message — no phone or no consent.' : null,
  ].filter(Boolean);

  try {
    const lead = await prisma.lead.create({
      data: {
        organizationId: opts.organizationId,
        channelId: opts.channelId,
        metaLeadId: opts.leadgenId,
        metaFormId: graphLead.form_id || undefined,
        metaAdId: graphLead.ad_id || undefined,
        metaAdSetId: graphLead.adset_id || undefined,
        metaCampaignId: graphLead.campaign_id || undefined,
        contactId,
        whatsappNumberId,
        title: leadTitle(mapped.name, mapped.email, opts.leadgenId),
        source: META_ADS_SOURCE,
        stage: 'NEW',
        notes: notesParts.length ? notesParts.join('\n') : undefined,
      },
      select: { id: true },
    });

    const whatsappSent = await maybeSendLeadAdsTemplate({
      organizationId: opts.organizationId,
      contact: contactForSend,
      whatsappNumberId,
    });

    return {
      leadId: lead.id,
      created: true,
      contactId,
      whatsappSent,
      skippedReason: whatsappSent
        ? undefined
        : !normalizedPhone
          ? 'no_phone'
          : !contactForSend
            ? 'no_whatsapp_number'
            : !hasAuditableCampaignConsent(contactForSend)
              ? 'no_consent'
              : 'no_approved_template',
    };
  } catch (err) {
    // Race: unique (organizationId, metaLeadId) — treat as idempotent.
    if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'P2002') {
      const raced = await prisma.lead.findFirst({
        where: { organizationId: opts.organizationId, metaLeadId: opts.leadgenId },
        select: { id: true, contactId: true },
      });
      return {
        leadId: raced?.id ?? null,
        created: false,
        contactId: raced?.contactId ?? null,
        whatsappSent: false,
        skippedReason: 'duplicate_meta_lead_id',
      };
    }
    throw err;
  }
}

async function maybeSendLeadAdsTemplate(opts: {
  organizationId: string;
  contact: {
    id: string;
    phone: string;
    optedIn: boolean;
    consentSource: string | null;
    consentAt: Date | null;
    optOutAt: Date | null;
  } | null;
  whatsappNumberId: string | null;
}): Promise<boolean> {
  if (!opts.contact || !opts.whatsappNumberId) return false;
  if (!hasAuditableCampaignConsent(opts.contact)) return false;

  const org = await prisma.organization.findUnique({
    where: { id: opts.organizationId },
    select: { settings: true },
  });
  const settings = (org?.settings as Record<string, unknown>) || {};
  const meta = (settings.meta as Record<string, unknown>) || {};
  const templateName =
    typeof meta.leadAdsWhatsAppTemplate === 'string' ? meta.leadAdsWhatsAppTemplate.trim() : '';
  if (!templateName) return false;

  const number = await prisma.whatsappNumber.findFirst({
    where: { id: opts.whatsappNumberId, organizationId: opts.organizationId, isActive: true },
    select: { phoneNumberId: true, accessToken: true, wabaId: true, isOnBizApp: true },
  });
  if (!number?.accessToken || !number.phoneNumberId || !number.wabaId) return false;

  const accessToken = MetaWhatsAppService.decryptToken(number.accessToken);
  const template = await MetaWhatsAppService.getMessageTemplate(
    number.wabaId,
    accessToken,
    templateName
  );
  if (!template || String(template.status).toUpperCase() !== 'APPROVED') {
    log.info('Lead Ads template skip — not approved', {
      organizationId: opts.organizationId,
      templateName,
      status: template?.status ?? null,
    });
    return false;
  }

  const language = template.language || 'en';
  await MetaWhatsAppService.sendMessage(
    number.phoneNumberId,
    accessToken,
    {
      to: opts.contact.phone,
      type: 'template',
      template: {
        name: templateName,
        language: { code: language },
      },
    },
    { whatsappNumberId: opts.whatsappNumberId, isOnBizApp: number.isOnBizApp }
  );
  return true;
}
