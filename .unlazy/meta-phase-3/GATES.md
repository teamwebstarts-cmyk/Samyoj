# Gates: Meta Phase 3 Messenger inbox

OWNS: server/prisma/schema.prisma, server/prisma/migrations/20260923180000_messenger_channel_conversation/**, server/src/modules/facebook/**, server/src/modules/whatsapp/webhook-dispatcher.ts, client/src/pages/FacebookInboxPage.tsx, client/src/config/navigation.ts, client/src/App.tsx, client/src/services/api.ts, client/src/components/inbox/ServiceWindowBanner.tsx, client/src/config/pageMeta.ts, docs/meta-ecosystem/phases/03-messenger.md, .unlazy/meta-phase-3/**

Scope: Subscribe Page to messages+leadgen; inbound Page messaging → channelId-scoped Conversation + ContactPlatformIdentity; 24h text reply via Page messages client; `/facebook/inbox` shell + sidebar Inbox. No Phase 4 Instagram, no campaigns, no Recurring Notifications.

- [x] G1: Messenger inbox invariants (FB thread not WA, PSID dedupe, 24h send gate, leadgen unchanged)
  CHECK: node verify-phase3.mjs
  EXPECT: PHASE3_MESSENGER_OK
  CWD: .
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj/.unlazy/meta-phase-3; path=609b55c48eed/43 entries; output=PHASE3_MESSENGER_OK
