# 10 — Gating matrix

Legend: **G** = gated in CURRENT CODE · **U** = ungated · **T** = TARGET must gate · **—** = n/a

| Feature | Launch | Starter | Growth | Pro | Ent | CURRENT |
| --- | --- | --- | --- | --- | --- | --- |
| Inbox read | Y | Y | Y | Y | Y | U (always) |
| Inbox send | Y (trial/active) | Y | Y | Y | Y | U |
| WA connect slots | 1 T | 1 T | 2 T | 5 T | ∞ T | **U** |
| Seats | 1 T | 3 T | 10 T | 25 T | custom T | **Partial** (bypassable PATCH) |
| Contacts | 100 T | 5k T | 25k T | 100k T | ∞ T | **U** (copy said 500) |
| Workflows published | 1 T | 5 T | ∞ T | ∞ T | ∞ T | **U** |
| AI assistant | N T | N T | Y T | Adv T | Ded T | **U** |
| Analytics advanced | N | N | Y T | Y T | Y T | **U** |
| Campaigns | Tight cap T | Y T | Y T | Y T | Y T | Settings cap only, not plan |
| Calling module | N | N | N* | Y T | Y T | Flag unused |
| Public API | N | N | Adv T | Adv T | Y T | Flag unused |
| Content Studio | Low T | Low T | Mid T | High T | custom T | **G** by old plan names |
| Meta PMP | Always extra | extra | extra | extra | extra unless SOW | Heuristic only |

\*Growth Calling: default **off**; do not advertise Calling on Growth unless product later adds it. Pro “AI Advanced” ≠ Calling.

`OrgFeatureFlag` keys exist (`content_studio`, `voice_studio`, `video_studio`, `public_api`, `zapier_integration`, `commerce`, `calling`) but `requireFeature()` is **never called**. TARGET: either honor flags **or** derive from plan — do not leave dead flags that look like entitlements.

FEATURE_MATRIX.md billing DONE rows are **false** — do not use as ship criteria.
