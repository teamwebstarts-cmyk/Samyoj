import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import prisma from '../../config/database';
import {
  dispatchInstagramWebhookFields,
  dispatchPageWebhookFields,
  isOwnInstagramComment,
  parseJsonPreservingLargeIds,
} from '../whatsapp/webhook-dispatcher';
import { ingestInstagramTextMessage, instagramContactPhone, instagramWindowOpen } from './ingest';
import {
  COMMENT_PAGE_SIZE,
  ingestInstagramComment,
  instagramCommentListWhere,
  privateReplyOpen,
  sendPrivateReplyForComment,
  shouldSkipCommentKeywordAutomation,
} from './comment-ingest';
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
    instagramComment: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
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
    replyToInstagramComment: vi.fn().mockResolvedValue(undefined),
    sendInstagramTextMessage: vi.fn().mockResolvedValue({ messageId: 'mid.out' }),
    hideInstagramComment: vi.fn(),
    fetchInstagramComment: vi.fn().mockResolvedValue(null),
    listInstagramMediaIds: vi.fn().mockResolvedValue({ ids: [] }),
    listMediaComments: vi.fn().mockResolvedValue({ comments: [] }),
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
    commentMock.updateMany.mockResolvedValue({ count: 1 } as never);
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

  it('counts unmatched Instagram DMs when no Channel exists', async () => {
    channelMock.findMany.mockResolvedValue([] as never);
    const result = await dispatchInstagramWebhookFields(igMessageFixture());
    expect(result.claimed).toBe(0);
    expect(result.unmatched).toBe(1);
    expect(conversationMock.create).not.toHaveBeenCalled();
  });

  it('skips Instagram DM echoes without creating a thread', async () => {
    channelMock.findMany.mockResolvedValue([
      { id: 'ch_ig', organizationId: 'org_1', accessToken: 'enc:tok' },
    ] as never);
    const payload = igMessageFixture();
    (payload.entry[0].messaging[0].message as { is_echo?: boolean }).is_echo = true;
    const result = await dispatchInstagramWebhookFields(payload);
    expect(result.claimed).toBe(0);
    expect(result.unmatched).toBe(0);
    expect(conversationMock.create).not.toHaveBeenCalled();
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

  it('numeric Instagram comment ids are stored against the connected account', async () => {
    const raw = `{
      "object": "instagram",
      "entry": [{
        "id": 17841424744855401,
        "time": 1700000000,
        "changes": [{
          "field": "comments",
          "value": {
            "id": 18074865634493149,
            "text": "hiii",
            "from": { "id": 496274539931542, "username": "nirbhay_hiwse" },
            "media": { "id": 18030876632058880 }
          }
        }]
      }]
    }`;
    const payload = parseJsonPreservingLargeIds(raw);
    expect((payload.entry as Array<{ id: string }>)[0].id).toBe('17841424744855401');

    channelMock.findMany.mockResolvedValue([
      { id: 'ch_ig', organizationId: 'org_1', accessToken: 'enc:tok' },
    ] as never);
    commentMock.findUnique.mockResolvedValue(null as never);
    commentMock.create.mockResolvedValue({ id: 'row_num', igCommentId: '18074865634493149' } as never);

    const result = await dispatchInstagramWebhookFields(payload);
    expect(result.claimed).toBe(1);
    expect(result.unmatched).toBe(0);
    expect(commentMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          igCommentId: '18074865634493149',
          igMediaId: '18030876632058880',
          fromId: '496274539931542',
          fromUsername: 'nirbhay_hiwse',
          text: 'hiii',
        }),
      })
    );
  });

  it('keeps a customer comment when Meta sets from.id to the business account id', async () => {
    const raw = `{
      "object": "instagram",
      "entry": [{
        "id": "17841424744855401",
        "time": 1700000000,
        "changes": [{
          "field": "comments",
          "value": {
            "id": "18074865634493149",
            "text": "hiiii test",
            "from": { "id": "17841424744855401", "username": "nirbhay_hiwse" },
            "media": { "id": "18030876632058880" }
          }
        }]
      }]
    }`;
    channelMock.findMany.mockResolvedValue([
      { id: 'ch_ig', organizationId: 'org_1', accessToken: 'enc:tok', name: 'teamsamyoj' },
    ] as never);
    commentMock.findUnique.mockResolvedValue(null as never);
    commentMock.create.mockResolvedValue({ id: 'row_customer', igCommentId: '18074865634493149' } as never);

    const result = await dispatchInstagramWebhookFields(parseJsonPreservingLargeIds(raw));
    expect(result.claimed).toBe(1);
    expect(commentMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fromUsername: 'nirbhay_hiwse',
          text: 'hiiii test',
        }),
      })
    );
  });

  it('still skips a comment the connected account wrote itself', async () => {
    const raw = `{
      "object": "instagram",
      "entry": [{
        "id": "17841424744855401",
        "changes": [{
          "field": "comments",
          "value": {
            "id": "18074865634493150",
            "text": "ff",
            "from": { "id": "17841424744855401", "username": "teamsamyoj" }
          }
        }]
      }]
    }`;
    channelMock.findMany.mockResolvedValue([
      { id: 'ch_ig', organizationId: 'org_1', accessToken: 'enc:tok', name: 'teamsamyoj' },
    ] as never);

    const result = await dispatchInstagramWebhookFields(parseJsonPreservingLargeIds(raw));
    expect(result.claimed).toBe(0);
    expect(commentMock.create).not.toHaveBeenCalled();
    expect(isOwnInstagramComment({
      fromId: '17841424744855401',
      entryId: '17841424744855401',
      fromUsername: 'nirbhay_hiwse',
      businessUsername: 'teamsamyoj',
    })).toBe(false);
  });

  it('looks up a comment when Meta omits the username and the id matches the business', async () => {
    const { fetchInstagramComment } = await import('../facebook/page-client');
    vi.mocked(fetchInstagramComment).mockResolvedValueOnce({
      id: '18074865634493149',
      text: 'hiiii test',
      username: 'nirbhay_hiwse',
    });
    const raw = `{
      "object": "instagram",
      "entry": [{
        "id": "17841424744855401",
        "changes": [{
          "field": "comments",
          "value": {
            "id": "18074865634493149",
            "text": "",
            "from": { "id": "17841424744855401" }
          }
        }]
      }]
    }`;
    channelMock.findMany.mockResolvedValue([
      { id: 'ch_ig', organizationId: 'org_1', accessToken: 'enc:tok', name: 'teamsamyoj' },
    ] as never);
    commentMock.findUnique.mockResolvedValue(null as never);
    commentMock.create.mockResolvedValue({ id: 'row_lookup', igCommentId: '18074865634493149' } as never);

    const result = await dispatchInstagramWebhookFields(parseJsonPreservingLargeIds(raw));
    expect(result.claimed).toBe(1);
    expect(commentMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ fromUsername: 'nirbhay_hiwse', text: 'hiiii test' }),
      })
    );
  });

  it('plain JSON.parse loses the Instagram account id; the preserving parser does not', () => {
    const raw = '{"id":17841424744855401}';
    expect(String(JSON.parse(raw).id)).not.toBe('17841424744855401');
    expect(parseJsonPreservingLargeIds(raw).id).toBe('17841424744855401');
  });

  it('IG comment webhook does not create a Page Messenger thread', async () => {
    channelMock.findMany.mockResolvedValue([
      { id: 'ch_ig', organizationId: 'org_1', accessToken: 'enc:tok' },
    ] as never);
    commentMock.findUnique.mockResolvedValue(null as never);
    commentMock.create.mockResolvedValue({ id: 'row_1', igCommentId: 'cmt_1' } as never);

    const result = await dispatchInstagramWebhookFields(igCommentFixture());
    expect(result.claimed).toBe(1);
    expect(commentMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ commentedAt: new Date(1_700_000_000 * 1000) }),
      })
    );
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

  it('OAuth asks IG message scope and holds comments until Meta approves them', async () => {
    const oauth = readFileSync(join(__dirname, '../facebook/connect-oauth-state.ts'), 'utf8');
    const scopes = oauth.slice(oauth.indexOf('FACEBOOK_PAGE_LEADGEN_SCOPES'), oauth.indexOf('.join'));
    expect(scopes).toContain('instagram_manage_messages');
    expect(scopes).not.toContain('instagram_manage_comments');
    expect(oauth).toContain('instagram_manage_comments');
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
      .mockResolvedValueOnce({ parentPageId: 'page_1' } as never)
      .mockResolvedValueOnce({ platformAccountId: 'page_1', accessToken: 'enc:page' } as never);
    commentMock.update.mockResolvedValue({} as never);
    identityMock.findUnique.mockResolvedValue(null as never);
    contactMock.create.mockResolvedValue({ id: 'ct_ig' } as never);
    identityMock.create.mockResolvedValue({} as never);
    conversationMock.findFirst.mockResolvedValue(null as never);
    conversationMock.create.mockResolvedValue({ id: 'conv_pr', unreadCount: 0 } as never);
    messageMock.findUnique.mockResolvedValue(null as never);
    messageMock.create.mockResolvedValue({ id: 'msg_pr', direction: 'OUTBOUND' } as never);
    conversationMock.update.mockResolvedValue({ id: 'conv_pr' } as never);
    contactMock.findUnique.mockResolvedValue({ id: 'ct_ig', name: 'buyer', phone: 'instagram:igsid_1' } as never);

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
    const { replyToInstagramComment } = await import('../facebook/page-client');
    expect(replyToInstagramComment).not.toHaveBeenCalled();
    expect(conversationMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ channelId: 'ch_ig', whatsappNumberId: null }),
      })
    );
    expect(messageMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ direction: 'OUTBOUND', content: 'ig-reply', status: 'SENT' }),
      })
    );
  });

  it('keyword with only a public reply does not send a DM', async () => {
    const { replyToInstagramComment, sendInstagramPrivateReply } = await import('../facebook/page-client');
    commentMock.findUnique.mockResolvedValue(null as never);
    commentMock.create.mockResolvedValue({ id: 'row_pub', igCommentId: 'cmt_pub', commentedAt: new Date() } as never);
    automationMock.findMany.mockResolvedValue([
      { triggerType: 'KEYWORD', config: { platform: 'IG', keyword: 'PRICE', publicMessage: 'Check your DMs' } },
    ] as never);
    commentMock.findFirst.mockResolvedValue({
      id: 'row_pub',
      igCommentId: 'cmt_pub',
      publicReplySentAt: null,
    } as never);
    channelMock.findFirst
      .mockResolvedValueOnce({ parentPageId: 'page_1' } as never)
      .mockResolvedValueOnce({ platformAccountId: 'page_1', accessToken: 'enc:page' } as never);

    const stored = await ingestInstagramComment({
      organizationId: 'org_1',
      channelId: 'ch_ig',
      igCommentId: 'cmt_pub',
      text: 'PRICE please',
    });
    expect(stored.automationSent).toBe(true);
    expect(replyToInstagramComment).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'Check your DMs', commentId: 'cmt_pub' })
    );
    expect(sendInstagramPrivateReply).not.toHaveBeenCalled();
  });

  it('skips keyword automation when the same author was replied to on this post within 24h', async () => {
    commentMock.findUnique.mockResolvedValue(null as never);
    commentMock.create.mockResolvedValue({
      id: 'row_2',
      igCommentId: 'cmt_2',
      commentedAt: new Date(),
    } as never);
    commentMock.findFirst.mockResolvedValue({
      id: 'row_1',
      privateReplySentAt: new Date(),
    } as never);

    const stored = await ingestInstagramComment({
      organizationId: 'org_1',
      channelId: 'ch_ig',
      igCommentId: 'cmt_2',
      igMediaId: 'media_1',
      fromId: 'igsid_1',
      text: 'PRICE again',
    });
    expect(stored.created).toBe(true);
    expect(stored.automationSent).toBe(false);
    expect(automationMock.findMany).not.toHaveBeenCalled();
  });

  it('runs keyword automation again when the last reply is outside 24h', async () => {
    commentMock.findUnique.mockResolvedValue(null as never);
    commentMock.create.mockResolvedValue({
      id: 'row_3',
      igCommentId: 'cmt_3',
      commentedAt: new Date(),
    } as never);
    commentMock.findFirst.mockResolvedValue(null as never);
    automationMock.findMany.mockResolvedValue([] as never);

    const stored = await ingestInstagramComment({
      organizationId: 'org_1',
      channelId: 'ch_ig',
      igCommentId: 'cmt_3',
      igMediaId: 'media_1',
      fromId: 'igsid_1',
      text: 'PRICE again',
    });
    expect(stored.created).toBe(true);
    expect(automationMock.findMany).toHaveBeenCalled();
    expect(stored.automationSent).toBe(false);
  });

  it('shouldSkipCommentKeywordAutomation is false without a prior row', async () => {
    commentMock.findFirst.mockResolvedValue(null as never);
    const skip = await shouldSkipCommentKeywordAutomation({
      organizationId: 'org_1',
      channelId: 'ch_ig',
      igMediaId: 'media_1',
      fromId: 'igsid_1',
      excludeCommentId: 'row_new',
    });
    expect(skip).toBe(false);
  });

  it('only treats a reply from the last 24h as a repeat', async () => {
    commentMock.findFirst.mockResolvedValue(null as never);
    const now = new Date('2026-10-23T12:00:00.000Z');
    await shouldSkipCommentKeywordAutomation({
      organizationId: 'org_1',
      channelId: 'ch_ig',
      igMediaId: 'media_1',
      fromId: 'igsid_1',
      excludeCommentId: 'row_new',
      now,
    });
    expect(commentMock.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { privateReplySentAt: { gte: new Date('2026-10-22T12:00:00.000Z') } },
            { publicReplySentAt: { gte: new Date('2026-10-22T12:00:00.000Z') } },
          ],
        }),
      })
    );
  });

  it('keyword with both texts posts on the comment and sends a DM', async () => {
    const { replyToInstagramComment, sendInstagramPrivateReply } = await import('../facebook/page-client');
    commentMock.findUnique.mockResolvedValue(null as never);
    commentMock.create.mockResolvedValue({ id: 'row_both', igCommentId: 'cmt_both', commentedAt: new Date() } as never);
    automationMock.findMany.mockResolvedValue([
      {
        triggerType: 'KEYWORD',
        config: { platform: 'IG', keyword: 'PRICE', message: '₹999', publicMessage: 'Check your DMs' },
      },
    ] as never);
    commentMock.findFirst.mockResolvedValue({
      id: 'row_both',
      igCommentId: 'cmt_both',
      commentedAt: new Date(),
      publicReplySentAt: null,
      privateReplySentAt: null,
    } as never);
    channelMock.findFirst.mockResolvedValue({
      parentPageId: 'page_1',
      platformAccountId: 'page_1',
      accessToken: 'enc:page',
    } as never);
    identityMock.findUnique.mockResolvedValue({ contactId: 'ct_ig' } as never);
    conversationMock.findFirst.mockResolvedValue({ id: 'conv_pr', unreadCount: 0 } as never);
    messageMock.findUnique.mockResolvedValue(null as never);
    messageMock.create.mockResolvedValue({ id: 'msg_pr' } as never);
    conversationMock.update.mockResolvedValue({ id: 'conv_pr' } as never);
    contactMock.findUnique.mockResolvedValue({ id: 'ct_ig' } as never);

    const stored = await ingestInstagramComment({
      organizationId: 'org_1',
      channelId: 'ch_ig',
      igCommentId: 'cmt_both',
      text: 'PRICE',
    });
    expect(stored.automationSent).toBe(true);
    expect(replyToInstagramComment).toHaveBeenCalled();
    expect(sendInstagramPrivateReply).toHaveBeenCalledWith(
      expect.objectContaining({ text: '₹999' })
    );
  });

  it('rejects a second public reply on the same comment', async () => {
    const { replyToInstagramComment } = await import('../facebook/page-client');
    const { sendPublicReplyForComment } = await import('./comment-ingest');
    commentMock.findFirst.mockResolvedValue({
      id: 'row_pub',
      publicReplySentAt: new Date(),
    } as never);
    const second = await sendPublicReplyForComment({
      organizationId: 'org_1',
      channelId: 'ch_ig',
      commentRowId: 'row_pub',
      igCommentId: 'cmt_pub',
      text: 'again',
    });
    expect(second.ok).toBe(false);
    expect(replyToInstagramComment).not.toHaveBeenCalled();
  });

  it('history sync stores comments and does not auto-reply', async () => {
    const { listInstagramMediaIds, listMediaComments, sendInstagramPrivateReply } = await import('../facebook/page-client');
    vi.mocked(listInstagramMediaIds).mockResolvedValue({ ids: ['media_1'] });
    vi.mocked(listMediaComments).mockResolvedValue({
      comments: [{ id: 'cmt_old', text: 'PRICE please', username: 'buyer' }],
    });
    commentMock.findUnique.mockResolvedValue(null as never);
    commentMock.create.mockResolvedValue({ id: 'row_old', igCommentId: 'cmt_old' } as never);
    automationMock.findMany.mockResolvedValue([
      { triggerType: 'KEYWORD', config: { platform: 'IG', keyword: 'PRICE', message: 'ig-reply' } },
    ] as never);

    const { syncInstagramComments } = await import('./comment-sync');
    const result = await syncInstagramComments({
      organizationId: 'org_1',
      channelId: 'ch_ig',
      igUserId: 'ig_biz_1',
      pageAccessToken: 'page-token',
      businessUsername: 'teamsamyoj',
      maxMedia: 5,
      maxScan: 20,
    });
    expect(result.inserted).toBe(1);
    expect(sendInstagramPrivateReply).not.toHaveBeenCalled();
    const { replyToInstagramComment } = await import('../facebook/page-client');
    expect(replyToInstagramComment).not.toHaveBeenCalled();
    expect(commentMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ igCommentId: 'cmt_old', text: 'PRICE please' }),
      })
    );
  });

  it('comment list pages 25 at a time and filters need-reply on the server', () => {
    expect(COMMENT_PAGE_SIZE).toBe(25);
    const now = new Date('2026-09-26T12:00:00.000Z');
    const open = instagramCommentListWhere({
      organizationId: 'org_1',
      channelId: 'ch_ig',
      status: 'open',
      now,
    });
    expect(open.hidden).toBe(false);
    expect(open.privateReplySentAt).toBeNull();
    const retentionCutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const privateReplyCutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    expect(open.commentedAt).toEqual({
      gte: new Date(Math.max(retentionCutoff.getTime(), privateReplyCutoff.getTime())),
    });
    const sent = instagramCommentListWhere({
      organizationId: 'org_1',
      channelId: 'ch_ig',
      status: 'sent',
    });
    expect(sent.privateReplySentAt).toEqual({ not: null });
  });

  it('comments delete route is registered before :id handlers', () => {
    const src = readFileSync(join(__dirname, 'comments.routes.ts'), 'utf8');
    const deleteAt = src.indexOf("'/delete'");
    const replyAt = src.indexOf("'/:id/private-reply'");
    expect(deleteAt).toBeGreaterThan(-1);
    expect(replyAt).toBeGreaterThan(deleteAt);
  });

  it('subscribes post comments even when live comments are rejected', async () => {
    const { subscribeInstagramAccount } = await import('../facebook/page-client');
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    const ok = () => Promise.resolve(new Response(JSON.stringify({ success: true }), { status: 200 }));
    const denied = () =>
      Promise.resolve(new Response(JSON.stringify({ error: { message: '(#3) no live', code: 3 } }), { status: 400 }));
    fetchMock.mockImplementationOnce(ok).mockImplementationOnce(denied);
    await expect(subscribeInstagramAccount('17841424744855401', 'page-token')).resolves.toBeUndefined();
    const firstBody = String(fetchMock.mock.calls[0]?.[1] && (fetchMock.mock.calls[0][1] as RequestInit).body);
    const secondBody = String(fetchMock.mock.calls[1]?.[1] && (fetchMock.mock.calls[1][1] as RequestInit).body);
    expect(firstBody).toContain('messages%2Ccomments');
    expect(firstBody).not.toContain('live_comments');
    expect(secondBody).toContain('live_comments');
    fetchMock.mockRestore();
  });
});
