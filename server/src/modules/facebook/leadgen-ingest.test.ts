import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import prisma from '../../config/database';
import {
  dispatchPageWebhookFields,
} from '../whatsapp/webhook-dispatcher';
import { ingestLeadgenForChannel, META_ADS_SOURCE } from './leadgen-ingest';
import { mapLeadgenFields } from './page-client';

const sendMessage = vi.fn();
const getMessageTemplate = vi.fn();
const decryptToken = vi.fn(() => 'page-token');
const fetchLead = vi.fn();

vi.mock('../../config/database', () => ({
  default: {
    channel: { findMany: vi.fn(), updateMany: vi.fn() },
    lead: { findFirst: vi.fn(), create: vi.fn() },
    contact: { upsert: vi.fn(), create: vi.fn(), findUnique: vi.fn() },
    whatsappNumber: { findFirst: vi.fn(), findMany: vi.fn() },
    conversation: { create: vi.fn(), upsert: vi.fn() },
    organization: { findUnique: vi.fn() },
    providerWebhookEvent: {
      create: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

vi.mock('../../realtime', () => ({ emitToOrg: vi.fn() }));

vi.mock('../whatsapp/meta.service', () => ({
  MetaWhatsAppService: {
    decryptToken: (...args: unknown[]) => decryptToken(...args),
    sendMessage: (...args: unknown[]) => sendMessage(...args),
    getMessageTemplate: (...args: unknown[]) => getMessageTemplate(...args),
  },
}));

vi.mock('./page-client', async () => {
  const actual = await vi.importActual<typeof import('./page-client')>('./page-client');
  return {
    ...actual,
    fetchLeadgenLead: (...args: unknown[]) => fetchLead(...args),
  };
});

const channelMock = vi.mocked(prisma.channel);
const leadMock = vi.mocked(prisma.lead);
const contactMock = vi.mocked(prisma.contact);
const whatsappNumberMock = vi.mocked(prisma.whatsappNumber);
const conversationMock = vi.mocked(prisma.conversation);
const orgMock = vi.mocked(prisma.organization);
const events = vi.mocked(prisma.providerWebhookEvent);

function pageLeadgenFixture(leadgenId = 'lead_1', pageId = 'page_1') {
  return {
    object: 'page',
    entry: [
      {
        id: pageId,
        time: 1_700_000_000,
        changes: [
          {
            field: 'leadgen',
            value: {
              leadgen_id: leadgenId,
              page_id: pageId,
              form_id: 'form_1',
              created_time: 1_700_000_000,
            },
          },
        ],
      },
    ],
  };
}

describe('mapLeadgenFields', () => {
  it('maps phone / name / email from Instant Form field_data', () => {
    expect(
      mapLeadgenFields([
        { name: 'full_name', values: ['Ada'] },
        { name: 'phone_number', values: ['+91 90097 85315'] },
        { name: 'email', values: ['ada@example.com'] },
      ])
    ).toEqual({
      name: 'Ada',
      phone: '+91 90097 85315',
      email: 'ada@example.com',
    });
  });
});

describe('ingestLeadgenForChannel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    leadMock.findFirst.mockResolvedValue(null as never);
    leadMock.create.mockImplementation(async ({ data }: { data: { metaLeadId?: string } }) => ({
      id: `lead-row-${data.metaLeadId}`,
    }) as never);
    orgMock.findUnique.mockResolvedValue({ settings: {} } as never);
    whatsappNumberMock.findFirst.mockResolvedValue(null as never);
    whatsappNumberMock.findMany.mockResolvedValue([] as never);
  });

  it('same leadgen_id twice yields one Lead', async () => {
    fetchLead.mockResolvedValue({
      id: 'lead_dup',
      field_data: [{ name: 'email', values: ['a@b.com'] }],
    });

    const first = await ingestLeadgenForChannel({
      organizationId: 'org-1',
      channelId: 'ch-1',
      pageAccessToken: 'tok',
      leadgenId: 'lead_dup',
    });
    expect(first.created).toBe(true);
    expect(leadMock.create).toHaveBeenCalledTimes(1);

    leadMock.findFirst.mockResolvedValue({ id: first.leadId, contactId: null } as never);
    const second = await ingestLeadgenForChannel({
      organizationId: 'org-1',
      channelId: 'ch-1',
      pageAccessToken: 'tok',
      leadgenId: 'lead_dup',
    });
    expect(second.created).toBe(false);
    expect(second.leadId).toBe(first.leadId);
    expect(leadMock.create).toHaveBeenCalledTimes(1);
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('no phone → Lead exists, no WhatsApp send', async () => {
    fetchLead.mockResolvedValue({
      id: 'lead_email',
      field_data: [
        { name: 'full_name', values: ['Email Only'] },
        { name: 'email', values: ['only@example.com'] },
      ],
    });

    const result = await ingestLeadgenForChannel({
      organizationId: 'org-1',
      channelId: 'ch-1',
      pageAccessToken: 'tok',
      leadgenId: 'lead_email',
    });

    expect(result.created).toBe(true);
    expect(result.contactId).toBeNull();
    expect(result.whatsappSent).toBe(false);
    expect(result.skippedReason).toBe('no_phone');
    expect(contactMock.upsert).not.toHaveBeenCalled();
    expect(sendMessage).not.toHaveBeenCalled();
    expect(leadMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metaLeadId: 'lead_email',
          source: META_ADS_SOURCE,
          contactId: null,
        }),
      })
    );
  });

  it('phone without consent → Lead exists, no template send', async () => {
    fetchLead.mockResolvedValue({
      id: 'lead_phone',
      field_data: [
        { name: 'full_name', values: ['No Consent'] },
        { name: 'phone_number', values: ['919009785315'] },
      ],
    });
    whatsappNumberMock.findMany.mockResolvedValue([{ id: 'wa-1' }] as never);
    contactMock.upsert.mockResolvedValue({
      id: 'c-1',
      phone: '919009785315',
      optedIn: false,
      consentSource: null,
      consentAt: null,
      optOutAt: null,
    } as never);

    const result = await ingestLeadgenForChannel({
      organizationId: 'org-1',
      channelId: 'ch-1',
      pageAccessToken: 'tok',
      leadgenId: 'lead_phone',
    });

    expect(result.created).toBe(true);
    expect(result.contactId).toBe('c-1');
    expect(result.whatsappSent).toBe(false);
    expect(result.skippedReason).toBe('no_consent');
    expect(sendMessage).not.toHaveBeenCalled();
    expect(leadMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          notes: expect.stringContaining('No WhatsApp message — no phone or no consent.'),
        }),
      })
    );
  });

  it('phone with multiple active WhatsApp numbers → Lead only, no Contact on latest', async () => {
    fetchLead.mockResolvedValue({
      id: 'lead_multi',
      field_data: [
        { name: 'full_name', values: ['Multi'] },
        { name: 'phone_number', values: ['919009785315'] },
      ],
    });
    whatsappNumberMock.findMany.mockResolvedValue([{ id: 'wa-1' }, { id: 'wa-2' }] as never);

    const result = await ingestLeadgenForChannel({
      organizationId: 'org-1',
      channelId: 'ch-1',
      pageAccessToken: 'tok',
      leadgenId: 'lead_multi',
    });

    expect(result.created).toBe(true);
    expect(result.contactId).toBeNull();
    expect(result.whatsappSent).toBe(false);
    expect(contactMock.upsert).not.toHaveBeenCalled();
    expect(sendMessage).not.toHaveBeenCalled();
  });
});

