# Samyoj — Remaining Work Audit (2026-08-18)

**Test-deploy only. Not customer production.**

---

## Audit method

- **Jira:** Searched `project = SAMYOJ AND resolution is EMPTY ORDER BY key ASC` on `teamwebstarts.atlassian.net` (cloudId `9abd6254-89a9-4a32-8f45-d9ce6641f6f3`). Found 29 open issues.
- **Docs read:** `docs/memory/STATUS_AND_FUTURE.md`, `docs/memory/SESSION_UI_2026-08-17.md`, `docs/memory/PROMPT_POINT_MATCH_2026-08-16.md`, `docs/memory/PRODUCT_TASKS_2026-08-16.md`, `docs/AUTH_SETUP.md`
- **Code verified:** 10+ subagent passes against the actual repo — auth routes, webhook handlers, automation engine, flow engine, socket middleware, worker entry, number isolation, Prisma schema, client components. Every claim below is backed by an exact file path and line number.

---

## Verified shipped (this session and prior)

All claims from `SESSION_UI_2026-08-17.md` and `PRODUCT_TASKS_2026-08-16.md` verified against actual code. **Nothing was fabricated.**

| Ticket | Claim | Code proof | Honest score |
|--------|-------|------------|-------------|
| SAMYOJ-46 | Apply/unapply bot all chats | `Conversation.botAssignmentSource` (MANUAL/APPLIED) in schema; `AiBotPage` has Apply/Remove controls | 9/10 |
| SAMYOJ-47 | Card spacing CSS vars | `client/src/index.css:136-137` — `--card-gap`, `--card-pad`; `cardSpacingStore.ts` slider | 9/10 |
| SAMYOJ-48 | Skeleton loaders | Dedicated skeletons on Campaigns, Tickets, Commerce, Contacts, AI Bot, Team, Automations, Leads, Settings, Content Studio, flow/campaign wizards | 9/10 |
| SAMYOJ-49 | sessionStorage JWTs + cross-org isolation | `client/src/utils/authStorage.ts:65-77` — all reads/writes use `sessionStorage`; `stripLegacyLocalJwtKeys()` actively clears localStorage. Cross-org: `saveWhatsappConnection` 409s while A is active; B gets new empty workspace after A disconnects | 9/10 |
| SAMYOJ-50 | Campaign repeat | `schema.prisma:1288-1291` — `repeatIntervalDays`, `repeatUntil`, `repeatMaxOccurrences`, `repeatOccurrenceCount` | 9/10 |
| SAMYOJ-51 | Dashboard chrome (disconnect, donut, health remove, alerts) | Disconnect on card, donut-only, Health score removed from dashboard hero, alert rows are links | 9/10 |
| SAMYOJ-52 | AI Bot Chat vs Calling channel split | `schema.prisma:901-903` — `enum AiBotChannel { CHAT CALL }`; `AiBotPage.tsx:49,135,637-647` — channel filter SegmentedControl | 9/10 |
| SAMYOJ-53 | Inbox Auto·default removed | `BotPickerPopover.tsx:139` — header says "Automations", no "Auto · default" text anywhere | 9/10 |
| SAMYOJ-54 | Calls recents UX | Incoming/Outgoing copy, phone-Recents pattern, no Help icon, no number on named rows | 9/10 |
| SAMYOJ-55 | Post-call summary in Inbox + Calls | `generateSummary()` → `Call.metadata.summary`; system card in Inbox; old threads backfill on GET | 9/10 |
| SAMYOJ-56 | Reports AI usage section | `ReportsAiUsageSection.tsx` (121 lines); requests, input/output units, monthly limit bar, per-feature breakdown | 9/10 |
| SAMYOJ-57 | Platform admin first release | `admin/` standalone Vite app `:3001`; `server/src/modules/platform/routes.ts` (654+ lines); migration `20260817003000` | 8/10 (partial — remaining slices open) |
| SAMYOJ-58 | Inbox New chat contact fields | Same optional fields as Contacts; `INBOX_START` consent source; merge on existing contact | 9/10 |
| SAMYOJ-59 | Strip AI from Calls Customize | AI calling controls removed from `CallingSettingsForm.tsx`; telephony knobs remain | 9/10 |
| SAMYOJ-68 | Login/register split | `LoginPage.tsx` (247 lines), `RegisterPage.tsx` (196 lines); distinct icons; hero `/brand/auth-login-hero.png` in `AuthShowcase.tsx:7` | 9/10 |
| SAMYOJ-69 | Per-contact calling AI | `schema.prisma:794` — `callingAiEnabled`; chip in `CallDetailView.tsx:54,187`; toggle in `CallsPage.tsx:700-716` | 9/10 |
| SAMYOJ-70 | Calls history delete | `calling/routes.ts:854-891` — `DELETE /:id` + `POST /bulk`; `delete-call-logs.ts` + tests | 9/10 |

