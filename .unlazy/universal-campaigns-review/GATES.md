# Gates: universal campaigns review

OWNS: docs/product/UNIVERSAL_CAMPAIGNS_REVIEW_2026-09-30.md, docs/product/UNIVERSAL_CAMPAIGNS_REVIEW_BRIEF_2026-09-30.md, client/src/config/navigation.ts, client/src/config/navigation.test.ts, .unlazy/universal-campaigns-review/**

Scope: document the current WhatsApp-only campaign system and channel limits. Campaigns nav stays under WhatsApp (Contacts move reverted).

- [x] G1: review document contains the current-code map and channel capability evidence
  CHECK: node .unlazy/universal-campaigns-review/verify-universal-campaigns.mjs document
  EXPECT: universal campaigns document verification passed
  CWD: ../..
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=b67db49af689/39 entries; output=universal campaigns document verification passed

- [x] G2: review document separates provider capability, current implementation, recommendations, and unknowns
  CHECK: node .unlazy/universal-campaigns-review/verify-universal-campaigns.mjs boundaries
  EXPECT: universal campaigns boundary verification passed
  CWD: ../..
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=b67db49af689/39 entries; output=universal campaigns boundary verification passed

- [x] G3: Campaigns is listed under the WhatsApp platform group and not under Contacts
  CHECK: node .unlazy/universal-campaigns-review/verify-universal-campaigns.mjs navigation
  EXPECT: universal campaigns navigation verification passed
  CWD: ../..
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=b67db49af689/39 entries; output=universal campaigns navigation verification passed

- [x] G4: navigation regression tests and client build pass
  CHECK: cd client && npm test -- --run src/config/navigation.test.ts && npm run build
  EXPECT: built in
  CWD: ../..
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=b67db49af689/39 entries; output=- Use build.rollupOptions.output.manualChunks to improve chunking: https://rollupjs.org/configuration-options/#output-manualchunks | - Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.

- [x] G5: provider claims and the navigation-only scope receive a final manual review
  EVIDENCE: Manual review completed against the official Meta, Google, RFC, and compliance links in the document; follower-wide Messenger/Instagram broadcast is explicitly rejected, Gmail acceptance is not labeled delivery, and the navigation diff changes only sidebar placement while preserving campaign routes/API.

- [x] G6: the short review brief contains the honest channel verdict and implementation boundaries
  CHECK: node .unlazy/universal-campaigns-review/verify-universal-campaigns.mjs brief
  EXPECT: universal campaigns brief verification passed
  CWD: ../..
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=b67db49af689/39 entries; output=universal campaigns brief verification passed