describe('dispatchPageWebhookFields Phase 1', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    channelMock.findMany.mockResolvedValue([
      { id: 'ch-1', organizationId: 'org-1', accessToken: 'enc' },
    ] as never);
    events.create.mockResolvedValue({} as never);
    events.updateMany.mockResolvedValue({ count: 1 } as never);
    leadMock.findFirst.mockResolvedValue(null as never);
    leadMock.create.mockResolvedValue({ id: 'lead-row-1' } as never);
    orgMock.findUnique.mockResolvedValue({ settings: {} } as never);
    whatsappNumberMock.findFirst.mockResolvedValue(null as never);
    whatsappNumberMock.findMany.mockResolvedValue([] as never);
    fetchLead.mockResolvedValue({
      id: 'lead_1',
      field_data: [{ name: 'email', values: ['x@y.com'] }],
    });
    decryptToken.mockReturnValue('page-token');
  });

  it('page payload does not create a WhatsApp conversation', async () => {
    const result = await dispatchPageWebhookFields(pageLeadgenFixture());
    expect(result.claimed).toBe(1);
    expect(conversationMock.create).not.toHaveBeenCalled();
    expect(conversationMock.upsert).not.toHaveBeenCalled();
    expect(leadMock.create).toHaveBeenCalled();
  });

  it('unknown page does not write a Lead', async () => {
    channelMock.findMany.mockResolvedValue([] as never);
    const result = await dispatchPageWebhookFields(pageLeadgenFixture());
    expect(result).toEqual({ claimed: 0, unmatched: 1, duplicates: 0 });
    expect(leadMock.create).not.toHaveBeenCalled();
    expect(events.create).not.toHaveBeenCalled();
  });

  it('wrong org (ambiguous Channel) does not write a Lead', async () => {
    channelMock.findMany.mockResolvedValue([
      { id: 'ch-1', organizationId: 'org-a', accessToken: 'enc' },
      { id: 'ch-2', organizationId: 'org-b', accessToken: 'enc' },
    ] as never);
    const result = await dispatchPageWebhookFields(pageLeadgenFixture());
    expect(result.unmatched).toBe(1);
    expect(leadMock.create).not.toHaveBeenCalled();
  });

  it('duplicate claim skips second Lead write', async () => {
    const payload = pageLeadgenFixture('lead_dup2');
    const first = await dispatchPageWebhookFields(payload);
    expect(first.claimed).toBe(1);

    events.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '6.0.0',
      })
    );
    events.findUnique.mockResolvedValue({
      id: 'evt-1',
      status: 'COMPLETED',
      claimedAt: new Date(),
    } as never);

    const second = await dispatchPageWebhookFields(payload);
    expect(second.duplicates).toBe(1);
    expect(leadMock.create).toHaveBeenCalledTimes(1);
  });
});
