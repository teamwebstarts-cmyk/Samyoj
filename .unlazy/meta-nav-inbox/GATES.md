# Gates: Sidebar dropdowns + Facebook inbox chrome

OWNS: client/src/config/navigation.ts, client/src/components/layout/Sidebar.tsx, client/src/pages/FacebookInboxPage.tsx, client/src/components/inbox/InboxListHeader.tsx, client/src/components/inbox/InboxListEmpty.tsx, client/src/components/inbox/ConversationList.tsx, client/src/components/inbox/ChatHeader.tsx, client/src/components/settings/FacebookPagePanel.tsx, server/src/modules/facebook/messenger-inbox.routes.ts, .unlazy/meta-nav-inbox/**

Scope: WhatsApp and Facebook are Dashboard-style sidebar rows with chevrons; Facebook has Inbox only; Leads stay in Contacts; Messenger inbox reuses WhatsApp inbox chrome without templates.

- [x] G1: Nav and inbox chrome invariants
  CHECK: node verify-nav-inbox.mjs
  EXPECT: NAV_INBOX_OK
  CWD: .
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj/.unlazy/meta-nav-inbox; path=609b55c48eed/43 entries; output=NAV_INBOX_OK
