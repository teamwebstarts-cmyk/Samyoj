# Your prompt points → Jira → code (recheck 2026-08-16)

Single map of **this session’s dictation** (the four prompts you pasted). Specs stay in [PRODUCT_TASKS_2026-08-16.md](./PRODUCT_TASKS_2026-08-16.md). This file answers: **kya hua, kya baki, kya pura nahi, kuch chhota skip to nahi.**

Jira checked 2026-08-16 against epic [SAMYOJ-8](https://teamwebstarts.atlassian.net/browse/SAMYOJ-8). Board **Done** can look yellow (category map) — status **name** is what matters.

**Legend**

| Status | Meaning |
|--------|---------|
| **Done** | In code + Jira Done. Local test-deploy; not customer production. |
| **Not built** | Jira exists; no product code yet. |
| **Deferred** | Filed so it is not lost; do not start until you ask. |
| **Already was** | True before this dictation; no new ticket. |
| **Partial** | Ticket shipped; one small slice of your wording is still open. |
| **Later (you said)** | You told us to talk later; not skipped. |

You said **30+** tasks. **14** items from these prompts are filed (SAMYOJ-46–59). Unshared notebook items are **not invented**.

**Follow-ups landed later 2026-08-16 (same tickets, not new Jira):** 46 one All-chats switch + Inbox AI-on icon + **AI Bot** filter; 49 new tab starts logged out (cloned `sessionStorage` dropped; leftover `localStorage` JWTs stripped, not adopted); 54 Recents labels + iOS/WhatsApp colors; 55 team-only summary card, never Cloud-sent. Number isolation 4b rechecked, not rebuilt.

---

## Set 1 — first prompt

### P1. Apply / unapply one bot for all chats; do not touch personal Inbox picks

- **You asked:** New control on AI Bot **cards** next to Pause / Activate. One click apply all chats, one click remove all. Inbox per-person bot stays. Pause/Activate is **not** this toggle.
- **Jira:** [SAMYOJ-46](https://teamwebstarts.atlassian.net/browse/SAMYOJ-46) — Done
- **Code:** **Done.** `MANUAL` (Inbox named pick) vs `APPLIED`. Apply skips MANUAL. Remove only APPLIED + that bot. Number-scoped; missing header + multiple numbers → 409. Follow-up: Inbox list Bot icon when `botActive`; filter chip **AI Bot**.
- **Left:** Nothing from this point. Inbox Pause vs journeys is older [SAMYOJ-5](https://teamwebstarts.atlassian.net/browse/SAMYOJ-5), not this button.

### P2. Card margin throughout dashboard; Appearance slider; same for new screens

- **You asked:** Cards too tight. Add margin. Control how much from Appearance. Universal for product + development.
- **Jira:** [SAMYOJ-47](https://teamwebstarts.atlassian.net/browse/SAMYOJ-47) — Done
- **Code:** **Done** for Appearance slider (`--card-gap` / `--card-pad`) + connected dashboard + pre-connect grids.
- **Partial:** Not every card grid in the whole app was rewritten (Inbox thread, nested widgets). New screens should use the CSS vars. No extra Jira — not a new product behavior.

### P3. Skeleton loaders wherever DB / custom data loads

- **You asked:** Whole screens that load data get layout skeletons, not a spinner flash.
- **Jira:** [SAMYOJ-48](https://teamwebstarts.atlassian.net/browse/SAMYOJ-48) — Done
- **Code:** **Done** on Campaigns, Tickets, Commerce, Contacts, AI Bot, Team, Automations, Leads, Settings, Content Studio, flow/campaign wizards. Dashboard / Inbox / Reports / Calls / Templates / Billing already had them.
- **Partial:** Nested widgets can still spinner; template-library / onboarding shells were out of the listed pages. No extra Jira.

### P4. Multiple numbers = separate data (user-base separation)

- **You asked:** Multiple numbers, each manages its own data.
- **Jira:** none (on purpose)
- **Code:** **Already was** (`whatsappNumberId`). Recheck comment on 49. Do not redo.

### P5. Session-based login (this tab only; other tab = other account)

- **You asked:** Login lives only where they logged in. Same browser, another tab, another account.
- **Jira:** [SAMYOJ-49](https://teamwebstarts.atlassian.net/browse/SAMYOJ-49) 4a — Done
- **Code:** **Done (Pick A).** Live JWTs in `sessionStorage`. HttpOnly cookies are **not** this ticket ([SAMYOJ-3](https://teamwebstarts.atlassian.net/browse/SAMYOJ-3) still open). XSS can still read sessionStorage. Extra tabs must log in again.

### P6. Same WhatsApp number, different Samyoj account → fresh data, never my inbox

- **You asked:** Account A keeps number data. Account B connecting the same number must **not** get A’s data — fresh dashboard.
- **Jira:** [SAMYOJ-49](https://teamwebstarts.atlassian.net/browse/SAMYOJ-49) 4b — Done
- **Code:** **Done** as researched: while A is **active**, B **409**. After A **disconnects**, B gets a **new empty** workspace (not A’s row). Two **live** orgs on one Meta number was **not** built (inbound cannot split). In-org reconnect same phone still reuses A’s workspace.

### P7. Disconnect visible on dashboard (not ~3 clicks)

- **You asked:** Show Disconnect on the dashboard card.
- **Jira:** [SAMYOJ-51](https://teamwebstarts.atlassian.net/browse/SAMYOJ-51) 5a — Done (merged dashboard ticket)
- **Code:** **Done.** Soft disconnect + confirm.

### P8. Message performance: circular diagram only; hover tooltip in that color

- **You asked:** Remove the side numbers. Donut in the center. Hover = small tooltip in the segment color.
- **Jira:** [SAMYOJ-51](https://teamwebstarts.atlassian.net/browse/SAMYOJ-51) 5b — Done
- **Code:** **Done.**

### P9. Campaigns: reschedule + repeat every N days (same people)

- **You asked:** Pick a date to reschedule. Repeat every 2 / 3 / N days; send again to those people.
- **Jira:** [SAMYOJ-50](https://teamwebstarts.atlassian.net/browse/SAMYOJ-50) — Done
- **Code:** **Done.** Same audience, wall-clock time in campaign timezone, new run (old stats kept). RUNNING → 409. Consent still fail-closed.
- **Not skipped:** “how much time” = keep send **time of day** (comment on 50).

### P10. Remove Health score (dashboard)

- **You asked:** Remove Health score.
- **Jira:** [SAMYOJ-51](https://teamwebstarts.atlassian.net/browse/SAMYOJ-51) 5c — Done
- **Code:** **Done on dashboard.**
- **Partial (you said dashboard):** Reports page can still show Health. Say if that must go too. Not a missing ticket unless you want Reports stripped.

### P11. Dashboard alerts: no “Open Inbox” buttons; click the alert to go there

- **You asked:** Remove Open Inbox / Open … buttons. Hover + click the row → that place.
- **Jira:** [SAMYOJ-51](https://teamwebstarts.atlassian.net/browse/SAMYOJ-51) 5d — Done
- **Code:** **Done.** Whole row is the link.

---

## Set 2 — AI Bot / Inbox picker prompt

### P12. Inbox: disable default-bot selection (Auto · default)

- **You asked:** Pause / Activate already exists on AI Bot. Inbox should not have a second default control. **Default bot stays important** on the AI Bot page.
- **Jira:** [SAMYOJ-53](https://teamwebstarts.atlassian.net/browse/SAMYOJ-53) — Done
- **Code:** **Done.** Named enabled bots only. Tapping the already-checked default does **not** pin. Paused copy does not say Auto.

### P13. Global AI calling on / off (put on AI Bot, not buried)

- **You asked:** Calling already has a setting; make a clear global on/off. Research; put it on AI Bot while creating the calling bot.
- **Jira:** [SAMYOJ-52](https://teamwebstarts.atlassian.net/browse/SAMYOJ-52) — wired to existing `aiAutoAnswer`
- **Code:** **Done.** Global toggle on AI Bots → Calling. When off, `decideCallRoute` does not send to AI and `ensureDefaultBot` does not spawn.

### P14. Complete calling-settings replacement (“talk later”)

- **You asked:** Replace calling settings with better options — **later**. For now, move AI calling into the AI Calling bot.
- **Jira:** not a separate “full Customize rewrite” ticket (you deferred it)
- **Status:** **Later (you said).** AI chrome only is [SAMYOJ-59](https://teamwebstarts.atlassian.net/browse/SAMYOJ-59). Live transfer stays [SAMYOJ-12](https://teamwebstarts.atlassian.net/browse/SAMYOJ-12).

### P15. AI Chat bot vs AI Calling bot — separate brains, few clicks, reuse engine

- **You asked:** One brain today for chat + call. Too much engineering (tabs). Do **not** rebuild algorithms. Separate create: AI Chat **or** AI Calling. Few clicks. Support-style bots. List toggles to see chat vs calling. Default bot important.
- **Jira:** [SAMYOJ-52](https://teamwebstarts.atlassian.net/browse/SAMYOJ-52)
- **Code:** **Done.** `AiBot.channel` CHAT vs CALL. Separate Train rows. List Chat / Calling filters.

### P16. Personality: user types a bit → AI generates system prompt; platform chrome hidden

- **You asked:** User cannot write a long prompt. Type intent → generate instructions. Huge behind-the-scenes chrome stays ours. Business personality is theirs. Research Sarvam chat vs calling config.
- **Jira:** SAMYOJ-52 (same ticket — all AI Bot redesign bullets live here)
- **Code:** **Done.** Short intent → Generate. Platform chrome stays server-side. Temperature hardcoded 0.2.

### P17. Train: few clicks, show what was trained, vector Ready, block junk, little knowledge is OK

- **You asked:** Training stays important. Show what they trained. Do not dump useless content. Easy for chat **and** calling (separate after split).
- **Jira:** SAMYOJ-52
- **Code:** **Done.** Q&A default, Ready/Learning, junk guards. URL/PDF hidden from the simple path (API still exists).

### P18. Strip console: templates, Connect, More, analytics, activity, versions, theory

- **You asked:** Remove ready-made bot templates completely. Connect not important (optional at most). Remove reply style / creativity / max length / replies-per-minute. Remove analytics, recent activity, version history, activity log. Remove How-it-works theory.
- **Jira:** SAMYOJ-52 required-remove list
- **Code:** **Done in UI.** Templates / Connect / More / analytics / versions / How-it-works removed from AI Bot page. Unused files (`professionalBrains.ts`, `AiBotHowItWorks.tsx`) can linger. Server version/analytics routes still exist.
- **Not skipped:** Connect “not important” vs “we can add it” → spec = **no Connect tab**; optional one-line handoff only. Try-it (rechecked 2026-08-17): chat conversation test uses draft personality; calling has greeting preview **and** a typed test on the calling brain. Unused files (`professionalBrains.ts`, `AiBotHowItWorks.tsx`) still linger off-page.

### P19. Two support bots (chat + calling), not professional-brain templates

- **You asked:** One support-style bot for AI Chat, one for AI Calling — not the ready-made library.
- **Jira:** SAMYOJ-52
- **Code:** **Done.** Support-style chat bot and calling bot, not the ready-made library.

---

## Set 3 — Calls / Reports / admin prompt

### P20. Calls: remove Help icon

- **Jira:** [SAMYOJ-54](https://teamwebstarts.atlassian.net/browse/SAMYOJ-54) — Done
- **Code:** **Done.** Settings stay. Unused `CallsRailPanel.tsx` file can linger — not a product miss.

### P21. Incoming / Outgoing (not Inbound / Outbound)

- **Jira:** SAMYOJ-54
- **Code:** **Done.** Prisma enums unchanged.

### P22. Recents like a phone: name, glyphs, missed red, hide number when named

- **You asked:** Research mobile Recents. Incoming / outgoing / missed colors + icons. Do not show the number when there is a name.
- **Jira:** SAMYOJ-54
- **Code:** **Done.** Unknown = friendly short label, not full `+91` as the title. Number still on **detail** for callback.

### P23. After AI ↔ customer call: summary on the call **and** in Inbox

- **You asked:** Every AI call that ends → summary. Show on that call. Put the same summary in the Inbox chat if it exists.
- **Jira:** [SAMYOJ-55](https://teamwebstarts.atlassian.net/browse/SAMYOJ-55) — Done
- **Code:** **Done.** System card (not a fake customer bubble). Old threads backfill on Inbox GET. Human-only calls: no AI summary (you said AI-to-user).

### P24. Reports: dedicated AI usage (every AI surface, in/out, limits, analytics)

- **You asked:** Track every AI use in the system. Own Reports section. Incoming/outgoing, input/output, pricing, limits.
- **Jira:** [SAMYOJ-56](https://teamwebstarts.atlassian.net/browse/SAMYOJ-56)
- **Code:** **Done.** Reports has its own AI usage section: chat, calling LLM, listening, speaking, training, Content Studio, write personality, call summary. Input vs output. Month vs limit. Units, not rupees, not WhatsApp fees.
- **Honest on “pricing”:** ticket stores **units** now. Rupee prices wait for a rate card. **Do not mix Meta message fees** into Samyoj AI cost. That is documented, not skipped.

### P25. Future platform admin dashboard (logins, APIs, features per customer)

- **You asked:** Later: admin (not the customer Dashboard) — who logged in, what they use, APIs, AI in depth, user-friendly.
- **Jira:** [SAMYOJ-57](https://teamwebstarts.atlassian.net/browse/SAMYOJ-57) — In Progress; **first release in code 2026-08-17**
- **Code:** **Partial.** `admin/` `:3001` + `/api/platform/*` (cookie, CSRF, TOTP, RBAC). Spec: `docs/product/PLATFORM_ADMIN_2026-08-16.md`. Remaining: TARGET billing (35), STT/TTS honesty (56), impersonation, SMTP. Do not rebuild.

### P26. Documentation in our space for later

- **You asked:** Proper docs so we can use them later (Confluence / space).
- **Status:** **Repo is the space.** Confluence wiki API still 404. Durable copy: `docs/product/CALLS_AI_USAGE_ADMIN_2026-08-16.md`, `docs/product/INBOX_CONTACT_AND_CALLING_AI_2026-08-16.md`, plus this file. Not skipped.

---

## Set 4 — Inbox New chat + strip AI from calling settings

### P27. Inbox New chat = same optional person details as Contacts; same Contact row

- **You asked:** Adding a number from Inbox must be the same Contact. Show the same optional fields as Contacts Add (all optional, still show them). Phone required.
- **Jira:** [SAMYOJ-58](https://teamwebstarts.atlassian.net/browse/SAMYOJ-58) — Done
- **Code:** **Done.** Email, tags, notes, custom, campaign consent (`INBOX_START`). Unchecked ≠ campaign eligible. Blank extras do not wipe an existing contact. You started “in the AI” then corrected — **not** added to the AI Bot form.

### P28. Remove AI calling from Calls → Customize

- **You asked:** AI calling settings leave calling settings; they live on the AI Calling bot.
- **Jira:** [SAMYOJ-59](https://teamwebstarts.atlassian.net/browse/SAMYOJ-59)
- **Code:** **Done** with 52. Who answers / Which AI / voice / personality+training / auto-answer / max AI length removed from Customize. Org telephony knobs remain. Full Customize rewrite stays later (P14).

---

## Process you asked for (not product tickets)

| You asked | What we did |
|-----------|-------------|
| Research before creating Jira | Done. Spec in PRODUCT_TASKS + durable `docs/product/` |
| Note the real problem, not a fake task | Each Jira body names current files + done-when |
| Recheck so nothing escapes | First pass: DICTATION_RECHECK. This file: your pasted prompts vs Jira vs code |
| More tasks coming | Wait. Do not invent the rest of “30+” |

---

## Scoreboard (your points only)

| | Count | Keys |
|--|-------|------|
| **Done in code** | 13 tickets | 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 58, 59 |
| **Partial (first release)** | 1 | **57** (P25) — admin app + `/api/platform`; remaining 35/56/impersonation/SMTP |
| **Not built (next when you say)** | 0 from these prompts besides remaining 57 slices | |
| **Already was** | 1 point | P4 in-org numbers |
| **Later you said** | 1 point | P14 full Customize rewrite |

**Nothing from these four prompts is missing a Jira home.** Small leftovers (Reports Health, leftover Help file, not-every-card-grid, nested skeletons) are **not** new tickets.

---

## Do not start until you ask

1. SAMYOJ-57 remaining slices only (TARGET billing, STT/TTS honesty, impersonation, SMTP) — do not rebuild the admin app
2. Cookies (SAMYOJ-3) — conflicts with tab sessions unless you pick

Customer production = **no**. Test this batch locally: `http://localhost:3000` (customer) and `http://localhost:3001` (platform admin).
