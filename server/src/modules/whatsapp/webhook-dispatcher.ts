import prisma from '../../config/database';
import { Prisma } from '@prisma/client';
import { emitToOrg } from '../../realtime';
import { createModuleLogger } from '../../utils/logger';
import { parseMetaTimestamp } from '../campaigns/safety';
import { createHash } from 'node:crypto';
import { invalidateTemplateCache } from '../templates/cache';

const log = createModuleLogger('webhook-dispatcher');

function stableValue(value: unknown): string {
  if (!value || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableValue).join(',')}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, item]) => `${JSON.stringify(key)}:${stableValue(item)}`)
    .join(',')}}`;
}

export function hashWebhookPayload(value: unknown): string {
  return createHash('sha256').update(stableValue(value)).digest('hex');
}

export function providerWebhookEventKey(
  entryId: string | undefined,
  field: string,
  value: Record<string, unknown>
): string {
  const explicit = value.event_id || value.eventId || value.leadgen_id || value.mid;
  if (typeof explicit === 'string' && explicit) return `${field}:${explicit}`;
  return `${entryId || 'unknown'}:${field}:${hashWebhookPayload(value)}`;
}

export const PROVIDER_WEBHOOK_CLAIM_STALE_MS = 60_000;

export async function claimProviderWebhookEvent(
  organizationId: string,
  eventKey: string,
  field: string
): Promise<boolean> {
  try {
    await prisma.providerWebhookEvent.create({
      data: { organizationId, eventKey, field, status: 'PROCESSING', claimedAt: new Date() },
    });
    return true;
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
      throw error;
    }
  }

  const existing = await prisma.providerWebhookEvent.findUnique({
    where: { organizationId_eventKey: { organizationId, eventKey } },
  });
  if (!existing) {
    try {
      await prisma.providerWebhookEvent.create({
        data: { organizationId, eventKey, field, status: 'PROCESSING', claimedAt: new Date() },
      });
      return true;
    } catch (retryError) {
      if (retryError instanceof Prisma.PrismaClientKnownRequestError && retryError.code === 'P2002') {
        return false;
      }
      throw retryError;
    }
  }
  if (existing.status === 'COMPLETED') return false;
  if (existing.status !== 'PROCESSING') return false;

  const ageMs = Date.now() - existing.claimedAt.getTime();
  if (ageMs < PROVIDER_WEBHOOK_CLAIM_STALE_MS) return false;

  const reclaimed = await prisma.providerWebhookEvent.updateMany({
    where: {
      id: existing.id,
      status: 'PROCESSING',
      claimedAt: existing.claimedAt,
    },
    data: { claimedAt: new Date(), field },
  });
  return reclaimed.count === 1;
}

export async function completeProviderWebhookEvent(
  organizationId: string,
  eventKey: string
): Promise<void> {
  await prisma.providerWebhookEvent.updateMany({
    where: { organizationId, eventKey, status: 'PROCESSING' },
    data: { status: 'COMPLETED', processedAt: new Date() },
  });
}

export async function releaseProviderWebhookEvent(
  organizationId: string,
  eventKey: string
): Promise<void> {
  await prisma.providerWebhookEvent.deleteMany({
    where: { organizationId, eventKey, status: 'PROCESSING' },
  });
}

/** Durable receipt for every Meta POST (health + ops). Idempotency stays on claim/meta ids. */
export async function recordProviderWebhookReceipt(params: {
  organizationId: string;
  eventKey: string;
  field: string;
}): Promise<void> {
  try {
    await prisma.providerWebhookEvent.create({
      data: {
        organizationId: params.organizationId,
        eventKey: params.eventKey,
        field: params.field,
        status: 'RECEIVED',
        claimedAt: new Date(),
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return;
    log.warn('Could not record webhook receipt', {
      organizationId: params.organizationId,
      field: params.field,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export const HANDLED_FIELDS = new Set([
  'message_template_status_update',
  'message_template_quality_update',
  'message_template_components_update',
  'template_category_update',
  'phone_number_quality_update',
  'phone_number_name_update',
  'business_capability_update',
  'user_preferences',
  'account_alerts',
]);

export function providerPhoneNumberId(value: Record<string, unknown>): {
  phoneNumberId?: string;
  ambiguous: boolean;
} {
  const metadata = value.metadata as Record<string, unknown> | undefined;
  const nested = Array.isArray(value.user_preferences) ? value.user_preferences : [];
  const candidates = [
    value.phone_number_id,
    value.phoneNumberId,
    metadata?.phone_number_id,
    ...nested.flatMap((item) => {
      if (!item || typeof item !== 'object') return [];
      const preference = item as Record<string, unknown>;
      return [preference.phone_number_id, preference.phoneNumberId];
    }),
  ].filter((candidate): candidate is string => typeof candidate === 'string' && candidate.length > 0);
  const unique = [...new Set(candidates)];
  if (unique.length > 1) return { ambiguous: true };
  return { phoneNumberId: unique[0], ambiguous: false };
}

export async function resolveOrgFromWaba(
  wabaId: string | undefined,
  value: Record<string, unknown> = {}
) {
  if (!wabaId) return null;
  const providerIdentity = providerPhoneNumberId(value);
  if (providerIdentity.ambiguous) {
    log.warn('WABA webhook has conflicting phone number identities', { wabaId });
    return null;
  }
  if (providerIdentity.phoneNumberId) {
    return prisma.whatsappNumber.findFirst({
      where: {
        wabaId,
        phoneNumberId: providerIdentity.phoneNumberId,
        isActive: true,
      },
      select: { organizationId: true, id: true },
    });
  }

  const numbers = await prisma.whatsappNumber.findMany({
    where: { wabaId, isActive: true },
    select: { organizationId: true, id: true },
    take: 2,
  });
  if (numbers.length !== 1) {
    log.warn('WABA-only webhook is ambiguous; refusing to route it', {
      wabaId,
      activeNumberCount: numbers.length,
    });
    return null;
  }
  return numbers[0];
}

async function resolveOrgFromPhoneNumberId(phoneNumberId: string | undefined) {
  if (!phoneNumberId) return null;
  const number = await prisma.whatsappNumber.findFirst({
    where: { phoneNumberId, isActive: true },
    select: { organizationId: true, id: true },
  });
  return number;
}

async function appendOrgAlert(
  organizationId: string,
  alertType: string,
  alert: Record<string, unknown>
) {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { settings: true },
  });
  const settings = (org?.settings as Record<string, unknown>) || {};
  const alerts = (settings.alerts as Record<string, unknown[]>) || {};
  const existing = (alerts[alertType] as Record<string, unknown>[]) || [];

  const entry = { ...alert, createdAt: new Date().toISOString() };
  const updated = [entry, ...existing].slice(0, 20);

  await prisma.organization.update({
    where: { id: organizationId },
    data: {
      settings: {
        ...settings,
        alerts: { ...alerts, [alertType]: updated },
      } as object,
    },
  });

  await prisma.auditLog.create({
    data: {
      organizationId,
      action: 'whatsapp.provider_webhook_state',
      resource: 'whatsapp',
      details: { alertType, alert } as object,
    },
  });
  emitToOrg(organizationId, 'alert:new', { type: alertType, alert: entry });
}

async function handleTemplateStatusUpdate(
  value: Record<string, unknown>,
  wabaId: string | undefined
) {
  const number = await resolveOrgFromWaba(wabaId, value);
  if (!number) return;

  const event = (value.event as string) || '';
  const templateName = (value.message_template_name as string) || (value.name as string);
  const reason = (value.reason as string) || (value.rejected_reason as string);
  const templateId = value.message_template_id as string | undefined;

  log.info('Template status update', {
    organizationId: number.organizationId,
    event,
    templateName,
  });

  emitToOrg(number.organizationId, 'template:status', {
    templateId,
    templateName,
    event,
    reason,
  });

  if (wabaId && templateName) {
    await invalidateTemplateCache(number.organizationId, wabaId, templateName);
  }

  if (['REJECTED', 'PAUSED', 'DISABLED', 'FLAGGED'].includes(event.toUpperCase())) {
    await appendOrgAlert(number.organizationId, 'templateRejections', {
      templateId,
      templateName,
      status: event,
      reason,
      severity: event.toUpperCase() === 'REJECTED' ? 'error' : 'warning',
    });
  }

  await appendOrgAlert(number.organizationId, 'templateStatus', {
    templateId,
    templateName,
    status: event || undefined,
    reason,
    field: 'message_template_status_update',
  });
}

async function handlePhoneNumberQualityUpdate(value: Record<string, unknown>) {
  const phoneNumberId =
    (value.phone_number_id as string) ||
    (value.id as string);

  const metadata = value as { current_limit?: string; quality_rating?: string };
  const qualityRating = metadata.quality_rating || (value.event as string);

  const number = await resolveOrgFromPhoneNumberId(
    typeof phoneNumberId === 'string' && phoneNumberId.length < 20
      ? phoneNumberId
      : (value.phone_number_id as string)
  );
  if (!number) return;

  if (qualityRating) {
    await prisma.whatsappNumber.update({
      where: { id: number.id },
      data: {
        qualityRating: String(qualityRating).toUpperCase(),
        ...(typeof metadata.current_limit === 'string' &&
        /^(TIER_|UNTIERED)/i.test(metadata.current_limit)
          ? { messagingLimitTier: metadata.current_limit.toUpperCase() }
          : {}),
      },
    });
  } else if (
    typeof metadata.current_limit === 'string' &&
    /^(TIER_|UNTIERED)/i.test(metadata.current_limit)
  ) {
    await prisma.whatsappNumber.update({
      where: { id: number.id },
      data: { messagingLimitTier: metadata.current_limit.toUpperCase() },
    });
  }

  const rating = String(qualityRating || '').toUpperCase();
  if (rating === 'YELLOW' || rating === 'RED') {
    await appendOrgAlert(number.organizationId, 'qualityRating', {
      phoneNumberId: number.id,
      qualityRating: rating,
      currentLimit: metadata.current_limit,
      severity: rating === 'RED' ? 'error' : 'warning',
    });
  }

  emitToOrg(number.organizationId, 'whatsapp:quality', {
    qualityRating: rating,
    currentLimit: metadata.current_limit,
  });
}

async function handleAccountStateUpdate(
  value: Record<string, unknown>,
  wabaId: string | undefined,
  field: string
) {
  const number = await resolveOrgFromWaba(wabaId, value);
  if (!number) return;
  const safeState = {
    field,
    event: typeof value.event === 'string' ? value.event : undefined,
    status: typeof value.status === 'string' ? value.status : undefined,
    currentLimit: typeof value.current_limit === 'string' ? value.current_limit : undefined,
    maxLimit: typeof value.max_limit === 'string' ? value.max_limit : undefined,
    restriction: typeof value.restriction === 'string' ? value.restriction : undefined,
    qualityRating: typeof value.quality_rating === 'string' ? value.quality_rating : undefined,
    updatedAt: new Date().toISOString(),
  };
  await appendOrgAlert(number.organizationId, field === 'user_preferences' ? 'marketingPreferences' : 'whatsappState', safeState);
  emitToOrg(number.organizationId, 'whatsapp:state', safeState);
}

function preferenceEntries(value: Record<string, unknown>) {
  const nested = Array.isArray(value.user_preferences) ? value.user_preferences : [value];
  return nested.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object');
}

async function handleUserPreferences(value: Record<string, unknown>, wabaId: string | undefined) {
  const number = await resolveOrgFromWaba(wabaId, value);
  if (!number) return;

  for (const preference of preferenceEntries(value)) {
    const phone = (
      preference.wa_id ||
      preference.phone ||
      preference.phone_number ||
      preference.user_phone
    ) as string | undefined;
    const category = String(
      preference.preference_category || preference.category || preference.preference || ''
    ).toLowerCase();
    const preferenceValue = preference.value ?? preference.opted_in ?? preference.opt_in;
    const optedOut = category.includes('marketing') && (
      preferenceValue === false ||
      ['false', 'opt_out', 'opted_out', 'unsubscribe', 'unsubscribed'].includes(String(preferenceValue).toLowerCase())
    );
    if (!phone || !optedOut) continue;

    const occurredAt = parseMetaTimestamp(
      preference.timestamp ?? preference.event_timestamp ?? preference.occurred_at
    );
    // Fail closed: a provider opt-out without a trustworthy event time cannot
    // safely win over a newer START/consent decision.
    if (!occurredAt) continue;
    const providerEventId = typeof preference.event_id === 'string'
      ? preference.event_id
      : typeof preference.id === 'string' ? preference.id : undefined;
    const decision = {
      type: 'OPT_OUT',
      optedIn: false,
      source: 'META_USER_PREFERENCES',
      category,
      event: preference,
      ...(providerEventId ? { eventId: providerEventId } : {}),
      occurredAt: occurredAt.toISOString(),
    };
    const updated = await prisma.contact.updateMany({
      where: {
        organizationId: number.organizationId,
        whatsappNumberId: number.id,
        phone,
        OR: [{ consentAt: null }, { consentAt: { lte: occurredAt } }],
      },
      data: {
        optedIn: false,
        optOutAt: occurredAt,
        consentSource: 'META_USER_PREFERENCES',
        consentAt: occurredAt,
        consentVersion: 'meta-user-preferences-v1',
        consentDecision: decision as Prisma.InputJsonValue,
      },
    });
    await prisma.auditLog.create({
      data: {
        organizationId: number.organizationId,
        action: 'whatsapp.user_marketing_opt_out',
        resource: 'contact',
        details: {
          phone,
          category,
          updatedContact: updated.count === 1,
          source: 'META_USER_PREFERENCES',
          event: preference,
        } as object,
      },
    });
    await appendOrgAlert(number.organizationId, 'marketingPreferences', {
      phone,
      category,
      optedIn: false,
      source: 'META_USER_PREFERENCES',
    });
  }
}

async function handleAccountAlerts(value: Record<string, unknown>, wabaId: string | undefined) {
  const number = await resolveOrgFromWaba(wabaId, value);
  if (!number) return;

  const alertType = (value.alert_type as string) || (value.event as string) || 'unknown';
  const alertData = (value.alert_data as Record<string, unknown>) || value;

  log.warn('Account alert received', {
    organizationId: number.organizationId,
    alertType,
  });

  await appendOrgAlert(number.organizationId, 'accountAlerts', {
    alertType,
    data: alertData,
    severity: 'warning',
  });

  emitToOrg(number.organizationId, 'whatsapp:account-alert', { alertType, data: alertData });
}

export async function resolveOrgFromPageChannel(pageId: string | undefined) {
  if (!pageId) return null;
  const rows = await prisma.channel.findMany({
    where: {
      platform: 'FB',
      platformAccountId: pageId,
      isActive: true,
    },
    select: { id: true, organizationId: true, accessToken: true },
    take: 2,
  });
  if (rows.length !== 1) {
    if (rows.length > 1) {
      log.warn('Ambiguous active Channel for Page — refusing ownership', { pageId });
    }
    return null;
  }
  return rows[0];
}

async function claimAndRunPageEvent(opts: {
  organizationId: string;
  channelId: string;
  pageId: string | undefined;
  field: string;
  value: Record<string, unknown>;
  run: () => Promise<void>;
}): Promise<'claimed' | 'duplicate'> {
  const eventKey = providerWebhookEventKey(opts.pageId, opts.field, opts.value);
  const owned = await claimProviderWebhookEvent(opts.organizationId, eventKey, opts.field);
  if (!owned) {
    log.info('Duplicate page webhook skipped', {
      field: opts.field,
      organizationId: opts.organizationId,
      eventKey,
    });
    return 'duplicate';
  }
  try {
    await opts.run();
    await completeProviderWebhookEvent(opts.organizationId, eventKey);
    return 'claimed';
  } catch (error) {
    await releaseProviderWebhookEvent(opts.organizationId, eventKey);
    throw error;
  }
}

/** Phase 0 claim + Phase 1 leadgen + Phase 3 Messenger. Never creates WA conversations. */
export async function dispatchPageWebhookFields(
  payload: Record<string, unknown>
): Promise<{ claimed: number; unmatched: number; duplicates: number }> {
  let claimed = 0;
  let unmatched = 0;
  let duplicates = 0;

  for (const entry of (payload.entry as Array<Record<string, unknown>>) || []) {
    const entryPageId = typeof entry.id === 'string' ? entry.id : undefined;

    // Messenger Platform delivers DMs on entry.messaging[], not changes[].
    for (const event of (entry.messaging as Array<Record<string, unknown>>) || []) {
      const sender = (event.sender as { id?: string } | undefined)?.id;
      const recipient = (event.recipient as { id?: string } | undefined)?.id;
      const pageId = recipient || entryPageId;
      const message = event.message as Record<string, unknown> | undefined;
      const field = 'messages';

      if (!message || message.is_echo === true) continue;
      const text = typeof message.text === 'string' ? message.text : '';
      if (!text.trim() || !sender) continue;

      const channel = await resolveOrgFromPageChannel(pageId);
      if (!channel) {
        unmatched += 1;
        log.info('Page messaging unmatched — no active Channel for Page', {
          field,
          pageId: pageId ?? null,
        });
        continue;
      }

      const mid = typeof message.mid === 'string' ? message.mid : undefined;
      const value: Record<string, unknown> = {
        ...(mid ? { mid } : {}),
        sender_id: sender,
        text,
      };
      const tsRaw = event.timestamp;
      const timestampMs =
        typeof tsRaw === 'number'
          ? tsRaw
          : typeof tsRaw === 'string' && /^\d+$/.test(tsRaw)
            ? Number(tsRaw)
            : undefined;

      const outcome = await claimAndRunPageEvent({
        organizationId: channel.organizationId,
        channelId: channel.id,
        pageId,
        field,
        value,
        run: async () => {
          const { ingestMessengerTextMessage } = await import('../facebook/messenger-ingest');
          const result = await ingestMessengerTextMessage({
            organizationId: channel.organizationId,
            channelId: channel.id,
            psid: sender,
            text: text.trim(),
            metaMessageId: mid,
            timestampMs,
          });
          log.info('Page messaging ingested', {
            organizationId: channel.organizationId,
            channelId: channel.id,
            conversationId: result.conversationId,
            createdConversation: result.createdConversation,
            skippedReason: result.skippedReason ?? null,
          });
          if (!result.skippedReason) {
            const { sendChannelKeywordReply } = await import('../facebook/channel-keyword');
            await sendChannelKeywordReply({
              organizationId: channel.organizationId,
              platform: 'FB',
              recipientId: sender,
              text: text.trim(),
            });
          }
        },
      });
      if (outcome === 'duplicate') duplicates += 1;
      else claimed += 1;
    }

    for (const change of (entry.changes as Array<Record<string, unknown>>) || []) {
      const field = typeof change.field === 'string' ? change.field : 'unknown';
      const value = (change.value as Record<string, unknown>) || {};
      const valuePageId = typeof value.page_id === 'string' ? value.page_id : undefined;
      const pageId = valuePageId || entryPageId;
      const channel = await resolveOrgFromPageChannel(pageId);
      if (!channel) {
        unmatched += 1;
        log.info('Page webhook unmatched — no active Channel for Page', {
          field,
          pageId: pageId ?? null,
        });
        continue;
      }

      const outcome = await claimAndRunPageEvent({
        organizationId: channel.organizationId,
        channelId: channel.id,
        pageId,
        field,
        value,
        run: async () => {
          if (field === 'leadgen') {
            const leadgenId = typeof value.leadgen_id === 'string' ? value.leadgen_id : '';
            if (!leadgenId || !channel.accessToken) {
              log.warn('leadgen claim without leadgen_id or Page token', {
                organizationId: channel.organizationId,
                channelId: channel.id,
                hasToken: Boolean(channel.accessToken),
              });
            } else {
              const { ingestLeadgenForChannel } = await import('../facebook/leadgen-ingest');
              const { MetaWhatsAppService } = await import('./meta.service');
              const pageToken = MetaWhatsAppService.decryptToken(channel.accessToken);
              const result = await ingestLeadgenForChannel({
                organizationId: channel.organizationId,
                channelId: channel.id,
                pageAccessToken: pageToken,
                leadgenId,
              });
              log.info('Page leadgen ingested', {
                organizationId: channel.organizationId,
                channelId: channel.id,
                leadgenId,
                leadId: result.leadId,
                created: result.created,
                whatsappSent: result.whatsappSent,
                skippedReason: result.skippedReason ?? null,
              });
            }
          } else {
            log.info('Page webhook claimed and ignored', {
              organizationId: channel.organizationId,
              channelId: channel.id,
              field,
            });
          }
        },
      });
      if (outcome === 'duplicate') duplicates += 1;
      else claimed += 1;
    }
  }

  return { claimed, unmatched, duplicates };
}

export async function resolveOrgFromIgChannel(igUserId: string | undefined) {
  if (!igUserId) return null;
  const rows = await prisma.channel.findMany({
    where: {
      platform: 'IG',
      platformAccountId: igUserId,
      isActive: true,
    },
    select: { id: true, organizationId: true, accessToken: true },
    take: 2,
  });
  if (rows.length !== 1) {
    if (rows.length > 1) {
      log.warn('Ambiguous active Channel for Instagram — refusing ownership', { igUserId });
    }
    return null;
  }
  return rows[0];
}

export async function dispatchInstagramWebhookFields(
  payload: Record<string, unknown>
): Promise<{ claimed: number; unmatched: number; duplicates: number }> {
  let claimed = 0;
  let unmatched = 0;
  let duplicates = 0;

  for (const entry of (payload.entry as Array<Record<string, unknown>>) || []) {
    const entryIgId = typeof entry.id === 'string' ? entry.id : undefined;

    for (const event of (entry.messaging as Array<Record<string, unknown>>) || []) {
      const sender = (event.sender as { id?: string } | undefined)?.id;
      const message = event.message as Record<string, unknown> | undefined;
      const field = 'messages';
      const isSelf = (event as { is_self?: boolean }).is_self === true;
      if (!message || message.is_echo === true) continue;
      if (isSelf) continue;
      const text = typeof message.text === 'string' ? message.text : '';
      if (!text.trim() || !sender) continue;
      if (sender === entryIgId) continue;

      const channel = await resolveOrgFromIgChannel(entryIgId);
      if (!channel) {
        unmatched += 1;
        continue;
      }

      const mid = typeof message.mid === 'string' ? message.mid : undefined;
      const value: Record<string, unknown> = {
        ...(mid ? { mid } : {}),
        sender_id: sender,
        text,
      };
      const tsRaw = event.timestamp;
      const timestampMs =
        typeof tsRaw === 'number'
          ? tsRaw
          : typeof tsRaw === 'string' && /^\d+$/.test(tsRaw)
            ? Number(tsRaw)
            : undefined;

      const outcome = await claimAndRunPageEvent({
        organizationId: channel.organizationId,
        channelId: channel.id,
        pageId: entryIgId,
        field,
        value,
        run: async () => {
          const { ingestInstagramTextMessage } = await import('../instagram/ingest');
          const result = await ingestInstagramTextMessage({
            organizationId: channel.organizationId,
            channelId: channel.id,
            igsid: sender,
            text: text.trim(),
            metaMessageId: mid,
            timestampMs,
          });
          if (!result.skippedReason) {
            const { sendChannelKeywordReply } = await import('../facebook/channel-keyword');
            await sendChannelKeywordReply({
              organizationId: channel.organizationId,
              platform: 'IG',
              recipientId: sender,
              text: text.trim(),
            });
          }
        },
      });
      if (outcome === 'duplicate') duplicates += 1;
      else claimed += 1;
    }

    for (const change of (entry.changes as Array<Record<string, unknown>>) || []) {
      const field = typeof change.field === 'string' ? change.field : 'unknown';
      // ponytail: live_comments share this ingest path; Meta only allows private reply during the live broadcast. Graph error is the ceiling until we store isLive.
      if (field !== 'comments' && field !== 'live_comments') {
        unmatched += 1;
        continue;
      }
      const value = (change.value as Record<string, unknown>) || {};
      const channel = await resolveOrgFromIgChannel(entryIgId);
      if (!channel) {
        unmatched += 1;
        continue;
      }
      const commentId =
        (typeof value.id === 'string' && value.id) ||
        (typeof value.comment_id === 'string' && value.comment_id) ||
        '';
      const from = (value.from as { id?: string; username?: string } | undefined) || {};
      if (from.id && entryIgId && from.id === entryIgId) continue;
      if (!commentId) {
        unmatched += 1;
        continue;
      }
      const media = (value.media as { id?: string } | undefined) || {};
      const text = typeof value.text === 'string' ? value.text : '';
      const commentedAt = parseMetaTimestamp(
        value.created_time ?? value.timestamp ?? value.comment_timestamp ?? entry.time
      );

      const outcome = await claimAndRunPageEvent({
        organizationId: channel.organizationId,
        channelId: channel.id,
        pageId: entryIgId,
        field,
        value,
        run: async () => {
          const { ingestInstagramComment } = await import('../instagram/comment-ingest');
          await ingestInstagramComment({
            organizationId: channel.organizationId,
            channelId: channel.id,
            igCommentId: commentId,
            igMediaId: media.id,
            fromId: from.id,
            fromUsername: from.username,
            text,
            commentedAt,
          });
        },
      });
      if (outcome === 'duplicate') duplicates += 1;
      else claimed += 1;
    }
  }

  return { claimed, unmatched, duplicates };
}

export async function dispatchNonMessageWebhookFields(
  payload: Record<string, unknown>
): Promise<void> {
  if (payload.object === 'page') {
    await dispatchPageWebhookFields(payload);
    return;
  }

  if (payload.object === 'instagram') {
    await dispatchInstagramWebhookFields(payload);
    return;
  }

  if (payload.object !== 'whatsapp_business_account') return;

  for (const entry of (payload.entry as Array<Record<string, unknown>>) || []) {
    const wabaId = entry.id as string | undefined;

    for (const change of (entry.changes as Array<Record<string, unknown>>) || []) {
      const field = change.field as string;
      if (!HANDLED_FIELDS.has(field)) continue;

      const value = (change.value as Record<string, unknown>) || {};
      const number = field === 'phone_number_quality_update'
        ? await resolveOrgFromPhoneNumberId(value.phone_number_id as string)
        : await resolveOrgFromWaba(wabaId, value);
      const eventKey = providerWebhookEventKey(wabaId, field, value);
      if (number && !await claimProviderWebhookEvent(number.organizationId, eventKey, field)) {
        log.info('Duplicate provider webhook skipped', { field, organizationId: number.organizationId });
        continue;
      }

      try {
        if (field === 'message_template_status_update') {
          await handleTemplateStatusUpdate(value, wabaId);
        } else if (field === 'message_template_quality_update') {
          await handleTemplateStatusUpdate(value, wabaId);
        } else if (field === 'message_template_components_update' || field === 'template_category_update') {
          const number = await resolveOrgFromWaba(wabaId, value);
          if (number) {
            await appendOrgAlert(number.organizationId, 'templateStatus', {
              field,
              templateId: value.message_template_id || value.template_id,
              templateName: value.message_template_name || value.name,
              previousCategory: value.previous_category,
              category: value.new_category || value.category,
              components: value.components,
            });
          }
        } else if (field === 'phone_number_quality_update') {
          await handlePhoneNumberQualityUpdate(value);
        } else if (field === 'account_alerts') {
          await handleAccountAlerts(value, wabaId);
        } else if (field === 'user_preferences') {
          await handleUserPreferences(value, wabaId);
        } else {
          await handleAccountStateUpdate(value, wabaId, field);
        }
        if (number) {
          await completeProviderWebhookEvent(number.organizationId, eventKey);
        }
      } catch (error) {
        if (number) {
          await releaseProviderWebhookEvent(number.organizationId, eventKey);
        }
        throw error;
      }
    }
  }
}
