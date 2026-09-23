import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import prisma from '../../config/database';
import { dispatchInstagramWebhookFields, dispatchPageWebhookFields } from '../whatsapp/webhook-dispatcher';
import { ingestInstagramTextMessage, instagramContactPhone, instagramWindowOpen } from './ingest';
import { ingestInstagramComment, privateReplyOpen, sendPrivateReplyForComment } from './comment-ingest';
import { CUSTOMER_SERVICE_WINDOW_MS } from '../inbox/service-window';

vi.mock('../../config/database', () => ({
  default: {
    channel: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
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
    instagramComment: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    automation: { findMany: vi.fn() },
    lead: { findFirst: vi.fn(), create: vi.fn() },
    whatsappNumber: { findMany: vi.fn(), findFirst: vi.fn() },
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
    decryptToken: vi.fn(() => 'page-token'),
    encryptToken: vi.fn((t: string) => `enc:${t}`),
  },
}));
vi.mock('../facebook/page-client', async () => {
  const actual = await vi.importActual<typeof import('../facebook/page-client')>('../facebook/page-client');
  return {
    ...actual,
    sendInstagramPrivateReply: vi.fn().mockResolvedValue({ messageId: 'mid.pr', recipientId: 'igsid_1' }),
    sendInstagramTextMessage: vi.fn().mockResolvedValue({ messageId: 'mid.out' }),
    hideInstagramComment: vi.fn(),
  };
});

const channelMock = vi.mocked(prisma.channel);
const identityMock = vi.mocked(prisma.contactPlatformIdentity);
const contactMock = vi.mocked(prisma.contact);
const conversationMock = vi.mocked(prisma.conversation);
const messageMock = vi.mocked(prisma.message);
const commentMock = vi.mocked(prisma.instagramComment);
const automationMock = vi.mocked(prisma.automation);
const events = vi.mocked(prisma.providerWebhookEvent);

function igMessageFixture(igsid = 'igsid_1', mid = 'mid_ig_1', text = 'Hello IG') {
  return {
    object: 'instagram',
    entry: [
      {
        id: 'ig_biz_1',
        time: 1_700_000_000,
        messaging: [
          {
            sender: { id: igsid },
            recipient: { id: 'ig_biz_1' },
            timestamp: 1_700_000_000_000,
            message: { mid, text },
          },
        ],
      },
    ],
  };
}

function igCommentFixture(commentId = 'cmt_1', text = 'PRICE please') {
  return {
    object: 'instagram',
    entry: [
      {
        id: 'ig_biz_1',
        time: 1_700_000_000,
        changes: [
          {
            field: 'comments',
            value: {
              id: commentId,
              text,
              from: { id: 'igsid_1', username: 'buyer' },
              media: { id: 'media_1' },
            },
          },
        ],
      },
    ],
  };
}

