# Gates: Manual live proof after A–F

OWNS: .unlazy/existing-harden-manual/**, docs/ROADMAP_CHECKLIST_HINGLISH_2026.md, docs/IMPLEMENTATION_PLAN_EXISTING_15D.md

Scope: Re-prove unit packets still green, then live Inbox/campaign/inbound. Customer production stays no until every manual gate here has evidence.

- [x] G1: packets A–F unit/harness oracles still pass
  CHECK: node .unlazy/existing-harden-manual/verify-unit-green.mjs
  EXPECT: existing-harden-unit-green-ok
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=e3a870e24ba1/42 entries; output=existing-harden-unit-green-ok

- [x] G2: `bash start.sh` ke baad API, Admin, webhookConfigured, tunnel challenge
  EVIDENCE: 2026-09-11 start.sh exit=0; /health status=ok db+redis ok workersStarted=true; client 200; admin 200; webhookConfigured=true; public challenge body=ping; webhook/health has no webhookUrl. lastReceivedAt=2026-08-29 (purana). Naya phone reply still G3.

- [ ] G3: naya phone reply Inbox mein aaya aur webhook health `totalReceived` badha
  EVIDENCE: pending

- [ ] G4: Connect → Inbox send → template → campaign, ek test number, duplicate send nahi
  EVIDENCE: pending

- [ ] G5: doosre org / doosre WhatsApp number ka data mix nahi (live click)
  EVIDENCE: pending

- [ ] G6: GO/NO-GO — 8 must-tick live evidence se; fail = customer access nahi
  EVIDENCE: pending
