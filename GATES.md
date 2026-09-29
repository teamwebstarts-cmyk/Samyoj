# Gates: Gmail attachments and template library

OWNS: client/src/pages/email/**, client/src/components/email/**, server/src/modules/gmail/**, server/src/workers/**, server/src/config/queues.ts, server/src/index.ts, server/prisma/schema.prisma, server/prisma/migrations/**, docs/product/GMAIL_*.md

Scope: ship the Gmail send foundation, secure Compose attachments/tools, and a read-only 12-template library without changing unrelated dashboard or Instagram work.

- [x] G1: sent-list filter and prior-mail match keep real hits and drop known misses
  CHECK: node client/scripts/verify-email-polish.mjs functions
  EXPECT: email list verification passed
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=903aa5ef58f2/38 entries; output=email list verification passed

- [x] G2: compose, templates, dashboard, and the top bar read the shared mailbox list
  CHECK: node client/scripts/verify-email-polish.mjs wiring
  EXPECT: email wiring verification passed
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=903aa5ef58f2/38 entries; output=email wiring verification passed

- [ ] G3: server attachment validation rejects unsafe files and enforces product limits
  CHECK: cd server && npm test -- --runInBand src/modules/gmail/attachments.test.ts
  EXPECT: PASS

- [ ] G4: Gmail MIME construction includes plain text, optional HTML, and attachments within the total-size ceiling
  CHECK: cd server && npm test -- --runInBand src/modules/gmail/mime.test.ts
  EXPECT: PASS

- [ ] G5: Gmail routes and send worker are organization-scoped and fail closed
  CHECK: cd server && npm test -- --runInBand src/modules/gmail/routes.test.ts src/modules/gmail/send.service.test.ts
  EXPECT: PASS

- [ ] G6: template library has exactly 12 read-only entries and copy/edit stays organization-owned
  CHECK: node client/scripts/verify-email-template-library.mjs
  EXPECT: email template library verification passed

- [ ] G7: server and client production builds pass
  CHECK: npm run build
  EXPECT: server build OK

- [x] G8: client production build passes
  CHECK: cd client && npm run build
  EXPECT: built in
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=b67db49af689/39 entries; output=- Use build.rollupOptions.output.manualChunks to improve chunking: https://rollupjs.org/configuration-options/#output-manualchunks | - Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
