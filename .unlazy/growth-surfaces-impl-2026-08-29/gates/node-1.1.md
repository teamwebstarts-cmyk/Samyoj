# Gates: Wave 1 ops truth integration

Scope: integrate children 1.1.1 1.1.2 1.1.3 1.1.4 into honest dashboard + quota + inbox window

- [x] N1: wave 1 source contract holds together
  CHECK: node .unlazy/growth-surfaces-impl-2026-08-29/scripts/verify-impl.mjs --leaf wave1
  EXPECT: growth-surfaces impl verification passed
  CWD: /workspaces/Samyoj
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=6edb1355a1f7/42 entries; output=OK include server/src/modules/inbox/service-window.ts | growth-surfaces impl verification passed
