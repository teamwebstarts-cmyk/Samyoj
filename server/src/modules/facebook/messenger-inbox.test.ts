import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import prisma from '../../config/database';
import { dispatchPageWebhookFields } from '../whatsapp/webhook-dispatcher';
import {
  ingestMessengerTextMessage,
  messengerContactPhone,
  messengerWindowOpen,
} from './messenger-ingest';
import { ingestLeadgenForChannel, META_ADS_SOURCE } from './leadgen-ingest';
import { CUSTOMER_SERVICE_WINDOW_MS } from '../inbox/service-window';

vi.mock('../../config/database', () => ({
  default: {
    channel: { findMany: vi.fn(), findFirst: vi.fn() },
    contact: { create: vi.fn(), findUnique: vi.fn() },
    contactPlatformIdentity: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
    conversation: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      updateMany: vi.fn(),
    },
    message: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn(), findMany: vi.fn() },
    lead: { findFirst: vi.fn(), create: vi.fn() },
    whatsappNumber: { findMany: vi.fn(), findFirst: vi.fn() },
    organization: { findUnique: vi.fn() },
    providerWebhookEvent: {
      create: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    internalNote: { create: vi.fn() },
    organizationUser: { findFirst: vi.fn() },
  },
}));

vi.mock('../../realtime', () => ({ emitToOrg: vi.fn() }));
vi.mock('../whatsapp/meta.service', () => ({
  MetaWhatsAppService: {
    decryptToken: vi.fn(() => 'page-token'),
    encryptToken: vi.fn((t: string) => `enc:${t}`),
    getMessageTemplate: vi.fn(),
    sendMessage: vi.fn(),
  },
}));
vi.mock('./page-client', async () => {
  const actual = await vi.importActual<typeof import('./page-client')>('./page-client');
  return {
    ...actual,
    fetchLeadgenLead: vi.fn(),
    sendPageTextMessage: vi.fn().mockResolvedValue({ messageId: 'mid.out' }),
    subscribePageToLeadgen: vi.fn(),
  };
});

const channelMock = vi.mocked(prisma.channel);
const identityMock = vi.mocked(prisma.contactPlatformIdentity);
const contactMock = vi.mocked(prisma.contact);
const conversationMock = vi.mocked(prisma.conversation);
const messageMock = vi.mocked(prisma.message);
const leadMock = vi.mocked(prisma.lead);
const events = vi.mocked(prisma.providerWebhookEvent);

function pageMessagingFixture(psid = 'psid_1', mid = 'mid_1', text = 'Hello Page') {
  return {
    object: 'page',
    entry: [
      {
        id: 'page_1',
        time: 1_700_000_000,
        messaging: [
          {
            sender: { id: psid },
            recipient: { id: 'page_1' },
            timestamp: 1_700_000_000_000,
            message: { mid, text },
          },
        ],
      },
    ],
  };
}

function pageLeadgenFixture(leadgenId = 'lead_1') {
  return {
    object: 'page',
    entry: [
      {
        id: 'page_1',
        time: 1_700_000_000,
        changes: [
          {
            field: 'leadgen',
            value: {
              leadgen_id: leadgenId,
              page_id: 'page_1',
              form_id: 'form_1',
              created_time: 1_700_000_000,
            },
          },
        ],
      },
    ],
  };
}

