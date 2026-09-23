# Gates: Meta phase execution pack

OWNS: docs/meta-ecosystem/phases/**, docs/meta-ecosystem/ARCHITECTURE.md, docs/meta-ecosystem/README.md, .cursor/agents/samyoj-meta-ecosystem-keeper.md, .unlazy/meta-phase-pack/**

Scope: One executable doc per phase plus the reuse map. No product code.

- [x] G1: Phase pack names do, don't, and a test for every phase
  CHECK: node .unlazy/meta-phase-pack/verify-pack.mjs
  EXPECT: PHASE_PACK_OK
  CWD: .
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=609b55c48eed/43 entries; output=PHASE_PACK_OK
