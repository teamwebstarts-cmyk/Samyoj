# Gates: Packet C webhook persist-then-ack

OWNS: server/prisma/schema.prisma, server/prisma/migrations/20260911150000_webhook_envelope_payload/migration.sql, server/src/modules/whatsapp/webhook-accept.ts, server/src/modules/whatsapp/webhook-accept.test.ts, server/src/modules/whatsapp/webhook-dispatcher.ts, server/src/modules/whatsapp/routes.ts, server/src/modules/whatsapp/route-hardening.test.ts, server/src/modules/whatsapp/webhook-health.ts, server/src/modules/whatsapp/webhook-health.test.ts, server/src/workers/webhook.processor.ts, server/src/workers/webhook.processor.test.ts, server/src/workers/index.ts, docs/ROADMAP_CHECKLIST_HINGLISH_2026.md, docs/IMPLEMENTATION_PLAN_EXISTING_15D.md, .unlazy/existing-harden-packet-c/**

Scope: Persist encrypted webhook payload, then ack Meta. Same payload does not create extra messages. Two numbers in one payload both route. HMAC still 401 before persist.

- [x] G1: persist-then-ack — envelope row exists before EVENT_RECEIVED; persist failure does not ack
  CHECK: node .unlazy/existing-harden-packet-c/verify-packet-c.mjs --accept
  EXPECT: packet-c-accept-ok
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=e3a870e24ba1/42 entries; output=packet-c-accept-ok

- [x] G2: duplicate Meta payloads create one inbound message and still resume followups
  CHECK: node .unlazy/existing-harden-packet-c/verify-packet-c.mjs --dup
  EXPECT: packet-c-dup-ok
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=e3a870e24ba1/42 entries; output=packet-c-dup-ok

- [x] G3: two phone_number_id values in one payload each get their own number lookup
  CHECK: node .unlazy/existing-harden-packet-c/verify-packet-c.mjs --multi
  EXPECT: packet-c-multi-ok
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=e3a870e24ba1/42 entries; output=packet-c-multi-ok

- [x] G4: HMAC still rejects before persist; public health has oldestWaitingMs and no webhookUrl; routes persist then ack
  CHECK: node .unlazy/existing-harden-packet-c/verify-packet-c.mjs --wired
  EXPECT: packet-c-wired-ok
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=e3a870e24ba1/42 entries; output=packet-c-wired-ok
