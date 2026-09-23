# Phase 2 status — CTWA chip (do not re-audit)

**Checked:** 2026-09-23. Recheck only; not a rebuild.

## What shipped

- Inbound WhatsApp referral → `Conversation.botState.ctwaReferral` + `ctwaReceivedAt` (first write wins).
- Inbox DTO `whatsappAd` from known Cloud API fields: `source_id`, `headline`, `body`, `source_type`, `source_url`, `ctwa_clid`.
- ChatHeader emerald pill **WhatsApp ad** (+ name = headline else body). No fake 72h countdown.
- Only **ad** referrals (`source_type === 'ad'` or `ctwa_clid`) are stored/shown — not post/product, not Leads/META_ADS.

## Files

| Area | Path |
|------|------|
| Helpers | `server/src/modules/inbox/ctwa-referral.ts` |
| Tests | `server/src/modules/inbox/ctwa-referral.test.ts` |
| Parse | `server/src/modules/inbox/message-parser.ts` |
| Persist | `server/src/workers/webhook.processor.ts` |
| API | `server/src/modules/inbox/routes.ts` |
| UI | `client/src/components/inbox/ChatHeader.tsx`, `client/src/types/index.ts` |
| Spec | `docs/meta-ecosystem/phases/02-ctwa.md` |

## Confidence: **high**

Field names match Meta’s referral shape already used in fixtures. Merge is idempotent; chip is null without an ad referral; Lead path is untouched. Vitest green on these invariants.

## Proven by tests vs live proof

| Proven (vitest) | Still needs a live ad click |
|-----------------|-----------------------------|
| Parse + merge + chip DTO | Real Meta webhook delivers referral on first message |
| No chip without referral | Chip visible in a real Inbox thread |
| No overwrite on repeat webhook | Assign / notes / reply still work on that thread (manual) |
| Non-ad referral ignored | — |
| Lead create not invoked in unit path | Facebook → Leads count unchanged after a CTWA click (spot-check) |

## Intentionally not built

- Ad creation / Marketing API / `ads_management` for this phase
- Filing CTWA under Facebook → Leads or Meta Ads CPL
- Campaign name on the chip (Meta does not send it on this webhook)
- Fake 72h countdown when Meta sends no click timestamp
