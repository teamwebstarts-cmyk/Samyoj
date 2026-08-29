# Status, leftovers, do not redo

Last updated: **2026-08-29** (Samyoj template catalog in Postgres + Platform Admin publisher).

**2026-08-29 template catalog (test-deploy):** Tenant Template Library reads published `PlatformLibraryTemplate` rows (seeded from 30 bilingual drafts). Users pick, review, and submit to **this** WABA via `POST /templates/catalog/:slug/submit`. Platform Admin `/library` CRUD publishes drafts to that catalog. **Honest limit:** Samyoj cannot pre-approve Meta on a customer number. Utility/Auth are usually faster; Marketing is slower. Additive migration `20260829220000_platform_library_templates`. Comment on [SAMYOJ-11](https://teamwebstarts.atlassian.net/browse/SAMYOJ-11) / [SAMYOJ-57](https://teamwebstarts.atlassian.net/browse/SAMYOJ-57); no sibling ticket.

**2026-08-25 Automations Phase B (test-deploy):** Conflict-at-save **server-enforced** (duplicate welcome/keyword blocks with 409). Keyword word-boundary on flow intent routes. Per-node `interruptOnInbound` on delay/schedule steps. **Send-test-to-phone** on flows + auto-replies (`POST /flows/:id/test`, `POST /automations/:id/test`). Inbox **jump-to-node** (`PATCH /inbox/:id/flow-jump`). Honest skip-reason analytics (`bySkipReason`: CSW closed, 24h cap, inbound during wait). Frequency cap, campaign picker, default flows tab, inbox waiting UI were already in code. **Phase C still deferred** (SAMYOJ-26).

**2026-08-25 tenant auth + billing (test-deploy):** [SAMYOJ-3](https://teamwebstarts.atlassian.net/browse/SAMYOJ-3) **landed in code** — tenant JWTs in HttpOnly `samyoj_access` / `samyoj_refresh` cookies (`Path=/api`), readable `samyoj_csrf` double-submit CSRF, Socket.IO cookie auth + `session:revoked` on revoke. Client no longer stores live JWTs in `sessionStorage`/`localStorage`. **Email verification gate:** register sets `emailVerifiedAt: null`; production blocks login until verified (`ALLOW_UNVERIFIED_LOGIN` for dev). **Manual billing shipped** (not SAMYOJ-35 TARGET): plan-period ledger, one-pack AI top-ups, fail-closed entitlements, no recurring checkout — gates G1–G13 pass. **Not** customer production (inbound live proof, restore on customer host, TARGET billing, live transfer still open).

**2026-08-17 platform admin ([SAMYOJ-57](https://teamwebstarts.atlassian.net/browse/SAMYOJ-57) first release, test-deploy):** `admin/` on `:3001`, `/api/platform/*` cookie+CSRF+TOTP+RBAC, additive migration `20260817003000_platform_schema_auth` applied via `db:migrate-startup-safe`. Tenant `/api/ops` is gone. **Not** customer production. Remaining on 57: [SAMYOJ-35](https://teamwebstarts.atlassian.net/browse/SAMYOJ-35) TARGET billing, [SAMYOJ-56](https://teamwebstarts.atlassian.net/browse/SAMYOJ-56) STT/TTS ledger, impersonation, WhatsApp outreach. SMTP honesty: unset SMTP stores LOGGED, never SENT. Do not rebuild.

**2026-08-17 login chrome ([SAMYOJ-68](https://teamwebstarts.atlassian.net/browse/SAMYOJ-68) Done):** split `/login` + register vs product mockup; hero `/brand/auth-login-hero.png`. Auth APIs unchanged. Not customer production.

**2026-08-17 AI Bot UX (SAMYOJ-52 / 59 iteration, test-deploy):** ListToolbar desktop one row / mobile stack; Write personality richer + business extras; Train Write answers; Setup 2x2 + About the business; Calling All-calls; 4 voices + preview; Train/Try it on calling; telephony on calling-bot **When they call** (P14 Customize home now on the bot; Calls Customize editor removed); compact empty states. Additive SQL `20260816220000` + `20260816231500`. Not customer production.

**2026-08-17 per-contact calling AI ([SAMYOJ-69](https://teamwebstarts.atlassian.net/browse/SAMYOJ-69) Done):** Contact `callingAiEnabled`; Call detail chip AI answers / Person only; global Off still wins; Person only then human then miss, no AI fallback. Migration `20260817001000`. Relates 52/53. Not customer production.

Working Jira backlog (trimmed, major only): epic [SAMYOJ-8](https://teamwebstarts.atlassian.net/browse/SAMYOJ-8). New problems merge into an existing open ticket or file one major Task (`.cursor/rules/jira-task-backlog.mdc`). Do not start a ticket unless asked.

**2026-08-16 product sets** -- spec: [PRODUCT_TASKS_2026-08-16.md](./PRODUCT_TASKS_2026-08-16.md). Durable copy: [docs/product/CALLS_AI_USAGE_ADMIN_2026-08-16.md](../product/CALLS_AI_USAGE_ADMIN_2026-08-16.md), [docs/product/INBOX_CONTACT_AND_CALLING_AI_2026-08-16.md](../product/INBOX_CONTACT_AND_CALLING_AI_2026-08-16.md). User has more items still to dictate.

**Landed in code 2026-08-16** (user testing locally now; **not** customer production): [SAMYOJ-47](https://teamwebstarts.atlassian.net/browse/SAMYOJ-47) card spacing, [SAMYOJ-48](https://teamwebstarts.atlassian.net/browse/SAMYOJ-48) skeletons, [SAMYOJ-50](https://teamwebstarts.atlassian.net/browse/SAMYOJ-50) campaign repeat, [SAMYOJ-51](https://teamwebstarts.atlassian.net/browse/SAMYOJ-51) dashboard chrome, [SAMYOJ-53](https://teamwebstarts.atlassian.net/browse/SAMYOJ-53) Inbox Auto-default, [SAMYOJ-54](https://teamwebstarts.atlassian.net/browse/SAMYOJ-54) Calls recents, [SAMYOJ-55](https://teamwebstarts.atlassian.net/browse/SAMYOJ-55) post-call summary, [SAMYOJ-58](https://teamwebstarts.atlassian.net/browse/SAMYOJ-58) Inbox New chat contact fields, [SAMYOJ-46](https://teamwebstarts.atlassian.net/browse/SAMYOJ-46) apply/unapply bot all chats, [SAMYOJ-49](https://teamwebstarts.atlassian.net/browse/SAMYOJ-49) tab-scoped `sessionStorage` JWTs (Pick A) + cross-org number after disconnect, [SAMYOJ-52](https://teamwebstarts.atlassian.net/browse/SAMYOJ-52) AI Bot Chat vs Calling, [SAMYOJ-59](https://teamwebstarts.atlassian.net/browse/SAMYOJ-59) strip AI from Calls Customize, [SAMYOJ-56](https://teamwebstarts.atlassian.net/browse/SAMYOJ-56) Reports AI usage.

**Landed 2026-08-17 (same, not customer production):** [SAMYOJ-68](https://teamwebstarts.atlassian.net/browse/SAMYOJ-68) login/register split; [SAMYOJ-69](https://teamwebstarts.atlassian.net/browse/SAMYOJ-69) per-contact calling AI; **[SAMYOJ-57](https://teamwebstarts.atlassian.net/browse/SAMYOJ-57) platform admin first release** (`admin/` `:3001` + `/api/platform/*`). Follow-up polish stayed on 51 / 52 / 53 / 55 / 56 / 59 (no extra tickets). UI Before/After: [SESSION_UI_2026-08-17.md](./SESSION_UI_2026-08-17.md). History delete: [SAMYOJ-70](https://teamwebstarts.atlassian.net/browse/SAMYOJ-70) (Relates 54). Orders sidebar hide commented on [SAMYOJ-8](https://teamwebstarts.atlassian.net/browse/SAMYOJ-8) -- no new Task.

**2026-08-18 session work (verified in code):** Login redesign (SAMYOJ-68 Done), call STT tuning (VAD 650ms, balanced stream, echo tail 550ms), barge-in during TTS (RMS detection, stopBotSpeechForBargeIn), PreConnectHero padding, Calls empty states (Inbox-matching), sidebar collapsed hover expand. Inbox call-permission card (P1-1): `call-permission-message.ts` + parser + InteractiveMessageCard + tests (2026-08-18). Rate limiter fail-closed (P1-2): `redisAuthStore` + `consumeAccountThrottle` use `BoundedMemoryCounter` fallback, `passOnStoreError: false`, 17 tests.

**2026-08-18 full audit:** `audit/FULL_REVIEW_2026-08-18.md`. 5 subagent reviews + manual reads. All claims have exact file paths + line numbers. Production readiness: 4/10.

**2026-08-18 post-audit session work (verified, test-deploy):** Template variable dropdowns (select-or-type with contact-aware suggestions in Inbox template composer). Support system bot (mandatory, non-deletable per org, `isSystem` field, 403 on delete, migration `20260817140000_ai_bot_system_support`). Removed AiBotHero + sky info banner. Call latency tuning (configurable STT silence/echo tail, early streaming TTS, fast KB, filler stripping). Call TTS no-audio fix (`normalizeSarvamLanguageCode`, `synthesizeWithFallback`). Call AI reply quality (Hinglish patterns, KB fallback, speakable-chunk check, gender-neutral Hindi). Call summary placement (after call-end pill, `alignCallSummariesInThread`, `CallSummaryNote` variant thread). Inbox chatbot no-reply fix (opt-out no longer blocks service chat). Support Board sidebar (Sarvam assistant, 8 suggested questions, `/api/support/status` + `/api/support/chat`, tickets tab removed). Platform admin UI redesign (72rem centered, 12.75rem sidebar, denser tables/cards, forest graphite + mint theme, 18/18 tests). Full session: [SESSION_2026-08-18.md](./SESSION_2026-08-18.md).

**Phase plan (user decision 2026-08-18):**
- **Phase 1 (NOW):** Fix product issues -- ~~call-permission card~~ (DONE 2026-08-18), ~~rate limiter fail-closed~~ (DONE), ~~automations botActive+journeys~~ (VERIFIED), ~~backup restore~~ (DONE), socket membership (DONE), Graph template clone (DONE), FEATURE_MATRIX fix (DONE), stale docs cleanup (DONE), inbound proof (needs live test), barge-in live test (needs live call), ~~ghost enum cleanup~~ (FALSE POSITIVE — AI_CHATBOT is a log tag), ~~tests for critical paths~~ (DONE).
- **Phase 2 (LATER -- after product is solid):** ~~Auth/tokens (HttpOnly cookies, SAMYOJ-3)~~ **landed 2026-08-25**, email verification gate **landed 2026-08-25**, manual billing **shipped 2026-08-25** (TARGET subscriptions = SAMYOJ-35 still deferred), live transfer (SAMYOJ-12), Phase C automations (SAMYOJ-26).

**Phase 1 completed:**
- **P1-1 Inbox call-permission card (2026-08-18):** `call-permission-message.ts` persists outbound permission requests as INTERACTIVE messages in the Inbox thread. `message-parser.ts` parses `call_permission_request` and `call_permission_response` interactive types. `InteractiveMessageCard.tsx` + `WhatsAppPreview.tsx` render a card with phone icon, body text, and status badge (pending/granted/denied). Calling routes wired to persist on send. 7/7 tests pass. `audit/FULL_REVIEW_2026-08-18.md` P1-1 updated to VERIFIED.
- **P1-2 Rate limiter fail-closed (2026-08-18):** `redisAuthStore` now uses `BoundedMemoryCounter` fallback (capacity 5000). `consumeAccountThrottle` also fails closed. All 7 existing tests pass. `server/src/modules/auth/rate-limit.ts:5-52,226-252`.
- **P1-3 Automations botActive + CSW (2026-08-18):** No code fix needed. Journey scheduling already checks `botActive` via `isBotPaused` double-guard in `resumeFlowAfterDelay` (lines 1457, 1477) and `startFlowFromJob` (line 1758). `pauseConversationAutomations` proactively cancels delay jobs. CSW enforcement complete: `deliverOutboundMessage` blocks non-TEMPLATE sends; flow engine + automation engine graceful skip on CSW error. `audit/FULL_REVIEW_2026-08-18.md` P1-3 updated to VERIFIED. Jira: [SAMYOJ-5](https://teamwebstarts.atlassian.net/browse/SAMYOJ-5) Done.
- **P1-4 Backup restore drill (2026-08-18):** `server/scripts/restore-database.ts` + `npm run db:restore`. Validates backup format, confirmation prompt with `--yes` bypass, `--clean --if-exists --no-owner --no-privileges`, Docker fallback. Roundtrip tested: 25 migrations intact. Documented in `docs/DEV_SETUP_CHECKLIST.md`. Jira: [SAMYOJ-6](https://teamwebstarts.atlassian.net/browse/SAMYOJ-6) Done.

- **P1-5 Socket membership re-check (2026-08-18):** `startMembershipGuard(socket)` in `socket-auth.ts` — 60s periodic re-check of `hasActiveOrgMembership`. On revocation: emits `session:revoked` + disconnects. Handles org-deleted (cascade), API-key sockets skipped, transient DB errors tolerated. 7 new tests (15 total). `server/src/middleware/socket-auth.ts`, `server/src/index.ts`, `socket-auth.test.ts`.
- **P1-6 Graph template clone (2026-08-18):** Clone infrastructure already existed (`createMessageTemplateFromLibrary` in `meta.service.ts`, `POST /from-library` route, full client wizard). Tightened `createFromLibrarySchema` from loose `z.array(z.record(z.unknown()))` to discriminated union validating URL buttons (`base_url` + `url_suffix_example`), PHONE_NUMBER, OTP. Added "Account" quick-pick. 28 tests (24 new + 4 network error). `server/src/modules/templates/types.ts`, `clone.test.ts`, `client/src/utils/templateLibrary.ts`, `TemplateLibraryBrowseStep.tsx`. Live WABA test needed to verify end-to-end.
- **P1-7 FEATURE_MATRIX docs (2026-08-18):** Billing "All DONE" → "DONE (demo)" + 5 PLANNED rows. Voice "All DONE" → "Core works; live transfer is a stub". Sarvam TTS/STT. Stale warnings on old docs. Per-row billing contradictions fixed. `docs/audit/FEATURE_MATRIX.md`, `docs/audit/CALLS_AI_BOT_CONNECTION_REPORT.md`, `docs/memory/STATUS_AND_FUTURE.md`.
- **P1-13 Critical path tests (2026-08-18):** 216 new tests across 14 files covering all7 zero-coverage critical paths: billing (plans, razorpay payment/webhook signature, usage), middleware auth (JWT, role check), media (upload validation, audio transcode, storage adapter, image optimize, public routes path traversal), auth routes (register/login/refresh/logout), messages (CSW error, types), campaigns (CSV, edit/reschedule), AI chat-completion (config, routing, quota). Files: `billing/*.test.ts` (4), `media/*.test.ts` (6), `auth/routes.test.ts`, `messages/send.service.test.ts`, `campaigns/service.test.ts`, `ai/chat-completion.service.test.ts`.

**Still open (Phase 1):** [SAMYOJ-2](https://teamwebstarts.atlassian.net/browse/SAMYOJ-2) inbound (needs live test). P1-10 barge-in live test (needs live call).

**Automated verification pass (2026-08-18 evening, this session):**
- Server started via `bash start.sh` — Docker (Postgres+Redis), API `:8000`, UI `:3000`, Admin `:3001`, ngrok tunnel all healthy.
- **All tests pass:** server 832/832, client 69/69, admin 18/18 = 919 total, 0 failures.
- **Webhook health verified:** `totalReceived: 32`, `totalQueued: 32`, `webhookConfigured: true`.
- **Webhook endpoints verified:** GET `/webhook` returns 200 (challenge), POST returns 400 (rejects empty payload correctly).
- **Barge-in code verified via read-through:** RMS energy gate (BARGE_IN_RMS_THRESHOLD=1500), 400ms TTS echo tail, voice backchannel check all correct in `ai-voice-agent.ts:165-189,384-405,586-614`.
- **Rate limiter verified:** `BoundedMemoryCounter` fallback, 8/8 tests pass, fail-closed confirmed.
- **P1-9 + P1-10 still need phone:** Documented exact test steps in `audit/FULL_REVIEW_2026-08-18.md`.
- **DRY refactor plan:** D1 (NotificationService), D2 (InboxPage+CallsPage), D3 (MediaUtils) documented but not started — do after P1 phone tests.

**P2 implementation pass (2026-08-18):** Dead code cleanup (removed3 dead AI bot routes +3 dead functions + dead client component + dead API call). Auth middleware tests (13 tests: `authenticate`, `loadOrgRole`, `requireOrgRole`). Auth session tests (11 tests: `createSession`, `rotateRefreshSession`, theft detection). Password policy tests (13 tests). Message sending tests (10 tests: `toDbMessageType`, `isCswClosedError`, CSW constants). Meta token-exchange documented. Full suite: 119 files, 832 tests passing. Plan: `docs/memory/PHASED_PLAN_2026-08-18.md`.

**Deferred to Phase 2:** ~~[SAMYOJ-3](https://teamwebstarts.atlassian.net/browse/SAMYOJ-3) cookies/tenancy~~ **landed 2026-08-25**, [SAMYOJ-12](https://teamwebstarts.atlassian.net/browse/SAMYOJ-12) live transfer, [SAMYOJ-26](https://teamwebstarts.atlassian.net/browse/SAMYOJ-26) Phase C, [SAMYOJ-35](https://teamwebstarts.atlassian.net/browse/SAMYOJ-35) TARGET Razorpay Subscriptions (manual plan-period billing is shipped). **SAMYOJ-57 remaining (do not rebuild A-D):** TARGET subscriptions (35), STT/TTS ledger honesty, impersonation, WhatsApp outreach. SMTP honesty (no fake SENT) is in code; a real mailbox still needs `SMTP_HOST`.

## Ready or not

| Question | Answer |
|----------|--------|
| Deploy this build for **internal using and testing**? | **Yes** -- `bash start.sh` (or `setup.sh` first time). Then a **new** inbound WhatsApp reply + an AI call. Testing deploy, **not** production. |
| Restart a **customer production-ready pipeline** / real-user go-live? | **No.** Inbound unproven on customer host, backup restore drill untested on customer host, live transfer (stub), SAMYOJ-35 TARGET subscriptions not shipped. Auth cookies + email gate + manual billing **are** in code (2026-08-25). See blockers below. |
| "Every possible problem solved"? | **No.** Phase 1 (product fixes) must complete before Phase 2 (auth/billing). Full list in `audit/FULL_REVIEW_2026-08-18.md`. |

`docs/audit/FEATURE_MATRIX.md` and `docs/audit/CALLS_AI_BOT_CONNECTION_REPORT.md` have been updated (2026-08-18) to reflect actual status: billing is demo-grade, voice live transfer is a stub, runtime TTS/STT is Sarvam. Prefer this folder as source of truth.

---

## How to run (testing deploy)

Always: `bash start.sh` (or `setup.sh` first time) = Docker Postgres + Redis + API `:8000` + UI `:3000` + **Admin `:3001`** + **ngrok-only** inbound tunnel. No Cloudflare. **Fail** if `NGROK_AUTHTOKEN` / ngrok auth is missing. Scripts wait for the tunnel URL, then start the API so `META_WEBHOOK_URL` is current. First platform operator: `cd server && PLATFORM_OPERATOR_PASSWORD='...' npm run platform:bootstrap-operator -- --email you@samyoj.com` then open `http://localhost:3001`.

---

## Automations -- what next looks like

Full map: `docs/memory/RESEARCH_MAP.md`. Short version:

| Bucket | Status |
|--------|--------|
| Phase A (make it true) | Mostly in code. Pause-bot vs journeys **VERIFIED** (P1-3, SAMYOJ-5 Done) — botActive double-guard in `resumeFlowAfterDelay` + `startFlowFromJob`; `pauseConversationAutomations` cancels delay jobs. CSW enforcement **VERIFIED** — `deliverOutboundMessage` blocks non-TEMPLATE; flow engine graceful skip. Remaining: draft vs in-flight delay, CSW fallback template. |
| Phase B leftovers we **did** ship | Frequency cap, conflict preview at save, default tab = flows, Inbox waiting chip. |
| Phase B still open | Keyword word-boundary, campaign picker, send-test, pause journeys, interrupt-vs-continue node setting. |
| Phase C | **Do not start** unless the user asks. |

---

## Still left -- and why we did not "just fix it"

| Leftover | Why not / next |
|----------|----------------|
| SAMYOJ-57 remaining (not a rebuild) | First release is in code. Open: TARGET billing (35), STT/TTS ledger (56), impersonation, WhatsApp outreach. SMTP honesty: LOGGED when `SMTP_HOST` unset, never SENT. Additive SQL `20260817003000` **is applied** via `db:migrate-startup-safe`; outreach `LOGGED` status is `20260817120000`. SAMYOJ-52/56 SQL `20260816220000`, bot business details `20260816231500`, and contact calling AI `20260817001000` are the other additive 16-17 Aug migrations. |
| ~~Preconnect hero video~~ | **Fixed 2026-08-18.** Play button hidden when `VITE_PRECONNECT_VIDEO_URL` is unset. `onWatchVideo` optional in `PreConnectHero.tsx`. |
| Inbound Inbox replies | Infra, not Inbox UI. `bash start.sh` + live ngrok; `META_WEBHOOK_URL` must match; send a **new** phone reply. Symptom: send works, `totalReceived: 0`. |
| Live Graph proof of library clone | Clone `account_creation_confirmation` with real `https://yourstore.com/verify` (not localhost). If Graph rejects suffix sample, next smallest change is full reconstructed URL as `url_suffix_example` -- **don't guess now**. |
| Live agent on the **same phone call** | WebRTC media transfer not production-ready; settings force `message_only`. Copy is honest. Do not promise "please hold". |
| Access + refresh in HttpOnly cookies (SAMYOJ-3) | **Done 2026-08-25:** `samyoj_access` / `samyoj_refresh` HttpOnly + `samyoj_csrf` double-submit. Client no longer stores live JWTs. Socket.IO reads cookie when handshake token absent. |
| Meta token exchange POST (no `client_secret` on URL) | **Done 2026-08-25:** `exchangeCodeForToken` / long-lived use POST form body. |
| Leftover org App Secret in DB | Stripped on Connect + GET `/meta-config` when platform `.env` is set (`stripLeftoverOrgMetaCredentials`). **No** one-shot migration of every org. PATCH is 410. Do not re-add UI. |
| Email verification honesty | **Done 2026-08-25:** Register sets `emailVerifiedAt: null`. Production login blocked until verified (`EMAIL_NOT_VERIFIED`); dev allows via `ALLOW_UNVERIFIED_LOGIN`. |
| Interrupt **while** TTS is playing | **DONE (2026-08-18):** RMS-based barge-in (`stopBotSpeechForBargeIn`), VAD speech_start, STT final all stop bot playback. Echo guard 700ms + RMS threshold 1800. See `ai-voice-agent.ts:290-299`, `spoken-text.ts:74-79,109-125`. |
| Inbox pause does not stop **flows** | **VERIFIED (2026-08-18):** AI path honors `botActive`, journeys also honor `botActive` via `isBotPaused` double-guard in `resumeFlowAfterDelay` (lines 1457, 1477) and `startFlowFromJob` (line 1758). `pauseConversationAutomations` proactively removes delay jobs from queue. CSW enforcement on non-template outbound also verified. |
| Billing | **Manual plan-period billing shipped 2026-08-25** (G1–G13). TARGET Razorpay Subscriptions + GST invoices = SAMYOJ-35, still deferred. |
| Phase C automations | User said do not start: tickets/SLA, catalog, NL generate-flow, form-builder merge, `goto_flow` stack, wait-for-media. |
| Invent Meta marketing template library | **Superseded 2026-08-29:** Samyoj-owned catalog in Postgres (includes Marketing drafts). Still not Meta pre-approval. Do not clone Meta's library as the product. |
| Public health `totalReceived: 0` after restart | Not proof inbound is dead. Prove with a **new** phone message. Public JSON has **no** `webhookUrl` / `lastError` / Facebook trace -- use `.env`. |
| Socket membership re-check | **Done 2026-08-18:** `startMembershipGuard` re-checks org membership every 60s; emits `session:revoked` + disconnect on revoke. |
| ~~Email verification theater~~ | **Done 2026-08-25:** Register no longer auto-sets `emailVerifiedAt`. |
| Backup restore drill | **Done 2026-08-18:** `server/scripts/restore-database.ts` + `npm run db:restore` + documented in `docs/DEV_SETUP_CHECKLIST.md`. Roundtrip tested. Relates SAMYOJ-6. |
| Train Ready needs Azure embeddings | Vector Ready is Azure-only. No embeddings key then training stays Learning. Not a new Jira. |
| Speaker outside the four voices | Calling UI offers Shubh / Ratan / Priya / Ishita. Other Sarvam speakers are not in that picker. |
| Pickup save vs bot Save footer | When they call pickup can save separately from the bot editor Save footer. Honest UX leftover, not a new Task. |
| `npm run start:worker` second consumer | **Closed:** scripts + standalone entry **exit 1**. `startWorkers()` inside the API is the only path. |
| ~~Rate limiter fails open on Redis down~~ | **VERIFIED fail-closed.** Customer auth limiter uses `BoundedMemoryCounter` fallback + `passOnStoreError: false`. `consumeAccountThrottle` also fails closed. 17 tests. `audit/FULL_REVIEW_2026-08-18.md` P1-2. |
| ~~FEATURE_MATRIX misleading~~ | **Fixed 2026-08-18.** Billing now "Demo — not production-ready"; voice "Core works; live transfer deferred"; Google TTS → Sarvam TTS; stale warnings added. |

---

## Do not redo (already built)

- Re-research "is Train connected to calls?" -- yes, `pickCallBotId` + `searchKnowledgeBase`. Chat vs calling bots are split (`AiBot.channel`, SAMYOJ-52). Do not rebuild the engines.
- Re-do 2026-08-16 shipped product tickets: 47 card spacing, 48 skeletons, 50 campaign repeat, 51 dashboard chrome, 53 Inbox Auto-default, 54 Calls recents, 55 post-call summary, 58 Inbox New chat fields, 46 apply/unapply bot all chats, 49 tab-scoped sessionStorage + cross-org number after disconnect, 52 Chat vs Calling AI bots, 59 strip Customize AI, 56 Reports AI usage.
- Re-do 2026-08-17: 68 login chrome, 69 per-contact calling AI, **57 platform admin first release**, 52/59 When they call telephony, Inbox chips, summary flat border, preconnect trim, **70 Recents history delete**, UI comparison `SESSION_UI_2026-08-17.md`.
- Re-do 2026-08-18 session work: login redesign, call STT tuning, barge-in during TTS, PreConnectHero padding, Calls empty states, sidebar collapsed hover expand, Inbox call-permission card.
- Re-do 2026-08-18 post-audit work: template variable dropdowns (TemplateParamField), Support system bot (isSystem, migration 20260817140000), AiBotHero/sky banner removal, call latency tuning (streaming TTS, fast KB, filler stripping), call TTS no-audio fix (normalizeSarvamLanguageCode), call AI reply quality (Hinglish, KB fallback, speakable chunks), call summary placement (alignCallSummariesInThread, variant thread), Inbox chatbot no-reply fix (opt-out vs service chat), Support Board sidebar (Sarvam assistant, product-knowledge.ts, /api/support/*), platform admin UI redesign (72rem, forest graphite, 18/18 tests).
- Re-research or rebuild platform admin (cookie session, `admin/` app, `/api/ops` leak). Remaining 57 work is 35/56/impersonation/WhatsApp outreach. Do not redo SMTP SENT-without-send.
- Re-split TTS on every separator for "lower latency" -- that was the gap.
- Re-enable STT during TTS playback -- **DONE 2026-08-18**: STT stays live during TTS, mute only echo tail.
- Re-audit stale docs (P1-8) -- **RESOLVED 2026-08-18**: STATUS_AND_FUTURE.md already updated before audit was written.
- Interrupt while TTS is playing -- **DONE 2026-08-18**: RMS barge-in, VAD, STT final all stop playback.
- Re-dump latest FAQs when search misses -- hallucination.
- Re-add Settings App ID / App Secret / Advanced override.
- Cloudflare/cloudflared tunnel fallback.
- Dual `npm run start:worker` / `dev:worker` / PM2 `whatsapp-worker` (scripts now **exit 1**; workers are embedded).
- Re-open WhatsApp number isolation (409 header, soft disconnect, same-phone reconnect).
- Live transfer "coming soon" copy.
- Broad hang-up on `bye` / casual closers.
- Re-open OTP/feedback/welcome as Create wizard starters (OTP lives in Meta library).
- Force `/{{1}}` onto static HTTPS library buttons.
- Tell users Settings then Configure Meta app (`oauth-errors.ts`).
- Rewrite billing from the open docs unless the user asks. **Deferred to Phase 2.**

---

## If the next session is asked to "make it production"

See `audit/FULL_REVIEW_2026-08-18.md` Phase 2 list. Order: ~~HttpOnly cookies (SAMYOJ-3)~~ **done 2026-08-25**, ~~email verification gate~~ **done 2026-08-25**, rate limiter fail-closed **done**, manual billing **shipped** (TARGET SAMYOJ-35 still open), live transfer research (SAMYOJ-12), inbound proof on customer host.

Until then: **test-deploy is the goal.** Do not start a production launch pipeline.
