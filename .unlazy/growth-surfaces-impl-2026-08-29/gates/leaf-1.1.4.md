# Gates: Inbox 24h window chips

OWNS: client/src/components/inbox/InboxListHeader.tsx, client/src/utils/inboxListParams.ts, client/src/utils/inboxListParams.test.ts, server/src/modules/inbox/routes.ts, server/src/modules/inbox/service-window.ts, server/src/modules/inbox/service-window.test.ts

Scope: Add Can reply / Needs template chips filtered on the server by cs24hWindowOpensAt. Keep CRM Open/Pending.

- [x] G1: chips map to window=open|closed and server filters cs24hWindowOpensAt
  CHECK: node .unlazy/growth-surfaces-impl-2026-08-29/scripts/verify-impl.mjs --leaf 1.1.4
  EXPECT: growth-surfaces impl verification passed
  CWD: /workspaces/Samyoj
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=6edb1355a1f7/42 entries; output=OK include server/src/modules/inbox/service-window.ts | growth-surfaces impl verification passed
