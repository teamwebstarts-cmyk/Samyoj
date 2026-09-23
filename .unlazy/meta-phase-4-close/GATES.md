# Gates: Phase 4 close + dashboard channel connect

OWNS: client/src/components/layout/WhatsAppStatusCard.tsx, client/src/components/layout/MetaChannelChips.tsx, client/src/components/dashboard/WhatsAppConnectGuide.tsx, client/src/pages/FacebookCallbackPage.tsx, client/src/pages/InstagramInboxPage.tsx, client/src/pages/FacebookInboxPage.tsx, client/src/pages/InstagramCommentsPage.tsx, client/src/index.css, server/src/modules/facebook/save-page-channel.ts, server/src/modules/facebook/page-client.ts, server/src/modules/facebook/save-page-channel.test.ts, server/src/modules/whatsapp/meta.service.ts, server/src/modules/whatsapp/webhook-dispatcher.ts, server/src/modules/instagram/instagram.test.ts, server/src/modules/instagram/inbox.routes.ts, server/src/modules/instagram/comments.routes.ts, docs/meta-ecosystem/STATUS_SIMPLE.md, .unlazy/meta-phase-4-close/**

Scope: Close Phase 4 gaps (IG live_comments subscribe, Page disconnect also soft-disconnects IG, socket IG-only, comment_id, app webhook objects) and add Facebook/Instagram connect icons on the sidebar WhatsApp card. No Phase 5 Ads, no App ID in UI, no Posts.

- [x] G1: Phase 4 close + dashboard connect invariants
  CHECK: node verify-close.mjs
  EXPECT: PHASE4_CLOSE_OK
  CWD: .
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj/.unlazy/meta-phase-4-close; path=609b55c48eed/43 entries; output=PHASE4_CLOSE_OK
