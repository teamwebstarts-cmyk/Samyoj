# Gates: Inbox 24h window Active / Inactive

OWNS: client/src/components/inbox/InboxListHeader.tsx, client/src/utils/inboxListParams.ts, client/src/utils/inboxListParams.test.ts, client/src/pages/InboxPage.tsx, client/src/components/inbox/useConversationList.ts, client/src/components/inbox/useInboxNumberCache.ts, server/src/modules/inbox/routes.ts, server/src/modules/inbox/service-window.ts, server/src/modules/inbox/service-window.test.ts

Scope: Header Active / Inactive (24h CSW) next to New chat. No Can reply / Needs template chips. Keep CRM Open/Pending chips.

- [x] G1: Active/Inactive map to window=open|closed and server filters cs24hWindowOpensAt
  CHECK: node .unlazy/growth-surfaces-impl-2026-08-29/scripts/verify-impl.mjs --leaf 1.1.4
  EXPECT: growth-surfaces impl verification passed
  CWD: /workspaces/Samyoj
