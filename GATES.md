# Gates: email polish leftovers

OWNS: client/src/pages/email/**, client/src/components/layout/AppTopbar.tsx, client/src/utils/workspaceChannels.ts, client/scripts/verify-email-polish.mjs

Scope: connect saved templates to compose, relate prior mail to the selected contact, filter the sent list, and stop the email top bar from saying Not connected while the mock mailbox is connected

- [x] G1: sent-list filter and prior-mail match keep real hits and drop known misses
  CHECK: node client/scripts/verify-email-polish.mjs functions
  EXPECT: email list verification passed
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=903aa5ef58f2/38 entries; output=email list verification passed

- [x] G2: compose, templates, dashboard, and the top bar read the shared mailbox list
  CHECK: node client/scripts/verify-email-polish.mjs wiring
  EXPECT: email wiring verification passed
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=903aa5ef58f2/38 entries; output=email wiring verification passed