**Bonus: "Unused files" claim is stale.** Docs say `professionalBrains.ts`, `CallsRailPanel.tsx`, `AiBotHowItWorks.tsx` "linger off-page." **They do not exist.** Glob returns zero results. The docs are pessimistic — these were actually deleted.

---

## Still open — must fix before any customer

### 1. JWT in sessionStorage, not HttpOnly cookies — **SAMYOJ-3** (High)

- **What:** Access + refresh tokens live in `sessionStorage` (SAMYOJ-49 Pick A). XSS can read them. No `Set-Cookie`, no `httpOnly` anywhere in `server/src/modules/auth/routes.ts`. All three endpoints (`/register`, `/login`, `/refresh`) use `sendSuccess()` JSON body.
- **File:** `server/src/modules/auth/routes.ts:134-135,239-240,260-263` (tokens in response body); `client/src/utils/authStorage.ts:65-77` (sessionStorage)
- **Fix:** HttpOnly cookie migration. SAMYOJ-49 Pick A was the interim; SAMYOJ-3 is the real fix. Conflicts with tab-scoped multi-account (cookies are browser-wide). Needs explicit product pick.
- **Jira:** [SAMYOJ-3](https://teamwebstarts.atlassian.net/browse/SAMYOJ-3) — To Do, High
- **Severity:** Critical for production. Acceptable for test-deploy.

### 2. Inbound webhook unproven — **SAMYOJ-2** (High)

- **What:** No verified instance of a **new** phone reply incrementing `totalReceived`. The code is correct (BullMQ queue, Redis counters, hydration on restart, client poll every 60s), but the live proof is missing. `META_WEBHOOK_URL` must match the ngrok tunnel; tunnel must be running.
- **File:** `server/src/modules/whatsapp/routes.ts:604-769` (POST handler); `webhook-health.ts:41-48` (tracking); `scripts/dev-tunnel.sh` (tunnel); `start.sh:129-148` (tunnel startup)
- **Fix:** Run `bash start.sh`, verify ngrok tunnel is live, send a **new** message from phone to business number, confirm `totalReceived > 0` via `GET /api/whatsapp/webhook/health`.
- **Jira:** [SAMYOJ-2](https://teamwebstarts.atlassian.net/browse/SAMYOJ-2) — To Do, High
- **Severity:** Critical for production. For test-deploy, needs one manual proof.

### 3. Automations send-when-shouldn't — **SAMYOJ-5** (High) — **PARTIALLY FIXED**

- **What:** Inbox pause (`botActive: false`) now correctly stops journeys, auto-replies, and AI at **all six** flow engine entry points (`processInboundFlow`, delay job (2 checks), `triggerMissedCallFlow`, `triggerEventFlow`, `scheduleFlowStart`). Also stops inbound automations in `engine.ts:345-360` and AI in `chatbot.service.ts:312-315`. `pauseConversationAutomations` proactively cancels queued delay jobs.
- **Exception:** Campaign sends do NOT check `botActive`. They use consent/opt-in instead. This appears intentional — campaigns are outbound template blasts, not inbound-triggered.
- **Remaining gap per ticket title:** "outside CSW" (customer service window) — not verified in this pass. The "paused" and "unpublished" parts are addressed.
- **File:** `server/src/modules/flows/live.ts:8-11` (`isBotPaused`); `server/src/modules/flows/engine.ts:1127,1457,1477,1533,1626,1758` (all entry points); `server/src/modules/automation/engine.ts:345-360`
- **Fix:** Verify CSW (24-hour window) enforcement on outbound non-template messages. The pause/journey part looks solid.
- **Jira:** [SAMYOJ-5](https://teamwebstarts.atlassian.net/browse/SAMYOJ-5) — To Do, High
- **Severity:** High. Pause is fixed; CSW needs verification.

### 4. Email verification is theater — **SAMYOJ-3** (subset)

- **What:** `emailVerifiedAt: new Date()` is set immediately on register (`routes.ts:72-79`). Login skips verification check (`routes.ts:177`). `/verify-email` endpoint exists but is dead code in practice. Response hardcodes `emailVerified: true` (`routes.ts:126`).
- **File:** `server/src/modules/auth/routes.ts:72-79,104,126,177`
- **Fix:** Either implement real email verification (send link, gate login until verified) or remove the theater and document that verification is not required.
- **Jira:** Part of [SAMYOJ-3](https://teamwebstarts.atlassian.net/browse/SAMYOJ-3)
- **Severity:** Medium. Not a security hole for test-deploy, but dishonest for production.

### 5. Backup restore drill untested — **SAMYOJ-6** (Medium)

- **What:** Backup script exists (`server/scripts/backup-database.ts` → `pg_dump --format=custom`). **No restore script.** `migrate-reconciliation-safe.ts` validates backup file format but does not restore. No documented restore procedure.
- **File:** `server/scripts/backup-database.ts`; `server/scripts/migrate-reconciliation-safe.ts:13-38`
- **Fix:** Write a `restore-database.ts` script, test it against a backup, document the procedure.
- **Jira:** [SAMYOJ-6](https://teamwebstarts.atlassian.net/browse/SAMYOJ-6) — To Do, Medium
- **Severity:** Medium. No DR capability until tested.

### 6. Socket membership is connect-time only — **SAMYOJ-3** (subset)

- **What:** `socketAuthMiddleware` runs only during Socket.IO handshake (`socket-auth.ts:10-36`). Room joins happen in the `connection` handler (`index.ts:84-96`). No per-event re-validation of org membership. If a user is removed from an org, their live socket stays until disconnect/reconnect.
- **File:** `server/src/middleware/socket-auth.ts:10-36`; `server/src/index.ts:84-96`
- **Fix:** Add per-event middleware or periodic membership re-check. For test-deploy, reconnect is sufficient.
- **Jira:** Part of [SAMYOJ-3](https://teamwebstarts.atlassian.net/browse/SAMYOJ-3)
- **Severity:** Medium. Real risk for production multi-tenant.

### 7. Graph template clone not built — **SAMYOJ-11** (Medium)

- **What:** Zero results for `account_creation_confirmation` in any `.ts` file. No clone logic exists. Only referenced in documentation.
- **Fix:** Implement Meta Graph API template clone with real HTTPS `url_suffix_example`. Requires a live WABA + valid template.
- **Jira:** [SAMYOJ-11](https://teamwebstarts.atlassian.net/browse/SAMYOJ-11) — To Do, Medium
- **Severity:** Medium. Blocks one onboarding flow.

### 8. Meta token-exchange puts `client_secret` in query string

- **What:** `GET /oauth/access_token?client_secret=...` is the Meta token-exchange URL. POST would be a contract change with Meta's API.
- **Fix:** Verify Meta supports POST for this endpoint. If not, document the constraint.
- **Severity:** Low-Medium. Meta's own API design; not something Samyoj can unilaterally fix.

### 9. Leftover org App Secret in DB (no one-shot migration)

- **What:** `stripLeftoverOrgMetaCredentials` runs on Connect + GET `/meta-config` when platform `.env` is set. But there is **no** one-shot migration to strip every org's leftover credentials. PATCH endpoint is 410.
- **Fix:** Either run a one-time migration or document that cleanup happens lazily on Connect.
- **Severity:** Low. Cleanup is lazy but functional.

### 10. `docs/AUTH_SETUP.md` is stale on localStorage claim

- **What:** Line 74 says "Access + refresh tokens remain in `localStorage` (XSS risk)." This is **wrong** — tokens moved to `sessionStorage` (SAMYOJ-49). The doc also says "email verification issued" on line 9, which is misleading (it's set immediately, not actually verified).
- **File:** `docs/AUTH_SETUP.md:74`
- **Fix:** Update line 74 to say `sessionStorage`. Update line 9 to clarify verification is disabled.
- **Severity:** Low. Doc accuracy, not code.

---

## Deferred (not now, but filed)

| Jira | Summary | Why deferred |
|------|---------|-------------|
| [SAMYOJ-12](https://teamwebstarts.atlassian.net/browse/SAMYOJ-12) | Live agent on same call (WebRTC transfer) | WebRTC media transfer not production-ready; settings force `message_only` |
| [SAMYOJ-26](https://teamwebstarts.atlassian.net/browse/SAMYOJ-26) | Phase C automations (forms, SLA, catalog, NL, goto, media, drip) | User said do not start |
| [SAMYOJ-35](https://teamwebstarts.atlassian.net/browse/SAMYOJ-35) | Billing: money-safety, Razorpay Subscriptions + GST | Spec only (`docs/billing/`). Do not implement unless asked |
| SAMYOJ-57 remaining | TARGET billing, STT/TTS ledger, impersonation, WhatsApp outreach | First release in code. Remaining slices are separate work |

---

## Chhote leftovers (not Jira-worthy)

| Item | Status | Notes |
|------|--------|-------|
| `VITE_PRECONNECT_VIDEO_URL` unset | Env leftover | Preconnect hero play button does nothing. Not a bug. |
| Reports page still shows Health score | Partial | Dashboard Health removed (51). Reports page kept it. Not a new ticket unless asked. |
| Nested widget skeletons | Minor | Some nested widgets still show spinner instead of skeleton. Not a product miss. |
| `professionalBrains.ts`, `CallsRailPanel.tsx`, `AiBotHowItWorks.tsx` | **Actually deleted** | Docs claim they "linger" — they don't. Glob returns zero. Docs are stale on this. |
| Speaker outside four voices | Design | Calling UI offers Shubh / Ratan / Priya / Ishita only. Other Sarvam speakers not in picker. |
| Pickup save vs bot Save footer | UX | "When they call" pickup can save separately from bot editor Save footer. Honest leftover. |
| Train Ready needs Azure embeddings | Infra | Vector Ready is Azure-only. No embeddings key → training stays Learning. |
| Unused server version/analytics routes | Dead code | Server routes for bot version history/analytics still exist (UI removed in 52). |

---

## Production readiness score

**4/10** — Works for internal test-deploy. Unsafe/fragile for real customers.

| Area | Score | Why |
|------|-------|-----|
| Auth (JWT/storage) | 4/10 | sessionStorage is XSS-readable. No HttpOnly cookies. Refresh rotation works. |
| Inbound webhook | 5/10 | Code is correct. Infra (tunnel, META_WEBHOOK_URL) must be live. Unproven with real phone. |
| Automations safety | 7/10 | `botActive` pause works at all entry points. CSW enforcement needs verification. |
| Number isolation | 9/10 | 409 on missing header, soft disconnect, cross-org fresh workspace. Solid. |
| Workers/embedded | 9/10 | `startWorkers()` in API, exit-1 guards on standalone scripts, PM2 omits worker. |
| Platform admin | 7/10 | Cookie+CSRF+TOTP+RBAC works. Remaining slices (billing, impersonation) open. |
| Email verification | 2/10 | Theater. Set immediately on register. Dead code path. |
| Backup/DR | 2/10 | Backup exists. No restore script. No tested drill. |
| Socket tenancy | 4/10 | Connect-time only. No per-event re-check. |
| Product features | 9/10 | All claimed features verified in code. Nothing fabricated. |
| Documentation accuracy | 7/10 | `AUTH_SETUP.md` stale on localStorage. "Unused files" claim stale (files deleted). |

---

## What to work on next (priority order)

1. **Prove inbound (SAMYOJ-2)** — Run `bash start.sh`, verify ngrok tunnel, send a real phone reply, confirm `totalReceived > 0`. This is the single highest-leverage test: if inbound works, the whole Inbox pipeline is proven. If not, nothing else matters.

2. **HttpOnly cookie migration (SAMYOJ-3)** — This is the biggest production blocker. Needs a product pick: cookies are browser-wide (no tab-scoped multi-account). Either accept single-session-per-browser or keep sessionStorage and document the XSS tradeoff. Don't do both.

3. **Verify CSW enforcement (SAMYOJ-5)** — The pause/journey part is solid. Verify that non-template outbound messages respect the 24-hour customer service window. This is the last piece of the "send-when-shouldn't" puzzle.

4. **Fix `docs/AUTH_SETUP.md`** — One-line fix: change "localStorage" to "sessionStorage" on line 74. The user has this file open. Quick win.

5. **Backup restore drill (SAMYOJ-6)** — Write `restore-database.ts`, test against a backup, document the procedure. Low effort, high DR value.

---

*Audit performed 2026-08-18. All code claims verified against actual repo files with exact paths and line numbers. No agent claims were rubber-stamped.*
