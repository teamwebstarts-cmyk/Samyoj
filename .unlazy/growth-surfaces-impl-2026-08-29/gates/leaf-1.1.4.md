# Gates: Inbox 24h window chips

OWNS: client/src/components/inbox/InboxListHeader.tsx, client/src/utils/inboxListParams.ts, client/src/utils/inboxListParams.test.ts, server/src/modules/inbox/routes.ts, server/src/modules/inbox/service-window.ts, server/src/modules/inbox/service-window.test.ts

Scope: Add Can reply / Needs template chips filtered on the server by cs24hWindowOpensAt. Keep CRM Open/Pending.

- [ ] G1: chips map to window=open|closed and server filters cs24hWindowOpensAt
  CHECK: node .unlazy/growth-surfaces-impl-2026-08-29/scripts/verify-impl.mjs --leaf 1.1.4
  EXPECT: growth-surfaces impl verification passed
  EVIDENCE: pending
