import { readFileSync } from 'fs';
import { join } from 'path';

export type Verdict = 'done' | 'remaining' | 'out' | 'live_unproven';

export type ScoreItem = {
  id: string;
  title: string;
  verdict: Verdict;
  files: string[];
  must?: string[];
  mustNot?: string[];
};

const root = join(__dirname, '../../../..');

function read(rel: string): string {
  return readFileSync(join(root, rel), 'utf8');
}

export const AUDIT_SCORE: ScoreItem[] = [
  {
    id: 'FB-text',
    title: 'Messenger text send/list',
    verdict: 'done',
    files: ['server/src/modules/facebook/messenger-inbox.routes.ts'],
    must: ["sendPageTextMessage", "'/:id/messages'"],
  },
  {
    id: 'IG-text',
    title: 'Instagram DM text send/list',
    verdict: 'done',
    files: ['server/src/modules/instagram/inbox.routes.ts'],
    must: ['sendInstagramTextMessage', "'/:id/messages'"],
  },
  {
    id: 'SAMYOJ-002',
    title: 'Outgoing mark_seen on open',
    verdict: 'done',
    files: [
      'server/src/modules/facebook/page-client.ts',
      'server/src/modules/facebook/channel-inbox-actions.ts',
    ],
    must: ["sender_action: 'mark_seen'", 'markConversationSeen'],
  },
  {
    id: 'SAMYOJ-003',
    title: 'Canned replies in FB/IG composer',
    verdict: 'done',
    files: ['client/src/pages/FacebookInboxPage.tsx', 'client/src/pages/InstagramInboxPage.tsx'],
    must: ['cannedReplies={cannedReplies}'],
  },
  {
    id: 'SAMYOJ-007',
    title: 'Labels on FB/IG chats',
    verdict: 'done',
    files: [
      'server/src/modules/facebook/channel-inbox-actions.ts',
      'client/src/pages/FacebookInboxPage.tsx',
      'client/src/pages/InstagramInboxPage.tsx',
    ],
    must: ["'/:id/labels'", 'onAddLabel'],
  },
  {
    id: 'SAMYOJ-009',
    title: 'Snooze FB/IG chats',
    verdict: 'done',
    files: [
      'server/src/modules/facebook/channel-inbox-actions.ts',
      'client/src/pages/FacebookInboxPage.tsx',
      'client/src/pages/InstagramInboxPage.tsx',
    ],
    must: ["'/:id/snooze'", 'onSnooze'],
  },
  {
    id: 'SAMYOJ-012-keyword',
    title: 'Keyword auto-reply on FB/IG DMs',
    verdict: 'done',
    files: [
      'server/src/modules/facebook/channel-keyword.ts',
      'server/src/modules/whatsapp/webhook-dispatcher.ts',
    ],
    must: ['sendChannelKeywordReply', "platform: 'FB'", "platform: 'IG'"],
  },
  {
    id: 'SAMYOJ-015',
    title: 'Export FB/IG chat',
    verdict: 'done',
    files: [
      'server/src/modules/facebook/channel-inbox-actions.ts',
      'client/src/pages/FacebookInboxPage.tsx',
      'client/src/pages/InstagramInboxPage.tsx',
    ],
    must: ["'/:id/export'", 'exportChat'],
  },
  {
    id: 'SAMYOJ-016',
    title: 'Delete FB/IG conversation',
    verdict: 'done',
    files: ['server/src/modules/facebook/channel-inbox-actions.ts'],
    must: ['deleteConversationKeepingHistory'],
  },
  {
    id: 'SAMYOJ-018',
    title: 'Mark unread',
    verdict: 'done',
    files: ['server/src/modules/facebook/channel-inbox-actions.ts'],
    must: ["'/:id/unread'", 'nextUnreadCount'],
  },
  {
    id: 'SAMYOJ-019',
    title: 'Favorite',
    verdict: 'done',
    files: [
      'server/src/modules/facebook/channel-inbox-actions.ts',
      'client/src/pages/FacebookInboxPage.tsx',
      'client/src/pages/InstagramInboxPage.tsx',
    ],
    must: ["'/:id/favorite'", 'onFavorite'],
    mustNot: ['hideFavorite'],
  },
  {
    id: 'SAMYOJ-020',
    title: 'Search inside FB/IG thread',
    verdict: 'done',
    files: ['client/src/pages/FacebookInboxPage.tsx', 'client/src/pages/InstagramInboxPage.tsx'],
    must: ['SearchInChatBar'],
  },
  {
    id: 'SAMYOJ-042',
    title: 'Facebook connect error is not a WhatsApp string replace',
    verdict: 'done',
    files: ['client/src/pages/FacebookCallbackPage.tsx'],
    mustNot: ['.replace(/\\bWhatsApp\\b/g, \'Facebook\')'],
  },
  {
    id: 'ADS-readonly',
    title: 'Ads insights are read-only ads_read',
    verdict: 'done',
    files: [
      'server/src/modules/facebook/connect-oauth-state.ts',
      'server/src/modules/facebook/ads-insights.ts',
      'client/src/pages/FacebookAdsPage.tsx',
    ],
    must: ['ads_read', 'never creates or pauses an ad'],
    mustNot: ['ads_management'],
  },
  {
    id: 'IG-comments',
    title: 'IG comment list/hide/private-reply/keyword',
    verdict: 'done',
    files: [
      'server/src/modules/instagram/comments.routes.ts',
      'server/src/modules/instagram/comment-ingest.ts',
    ],
    must: ['private-reply', 'maybeSendCommentKeywordReply'],
  },
  {
    id: 'SAMYOJ-001-media',
    title: 'Send image/file from FB/IG composer',
    verdict: 'done',
    files: [
      'server/src/modules/facebook/page-client.ts',
      'server/src/modules/facebook/channel-inbox-actions.ts',
      'client/src/pages/FacebookInboxPage.tsx',
      'client/src/pages/InstagramInboxPage.tsx',
    ],
    must: ['httpsMediaUrl', 'deliverChannelMedia', 'onAttach'],
  },
  {
    id: 'SAMYOJ-004-006',
    title: 'Messenger quick/list/template cards',
    verdict: 'out',
    files: [],
  },
  {
    id: 'SAMYOJ-008',
    title: 'Bulk select FB/IG chats',
    verdict: 'done',
    files: [
      'server/src/modules/facebook/channel-inbox-actions.ts',
      'client/src/pages/FacebookInboxPage.tsx',
      'client/src/pages/InstagramInboxPage.tsx',
    ],
    must: ["'/bulk'", 'selectionMode'],
  },
  {
    id: 'SAMYOJ-010',
    title: 'AI bot on FB/IG DMs',
    verdict: 'done',
    files: [
      'server/src/modules/ai/chatbot.service.ts',
      'server/src/modules/facebook/channel-keyword.ts',
      'client/src/pages/FacebookInboxPage.tsx',
    ],
    must: ['conversation!.channelId && conversation!.botActive', 'generateBotReply', 'setBot'],
  },
  {
    id: 'SAMYOJ-011',
    title: 'Flow engine on FB/IG DMs',
    verdict: 'remaining',
    files: [],
  },
  {
    id: 'SAMYOJ-012-engine',
    title: 'Channel text rules beyond keyword',
    verdict: 'done',
    files: ['server/src/modules/facebook/channel-keyword.ts'],
    must: ["triggerType === 'WELCOME'", "triggerType === 'AWAY'"],
  },
  {
    id: 'ADS-live',
    title: 'Ads tiles match Ads Manager on a live account',
    verdict: 'live_unproven',
    files: ['docs/meta-ecosystem/phases/05-ads-read.md'],
  },
  {
    id: 'ADS-create',
    title: 'Create or pause ads',
    verdict: 'out',
    files: ['docs/meta-ecosystem/phases/05-ads-read.md'],
  },
  {
    id: 'ADS-unique',
    title: 'One MetaAdsSnapshot per org (matches one selected account)',
    verdict: 'out',
    files: ['server/prisma/schema.prisma', 'server/src/modules/facebook/ads-insights.ts'],
    must: ['organizationId   String   @unique'],
  },
  {
    id: 'IG-stories',
    title: 'Instagram Stories inbox',
    verdict: 'out',
    files: [],
  },
  {
    id: 'IG-publish',
    title: 'Instagram post/story publishing',
    verdict: 'out',
    files: [],
  },
  {
    id: 'LEAD-live',
    title: 'Live Instant Form → Lead row',
    verdict: 'live_unproven',
    files: ['docs/meta-ecosystem/phases/01-lead-ads.md'],
  },
];

export function scoreAudit(items = AUDIT_SCORE) {
  const counts = { done: 0, remaining: 0, out: 0, live_unproven: 0 };
  const failures: string[] = [];

  for (const item of items) {
    counts[item.verdict] += 1;
    if (item.verdict !== 'done' && item.verdict !== 'out') continue;
    const body = item.files.map(read).join('\n');
    for (const needle of item.must || []) {
      if (!body.includes(needle)) failures.push(`${item.id} missing ${needle}`);
    }
    for (const needle of item.mustNot || []) {
      if (body.includes(needle)) failures.push(`${item.id} still has ${needle}`);
    }
  }

  return { counts, failures, line: `SCORE done=${counts.done} remaining=${counts.remaining} out=${counts.out} live_unproven=${counts.live_unproven}` };
}
