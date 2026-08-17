# Status, leftovers, do not redo

Last updated: **2026-08-17** (UI Before → After on Jira + `SESSION_UI_2026-08-17.md`; [SAMYOJ-70](https://teamwebstarts.atlassian.net/browse/SAMYOJ-70) Calls history delete).

**2026-08-17 platform admin ([SAMYOJ-57](https://teamwebstarts.atlassian.net/browse/SAMYOJ-57) first release, test-deploy):** `admin/` on `:3001`, `/api/platform/*` cookie+CSRF+TOTP+RBAC, additive migration `20260817003000_platform_schema_auth` applied via `db:migrate-startup-safe`. Tenant `/api/ops` is gone. **Not** customer production. Remaining on 57: [SAMYOJ-35](https://teamwebstarts.atlassian.net/browse/SAMYOJ-35) TARGET billing, [SAMYOJ-56](https://teamwebstarts.atlassian.net/browse/SAMYOJ-56) STT/TTS ledger, impersonation, WhatsApp outreach. SMTP honesty: unset SMTP stores LOGGED, never SENT. Do not rebuild.

**2026-08-17 login chrome ([SAMYOJ-68](https://teamwebstarts.atlassian.net/browse/SAMYOJ-68) Done):** split `/login` + register vs product mockup; hero `/brand/auth-login-hero.png`. Auth APIs unchanged. Not customer production.

**2026-08-17 AI Bot UX (SAMYOJ-52 / 59 iteration, test-deploy):** ListToolbar desktop one row / mobile stack; Write personality richer + business extras; Train Write answers; Setup 2×2 + About the business; Calling All-calls; 4 voices + preview; Train/Try it on calling; telephony on calling-bot **When they call** (P14 Customize home now on the bot; Calls Customize editor removed); compact empty states. Additive SQL `20260816220000` + `20260816231500`. Not customer production.

**2026-08-17 per-contact calling AI ([SAMYOJ-69](https://teamwebstarts.atlassian.net/browse/SAMYOJ-69) Done):** Contact `callingAiEnabled`; Call detail chip AI answers / Person only; global Off still wins; Person only → human then miss, no AI fallback. Migration `20260817001000`. Relates 52/53. Not customer production.

Working Jira backlog (trimmed, major only): epic [SAMYOJ-8](https://teamwebstarts.atlassian.net/browse/SAMYOJ-8). New problems → merge into an existing open ticket or file one major Task (`.cursor/rules/jira-task-backlog.mdc`). Do not start a ticket unless asked.

**2026-08-16 product sets** — spec: [PRODUCT_TASKS_2026-08-16.md](./PRODUCT_TASKS_2026-08-16.md). Durable copy: [docs/product/CALLS_AI_USAGE_ADMIN_2026-08-16.md](../product/CALLS_AI_USAGE_ADMIN_2026-08-16.md), [docs/product/INBOX_CONTACT_AND_CALLING_AI_2026-08-16.md](../product/INBOX_CONTACT_AND_CALLING_AI_2026-08-16.md). User has more items still to dictate.

**Landed in code 2026-08-16** (user testing locally now; **not** customer production): [SAMYOJ-47](https://teamwebstarts.atlassian.net/browse/SAMYOJ-47) card spacing, [SAMYOJ-48](https://teamwebstarts.atlassian.net/browse/SAMYOJ-48) skeletons, [SAMYOJ-50](https://teamwebstarts.atlassian.net/browse/SAMYOJ-50) campaign repeat, [SAMYOJ-51](https://teamwebstarts.atlassian.net/browse/SAMYOJ-51) dashboard chrome, [SAMYOJ-53](https://teamwebstarts.atlassian.net/browse/SAMYOJ-53) Inbox Auto·default, [SAMYOJ-54](https://teamwebstarts.atlassian.net/browse/SAMYOJ-54) Calls recents, [SAMYOJ-55](https://teamwebstarts.atlassian.net/browse/SAMYOJ-55) post-call summary, [SAMYOJ-58](https://teamwebstarts.atlassian.net/browse/SAMYOJ-58) Inbox New chat contact fields, [SAMYOJ-46](https://teamwebstarts.atlassian.net/browse/SAMYOJ-46) apply/unapply bot all chats, [SAMYOJ-49](https://teamwebstarts.atlassian.net/browse/SAMYOJ-49) tab-scoped `sessionStorage` JWTs (Pick A) + cross-org number after disconnect, [SAMYOJ-52](https://teamwebstarts.atlassian.net/browse/SAMYOJ-52) AI Bot Chat vs Calling, [SAMYOJ-59](https://teamwebstarts.atlassian.net/browse/SAMYOJ-59) strip AI from Calls Customize, [SAMYOJ-56](https://teamwebstarts.atlassian.net/browse/SAMYOJ-56) Reports AI usage.

**Landed 2026-08-17 (same, not customer production):** [SAMYOJ-68](https://teamwebstarts.atlassian.net/browse/SAMYOJ-68) login/register split; [SAMYOJ-69](https://teamwebstarts.atlassian.net/browse/SAMYOJ-69) per-contact calling AI; **[SAMYOJ-57](https://teamwebstarts.atlassian.net/browse/SAMYOJ-57) platform admin first release** (`admin/` `:3001` + `/api/platform/*`). Follow-up polish stayed on 51 / 52 / 53 / 55 / 56 / 59 (no extra tickets). UI Before → After: [SESSION_UI_2026-08-17.md](./SESSION_UI_2026-08-17.md). History delete: [SAMYOJ-70](https://teamwebstarts.atlassian.net/browse/SAMYOJ-70) (Relates 54). Orders sidebar hide commented on [SAMYOJ-8](https://teamwebstarts.atlassian.net/browse/SAMYOJ-8) — no new Task.

**Still open (real leftovers):** [SAMYOJ-2](https://teamwebstarts.atlassian.net/browse/SAMYOJ-2) inbound, [SAMYOJ-3](https://teamwebstarts.atlassian.net/browse/SAMYOJ-3) cookies/tenancy, [SAMYOJ-5](https://teamwebstarts.atlassian.net/browse/SAMYOJ-5) automations send-when-shouldn’t, [SAMYOJ-6](https://teamwebstarts.atlassian.net/browse/SAMYOJ-6) restore drill, [SAMYOJ-11](https://teamwebstarts.atlassian.net/browse/SAMYOJ-11) Graph template clone. **Deferred until asked:** [SAMYOJ-12](https://teamwebstarts.atlassian.net/browse/SAMYOJ-12) live transfer, [SAMYOJ-26](https://teamwebstarts.atlassian.net/browse/SAMYOJ-26) Phase C, [SAMYOJ-35](https://teamwebstarts.atlassian.net/browse/SAMYOJ-35) billing TARGET. **SAMYOJ-57 remaining (do not rebuild A–D):** TARGET subscriptions, STT/TTS ledger honesty, impersonation, WhatsApp outreach. SMTP honesty (no fake SENT) is in code; a real mailbox still needs `SMTP_HOST`.

## Ready or not

| Question | Answer |
|----------|--------|
| Deploy this build for **internal using and testing**? | **Yes** — `bash start.sh` (or `setup.sh` first time). Then a **new** inbound WhatsApp reply + an AI call. Testing deploy, **not** production. |
| Restart a **customer production-ready pipeline** / real-user go-live? | **No.** Auth, billing, live voice transfer, automations gaps, leftover Meta rows. |
| “Every possible problem solved”? | **No.** 14–15 Aug targeted templates + WhatsApp Connect leftovers. Whole CRM is not production-complete. |

Do not treat `docs/audit/FEATURE_MATRIX.md` “Voice Calling All DONE” / Google TTS / Deepgram / billing DONE as current. Runtime voice is **Sarvam**. Older `docs/audit/CALLS_AI_BOT_CONNECTION_REPORT.md` (2026-08-05) still talks Azure chat brain + Deepgram/Google ears — **stale**. Prefer this folder.

---

## How to run (testing deploy)

Always: `bash start.sh` (or `setup.sh` first time) = Docker Postgres + Redis + API `:8000` + UI `:3000` + **Admin `:3001`** + **ngrok-only** inbound tunnel. No Cloudflare. **Fail** if `NGROK_AUTHTOKEN` / ngrok auth is missing. Scripts wait for the tunnel URL, then start the API so `META_WEBHOOK_URL` is current. First platform operator: `cd server && PLATFORM_OPERATOR_PASSWORD='…' npm run platform:bootstrap-operator -- --email you@samyoj.com` then open `http://localhost:3001`.

---

## Automations — what next looks like

Full map: `docs/memory/RESEARCH_MAP.md`. Short version:

| Bucket | Status |
|--------|--------|
| Phase A (make it true) | Mostly in code. Open: pause-bot vs journeys, draft vs in-flight delay, CSW fallback template. |
| Phase B leftovers we **did** ship | Frequency cap, conflict preview at save, default tab = flows, Inbox waiting chip. |
| Phase B still open | Keyword word-boundary, campaign picker, send-test, pause journeys, interrupt-vs-continue node setting. |
| Phase C | **Do not start** unless the user asks. |

---

## Still left — and why we did not “just fix it”

| Leftover | Why not / next |
|----------|----------------|
| SAMYOJ-57 remaining (not a rebuild) | First release is in code. Open: TARGET billing (35), STT/TTS ledger (56), impersonation, WhatsApp outreach. SMTP honesty: LOGGED when `SMTP_HOST` unset, never SENT. Additive SQL `20260817003000` **is applied** via `db:migrate-startup-safe`; outreach `LOGGED` status is `20260817120000`. SAMYOJ-52/56 SQL `20260816220000`, bot business details `20260816231500`, and contact calling AI `20260817001000` are the other additive 16–17 Aug migrations. |
| Preconnect hero video | Play uses `VITE_PRECONNECT_VIDEO_URL`, which is **unset**. Env leftover — not a Jira. |
| Inbound Inbox replies | Infra, not Inbox UI. `bash start.sh` + live ngrok; `META_WEBHOOK_URL` must match; send a **new** phone reply. Symptom: send works, `totalReceived: 0`. |
| Live Graph proof of library clone | Clone `account_creation_confirmation` with real `https://yourstore.com/verify` (not localhost). If Graph rejects suffix sample, next smallest change is full reconstructed URL as `url_suffix_example` — **don’t guess now**. |
| Live agent on the **same phone call** | WebRTC media transfer not production-ready; settings force `message_only`. Copy is honest. Do not promise “please hold”. |
| Access + refresh in `sessionStorage` (per tab) | XSS can still read them. HttpOnly cookies = **SAMYOJ-3**, deferred (Pick A for SAMYOJ-49). Refresh **does** rotate (`rotateRefreshSession`). `docs/audit/AUTH_DEEP_REVIEW.md` (July) is **stale on rotation** and still talks `localStorage`. |
| `GET /oauth/access_token?client_secret=` | Meta token-exchange URL; not the Graph GET helper. POST would be a contract change. |
| Leftover org App Secret in DB | Stripped on Connect + GET `/meta-config` when platform `.env` is set (`stripLeftoverOrgMetaCredentials`). **No** one-shot migration of every org. PATCH is 410. Do not re-add UI. |
| Interrupt **while** TTS is playing | Disabled on purpose (echo loop on speaker). Gap interrupt only. Do not add AEC/WebSocket TTS unless user explicitly asks. |
| Inbox pause does not stop **flows** | Known; AI path honors `botActive`, journeys do not. Needs an explicit product pick. |
| Billing | Docs only: `docs/audit/BILLING_SYSTEM_REVIEW.md`, `docs/billing/14-IMPLEMENTATION-BLUEPRINT.md`. Razorpay checkout is demo-grade. **Do not implement this session’s leftover as code unless asked.** |
| Phase C automations | User said do not start: tickets/SLA, catalog, NL generate-flow, form-builder merge, `goto_flow` stack, wait-for-media. |
| Invent Meta marketing template library | Do not. Use Meta’s library + the 3 Create starters. |
| Public health `totalReceived: 0` after restart | Not proof inbound is dead. Prove with a **new** phone message. Public JSON has **no** `webhookUrl` / `lastError` / Facebook trace — use `.env`. |
| Socket membership is connect-time | Live sockets stay until reconnect; membership is not re-checked per event. |
| Email verification theater | Register sets `emailVerifiedAt` immediately. Do not claim verified-email auth. |
| Backup restore drill | Untested. Do not claim DR-ready. |
| Train Ready needs Azure embeddings | Vector Ready is Azure-only. No embeddings key → training stays Learning. Not a new Jira. |
| Unused files on disk | `professionalBrains.ts`, `CallsRailPanel.tsx` linger off-page. Not product misses. |
| Speaker outside the four voices | Calling UI offers Shubh / Ratan / Priya / Ishita. Other Sarvam speakers are not in that picker. |
| Pickup save vs bot Save footer | When they call pickup can save separately from the bot editor Save footer. Honest UX leftover, not a new Task. |
| `npm run start:worker` second consumer | **Closed:** scripts + standalone entry **exit 1**. `startWorkers()` inside the API is the only path. |

---

## Do not redo (already built)

- Re-research “is Train connected to calls?” — yes, `pickCallBotId` + `searchKnowledgeBase`. Chat vs calling bots are split (`AiBot.channel`, SAMYOJ-52). Do not rebuild the engines.
- Re-do 2026-08-16 shipped product tickets: 47 card spacing, 48 skeletons, 50 campaign repeat, 51 dashboard chrome, 53 Inbox Auto·default, 54 Calls recents, 55 post-call summary, 58 Inbox New chat fields, 46 apply/unapply bot all chats, 49 tab-scoped sessionStorage + cross-org number after disconnect, 52 Chat vs Calling AI bots, 59 strip Customize AI, 56 Reports AI usage.
- Re-do 2026-08-17: 68 login chrome, 69 per-contact calling AI, **57 platform admin first release**, 52/59 When they call telephony, Inbox chips, summary flat border, preconnect trim, **70 Recents history delete**, UI comparison `SESSION_UI_2026-08-17.md`.
- Re-research or rebuild platform admin (cookie session, `admin/` app, `/api/ops` leak). Remaining 57 work is 35/56/impersonation/WhatsApp outreach. Do not redo SMTP SENT-without-send.
- Re-split TTS on every `।` / `.` for “lower latency” — that was the रुक-रुक gap.
- Re-enable STT during TTS playback — echo loop.
- Re-dump latest FAQs when search misses — hallucination.
- Re-add Settings App ID / App Secret / Advanced override.
- Cloudflare/cloudflared tunnel fallback.
- Dual `npm run start:worker` / `dev:worker` / PM2 `whatsapp-worker` (scripts now **exit 1**; workers are embedded).
- Re-open WhatsApp number isolation (409 header, soft disconnect, same-phone reconnect).
- Live transfer “coming soon” copy.
- Broad hang-up on `bye` / `रख दे` / `टीम से बात`.
- Re-open OTP/feedback/welcome as Create wizard starters (OTP lives in Meta library).
- Force `/{{1}}` onto static HTTPS library buttons.
- Tell users Settings → Configure Meta app (`oauth-errors.ts`).
- Rewrite billing from the open docs unless the user asks.

---

## If the next session is asked to “make it production”

Order (smallest first): OAuth token-exchange without `client_secret` in query → leftover org Meta rows already strip on Connect/meta-config when `.env` is set (no one-shot migration unless asked) → HttpOnly refresh cookies → billing money-safety (blueprint Phase 0) if they will charge → only then live transfer research.

Until then: **test-deploy is the goal.** Do not start a production launch pipeline.
