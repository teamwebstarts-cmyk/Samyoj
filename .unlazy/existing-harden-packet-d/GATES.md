# Gates: Packet D duplicate send band

OWNS: server/prisma/schema.prisma, server/prisma/migrations/20260911140000_outbound_idempotency_key/migration.sql, server/src/modules/messages/outbound-idempotency.ts, server/src/modules/messages/outbound-idempotency.test.ts, server/src/modules/inbox/routes.ts, server/src/modules/messages/routes.ts, server/src/modules/messages/service.ts, server/src/modules/campaigns/routes.ts, server/src/errors/meta.ts, server/src/modules/whatsapp/meta.service.ts, server/src/modules/whatsapp/meta.service.send.test.ts, client/src/services/api.ts, docs/ROADMAP_CHECKLIST_HINGLISH_2026.md, docs/IMPLEMENTATION_PLAN_EXISTING_15D.md, .unlazy/existing-harden-packet-d/**

Scope: Idempotency-Key on Inbox + campaign send; Meta send timeout without blind retry; existing campaign claim tests stay green.

- [x] G1: same conversation Idempotency-Key replays one message
  CHECK: node .unlazy/existing-harden-packet-d/verify-packet-d.mjs --inbox
  EXPECT: packet-d-inbox-ok
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=e3a870e24ba1/42 entries; output=packet-d-inbox-ok

- [x] G2: Meta send aborts on timeout and does not retry; 429 still retries
  CHECK: node .unlazy/existing-harden-packet-d/verify-packet-d.mjs --meta
  EXPECT: packet-d-meta-ok
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=e3a870e24ba1/42 entries; output=packet-d-meta-ok

- [x] G3: client Inbox and campaign send attach Idempotency-Key; server routes read it
  CHECK: node .unlazy/existing-harden-packet-d/verify-packet-d.mjs --wired
  EXPECT: packet-d-wired-ok
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=e3a870e24ba1/42 entries; output=packet-d-wired-ok

- [x] G4: campaign claim/lease skip-retry tests still pass
  CHECK: node .unlazy/existing-harden-packet-d/verify-packet-d.mjs --campaign
  EXPECT: packet-d-campaign-ok
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=e3a870e24ba1/42 entries; output=packet-d-campaign-ok
