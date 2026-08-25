# Gates: Meta Business learning master guide

OWNS: docs/learning/META_BUSINESS_PLATFORM_MASTER_GUIDE_2026.md, .unlazy/meta-learning/**, .cursor/agents/meta-*.md

Scope: One Hinglish+English master MD for Sonu covering Meta Business/WhatsApp Graph APIs (2025–2026), Samyoj current Meta surface, pricing/ban/onboarding risks, future IG/FB scope notes, and study sources — not a code change.

- [x] G1: master guide file exists and passes structure oracle
  CHECK: node verify-guide.mjs
  EXPECT: meta learning guide verification passed
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj/.unlazy/meta-learning; path=6edb1355a1f7/42 entries; output=meta learning guide verification passed | chars=29686 urls=60

- [x] G2: guide cites at least 40 distinct http(s) sources
  CHECK: node verify-guide.mjs --min-urls 40
  EXPECT: meta learning guide verification passed
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj/.unlazy/meta-learning; path=6edb1355a1f7/42 entries; output=meta learning guide verification passed | chars=29686 urls=60

- [x] G3: guide includes Samyoj current Meta API map section
  CHECK: node verify-guide.mjs --require-section "Samyoj current Meta surface"
  EXPECT: meta learning guide verification passed
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj/.unlazy/meta-learning; path=6edb1355a1f7/42 entries; output=meta learning guide verification passed | chars=29686 urls=60

- [x] G4: guide includes quiz / self-check checklist
  CHECK: node verify-guide.mjs --require-section "Quiz"
  EXPECT: meta learning guide verification passed
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj/.unlazy/meta-learning; path=6edb1355a1f7/42 entries; output=meta learning guide verification passed | chars=29686 urls=60

- [x] G5: owner can study for ~2 days using only this doc + linked URLs
  EVIDENCE: guide §15 Day1/Day2 blocks; §17 70+ sources; §16 quiz; docs/learning/META_BUSINESS_PLATFORM_MASTER_GUIDE_2026.md (~30k chars, 60 unique URLs)
