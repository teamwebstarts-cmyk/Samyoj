# Gates: click-amplification load locks

OWNS: client/src/pages/InstagramInboxPage.tsx, client/src/pages/FacebookInboxPage.tsx, client/src/pages/InstagramCommentsPage.tsx, client/src/pages/InstagramPostsPage.tsx, client/src/pages/CallsPage.tsx, client/src/components/inbox/useInboxSender.ts, client/src/components/inbox/useConversationActions.ts, client/src/components/ui/ConfirmDialog.tsx, client/src/services/api.ts, server/src/modules/instagram/inbox.routes.ts, server/src/modules/instagram/comments.routes.ts, server/src/modules/instagram/comment-sync.ts, server/src/modules/instagram/comment-sync.lock.test.ts, server/src/modules/facebook/messenger-inbox.routes.ts, server/src/modules/facebook/channel-inbox-actions.ts, server/src/modules/facebook/save-page-channel.ts, server/src/modules/messages/outbound-idempotency.ts, server/src/modules/campaigns/worker-safety.test.ts

Scope: stop multi-click from cloning WhatsApp, Instagram, Facebook, comments, posts, calls, and campaign confirms, and keep custom BullMQ job ids colon-free.

- [x] G1: WhatsApp, Instagram, Facebook, and Gmail send paths refuse a second click before React re-renders
  CHECK: node verify-click-locks.mjs
  EXPECT: click lock verification passed
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj/.unlazy/click-amplification; path=b67db49af689/39 entries; output=click lock verification passed

- [x] G2: Instagram and Facebook inbox sends replay the same Idempotency-Key instead of a second Graph POST
  CHECK: node verify-idempotency.mjs
  EXPECT: inbox idempotency verification passed
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj/.unlazy/click-amplification; path=b67db49af689/39 entries; output=inbox idempotency verification passed

- [x] G3: Instagram comment sync and private/public replies cannot pile duplicate Graph work
  CHECK: node verify-comment-guards.mjs
  EXPECT: comment guard verification passed
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj/.unlazy/click-amplification; path=b67db49af689/39 entries; output=comment guard verification passed

- [x] G4: custom BullMQ job id builders stay inside the colon-free alphabet
  CHECK: node verify-job-ids.mjs
  EXPECT: job id verification passed
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj/.unlazy/click-amplification; path=b67db49af689/39 entries; output=job id verification passed

- [x] G5: inbox, comment, campaign, and Gmail safety tests still pass
  CHECK: node run-tests.mjs
  EXPECT: click-amplification tests passed
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj/.unlazy/click-amplification; path=b67db49af689/39 entries; output=- ESM syntax in a file loaded as CommonJS (vitest.config.ts:1:1). Use a `.mjs` extension or set `"type": "module"` in the closest package.json | Set `VITE_CONFIG_NATIVE_IGNORE_WARNING=true` to suppress this warning.
