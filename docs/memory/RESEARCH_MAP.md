# Research we already did — do not re-audit from scratch

Long reviews live under `docs/audit/` (billing also `docs/billing/`). This file is the **map** so a new session does not redo the same reading. Prefer **code + this folder** when an audit is older than **2026-08-15**.

---

## Still useful (read these, don’t rewrite them)

| Doc | What it is | Caveat |
|-----|------------|--------|
| `docs/audit/AUTOMATION_WORKFLOW_COMPLETE_REVIEW.md` | Full Automations research: three products, inbound order, Meta policy, competitors, Phase A/B/C | Written **before** Phase A code. Use for *why*, not current status. |
| `docs/audit/AUTOMATION_WORKFLOW_RECHECK_2026-08-14.md` | Post–Phase A critic pass. Scores, leftovers, pause-bot gap | Mid-session. Several Phase B items listed as open were **built later the same day** (see below). |
| `docs/WHATSAPP_CONNECT_DEVELOPER_GUIDE.md` | Connect OAuth + inbound tunnel runbook | Public `/webhook/health` **no longer** returns `webhookUrl`. |
| `docs/DEV_SETUP_CHECKLIST.md` | Quick start | Same health-URL caveat. |
| `docs/audit/WHATSAPP_CONNECTION_FLOW_ANALYSIS.md` | Connect flow analysis | PATCH `/meta-config` is now **410**. GET sanitized; leftovers stripped on Connect/GET when platform `.env` is set. |
| `docs/audit/BILLING_SYSTEM_REVIEW.md` | Honest billing-as-coded review (~4/10 demo checkout) | **Docs only.** Do not implement unless asked. |
| `docs/billing/14-IMPLEMENTATION-BLUEPRINT.md` | Phased billing plan (Phase 0 money safety first) | **Future product work.** Not started 14–15 Aug. |

---

## Stale — do not treat as current

| Doc | What’s wrong now |
|-----|------------------|
| `docs/audit/FEATURE_MATRIX.md` | Still claims Google TTS / Deepgram / Voice Calling “All DONE” and billing DONE. Footer test counts outdated. Prefer code. |
| `docs/audit/CALLS_AI_BOT_CONNECTION_REPORT.md` (2026-08-05) | Azure OpenAI as the chat brain + Deepgram/Google ears. Runtime is **Sarvam** + Azure **embeddings only**. |
| `docs/audit/README.md` (2026-07-31) | Architecture still lists Azure chat + Deepgram + Google TTS. |
| `docs/audit/SARVAM_AS_AI_BRAIN.md` / `SARVAM_BRAIN_IMPLEMENTATION_BLUEPRINT.md` | Planning docs. Implementation landed; don’t re-plan the brain. |
| `docs/audit/AUTH_DEEP_REVIEW.md` (July) | Stale on refresh **rotation** (`rotateRefreshSession` exists). JWT-in-localStorage leftover is still real. |

Inbox UI audits (`INBOX_*`) were a different stretch. Don’t mix them with calling/automation memory unless the user asks. `INBOX_READINESS_REVIEW_2026-08-05.md` / `docs/AUDIT.md` still say disconnect **deletes** numbers or nulls `whatsappNumberId` — **false** now (soft `isActive=false`). Number isolation truth: `docs/memory/SESSION_2026-08-15.md`.

---

## Automations phases (honest as of 2026-08-14 night)

Inbound order (unchanged, keep it): **conversation flow → static auto-reply → AI**.

### Phase A — mostly in code

CSW gate (no auto template fallback), `optedIn` on engines/resume, delay + form-wait interrupt, exact STOP (no `cancel` prefix), `ANY_MESSAGE` true catch-all, Redis lock heartbeat + requeue, Live = published **and** enabled (new matches), OWNER/ADMIN mutations, cycle detection, webhook SSRF, NFM HMAC.

**Still open from A:** Inbox pause does **not** stop journeys; draft/unpublish does **not** stop in-flight delay jobs; no CSW fallback template; `FEATURE_MATRIX` still messy.

**Tests:** `server/src/modules/automation/engine.inbound.test.ts` **does** cover `handleInboundAutomations` now. The recheck’s “zero inbound tests” line is **outdated**.

### Phase B — mixed

**Built after the recheck (same stretch):**

- Conflict preview **at save** + hub banner links
- Frequency cap: once per conversation / 24h (`automation/frequency.ts`)
- Default Automations tab = **Conversation flows**
- Inbox “waiting for a button” chip (`flow-waiting.ts`)

**Still not done:** keyword word-boundary on auto-replies (still `includes`), campaign picker UI, send-test-to-my-WhatsApp, interrupt-vs-continue as a node setting, pause-bot vs flows, node-level drop-off honesty.

### Phase C — **do not start** unless the user explicitly asks

Tickets/SLA node, catalog, NL generate-flow, merge form-builder (`wa-forms` vs `flows-assets`), `goto_flow` return stack, wait-for-media (`waitingFor: 'media'` never set), `on_tag_added`, template drip outside CSW.

---

## Calling research (one-liners we already decided)

- Sarvam = ears/mouth + **voice** LLM. Train/FAQ + personality = the **AiBot**. Not two chatbots.
- Embeddings stay **Azure**. If Azure embeddings fail, knowledge falls back to token search.
- Do **not** add acoustic barge-in / AEC / WebSocket TTS unless asked. Echo loop is why STT is muted during playback + 400ms tail.
- Live person on the **same** phone call is not ready. Support = WhatsApp follow-up + hang up.

---

## Templates + Connect + isolation (2026-08-15) — do not re-research

Shipped in `docs/memory/SESSION_2026-08-15.md`. Short truths:

- Create starters = Order / Appointment / Offer only. OTP is Meta library.
- Library clone: static HTTPS buttons keep their URL; dynamic uses `url_suffix_example` suffix sample (`verify`/`demo`). Live Graph proof still pending (`account_creation_confirmation` + real public https).
- Failed template fetches retry and keep the last list (Templates, Library, Campaigns, Inbox).
- Empty number list = Connect WhatsApp (`hasConnectedNumber` / `afterWhatsappNumbersFetch`), not a spinner.
- Public webhook health = counters only.
- **Customer production: no. Testing deploy: `bash start.sh`.**
- Number workspaces: `whatsappNumberId`; missing header + multiple numbers → 409; disconnect is soft; workers embedded (npm worker scripts exit 1).
