# Plan: Show seeded brain knowledge fully & editably in Train tab

## Context

Two "professional brains" (`support-pro`, `sales-pro`) in `client/src/components/ai-bot/professionalBrains.ts`
each carry pre-built `knowledgeItems` (FAQs). When a bot is created from a brain
(`openCreate(brain)` in `client/src/pages/AiBotPage.tsx`), those items are seeded via
`aiBotApi.seedKnowledge` and reloaded into `faqs`. The **backend already returns every
knowledge item** (FAQ / URL / PDF) with `sourceType`, `sourceUrl`, `hasEmbedding` on
`aiBot.get` (`server/src/modules/ai-bot/routes.ts:263`, `bot.service.ts:79-88`) — nothing is
filtered server-side.

The Train tab (`AiBotPage.tsx` lines 1354-1524) already renders **all** `faqs` (seeded, URL,
PDF) with click-to-edit and per-row delete, plus search and source badges. So data is not
hidden. The user's concern is that this isn't **clearly surfaced**: seeded brain FAQs should be
visibly labeled as pre-built, grouped/identified, and provably editable/deletable — so the user
can reconfigure any of it.

## Goal

Make every piece of training data added to a brain (pre-built FAQs, URL imports, PDF imports)
fully visible and editable in the Train tab, with clear provenance labels, no hidden items, and
working edit/delete/add for all of it.

## Changes

### 1. Label seeded brain FAQs with provenance (client)
- In `professionalBrains.ts`, give each brain an explicit `displayName` (e.g. "Support Professional")
  and a `knowledgeLabel` like "Pre-built FAQ". (Optional: keep as-is and use `brain.name`.)
- When seeding in `handleSubmit` (`AiBotPage.tsx` ~603-613), pass the brain id/name so seeded items
  are tagged. **Simplest approach:** after creation + seed, the reload from `aiBotApi.get` returns
  items all as `sourceType: 'FAQ'`. To distinguish pre-built vs user-added FAQs, track the seeded
  titles locally: store `seededTitles` (Set) in state when `brainKnowledgeItems` is applied, reset on
  `closeSlide`/`resetSlideState`. Use it only for a non-destructive "Pre-built" badge — do NOT change
  `sourceType` (keeps backend/embedding logic unchanged).

### 2. Show provenance badge in Train list
- In the `filteredFaqs.map` block (`AiBotPage.tsx` ~1404-1438), add a "Pre-built" pill when
  `seededTitles.has(faq.title)` (in addition to existing `sourceType` / `Ready` badges). This makes
  brain-sourced items visually obvious without hiding them.

### 3. Add a Train summary header
- Near the existing "Training status" panel (~1363), show counts by source:
  `X pre-built · Y from URL · Z from PDF · N added` using `faqs` grouped by `sourceType`
  (pre-built = FAQ && in `seededTitles`; URL; PDF). Confirms nothing is hidden.

### 4. Ensure edit/delete works on all items (verify, no-op if already correct)
- `startEditFaq` / `saveFaq` / `deleteFaq` operate on any `faq.id` regardless of source — already true.
  Confirm the edit panel (lines 1446-1479) shows full content for seeded items (it does: `faq.content`).
  No code change needed unless tests reveal otherwise.

### 5. No backend changes required
- `seed-knowledge` already sets `sourceType: 'FAQ'` and creates embeddings (`routes.ts:383-419`).
- `ingest-url` / `ingest-pdf` already set `sourceType` + `sourceUrl` (`knowledge-ingest.service.ts`).
- `aiBot.get` returns all items. No server edits needed.

## Files touched
- `client/src/pages/AiBotPage.tsx` — add `seededTitles` state, badge, summary counts.
- `client/src/components/ai-bot/professionalBrains.ts` — (optional) display name for label.

## Validation
- `npx tsc --noEmit` passes for `client` (and `server` unchanged).
- Manual check: create a bot from "Support Professional" → Train tab shows all ~24 pre-built FAQs
  with "Pre-built" badge, each clickable to edit, each deletable; URL/PDF imports also appear and
  are editable/deletable. Search filters across all. Counts in summary add up to total.
- Confirm seeded items can be edited and saved (PUT `/:id/faq/:faqId`) and reloaded correctly.

## Open questions (will confirm during impl if needed)
- Should pre-built items be deletable, or only editable? User said "delete it ... everything too" →
  allow delete. Keep as-is (delete enabled for all).
- Keep `AiBotTemplatePicker.tsx` / `botTemplates.ts` as dead code (unreferenced) — out of scope.
