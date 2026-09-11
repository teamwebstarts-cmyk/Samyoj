# Gates: Packet F 1000-send + restart harness

OWNS: server/scripts/packet-f-harness.ts, server/scripts/restore-database.ts, server/src/middleware/tenant-csrf.ts, server/src/middleware/tenant-csrf.test.ts, .unlazy/existing-harden-packet-c/verify-packet-c.mjs, .unlazy/existing-harden-packet-f/**, docs/ROADMAP_CHECKLIST_HINGLISH_2026.md, docs/IMPLEMENTATION_PLAN_EXISTING_15D.md

Scope: Harness proves N unique Graph sends, no second send after providerCallStartedAt, Meta 429 vs timeout/5xx, and isolated restore that cannot wipe the primary DB. Live inbound stays Manual.

- [x] G1: eligible consented recipients produce that many unique Graph sends and zero duplicate tos
  CHECK: node .unlazy/existing-harden-packet-f/verify-packet-f.mjs --count
  EXPECT: packet-f-count-ok
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=e3a870e24ba1/42 entries; output=packet-f-count-ok

- [x] G2: restart after providerCallStartedAt does not call Graph again for that recipient
  CHECK: node .unlazy/existing-harden-packet-f/verify-packet-f.mjs --restart
  EXPECT: packet-f-restart-ok
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=e3a870e24ba1/42 entries; output=packet-f-restart-ok

- [x] G3: Meta 429 still retries; timeout-after-accept and 5xx do not double-send; Redis down throttle stays safe
  CHECK: node .unlazy/existing-harden-packet-f/verify-packet-f.mjs --meta
  EXPECT: packet-f-meta-ok
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=e3a870e24ba1/42 entries; output=packet-f-meta-ok

- [x] G4: isolated restore refuses the primary DATABASE_URL and the checklist/rehearsal path exists
  CHECK: node .unlazy/existing-harden-packet-f/verify-packet-f.mjs --restore
  EXPECT: packet-f-restore-ok
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=e3a870e24ba1/42 entries; output=restore-rehearsal=ok | packet-f-restore-ok
