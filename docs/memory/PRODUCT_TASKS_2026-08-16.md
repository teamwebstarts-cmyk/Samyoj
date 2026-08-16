# Product tasks — researched 2026-08-16 (set 1)

**Implementation note (2026-08-16, later the same day):** these tickets **shipped in code** — [SAMYOJ-47](https://teamwebstarts.atlassian.net/browse/SAMYOJ-47), [48](https://teamwebstarts.atlassian.net/browse/SAMYOJ-48), [50](https://teamwebstarts.atlassian.net/browse/SAMYOJ-50), [51](https://teamwebstarts.atlassian.net/browse/SAMYOJ-51), [53](https://teamwebstarts.atlassian.net/browse/SAMYOJ-53), [54](https://teamwebstarts.atlassian.net/browse/SAMYOJ-54), [55](https://teamwebstarts.atlassian.net/browse/SAMYOJ-55), [58](https://teamwebstarts.atlassian.net/browse/SAMYOJ-58). **Same evening:** [SAMYOJ-46](https://teamwebstarts.atlassian.net/browse/SAMYOJ-46) apply/unapply bot all chats, [SAMYOJ-49](https://teamwebstarts.atlassian.net/browse/SAMYOJ-49) tab-scoped `sessionStorage` JWTs (Pick A) + cross-org number after disconnect. **Night pass:** [SAMYOJ-52](https://teamwebstarts.atlassian.net/browse/SAMYOJ-52) Chat vs Calling AI bots, [SAMYOJ-59](https://teamwebstarts.atlassian.net/browse/SAMYOJ-59) strip AI from Calls Customize, [SAMYOJ-56](https://teamwebstarts.atlassian.net/browse/SAMYOJ-56) Reports AI usage. User is testing locally (`bash start.sh`). **Not customer production.**

**2026-08-17:** [SAMYOJ-57](https://teamwebstarts.atlassian.net/browse/SAMYOJ-57) **first release in code** — spec [`docs/product/PLATFORM_ADMIN_2026-08-16.md`](../product/PLATFORM_ADMIN_2026-08-16.md); `admin/` `:3001` + `/api/platform/*`. Remaining: 35 TARGET billing, 56 STT/TTS honesty, impersonation, SMTP. Do not rebuild A–D.

User-dictated work. Originally research-only. Set 1 = §1–6. Set 2 = §7–8 (AI Bot). Set 3 = §9–12 (Calls UX, post-call summary, AI Reports, future admin). Set 4 = §13–14 (Inbox new-contact fields, strip AI from Calling settings). More items still coming. Full session note: [SESSION_2026-08-16.md](./SESSION_2026-08-16.md). Durable copy for later Confluence: [docs/product/CALLS_AI_USAGE_ADMIN_2026-08-16.md](../product/CALLS_AI_USAGE_ADMIN_2026-08-16.md) (set 3) and [docs/product/INBOX_CONTACT_AND_CALLING_AI_2026-08-16.md](../product/INBOX_CONTACT_AND_CALLING_AI_2026-08-16.md) (set 4).

Jira epic: [SAMYOJ-8](https://teamwebstarts.atlassian.net/browse/SAMYOJ-8). These are **new product tasks**, not leftovers from STATUS. Do not merge them into SAMYOJ-2 / 5 / 11. Tenancy/session **relates to** SAMYOJ-3 (do not silently absorb).

---

## 1. Apply / unapply one AI bot for all chats (keep personal Inbox picks)

**Problem (product):** On AI Bot, the user wants one click to apply a bot to every chat, and one click to take that bot off every chat. Inbox already lets you pick a bot **for one person**. That personal pick must stay. Global apply/unapply must not overwrite it.

**What exists today**

| Layer | Current behavior | Path |
|-------|------------------|------|
| Org-wide Pause / Activate | Toggles `AiBot.enabled`. Stops/starts the bot everywhere it would run. **Not** “assign this bot to chats.” | `AiBotPage.toggleEnabled` → `aiBotApi.update({ enabled })`. Buttons on `AiBotCard` (Pause / On) and the xl table row. |
| Per-chat pick | Sets `Conversation.activeBotId` (+ optional `botActive` / handoff reset) on **one** conversation. `null` = org default bot. | Inbox `handleSetActiveBot` → `PATCH` inbox bot. `BotPickerPopover`. |
| Bulk inbox API | assign / status / snooze / delete only. **No** bulk bot action. | `POST /inbox/bulk` |
| Distinction personal vs default | **None.** `activeBotId` is just a nullable FK. A chat on the default bot looks the same as “never touched” (`null`). A chat where the user explicitly picked bot A looks the same as “apply-all set bot A.” | `Conversation.activeBotId`, `botActive` |

Copy on AI Bot already says pause-one-customer from Inbox (`AiBotPage` ~1116). That is **pause** (`botActive`), not assignment.

**Why Pause/Activate cannot be reused**

- Pause = `enabled=false` on the bot definition. Personal Inbox picks still point at that bot; they just would not reply.
- Apply-all = write `activeBotId` (and live flag) across many conversations.
- Unapply-all = clear those writes **only** where they were applied globally.

**Required product rule (must ship)**

1. New control on each bot **card** (`AiBotCard`) **and** the xl table actions, next to Pause / Activate — e.g. **Apply to all chats** / **Remove from all chats**.
2. Scope: current org + **current WhatsApp number** (`whatsappNumberId`). Never cross-number.
3. **Do not change** conversations whose bot was chosen in Inbox for that person (manual / personal).
4. Pause / Activate stays as org-level `enabled`. Do not overload it.
5. Do not confuse with Inbox `botActive` vs journeys ([SAMYOJ-5](https://teamwebstarts.atlassian.net/browse/SAMYOJ-5)).

**Implementation note (so the task is actually correct)**

Without a source flag, apply-all cannot tell “user picked bot A in Inbox” from “apply-all wrote bot A.” Need something like `Conversation.botAssignmentSource = MANUAL | APPLIED` (unset/`null` activeBotId = follow default, not MANUAL).

- Apply bot A: update rows where source is **not** `MANUAL`; set `activeBotId=A`, source=`APPLIED`, typically `botActive=true`.
- Remove bot A from all: only rows with source=`APPLIED` **and** `activeBotId=A`; revert to default (`activeBotId=null`, source unset). Leave `MANUAL` rows alone — even if they also use bot A.
- Inbox picker sets source=`MANUAL` (including “use default” if the user explicitly chose default).

**Done when**

- Card + table expose Apply all / Remove all.
- Chats with a personal Inbox bot are unchanged.
- Chats still on default / previous apply-all follow the new bot (or revert).
- Number-scoped; fail closed if the number header is missing with multiple numbers.

---

## 2. Universal card spacing, controlled from Appearance

**Problem:** Dashboard (and other screens) feel packed. Cards sit too close. User wants more margin/gap, and to **control how much** from Settings → Appearance. Same tokens for product UI and for new screens in development.

**What exists today**

- Appearance has **Theme** + **Display density** (`comfortable` / `compact`) only. No card-gap slider. `AppearanceSettingsPanel.tsx`, `densityStore.ts`.
- Density CSS vars (`client/src/index.css`): sidebar, topbar, page padding, `--density-stack-gap` (1rem / 0.75rem), nav item height.
- Dashboard **ignores** those vars for the main grid: hardcoded `space-y-3`, `gap-3` (`DashboardPage.tsx`). Cards use tight `p-3` / `sm:p-3.5`.
- List pages that use `list-page-stack` already follow `--density-stack-gap`. Dashboard hero/grid does not.

**Required**

1. CSS variables for card gap and card padding (e.g. `--card-gap`, `--card-pad`) on `html`.
2. Appearance control (slider or stepped sizes) for how much to open the cards. Density presets may set defaults; the new control is the card spacing, not a third theme.
3. Dashboard grids/stacks use the vars (stop hardcoding `gap-3`).
4. Document for developers: new card layouts use the vars, not magic Tailwind gaps.
5. Apply across dashboard screens first, then the same tokens on other card grids (do not invent a second spacing system).

**Not this ticket:** theme colors, compact sidebar, skeleton loaders (task 3).

---

## 3. Skeleton loaders on every screen that loads DB / API data

**Problem:** Some pages already skeleton; many still flash a spinner/`LoadingState` or empty shell while customized or database data loads. User wants real skeleton loaders everywhere that pattern applies.

**Already have dedicated skeletons**

Dashboard (`DashboardSkeleton`, `PreConnectSkeleton`), Inbox list/thread, Reports, Calls list, Templates list, Billing.

**Still spinner / generic loading (examples)**

| Screen | Today |
|--------|--------|
| Campaigns | `LoadingState` “Loading campaigns…” |
| Tickets | `LoadingState` “Loading tickets...” |
| Commerce | `loading && orders.length === 0` (not a layout skeleton) |
| Contacts, AI Bot, Team, Automations, Leads, Settings, Content Studio, Flow builder, Campaign wizard | no matching layout skeleton (or only pulse on a nested widget) |

**Required**

- For each authenticated page that fetches org/number-scoped data: a skeleton that matches the **real layout** (cards/table/hero), shown on first load (and keep content on refetch when data already exists).
- Reuse one primitive (shared pulse blocks) so we do not invent 15 unrelated designs.
- Auth pages (login/register) are out of scope unless they fetch account data.

---

## 4. Tab-scoped login + same Meta number must not leak another account’s data

Two related tenancy rules. **Major.** Relates to [SAMYOJ-3](https://teamwebstarts.atlassian.net/browse/SAMYOJ-3) — do not treat cookies as already solving this.

### 4a. Session only in the tab where the user logged in

**Wanted:** Login in tab A stays tab A. Open the same site in another tab (or the same tab after logout) and log into a **different** account in the **same browser**. Sessions must not overwrite each other via shared storage.

**Today:** Access + refresh JWTs live in **`localStorage`** (`client/src/utils/authStorage.ts`). That is **one session per origin for the whole browser**. Every tab shares Account A. Logging into B in a new tab **replaces** A everywhere.

OAuth already uses `sessionStorage` only as a **backup** while Facebook redirects (`backupAuthBeforeOAuth`) — not as the live session.

**Conflict with SAMYOJ-3:** HttpOnly cookies are normally **browser-wide**, not tab-scoped. Tab-scoped multi-account needs `sessionStorage` (or equivalent) and **cannot** be the same design as “move JWT into cookies” without an explicit pick.

**Product pick required before coding (write the choice on the ticket)**

| Pick | Result |
|------|--------|
| **A (matches this request) — SHIPPED 2026-08-16** | Tokens in `sessionStorage` (per tab). Same browser, two tabs, two accounts. XSS still reads tokens. SAMYOJ-3 cookie work stays deferred. |
| **B (SAMYOJ-3)** | HttpOnly cookies. More XSS-safe. **One** login per browser; cannot keep two accounts in two tabs. **Not this ticket.** |

Do not implement both and pretend they compose. **This pass implemented Pick A only.**

### 4b. Same WhatsApp number, different Samyoj accounts → no shared workspace

**Wanted:** Account A connected number X keeps A’s inbox/contacts/campaigns. If Account B (another org) connects the **same** Meta number, B must see a **fresh** dashboard — never A’s rows.

**Already true (do not redo as “number isolation”)**

Inside **one** org, each connected number is its own workspace via `whatsappNumberId`. Reconnect same displayed phone in that org **reuses** that workspace. Disconnect is soft (`isActive=false`). Multiple active numbers + missing header → 409. See `.cursor/rules/whatsapp-number-isolation.mdc`.

**Cross-org today**

- `WhatsappNumber @@unique([phoneNumberId])` is **global**.
- `saveWhatsappConnection` **409s** if another org already has that `phoneNumberId` **or** `normalizedPhoneNumber`. Message: disconnect there first. The lookup does **not** ignore `isActive=false`, so B is blocked even after A soft-disconnects.
- Webhook routing (`webhook-dispatcher.ts`) `findFirst` by `phoneNumberId` + `isActive: true`. Two active rows for one Meta id would be ambiguous; unique constraint currently prevents that.

**Honest split**

| Claim | Reality |
|-------|---------|
| “B must not see A’s inbox” | **Already fail-closed** while A’s row exists: B cannot connect, so B cannot load A’s `whatsappNumberId`. |
| “B should connect the same number and get an empty workspace while A also stays connected” | **Not how Meta works for inbound.** One Cloud API number / WABA subscription delivers webhooks to **one** app destination. Two live Samyoj orgs both “owning” the same `phoneNumberId` would split or drop inbound. **Do not build this** without a written Meta routing design. |
| After A disconnects, B connects and must not inherit A’s history | **Gap.** Unique `phoneNumberId` + 409 on inactive rows blocks B entirely. Product default: allow B only when A is inactive; **create a new** `WhatsappNumber` (+ empty contacts/inbox) for B; **do not** reassign A’s row. A’s history stays on A’s org, unreachable from B. |

**Done when**

- Tab sessions match the written pick (A or B above).
- Cross-org: B never reads A’s conversations/contacts/campaigns (keep 409 while A is active; after A disconnects, B gets a **new** empty number workspace).
- Automated test: org B connect same Meta id cannot `findMany` org A conversations.
- Do not drop in-org reconnect-same-phone reuse.

---

## 5. Dashboard chrome (merged): Disconnect on screen, donut-only performance, remove Health score, alerts click through

Four dashboard UI problems, one ticket.

### 5a. Disconnect visible on the dashboard

**Today:** Connected state in `WhatsAppConnectGuide` shows **Manage** + a `⋯` menu. **Disconnect** is inside that menu (`handleDisconnect`). That is extra clicks (~3). Settings WhatsApp tab also disconnects.

**Wanted:** Disconnect **on the dashboard card itself** (visible control), not buried in overflow. Keep a confirm so it stays a soft disconnect (`isActive=false`), not a delete.

### 5b. Message performance: circular diagram only + hover tooltip

**Today:** `MessagePerformanceDonut.tsx` — donut (`stroke` 14, radius 54) **plus** a numeric legend with mini bars (Delivered / Read / Failed / Pending). Center shows total sent. Segments are not hoverable.

**Wanted:** Remove the side data list. Larger/heavier ring in the center. Hover a segment → small tooltip in **that segment’s color** (Delivered `#25D366`, Read `#3B82F6`, Failed `#EF4444`, Pending `#8B5CF6`) with count + % + short label. Keep period picker and “View full report.”

### 5c. Remove Health score

**Today:** `LiveMetricsHero` third mini-card **Health score** = `round((deliveryRate + readRate) / 2)`. Invented metric, not a Meta field.

**Wanted:** Remove it from the dashboard hero. Leave Delivery + Read rate.

Note: `ReportsPage` also shows a Health score. Out of scope unless we strip it in the same pass for consistency.

### 5d. Needs attention: no extra Open Inbox buttons; hover + click goes there

**Today:** `NeedsAttentionCard` rows are **not** the whole hit target. Each row has a separate CTA: “Open Inbox”, “View Failures”, “Connect”, “Enable”, plus footer “View all alerts.”

**Wanted:** Remove those action buttons. The alert row itself is the control: hover shows detail (tooltip/title), **click navigates** (Inbox / Reports / Settings WhatsApp) as the row already knows via `to`.

---

## 6. Campaigns: reschedule + repeat every N days

**Problem:** User wants to pick a new send date (reschedule) and to **repeat** a campaign every N days (every 2 days, every 3 days, …) so the same audience is messaged again on that cadence.

**What exists today**

- One-shot `Campaign.scheduledAt` (UTC instant) + display `timezone`. Status DRAFT → SCHEDULED → RUNNING → completed. `runVersion` increments when the scheduler claims a due row (`processScheduledCampaigns`).
- Wizard/list can set or clear `scheduledAt` for draft/scheduled. **No** `repeatIntervalDays`, **no** next-run after COMPLETED, **no** “repeat every N days” UI.
- Send path is fail-closed on consent (`optedIn` + `consentSource` + `consentAt` + no `optOutAt`). Repeat must keep that.

**Required**

1. **Reschedule:** from campaign list/detail, pick a future datetime; update `scheduledAt` (and SCHEDULED if needed). Do not silently mutate a RUNNING send.
2. **Repeat:** interval in days (integer ≥ 1). Optional end (until date or occurrence cap). After a run completes, if repeats remain, schedule the next run at last scheduled/sent + N days (define timezone: use campaign `timezone` for wall-clock, store UTC).
3. Each repeat is a **new run** (`runVersion`), new recipient rows or a clean PENDING set — do not destroy previous delivered/read/fail stats.
4. Number-scoped; same consent rules; respect campaign pause/cancel.
5. UI: interval + reschedule date in wizard review **and** on an existing campaign (not wizard-only).

**Not this ticket:** Phase C automations, billing quotas beyond existing ledger behavior (if a repeat would exceed quota, fail closed with a visible error).

---

## Mapping to Jira (set 1)

| Spec | Jira |
|------|------|
| §1 Apply/unapply bot for all chats | [SAMYOJ-46](https://teamwebstarts.atlassian.net/browse/SAMYOJ-46) |
| §2 Appearance card spacing | [SAMYOJ-47](https://teamwebstarts.atlassian.net/browse/SAMYOJ-47) |
| §3 Skeleton loaders | [SAMYOJ-48](https://teamwebstarts.atlassian.net/browse/SAMYOJ-48) |
| §4 Tab sessions + cross-org number data | [SAMYOJ-49](https://teamwebstarts.atlassian.net/browse/SAMYOJ-49) (Relates [SAMYOJ-3](https://teamwebstarts.atlassian.net/browse/SAMYOJ-3)) |
| §5 Dashboard chrome | [SAMYOJ-51](https://teamwebstarts.atlassian.net/browse/SAMYOJ-51) |
| §6 Campaign reschedule + repeat | [SAMYOJ-50](https://teamwebstarts.atlassian.net/browse/SAMYOJ-50) |

**Product pick (shipped 2026-08-16): Pick A — `sessionStorage` for live JWTs.** Tab A login stays tab A; another tab can log into a different account. HttpOnly cookies are browser-wide and cannot do that. [SAMYOJ-3](https://teamwebstarts.atlassian.net/browse/SAMYOJ-3) cookie work stays deferred. XSS can still read sessionStorage.

**Shipped 2026-08-16:** §2 [SAMYOJ-47](https://teamwebstarts.atlassian.net/browse/SAMYOJ-47), §3 [SAMYOJ-48](https://teamwebstarts.atlassian.net/browse/SAMYOJ-48), §5 [SAMYOJ-51](https://teamwebstarts.atlassian.net/browse/SAMYOJ-51), §6 [SAMYOJ-50](https://teamwebstarts.atlassian.net/browse/SAMYOJ-50), §1 [SAMYOJ-46](https://teamwebstarts.atlassian.net/browse/SAMYOJ-46), §4 [SAMYOJ-49](https://teamwebstarts.atlassian.net/browse/SAMYOJ-49) (Pick A). **Still not built:** set 2+ items 52 / 56 / 59.

---

# Product set 2 — AI Bot / Inbox picker / calling (researched 2026-08-16)

User-dictated. **§7 / SAMYOJ-53 shipped in code 2026-08-16.** **§8 / SAMYOJ-52 still not built** — do not start this pass. More items still coming. Do **not** rebuild the LLM/Train/call algorithms. Reuse `AiBot`, `KnowledgeBaseItem`, `buildConversationMessages`, Sarvam, `decideCallRoute`. This is a **UX + channel split + prompt chrome** change.

Jira: [SAMYOJ-53](https://teamwebstarts.atlassian.net/browse/SAMYOJ-53) Inbox default picker, [SAMYOJ-52](https://teamwebstarts.atlassian.net/browse/SAMYOJ-52) AI Bot redesign. Relates [SAMYOJ-46](https://teamwebstarts.atlassian.net/browse/SAMYOJ-46). Full Calls → Customize replacement is **later** (user said talk later). Live transfer stays [SAMYOJ-12](https://teamwebstarts.atlassian.net/browse/SAMYOJ-12).

---

## 7. Inbox: disable “Auto · default” bot selection

**Problem:** Inbox already lets you pick a bot **for that chat**. AI Bot already has Activate / Pause (`enabled`) per bot. The extra Inbox row **Auto · default** (`activeBotId = null`) is confusing. User asked to **disable default bot selection in Inbox**. Default still matters — it is set on the **AI Bot page**, not by picking Auto in Inbox.

**What exists today**

| Piece | Behavior | Path |
|-------|----------|------|
| Inbox picker | First option **Auto · default** calls `onSelectBot(null)`. Lists only `enabled` bots. Paused bots are hidden, not shown disabled. | `BotPickerPopover.tsx` |
| Per-chat assign | `null` = follow org `isDefault` (or first enabled). | `handleSetActiveBot`, `Conversation.activeBotId` |
| Default flag | Toggle **Default bot** on the create/edit form: “Replies to every message you receive.” | `AiBotPage` `form.isDefault`, `AiBot.isDefault` |
| Pause | `AiBot.enabled`. Inbox will not list that bot. If it was assigned, copy says “Assigned bot is unavailable — pick another or Auto.” | `BotPickerPopover` |

**Required**

1. Remove or disable the Inbox **Auto · default** option. User picks a **named** enabled bot for that chat, or leaves the chat on whatever the AI Bot page marked default (no extra Auto row).
2. Paused / inactive bots must not be selectable. If the assigned bot is paused, do not push the user to Auto — prompt to pick another **enabled** bot, or fall back to the page-level default without showing Auto.
3. **Keep** Default bot as a first-class toggle on AI Bot cards/list (user: “the default bot is very important”). That is how chats without a personal pick get a brain. Align with [SAMYOJ-46](https://teamwebstarts.atlassian.net/browse/SAMYOJ-46) apply-all (revert-to-default still means `isDefault`, not Inbox Auto).
4. Inbox picker lists **chat** bots only once channel split ships (set 2 §8). Until then, list enabled bots as today minus Auto.

**Not this ticket:** apply-all (46), journey pause (5).

---

## 8. AI Bot redesign — separate Chat vs Calling, few clicks, existing engine

**Problem:** One `AiBot` row is the brain for **WhatsApp chat and WhatsApp calls**. Create/edit is a developer console: six tabs (Personality, Train, AI call, Connect, Try it, More), ready-made professional brains, temperature / max tokens / replies-per-minute, analytics, recent activity, version history, activity log, long “How it works” theory. Normal users cannot create a bot in a few clicks. User wants **separate** AI Chat bots and AI Calling bots, each with its own personality and training, using the **same** backend pieces.

### 8a. Current engineering (keep the engine, hide the console)

| Layer | Today | Keep? |
|-------|--------|--------|
| One `AiBot` + `instructions` | Chat text + optional `<!-- VOICE_INSTRUCTIONS -->` block in the **same** row | Split into two bots (or `channel`), not two algorithms |
| Platform system chrome | `buildConversationMessages` concatenates user instructions + identity/memory/FAQ rules + `VOICE_SAFETY_RULES` | **Keep hidden.** User never edits this. Research: this is the “huge behind the scene” prompt. |
| Train | `KnowledgeBaseItem` + Azure embeddings (`hasEmbedding`), cosine 0.7, token fallback | Keep. Per-bot, so chat and calling train separately after split. |
| Chat LLM | `createChatCompletion` default `SARVAM_CHAT_MODEL` = `sarvam-105b` | Keep for **chat** bots |
| Call LLM | Hardcoded `sarvam-105b-conversations` (also `config.sarvam.voiceChatModel`) | Keep for **calling** bots |
| Call STT/TTS | Saaras + Bulbul; speaker/language in **org** `CallingSettings` | Move **priority** fields onto the calling bot (below). Org form replacement = later. |
| Call routing | `decideCallRoute` + `aiAutoAnswer` + `routingMode` + `defaultBotId` | Reuse. Global on/off = this `aiAutoAnswer` / calling-bot `enabled`. |
| `ensureDefaultBot` | If no enabled bot, **creates** “Support Bot” | Fail-closed when user turned calling/chat off — do not spawn a bot behind their back |
| Ready-made templates | `professionalBrains` + `AiBotProfessionalBrainPicker` (Support Professional, Sales, …) 1000+ word instructions + seeded FAQs | **Remove completely** |
| Personality presets | Friendly / Professional / Sales / Custom cards | Replace with **type a sentence → AI generates** user instructions |
| Tabs | Personality, Train, AI call, Connect, Try it, More | Strip to: type (chat vs call) → name → generate personality → train Q&A → (calling: voice + on/off). Try-it can stay as one simple test. |
| More tab | Creativity (`temperature` default **0.7**), max reply length, replies per minute, Analytics 30d, Recent activity, Version history, Activity log | **Remove from UI.** Hardcode safe backend values. Do not delete DB tables this session unless asked. |
| Connect tab | Handoff keywords + handoff message | Remove. Default keywords already exist in `bot.service` `DEFAULT_HANDOFF_KEYWORDS`. One optional “Offer a person when asked” toggle is enough if we keep handoff at all. |
| How it works | `AiBotHowItWorks` three-step theory | Remove. User called this unnecessary theory. |
| Copy | “This AI also answers WhatsApp voice calls when Calls is set to AI.” | False after split. |

Sarvam (docs.sarvam.ai, 2026-08-16): WhatsApp-style agents use a **short** system prompt (2–3 sentences) + `sarvam-105b`. Voice agents use STT (Saaras) + LLM + TTS (Bulbul) with **concise spoken** instructions. Temperature default in their API is **0.2**, not 0.7. Our More-tab Creativity slider is the wrong control for normal users and fights factual Train answers. Voice already caps `maxTokens` at 220 in `chatbot.service`. Chat should stay short without a user-facing max-length field.

### 8b. Create flow (few clicks)

1. Choose **AI Chat** or **AI Calling** (two support-style products, not one shared brain). List page: toggles/filters to see chat bots vs calling bots.
2. Name + short “what this bot should do” in the user’s own words (business, tone, never-promise). **Generate** user-facing instructions via existing `createChatCompletion` (do not invent a new model). User can edit the generated text once. Platform chrome stays server-side.
3. Train: Q&A only as the default path. Show each item: title, content, **Ready** if embedded. User must see exactly what was trained.
4. Guard Train: reject empty/tiny/duplicate dumps; cap count or size so people cannot paste a novel of junk. URL/PDF import is extra surface — hide from the simple path (engine can stay).
5. Chat bot: Default toggle (important), Pause/Activate, optional business hours. No voice speaker.
6. Calling bot: Pause/Activate = this calling brain on/off; **global AI calling on/off** (see 8c); only **priority** calling fields (below); greeting; speaker; language.

Do not connect chat bot and calling bot to the same `instructions` / same Train rows.

### 8c. Global AI calling on/off + which calling settings move

**Already exists (buried):** `CallingSettings.aiAutoAnswer` (checkbox under Calls → Customize → Advanced) and `routingMode` (`ai_only` / `agents_first` / `ai_then_agents`) under Who answers. `AiBot.enabled` pause does **not** reliably stop calls because `ensureDefaultBot` can create another brain.

**Required now**

- One obvious **AI calling on/off** (AI Bot page / calling bot card), wired to existing `aiAutoAnswer` (and calling-bot `enabled`). When off: `decideCallRoute` must not send the call to AI; do **not** `ensureDefaultBot`.
- While creating/editing an **AI Calling** bot, show only **priority** settings (user: not every Calls Customize section):

  | Move onto calling bot (priority) | Leave in Calls Customize for later / org-level |
  |----------------------------------|-----------------------------------------------|
  | AI calling on/off (`aiAutoAnswer`) | Max concurrent, ring timeout, recording consent |
  | Greeting (`aiGreeting`) | Missed-call WhatsApp template copy (can stay org) |
  | Speaker + language (Sarvam TTS/STT) | Live transfer (SAMYOJ-12 — stay `message_only`) |
  | This bot answers calls (`defaultBotId` → this calling bot) | After-hours mode matrix (simplify later) |

User said **complete calling-settings replacement** comes in a later dictation. Do not redesign the whole Calls → Customize IA in this ticket.

### 8d. System prompt architecture (backend)

Two layers, both already almost there:

1. **Platform chrome** (hidden): identity, “use Train, don’t invent,” language match, no prompt leak, voice spoken-style (`VOICE_SAFETY_RULES`) vs chat short-style. Keep in `chatbot.service` / `voice-instructions.ts`. Chat vs calling bots pick the matching chrome + matching Sarvam model.
2. **Business personality** (user): generated from their short description, stored in `AiBot.instructions`. Calling bots store **calling** personality only (no HTML voice-block hack required if the bot `channel` is CALL). Chat bots store **chat** personality only.

Generate-personality API: one authenticated POST, org+number scoped, uses the same brain, returns draft instructions, user saves. Do not put temperature in the UI.

### 8e. Training (vector DB honesty)

- Keep Azure embeddings. Show Ready vs still learning (already `hasEmbedding`).
- List is the source of truth of “what I trained.”
- Add guards so junk does not enter the index (min length, max items, duplicate titles).
- After split, Train on a chat bot must **not** answer calls and vice versa (`searchKnowledgeBase(bot.id, …)` already per-bot — routing must pick the right bot).

### 8f. Remove from AI Bot UI (do not skip)

Ready-made bot templates (`AiBotProfessionalBrainPicker` / `professionalBrains`). Connect tab. More: reply style (creativity, max length, replies per minute). Analytics. Recent activity. Version history. Activity log. Change-note field tied to versions. How it works theory. “This AI also answers voice calls” on a chat bot.

**Keep (simple):** name, generate/edit personality, Train Q&A, Default (chat), Pause/Activate, Try-it test for chat, voice preview for calling.

---

## Mapping to Jira (set 2)

| Spec | Jira |
|------|------|
| §7 Inbox disable Auto · default | [SAMYOJ-53](https://teamwebstarts.atlassian.net/browse/SAMYOJ-53) (Relates 46, 52) |
| §8 AI Bot redesign (chat vs calling, generate prompt, train, strip console, calling on/off) | [SAMYOJ-52](https://teamwebstarts.atlassian.net/browse/SAMYOJ-52) |

**Shipped 2026-08-16:** §7 [SAMYOJ-53](https://teamwebstarts.atlassian.net/browse/SAMYOJ-53). **Night pass:** §8 [SAMYOJ-52](https://teamwebstarts.atlassian.net/browse/SAMYOJ-52) Chat vs Calling, generate personality, simple Train, strip console, `aiAutoAnswer` on the calling bot. Test-deploy only.

---

# Product set 3 — Calls recents, post-call summary, AI Reports, admin (researched 2026-08-16)

Long-form copy for later (Confluence not connected): [docs/product/CALLS_AI_USAGE_ADMIN_2026-08-16.md](../product/CALLS_AI_USAGE_ADMIN_2026-08-16.md).

---

## 9. Calls history: remove Help, say Incoming/Outgoing, mobile Recents pattern

**Problem:** The Calls screen looks like a telecom console. Help icon + Inbound/Outbound jargon. History always shows the phone number and a generic phone icon — not how a normal phone Recents list works.

**Today**

- Right rail: Settings + **Help** (`HelpCircle`) → `CallsRailPanel` tips titled Outbound / Inbound (`CallsPage.tsx`, `CallsRailPanel.tsx`).
- Call detail: “Inbound call” / “Outbound call” (`CallDetailView.tsx`). DB: `USER_INITIATED` / `BUSINESS_INITIATED`.
- List: `CallListItem` title = name or formatted phone; **second line is always the number**; icon is generic `Phone` / callback. Status is a text badge, not incoming/outgoing/missed glyphs. Filter chip **Out**.
- Analytics panel data uses `inbound` / `outbound`; one card is “Calls made”.

**Mobile Recents research (Android Dialer / Google Phone / iOS / WhatsApp Calls)**

- Incoming answered: receive-arrow, green or blue.
- Outgoing: make-arrow, green.
- Missed: missed-arrow, **red** (name or glyph).
- Title = **contact name**. Number is not the list subtitle when a name exists.
- Time on the right. Filters All / Missed (and Incoming / Outgoing).

**Required**

1. Remove Help icon and help rail. Keep Settings.
2. User-visible copy: **Incoming** / **Outgoing** everywhere (detail, filters, empty states). Keep Prisma enums.
3. List: name + type glyph/color + time + duration. **No phone number on the row** when the contact has a name. Unknown: short friendly label, not a full `+91` line. Number may remain on detail for callback.
4. Missed = red glyph (and/or red name), matching phone Recents. Incoming vs outgoing glyphs on every row.
5. Filters: Incoming / Outgoing instead of **Out**.

---

## 10. After AI customer calls: summary on the call and in Inbox

**Problem:** User wants a summary after every AI ↔ customer call, shown on that call and in the Inbox chat if one exists.

**Today**

- On AI voice `end()`, `generateSummary()` writes `Call.metadata.summary` and an **internal note** (`persistCallSummaryNote`).
- `CallDetailView` **does not render** the summary.
- Inbox **strips** `isCallSummary` messages (legacy fake inbound bubbles). `ChatThread` also filters them.

**Required**

1. After an AI-handled call with a transcript, keep generating the summary.
2. Show it on the **Calls** detail/thread as a system card (not a spoken transcript line).
3. If `conversationId` exists, show the **same** summary in **Inbox** as a visible call-summary / system card — not a customer inbound bubble, not hidden.
4. LLM context must still ignore it (`isCallEvent` / dedicated metadata). Do not restore the old inbound-bubble bug.
5. Human-only calls: no AI summary unless product later asks.

---

## 11. Reports: dedicated AI usage section (every AI surface)

**Problem:** Every AI use in the product should be tracked in detail (input/output, limits, analytics) and shown in Reports as its **own** section.

**Today**

- `AiUsageLog` + `recordAiUsage` only `chat` | `embedding`. Prompt/completion columns exist.
- STT/TTS **not** logged. Content Studio tokens not written to the log. Call-summary LLM looks like generic `chat`.
- Reports card “AI & Calls” mixes AI requests, total tokens, completed calls, messages received. No input vs output, no limit bar, no per-surface breakdown. `getOrgUsageSummary` is richer than the UI.

**Required**

1. Record **every** AI path: chat bot, calling LLM, STT, TTS, embeddings, Content Studio, generate-personality, call summary — named actions.
2. Reports **separate section**: requests, input tokens, output tokens, by action/surface, month used vs `monthlyTokenLimit`.
3. Pricing: store **units** now. Money only with a later rate card. **Do not mix Meta Cloud API fees** into Samyoj AI cost.
4. Number-scoped. Fail closed when the monthly limit hits (already 429 on chat).

---

## 12. Platform admin dashboard

**Problem:** Operators need a Samyoj-wide admin view of how **each customer org** uses the product (funnel, features, AI, billing, Meta errors) — not the org Dashboard.

**Canonical spec (2026-08-16, shipped 2026-08-17):** [`docs/product/PLATFORM_ADMIN_2026-08-16.md`](../product/PLATFORM_ADMIN_2026-08-16.md). First release is in code (`admin/` `:3001`, `/api/platform/*`). Do **not** rebuild. Remaining: SAMYOJ-35 TARGET, SAMYOJ-56 STT/TTS honesty, impersonation, SMTP.

**Today:** operator console exists. `User.role = ADMIN` is still the org founder, not Samyoj staff. `GET /api/ops/recent-errors` is **removed**.

---

## Mapping to Jira (set 3)

| Spec | Jira |
|------|------|
| §9 Calls recents UX | [SAMYOJ-54](https://teamwebstarts.atlassian.net/browse/SAMYOJ-54) — **shipped 2026-08-16** |
| §10 Post-call summary Inbox + Calls | [SAMYOJ-55](https://teamwebstarts.atlassian.net/browse/SAMYOJ-55) — **shipped 2026-08-16** |
| §11 Reports AI usage | [SAMYOJ-56](https://teamwebstarts.atlassian.net/browse/SAMYOJ-56) — **shipped 2026-08-16** (units, not Meta fees) |
| §12 Platform admin dashboard | [SAMYOJ-57](https://teamwebstarts.atlassian.net/browse/SAMYOJ-57) — **first release shipped 2026-08-17**; remaining 35/56/impersonation/SMTP |

---

## 13. Inbox New chat = same optional person details as Contacts

**Problem:** User can start a chat from Inbox by adding a number. That person must land on the **same Contact** as Contacts (this WhatsApp number’s workspace). When adding a person on Contacts we already ask extra details (email, tags, notes, custom fields, campaign consent). Inbox New chat must ask **those same fields**. All extra fields are **optional** — still show them. Phone stays required.

**What exists today**

| Layer | Current behavior | Path |
|-------|------------------|------|
| Inbox form | **Phone** (required) + **Contact name** (optional). Nothing else. | `NewChatSlideOver.tsx` |
| Inbox API | `POST /inbox/start` body: `{ phone, name? }`. | `server/src/modules/inbox/routes.ts` `startChatSchema` |
| Contact row | Upsert on `@@unique([organizationId, whatsappNumberId, normalizedPhone])`. Conversation upsert on `(org, contactId, whatsappNumberId)`. **Linkage is already correct** — do not invent a second contact table. | Same route; `Contact` model |
| Create payload | `optedIn: true`, `source: 'OUTBOUND'`, **no** `consentSource` / `consentAt`. Update path only writes `name`. | `inbox/routes.ts` create/update |
| Contacts form | Phone, name, email, tags, notes, custom fields (`key=value` lines), **Allow campaign messages** (default off). | `ContactsPage.tsx` `emptyForm`; `POST /contacts` |
| Contacts consent | `contactCreateConsentFields` — omit checkbox → `optedIn: false` only. Check → audit (`consentSource` `MANUAL`, `consentAt`, decision JSON). Campaigns fail-closed: `optedIn` + `consentSource` + `consentAt` + no `optOutAt`. | `contacts/consent.ts`, `whatsapp-number-isolation.mdc` |
| Inbox after open | Tags + **conversation** internal notes. Profile shows email / opt-in **if already on the contact**. New chat cannot set them. `Contact.notes` ≠ Inbox `InternalNote`. | `InboxDetailsPanel.tsx`, `ProfileCard.tsx` |

**Required**

1. Inbox New chat collects the **same optional fields** as Contacts Add contact: name, email, tags, notes (`Contact.notes`), custom attributes, campaign-consent checkbox. Phone required. None of the extras are mandatory.
2. Persist onto that Contact; keep conversation **upsert** (existing chat opens, no duplicate thread). Number-scoped via `X-WhatsApp-Number-Id`.
3. Consent must **match Contacts**, not today’s silent `optedIn: true`. Unchecked / omitted → not campaign-eligible. Checked → same audit fields as Contacts (`MANUAL` or a dedicated `INBOX_START` source — pick one and use `contactConsentData`). Starting a 1:1 chat is not campaign consent.
4. Existing contact (same normalized phone on this number): merge provided optional fields; do not wipe name/email/tags/notes/attrs/consent when the user left a field blank.
5. After save, Contacts list/detail shows those fields; Inbox profile shows email / tags / campaign badge from the **same** row.
6. Prefer **one shared form** (or the same field list + validators) so Inbox and Contacts cannot drift.

**Not this ticket:** CSV import, changing the unique key, cross-org Meta number (SAMYOJ-49), Inbox conversation internal notes vs `Contact.notes`.

**Done when:** User can add a person from Inbox with optional details, skip extras, still start the chat, and that person is the same Contact on Contacts for this WhatsApp number — without auto campaign opt-in.

---

## 14. Remove AI calling from Calls → Customize

**Problem:** User already said AI calling personality / on-off / greeting / speaker belong on the **AI Calling bot** ([SAMYOJ-52](https://teamwebstarts.atlassian.net/browse/SAMYOJ-52)). Calls Customize still has a full AI-calling block. They now want that **AI calling UI removed from calling settings**. Full Customize rewrite (after-hours matrix, missed copy, …) stays **later**. This ticket is only the AI chrome.

**What exists today** (`CallingSettingsForm.tsx`)

| Section | AI calling? | Keep in Customize? |
|---------|-------------|--------------------|
| Who answers | Yes — AI Bot / Human / AI first + **Which AI** + “Edit personality & training” | **Remove.** Routing + which calling bot live on SAMYOJ-52. |
| Call behavior | Human ring timeout, etc. | Keep |
| Greetings | Greeting text + recording-consent toggle (mixed) | Greeting → calling bot (52). **Recording consent** stays org telephony. |
| After hours / Missed call reply | Org telephony | Keep (later rewrite) |
| Voice & language | Speaker, language, STT hint — AI voice | **Remove** from here once on the calling bot (52). |
| AI Bot personality | Deep link to `/ai-bot` | **Remove** |
| Training data | Deep link to `/ai-bot` | **Remove** |
| Advanced | Max concurrent, ring timeout, **Max AI call length**, **AI can answer automatically** (`aiAutoAnswer`) | Keep concurrent + ring. **Remove** AI length + auto-answer checkbox (on/off is 52 / `aiAutoAnswer` wired on the calling bot). |

`applyWhoAnswers` still writes `routingMode` + `aiAutoAnswer` from Who answers cards. Buried checkbox duplicates that. `ensureDefaultBot` can still spawn a bot when AI is “off” — that stays a 52 engine fix, not this UI ticket.

**Required**

1. Strip AI calling controls from Calls → Customize: Who answers, Which AI, personality/training nav, Max AI call length, “AI can answer automatically.”
2. Do **not** leave users with nowhere to turn calling AI on, pick greeting/speaker, or choose the calling bot. Land **with or after** SAMYOJ-52. Relates 52; do not ship a hole.
3. Keep non-AI knobs: human ring / max concurrent, after hours, missed reply, recording consent. Live transfer stays [SAMYOJ-12](https://teamwebstarts.atlassian.net/browse/SAMYOJ-12) (`message_only`).
4. Do not rebuild LLM / Train. Do not start the later full Customize replacement.

**Done when:** Calls → Customize has no AI Bot / training / auto-answer / which-AI / AI max-length UI. Those live on the calling bot (52). Org telephony knobs remain.

---

## Mapping to Jira (set 4)

| Spec | Jira |
|------|------|
| §13 Inbox New chat contact fields | [SAMYOJ-58](https://teamwebstarts.atlassian.net/browse/SAMYOJ-58) — **shipped 2026-08-16** |
| §14 Strip AI calling from Customize | [SAMYOJ-59](https://teamwebstarts.atlassian.net/browse/SAMYOJ-59) (Relates [SAMYOJ-52](https://teamwebstarts.atlassian.net/browse/SAMYOJ-52)) — **shipped 2026-08-16** with 52 |

---

## Implementation note — SAMYOJ-52 / 59 / 56 (2026-08-16 night)

Landed together as one AI track. Additive Prisma migration `20260816220000_ai_bot_channel_and_usage` (startup-safe; clones existing default chat bot into a CALL bot with copied Train so calling does not break). Reused `AiBot`, `KnowledgeBaseItem`, Azure embeddings, `buildConversationMessages`, Sarvam chat + `sarvam-105b-conversations` + Saaras/Bulbul, `decideCallRoute`. Hardcoded temperature **0.2**. `ensureDefaultBot` no longer creates. Customize save sends telephony fields only. Reports `GET /settings/ai/usage` surfaces; **no Meta Cloud API fees**. Test-deploy only.
