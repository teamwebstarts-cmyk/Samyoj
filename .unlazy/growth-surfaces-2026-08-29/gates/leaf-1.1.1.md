# Gates: Meta policy research

OWNS: docs/product/research-notes/01-meta-policy.md

Scope: Official 2025–2026 Meta facts for quality rating, messaging limits, Official Business Account (green tick), template categories, click tracking, and Click-to-WhatsApp website widgets.

- [x] G1: policy note exists with official URLs for quality, limits, OBA, templates, clicks, widget
  CHECK: node .unlazy/growth-surfaces-2026-08-29/scripts/verify-research.mjs --leaf 1.1.1
  EXPECT: growth-surfaces research verification passed
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=6edb1355a1f7/42 entries; output=OK 1.1.1 docs/product/research-notes/01-meta-policy.md | growth-surfaces research verification passed
