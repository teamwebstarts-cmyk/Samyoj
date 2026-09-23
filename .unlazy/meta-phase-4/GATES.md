# Gates: Sidebar one-active + Phase 4 Instagram

OWNS: client/src/config/navigation.ts, client/src/components/layout/Sidebar.tsx, client/src/index.css, client/src/pages/InstagramInboxPage.tsx, client/src/pages/InstagramCommentsPage.tsx, client/src/pages/AutomationsPage.tsx, client/src/components/automations/AutomationCard.tsx, client/src/App.tsx, client/src/services/api.ts, client/src/config/pageMeta.ts, client/src/components/settings/InstagramPagePanel.tsx, client/src/pages/SettingsPage.tsx, client/src/components/inbox/InboxListHeader.tsx, client/src/components/inbox/InboxListEmpty.tsx, server/prisma/schema.prisma, server/prisma/migrations/20260924010000_instagram_comments/**, server/src/modules/instagram/**, server/src/modules/facebook/page-client.ts, server/src/modules/facebook/save-page-channel.ts, server/src/modules/facebook/connect-oauth-state.ts, server/src/modules/whatsapp/webhook-dispatcher.ts, server/src/modules/automation/engine.ts, server/src/index.ts, docs/meta-ecosystem/STATUS_SIMPLE.md, .unlazy/meta-phase-4/**

Scope: Parent dropdown is not active while a child is; WhatsApp uses the brand glyph; Instagram Inbox + Comments + one private reply + comment-keyword automation. No Posts, no Phase 5 Ads, no WA templates on IG.

- [x] G1: Sidebar and Instagram surface invariants
  CHECK: node verify-phase4.mjs
  EXPECT: PHASE4_INSTAGRAM_OK
  CWD: .
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj/.unlazy/meta-phase-4; path=609b55c48eed/43 entries; output=PHASE4_INSTAGRAM_OK
