# Gates: Packet B leak / permission

OWNS: server/src/middleware/auth.ts, server/src/middleware/auth.test.ts, server/src/middleware/permissions.ts, server/src/middleware/api-key.ts, server/src/modules/content-studio/routes.ts, server/src/modules/wa-forms/routes.ts, server/src/modules/onboarding/routes.ts, server/src/modules/settings/routes.ts, server/src/modules/media/public.routes.ts, server/src/modules/media/public.routes.test.ts, server/src/modules/media/storage-adapter.ts, server/src/modules/media/storage-adapter.test.ts, server/src/modules/media/public-sign.ts, server/src/modules/messages/send.service.ts, docs/ROADMAP_CHECKLIST_HINGLISH_2026.md, docs/IMPLEMENTATION_PLAN_EXISTING_15D.md, .unlazy/existing-harden-packet-b/**

Scope: Fail-closed OWNER/ADMIN on existing mutate surfaces; signed public media; isolation tests still green.

- [x] G1: agent and API key cannot pass admin mutation middleware; GET is unchanged
  CHECK: node .unlazy/existing-harden-packet-b/verify-packet-b.mjs --auth
  EXPECT: packet-b-auth-ok
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=e3a870e24ba1/42 entries; output=packet-b-auth-ok

- [x] G2: unsigned public media is 401; signed path still serves
  CHECK: node .unlazy/existing-harden-packet-b/verify-packet-b.mjs --media
  EXPECT: packet-b-media-ok
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=e3a870e24ba1/42 entries; output=packet-b-media-ok

- [x] G3: studio, wa-forms, onboarding, hours, and media routes are wired to the shared guards
  CHECK: node .unlazy/existing-harden-packet-b/verify-packet-b.mjs --wired
  EXPECT: packet-b-wired-ok
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=e3a870e24ba1/42 entries; output=packet-b-wired-ok

- [x] G4: WhatsApp number isolation tests still pass
  CHECK: node .unlazy/existing-harden-packet-b/verify-packet-b.mjs --isolation
  EXPECT: packet-b-isolation-ok
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=e3a870e24ba1/42 entries; output=packet-b-isolation-ok