describe('Phase 4 Instagram', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    events.create.mockResolvedValue({} as never);
    events.findUnique.mockResolvedValue(null as never);
    events.updateMany.mockResolvedValue({ count: 1 } as never);
    automationMock.findMany.mockResolvedValue([] as never);
  });

  it('IG DM creates an IG-scoped thread, not WhatsApp or Messenger', async () => {
    channelMock.findMany.mockResolvedValue([
      { id: 'ch_ig', organizationId: 'org_1', accessToken: 'enc:tok' },
    ] as never);
    identityMock.findUnique.mockResolvedValue(null as never);
    contactMock.create.mockResolvedValue({ id: 'ct_ig' } as never);
    identityMock.create.mockResolvedValue({} as never);
    conversationMock.findFirst.mockResolvedValue(null as never);
    conversationMock.create.mockResolvedValue({ id: 'conv_ig', unreadCount: 0 } as never);
    messageMock.findUnique.mockResolvedValue(null as never);
    messageMock.create.mockResolvedValue({
      id: 'msg_ig',
      conversationId: 'conv_ig',
      direction: 'INBOUND',
      content: 'Hello IG',
    } as never);
    conversationMock.update.mockResolvedValue({
      id: 'conv_ig',
      lastMessageAt: new Date(),
      unreadCount: 1,
      channelId: 'ch_ig',
    } as never);
    contactMock.findUnique.mockResolvedValue({
      id: 'ct_ig',
      name: 'Instagram 1',
      phone: instagramContactPhone('igsid_1'),
    } as never);

    const result = await dispatchInstagramWebhookFields(igMessageFixture());
    expect(result.claimed).toBe(1);
    expect(conversationMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          channelId: 'ch_ig',
          whatsappNumberId: null,
        }),
      })
    );
    expect(identityMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ platform: 'IG', externalId: 'igsid_1' }),
      })
    );
  });

  it('same IGSID twice → one thread', async () => {
    identityMock.findUnique.mockResolvedValue({ contactId: 'ct_ig' } as never);
    conversationMock.findFirst
      .mockResolvedValueOnce(null as never)
      .mockResolvedValueOnce({ id: 'conv_ig', unreadCount: 1 } as never);
    conversationMock.create.mockResolvedValue({ id: 'conv_ig', unreadCount: 0 } as never);
    messageMock.findUnique.mockResolvedValue(null as never);
    messageMock.create
      .mockResolvedValueOnce({ id: 'msg_1', conversationId: 'conv_ig' } as never)
      .mockResolvedValueOnce({ id: 'msg_2', conversationId: 'conv_ig' } as never);
    conversationMock.update.mockResolvedValue({
      id: 'conv_ig',
      lastMessageAt: new Date(),
      unreadCount: 2,
      channelId: 'ch_ig',
    } as never);
    contactMock.findUnique.mockResolvedValue({ id: 'ct_ig', name: 'I', phone: 'instagram:igsid_1' } as never);

    const first = await ingestInstagramTextMessage({
      organizationId: 'org_1',
      channelId: 'ch_ig',
      igsid: 'igsid_1',
      text: 'hi',
      metaMessageId: 'mid_a',
    });
    const second = await ingestInstagramTextMessage({
      organizationId: 'org_1',
      channelId: 'ch_ig',
      igsid: 'igsid_1',
      text: 'again',
      metaMessageId: 'mid_b',
    });
    expect(first.conversationId).toBe('conv_ig');
    expect(second.conversationId).toBe('conv_ig');
    expect(conversationMock.create).toHaveBeenCalledTimes(1);
  });

  it('comment is not a Messenger/WA thread; second private reply is rejected', async () => {
    commentMock.findUnique.mockResolvedValue(null as never);
    commentMock.create.mockResolvedValue({
      id: 'row_1',
      igCommentId: 'cmt_1',
      commentedAt: new Date(),
    } as never);

    const stored = await ingestInstagramComment({
      organizationId: 'org_1',
      channelId: 'ch_ig',
      igCommentId: 'cmt_1',
      text: 'nice',
    });
    expect(stored.created).toBe(true);
    expect(conversationMock.create).not.toHaveBeenCalled();

    commentMock.findFirst.mockResolvedValue({
      id: 'row_1',
      igCommentId: 'cmt_1',
      commentedAt: new Date(),
      privateReplySentAt: new Date(),
    } as never);
    const second = await sendPrivateReplyForComment({
      organizationId: 'org_1',
      channelId: 'ch_ig',
      commentRowId: 'row_1',
      igCommentId: 'cmt_1',
      text: 'again',
    });
    expect(second.ok).toBe(false);
    expect(second.error).toMatch(/Waiting for them/);
  });

  it('IG comment webhook does not create a Page Messenger thread', async () => {
    channelMock.findMany.mockResolvedValue([
      { id: 'ch_ig', organizationId: 'org_1', accessToken: 'enc:tok' },
    ] as never);
    commentMock.findUnique.mockResolvedValue(null as never);
    commentMock.create.mockResolvedValue({ id: 'row_1', igCommentId: 'cmt_1' } as never);

    const result = await dispatchInstagramWebhookFields(igCommentFixture());
    expect(result.claimed).toBe(1);
    expect(conversationMock.create).not.toHaveBeenCalled();
    expect(messageMock.create).not.toHaveBeenCalled();
  });

  it('24h window matches Messenger; 7-day private reply is separate', () => {
    const now = new Date('2026-09-24T12:00:00.000Z');
    const openAt = new Date(now.getTime() - CUSTOMER_SERVICE_WINDOW_MS + 60_000);
    const closedAt = new Date(now.getTime() - CUSTOMER_SERVICE_WINDOW_MS - 60_000);
    expect(instagramWindowOpen(openAt, now)).toBe(true);
    expect(instagramWindowOpen(closedAt, now)).toBe(false);
    expect(privateReplyOpen(new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000), now)).toBe(true);
    expect(privateReplyOpen(new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000), now)).toBe(false);
  });

  it('OAuth asks IG comment/message scopes; Page dispatcher still ignores IG object', async () => {
    const oauth = readFileSync(join(__dirname, '../facebook/connect-oauth-state.ts'), 'utf8');
    expect(oauth).toContain('instagram_manage_comments');
    expect(oauth).toContain('instagram_manage_messages');
    const pageClient = readFileSync(join(__dirname, '../facebook/page-client.ts'), 'utf8');
    expect(pageClient).toContain('live_comments');
    const inbox = readFileSync(join(__dirname, 'inbox.routes.ts'), 'utf8');
    expect(inbox).toContain("platform: 'IG'");
    expect(inbox).toContain('req.query.q');
    expect(inbox).toContain('.max(1000)');
    expect(inbox).not.toContain('.max(2000)');
    expect(inbox).not.toContain('MetaWhatsAppService.sendMessage');
    expect(pageClient).not.toMatch(
      /sendInstagramTextMessage[\s\S]{0,400}messaging_type/
    );
    expect(pageClient).not.toMatch(
      /sendInstagramTextMessage[\s\S]{0,200}sendPageTextMessage/
    );
    channelMock.findMany.mockResolvedValue([] as never);
    const pageResult = await dispatchPageWebhookFields(igMessageFixture() as never);
    expect(pageResult.claimed).toBe(0);
  });

  it('comment keyword PRICE sends IG private reply, not a WhatsApp keyword', async () => {
    const { sendInstagramPrivateReply } = await import('../facebook/page-client');
    commentMock.findUnique.mockResolvedValue(null as never);
    commentMock.create.mockResolvedValue({
      id: 'row_kw',
      igCommentId: 'cmt_price',
      commentedAt: new Date(),
    } as never);
    automationMock.findMany.mockResolvedValue([
      { id: 'wa', config: { keyword: 'PRICE', message: 'wa-only' } },
      { id: 'ig', config: { platform: 'IG', keyword: 'PRICE', message: 'ig-reply' } },
    ] as never);
    commentMock.findFirst.mockResolvedValue({
      id: 'row_kw',
      igCommentId: 'cmt_price',
      commentedAt: new Date(),
      privateReplySentAt: null,
    } as never);
    channelMock.findFirst
      .mockResolvedValueOnce({ accessToken: 'enc:ig' } as never)
      .mockResolvedValueOnce({ platformAccountId: 'page_1', accessToken: 'enc:page' } as never);
    commentMock.update.mockResolvedValue({} as never);

    const stored = await ingestInstagramComment({
      organizationId: 'org_1',
      channelId: 'ch_ig',
      igCommentId: 'cmt_price',
      text: 'PRICE please',
    });
    expect(stored.automationSent).toBe(true);
    expect(sendInstagramPrivateReply).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'ig-reply', commentId: 'cmt_price' })
    );
    expect(conversationMock.create).not.toHaveBeenCalled();
  });
});
