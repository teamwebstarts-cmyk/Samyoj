# Status, leftovers, do not redo

Last updated: **2026-08-16**.

Working Jira backlog (trimmed, major only): epic [SAMYOJ-8](https://teamwebstarts.atlassian.net/browse/SAMYOJ-8). New problems → merge into an existing open ticket or file one major Task (`.cursor/rules/jira-task-backlog.mdc`). Do not start a ticket unless asked.

**2026-08-16 product sets** — spec: [PRODUCT_TASKS_2026-08-16.md](./PRODUCT_TASKS_2026-08-16.md). Durable copy: [docs/product/CALLS_AI_USAGE_ADMIN_2026-08-16.md](../product/CALLS_AI_USAGE_ADMIN_2026-08-16.md), [docs/product/INBOX_CONTACT_AND_CALLING_AI_2026-08-16.md](../product/INBOX_CONTACT_AND_CALLING_AI_2026-08-16.md). User has more items still to dictate.

**Landed in code 2026-08-16** (user testing locally now; **not** customer production): [SAMYOJ-47](https://teamwebstarts.atlassian.net/browse/SAMYOJ-47) card spacing, [SAMYOJ-48](https://teamwebstarts.atlassian.net/browse/SAMYOJ-48) skeletons, [SAMYOJ-50](https://teamwebstarts.atlassian.net/browse/SAMYOJ-50) campaign repeat, [SAMYOJ-51](https://teamwebstarts.atlassian.net/browse/SAMYOJ-51) dashboard chrome, [SAMYOJ-53](https://teamwebstarts.atlassian.net/browse/SAMYOJ-53) Inbox Auto·default, [SAMYOJ-54](https://teamwebstarts.atlassian.net/browse/SAMYOJ-54) Calls recents, [SAMYOJ-55](https://teamwebstarts.atlassian.net/browse/SAMYOJ-55) post-call summary, [SAMYOJ-58](https://teamwebstarts.atlassian.net/browse/SAMYOJ-58) Inbox New chat contact fields, [SAMYOJ-46](https://teamwebstarts.atlassian.net/browse/SAMYOJ-46) apply/unapply bot all chats, [SAMYOJ-49](https://teamwebstarts.atlassian.net/browse/SAMYOJ-49) tab-scoped `sessionStorage` JWTs (Pick A) + cross-org number after disconnect.

**Still open — do not start until after local test:** [SAMYOJ-52](https://teamwebstarts.atlassian.net/browse/SAMYOJ-52) AI Bot Chat vs Calling, [SAMYOJ-56](https://teamwebstarts.atlassian.net/browse/SAMYOJ-56) Reports AI usage, [SAMYOJ-59](https://teamwebstarts.atlassian.net/browse/SAMYOJ-59) strip AI from Calls Customize (Relates 52; land with/after 52). Deferred: [SAMYOJ-57](https://teamwebstarts.atlassian.net/browse/SAMYOJ-57) platform admin (with 12 / 26 / 35).

## Ready or not

| Question | Answer |
|----------|--------|
| Deploy this build for **internal using and testing**? | **Yes** — `bash start.sh` (or `setup.sh` first time). Then a **new** inbound WhatsApp reply + an AI call. Testing deploy, **not** production. |
| Restart a **customer production-ready pipeline** / real-user go-live? | **No.** Auth, billing, live voice transfer, automations gaps, leftover Meta rows. |
| “Every possible problem solved”? | **No.** 14–15 Aug targeted templates + WhatsApp Connect leftovers. Whole CRM is not production-complete. |

Do not treat `docs/audit/FEATURE_MATRIX.md` “Voice Calling All DONE” / Google TTS / Deepgram / billing DONE as current. Runtime voice is **Sarvam**. Older `docs/audit/CALLS_AI_BOT_CONNECTION_REPORT.md` (2026-08-05) still talks Azure chat brain + Deepgram/Google ears — **stale**. Prefer this folder.

---

## How to run (testing deploy)

Always: `bash start.sh` (or `setup.sh` first time) = Docker Postgres + Redis + API `:8000` + UI `:3000` + **ngrok-only** inbound tunnel. No Cloudflare. **Fail** if `NGROK_AUTHTOKEN` / ngrok auth is missing. Scripts wait for the tunnel URL, then start the API so `META_WEBHOOK_URL` is current.

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
| `npm run start:worker` second consumer | **Closed:** scripts + standalone entry **exit 1**. `startWorkers()` inside the API is the only path. |

---

## Do not redo (already built)

- Re-research “is Train connected to calls?” — yes, `pickCallBotId` + `searchKnowledgeBase`. **SAMYOJ-52 will split chat vs calling bots; until then this is still one brain. Do not start 52 this pass.**
- Re-do 2026-08-16 shipped product tickets: 47 card spacing, 48 skeletons, 50 campaign repeat, 51 dashboard chrome, 53 Inbox Auto·default, 54 Calls recents, 55 post-call summary, 58 Inbox New chat fields, 46 apply/unapply bot all chats, 49 tab-scoped sessionStorage + cross-org number after disconnect.
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
