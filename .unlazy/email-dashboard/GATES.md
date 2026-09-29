# Gates: email dashboard prompt recheck

OWNS: client/src/pages/email/**, client/src/pages/DashboardPage.tsx, .unlazy/email-dashboard/**

Scope: email dashboard matches the requested channel layout, mock stats, and non-overlapping recent/actions

- [x] G1: email dashboard source matches the requested layout
  CHECK: node .unlazy/email-dashboard/verify-email-dashboard.mjs
  EXPECT: email dashboard verification passed
  CWD: ../..
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=903aa5ef58f2/38 entries; output=email dashboard verification passed