describe('Phase 3 Messenger inbox', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    events.create.mockResolvedValue({} as never);
    events.findUnique.mockResolvedValue(null as never);
    events.updateMany.mockResolvedValue({ count: 1 } as never);
  });

  it('Page message creates a Facebook-scoped thread, not a WhatsApp conversation', async () => {
    channelMock.findMany.mockResolvedValue([
      { id: 'ch_1', organizationId: 'org_1', accessToken: 'enc:tok' },
    ] as never);
    identityMock.findUnique.mockResolvedValue(null as never);
    contactMock.create.mockResolvedValue({ id: 'ct_1' } as never);
    identityMock.create.mockResolvedValue({} as never);
    conversationMock.findFirst.mockResolvedValue(null as never);
    conversationMock.create.mockResolvedValue({ id: 'conv_fb', unreadCount: 0 } as never);
    messageMock.findUnique.mockResolvedValue(null as never);
    messageMock.create.mockResolvedValue({
      id: 'msg_1',
      conversationId: 'conv_fb',
      direction: 'INBOUND',
      content: 'Hello Page',
    } as never);
    conversationMock.update.mockResolvedValue({
      id: 'conv_fb',
      lastMessageAt: new Date(),
      unreadCount: 1,
      channelId: 'ch_1',
    } as never);
    contactMock.findUnique.mockResolvedValue({
      id: 'ct_1',
      name: 'Messenger 1',
      phone: messengerContactPhone('psid_1'),
    } as never);

    const result = await dispatchPageWebhookFields(pageMessagingFixture());
    expect(result.claimed).toBe(1);

    expect(conversationMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          channelId: 'ch_1',
          whatsappNumberId: null,
          contactId: 'ct_1',
        }),
      })
    );
    expect(identityMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          platform: 'FB',
          externalId: 'psid_1',
        }),
      })
    );
    // Must not invent a WhatsApp number on the thread.
    const createData = conversationMock.create.mock.calls[0]?.[0]?.data as {
      whatsappNumberId: unknown;
    };
    expect(createData.whatsappNumberId).toBeNull();
  });

  it('same PSID twice → one thread', async () => {
    identityMock.findUnique.mockResolvedValue({ contactId: 'ct_1' } as never);
    conversationMock.findFirst
      .mockResolvedValueOnce(null as never)
      .mockResolvedValueOnce({ id: 'conv_fb', unreadCount: 1 } as never);
    conversationMock.create.mockResolvedValue({ id: 'conv_fb', unreadCount: 0 } as never);
    messageMock.findUnique.mockResolvedValue(null as never);
    messageMock.create
      .mockResolvedValueOnce({ id: 'msg_1', conversationId: 'conv_fb' } as never)
      .mockResolvedValueOnce({ id: 'msg_2', conversationId: 'conv_fb' } as never);
    conversationMock.update.mockResolvedValue({
      id: 'conv_fb',
      lastMessageAt: new Date(),
      unreadCount: 2,
      channelId: 'ch_1',
    } as never);
    contactMock.findUnique.mockResolvedValue({ id: 'ct_1', name: 'M', phone: 'messenger:psid_1' } as never);

    const first = await ingestMessengerTextMessage({
      organizationId: 'org_1',
      channelId: 'ch_1',
      psid: 'psid_1',
      text: 'hi',
      metaMessageId: 'mid_a',
    });
    const second = await ingestMessengerTextMessage({
      organizationId: 'org_1',
      channelId: 'ch_1',
      psid: 'psid_1',
      text: 'again',
      metaMessageId: 'mid_b',
    });

    expect(first.conversationId).toBe('conv_fb');
    expect(second.conversationId).toBe('conv_fb');
    expect(conversationMock.create).toHaveBeenCalledTimes(1);
    expect(contactMock.create).not.toHaveBeenCalled();
  });

  it('reply inside 24h is allowed; after window, rejected', () => {
    const now = new Date('2026-09-23T12:00:00.000Z');
    const openAt = new Date(now.getTime() - CUSTOMER_SERVICE_WINDOW_MS + 60_000);
    const closedAt = new Date(now.getTime() - CUSTOMER_SERVICE_WINDOW_MS - 60_000);
    expect(messengerWindowOpen(openAt, now)).toBe(true);
    expect(messengerWindowOpen(closedAt, now)).toBe(false);
    expect(messengerWindowOpen(null, now)).toBe(false);

    const src = readFileSync(join(__dirname, 'messenger-inbox.routes.ts'), 'utf8');
    expect(src).toContain("Wait for the customer to message again.");
    expect(src).toContain('messengerWindowOpen');
    expect(src).toContain('sendPageTextMessage');
    expect(src).not.toContain('MetaWhatsAppService.sendMessage');
  });

  it('leadgen still creates a Lead and does not become a Messenger thread', async () => {
    const { fetchLeadgenLead } = await import('./page-client');
    vi.mocked(fetchLeadgenLead).mockResolvedValue({
      id: 'lead_1',
      field_data: [{ name: 'email', values: ['a@b.com'] }],
    });

    leadMock.findFirst.mockResolvedValue(null as never);
    vi.mocked(prisma.whatsappNumber.findMany).mockResolvedValue([] as never);
    leadMock.create.mockResolvedValue({ id: 'lead_row' } as never);

    const result = await ingestLeadgenForChannel({
      organizationId: 'org_1',
      channelId: 'ch_1',
      pageAccessToken: 'tok',
      leadgenId: 'lead_1',
    });

    expect(result.created).toBe(true);
    expect(result.leadId).toBe('lead_row');
    expect(leadMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          source: META_ADS_SOURCE,
          metaLeadId: 'lead_1',
          channelId: 'ch_1',
        }),
      })
    );
    expect(conversationMock.create).not.toHaveBeenCalled();
    expect(messageMock.create).not.toHaveBeenCalled();

    // Dispatcher leadgen path still claims without messaging ingest.
    channelMock.findMany.mockResolvedValue([
      { id: 'ch_1', organizationId: 'org_1', accessToken: 'enc:tok' },
    ] as never);
    conversationMock.create.mockClear();
    messageMock.create.mockClear();
    leadMock.findFirst.mockResolvedValue({ id: 'lead_row', contactId: null } as never);

    const dispatched = await dispatchPageWebhookFields(pageLeadgenFixture('lead_dup'));
    expect(dispatched.claimed).toBe(1);
    expect(conversationMock.create).not.toHaveBeenCalled();
  });

  it('subscribed_fields include messages and leadgen; OAuth asks pages_messaging', () => {
    const pageClient = readFileSync(join(__dirname, 'page-client.ts'), 'utf8');
    expect(pageClient).toMatch(/subscribed_fields:\s*'leadgen,messages'/);
    const oauth = readFileSync(join(__dirname, 'connect-oauth-state.ts'), 'utf8');
    expect(oauth).toContain('pages_messaging');
  });
});
