# Calls history, post-call summary, AI usage reports, platform admin

Durable product research for later implementation and for copying into Confluence when that product is connected. Dictated 2026-08-16 (set 3). Agent memory + Jira mapping: `docs/memory/PRODUCT_TASKS_2026-08-16.md` §9–12. **Shipped in code 2026-08-16:** §1 Calls recents (SAMYOJ-54), §2 post-call summary (SAMYOJ-55), §3 AI usage reports (SAMYOJ-56). **Not built:** platform admin (SAMYOJ-57, deferred).

Atlassian note (2026-08-16): the connected site `teamwebstarts.atlassian.net` currently exposes **Jira only** (`read:jira-work`, `write:jira-work`). Confluence wiki API returns 404. This file is the documentation space until Confluence is enabled.

---

## 1. Calls screen — friendly recents (not a telecom console)

### Remove the Help icon

`CallsPage.tsx` right rail has Settings + **Help** (`HelpCircle`). Help opens `CallsRailPanel` with tips titled **Outbound** / **Inbound**. Remove the Help control and the help panel. Settings stay.

### Words: Incoming / Outgoing (not Inbound / Outbound)

DB can keep `CallDirection`: `USER_INITIATED` / `BUSINESS_INITIATED`. **UI copy must say Incoming / Outgoing**, the same everyday words as a phone Recents list.

Today the UI says “Inbound call” / “Outbound call” (`CallDetailView.tsx`). Help tips say Inbound/Outbound. Filter chip is **Out**. Analytics API fields are `inbound` / `outbound` (`CallAnalyticsPanel`). Change user-visible strings only; do not rename Prisma enums in the same pass unless needed.

### Recents list like a mobile phone

Research (Android Dialer / Google Phone / iOS Recents / WhatsApp Calls):

| Type | Icon (Material / Lucide) | Color |
|------|--------------------------|--------|
| Incoming (answered) | Arrow into phone / `PhoneIncoming` / `call_received` | Green or blue (Android often green for answered, Pixel-style blue incoming) |
| Outgoing | Arrow out / `PhoneOutgoing` / `call_made` | Green |
| Missed / rejected | Diagonal missed / `PhoneMissed` / `call_missed` | **Red** — name or icon in red |
| Live | Pulse, not a history glyph | Emerald (already used) |

List row pattern:

1. Avatar + **contact name** as the title.
2. Small type glyph (incoming / outgoing / missed) next to a short subtitle (“Incoming”, “Outgoing”, “Missed”, duration).
3. Time on the right (already `formatCallTime`).
4. **Do not show the phone number on the list** when a name exists. That is what “we don’t have to show the number” means. Unknown contact: show a short friendly label (e.g. last digits or “Unknown”), not a giant `+91 …` second line. Detail view may still show the number for callback.

Today `CallListItem` always prints `formatPhoneDisplay(phone)` on the second line and uses a generic `Phone` icon — **no incoming vs outgoing vs missed glyph**. Status is a text badge (LIVE / Missed / Completed), not the phone Recents pattern.

Filters: All / Missed already exist. Add or rename **Incoming** and **Outgoing** (replace terse **Out**). Keep Live / AI / Human if still useful.

---

## 2. After an AI ↔ customer call: show the summary in Inbox and on the call

### What exists

On AI voice `end()`, if there is a transcript:

1. `generateSummary()` (2–3 sentences for the agent).
2. Saved on `Call.metadata.summary`.
3. `persistCallSummaryNote` writes an **internal note** (OWNER/ADMIN as author), not a WhatsApp bubble.

Call detail UI **does not read** `metadata.summary`. Inbox **hides** `metadata.isCallSummary` messages (`inbox/routes.ts` + `ChatThread` `isAgentOnlyChatMessage`) because old rows were wrongly stored as inbound customer bubbles.

### What to ship

After every **AI-handled** call with a customer ends (and a transcript exists):

1. Generate the summary (keep the existing generator; it is already agent-facing).
2. Show it on the **Calls** thread/detail for that call (system card, not a fake spoken turn).
3. If a conversation exists, show the **same** summary in **Inbox** as a visible call-summary card in that chat (system/event, not a customer inbound bubble, not hidden).
4. Human-only calls: no AI summary unless we later add a separate product pick.

Do not re-introduce `isCallSummary` as a fake inbound WhatsApp message. Use a dedicated event card both places so agents see it and the LLM does not treat it as customer text (`chatbot.service` already skips `isCallSummary` / `isCallEvent` / `isInternalNote`).

---

## 3. Reports — dedicated AI usage section (org)

### What exists

- `AiUsageLog`: `action` string, `promptTokens`, `completionTokens`, `totalTokens`. `recordAiUsage` only types **`chat` | `embedding`**.
- Chat completions (Sarvam + Azure fallback) and embeddings are recorded. **STT and TTS are not.** Content Studio counts tokens locally and does not write `AiUsageLog`. Call summary LLM calls go through `createChatCompletion` so they look like generic `chat`.
- Reports “AI & Calls” mixes AI request count, total tokens, completed calls, and messages received. `getOrgUsageSummary` has prompt/completion/month/limit/`byAction` but Reports UI does not show that split.
- `monthlyTokenLimit` can 429 chat; not a user-facing usage dashboard.

### What to ship (org Reports)

A **separate Reports section** (not mixed with message/call cards) covering **every AI surface** in the product:

| Surface | Track |
|---------|--------|
| WhatsApp chat bot | LLM input (prompt) / output (completion) tokens, request count |
| WhatsApp calling bot | Voice LLM tokens **plus** STT and TTS units (today unlogged) |
| Train embeddings | embedding action (already) |
| Content Studio / generate-personality / call summary | named actions, not dumped into `chat` |
| Limits | month used vs `monthlyTokenLimit` (and fail-closed 429 already) |

**Pricing:** log **units** first (tokens, STT seconds or chars, TTS chars). Convert to money only with a documented rate card later. **Never mix Meta Cloud API message fees into Samyoj AI prices** (`docs/billing/`, two ledgers).

Incoming vs outgoing here means **input vs output tokens** (prompt vs completion), plus call direction if useful — not WhatsApp inbound webhooks.

Number-scoped like the rest of Reports.

---

## 4. Future — platform admin dashboard

Canonical spec (research 2026-08-16): [`docs/product/PLATFORM_ADMIN_2026-08-16.md`](PLATFORM_ADMIN_2026-08-16.md). Jira **SAMYOJ-57**. Do not implement until that ticket is picked.

Not the org Dashboard. Operator console: funnel (login → Connect → contacts → send → AI → paid), AI caps, billing view, Meta error codes. **Do not log message bodies, customer phones, or Meta tokens.**

---

## Jira

| Topic | Key |
|-------|-----|
| Calls recents UX | SAMYOJ-54 |
| Post-call summary in Inbox + Calls | SAMYOJ-55 |
| Reports AI usage section | SAMYOJ-56 |
| Platform admin dashboard (future) | SAMYOJ-57 (deferred) |
