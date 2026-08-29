# Gates: Samyoj surface mapping

OWNS: docs/product/research-notes/02-samyoj-surfaces.md

Scope: Map each requested product surface onto current Samyoj files (dashboard cards, quality poll, quota, campaigns analytics, template library, inbox CSW, no click-tracking).

- [x] G1: surface note lists real file paths for dashboard, quality, campaigns, templates, inbox window
  CHECK: node .unlazy/growth-surfaces-2026-08-29/scripts/verify-research.mjs --leaf 1.1.2
  EXPECT: growth-surfaces research verification passed
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=6edb1355a1f7/42 entries; output=OK 1.1.2 docs/product/research-notes/02-samyoj-surfaces.md | growth-surfaces research verification passed
