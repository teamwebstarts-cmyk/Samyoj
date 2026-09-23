# Gates: Meta Phase 2 CTWA chip

OWNS: server/src/modules/inbox/ctwa-referral.ts, server/src/modules/inbox/ctwa-referral.test.ts, server/src/modules/inbox/message-parser.ts, server/src/modules/inbox/routes.ts, server/src/workers/webhook.processor.ts, client/src/components/inbox/ChatHeader.tsx, client/src/types/index.ts, docs/meta-ecosystem/phases/02-ctwa.md, .unlazy/meta-phase-2/**

Scope: Persist WhatsApp ad referral on Conversation.botState (existing ctwaReferral), expose a slim chip DTO on Inbox conversations, show emerald WhatsApp ad pill in ChatHeader. No Lead, no META_ADS, no Marketing API.

- [x] G1: CTWA inbound fixtures persist chip data without Lead / duplicate
  CHECK: node verify-phase2.mjs
  EXPECT: PHASE2_CTWA_OK
  CWD: .
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj/.unlazy/meta-phase-2; path=609b55c48eed/43 entries; output=PHASE2_CTWA_OK
