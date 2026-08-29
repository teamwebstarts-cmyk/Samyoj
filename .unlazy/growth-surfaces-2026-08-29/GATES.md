# Gates: Growth surfaces research (root)

OWNS: docs/product/GROWTH_SURFACES_PHASE_2026-08-29.md, docs/product/research-notes/**, .unlazy/growth-surfaces-2026-08-29/**

Scope: Research-only product decision pack for dashboard quality/quota, green tick, official template catalog, click tracking, inbox CSW filter, WhatsApp website button, and campaign retargeting — with honest GO/DEFER/NO-GO.

- [x] G1: synthesis document exists with a decision for every asked surface
  CHECK: node .unlazy/growth-surfaces-2026-08-29/scripts/verify-research.mjs
  EXPECT: growth-surfaces research verification passed
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=6edb1355a1f7/42 entries; output=OK 1.2.1 docs/product/GROWTH_SURFACES_PHASE_2026-08-29.md | growth-surfaces research verification passed

- [x] G2: no leaf claimed this work is already implemented without a repo path
  EVIDENCE: reviewed 2026-08-29 — 02-samyoj-surfaces.md maps each ask to existing files (LiveMetricsHero delivery rates, QualityRatingBanner, GET /campaigns/quota unused, TemplateCreateForm already has category/language, CampaignAnalyticsPanel has no retarget tabs). Synthesis GO/DEFER/NO-GO does not claim unshipped features as done.

- [x] G3: GSD CLI missing is recorded; research still completed without it
  EVIDENCE: reviewed 2026-08-29 — PLAN.md Out of scope records gsd-tools.cjs missing and no .planning/. Notes 01–03 plus GROWTH_SURFACES_PHASE_2026-08-29.md completed. Cursor Automations open_automation also recorded as unavailable.
