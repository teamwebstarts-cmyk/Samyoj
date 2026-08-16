# Agent memory — Samyoj

**Read this folder at the start of a new session** before re-researching calling, Train/AI bot, automations, WhatsApp connect, templates, billing, or “is this production-ready?”

This is **session memory**, not a second feature matrix. Short, path-backed, honest. Prefer these files over stale `docs/audit/FEATURE_MATRIX.md` (that file still says Google TTS / Deepgram / Voice Calling “All DONE” and billing DONE — **false**).

| File | Use |
|------|-----|
| [SESSION_2026-08-16.md](./SESSION_2026-08-16.md) | Product sets 1–4 researched + filed. **Shipped 2026-08-16:** 47, 48, 50, 51, 53, 54, 55, 58, 46, 49 (Pick A sessionStorage). **Still open:** 52, 56, 59. Recheck: [DICTATION_RECHECK_2026-08-16.md](./DICTATION_RECHECK_2026-08-16.md). |
| [PRODUCT_TASKS_2026-08-16.md](./PRODUCT_TASKS_2026-08-16.md) | Spec: current code vs wanted behavior (sets 1–4) |
| [../product/CALLS_AI_USAGE_ADMIN_2026-08-16.md](../product/CALLS_AI_USAGE_ADMIN_2026-08-16.md) | Durable set-3 product doc (Calls recents, summary, AI Reports, admin). Copy to Confluence when wiki is connected. |
| [../product/INBOX_CONTACT_AND_CALLING_AI_2026-08-16.md](../product/INBOX_CONTACT_AND_CALLING_AI_2026-08-16.md) | Durable set-4 product doc (Inbox New chat = Contacts fields; strip AI from Calling settings). |
| [SESSION_2026-08-15.md](./SESSION_2026-08-15.md) | Number isolation, workers embedded, campaign wizard UX, templates/Connect leftovers; **test-deploy vs production** |
| [SESSION_2026-08-14.md](./SESSION_2026-08-14.md) | Calls/Train/automations Phase B + earlier WhatsApp lock-down |
| [STATUS_AND_FUTURE.md](./STATUS_AND_FUTURE.md) | Test-deploy vs production, leftovers, do-not-redo |
| [RESEARCH_MAP.md](./RESEARCH_MAP.md) | Where the long audits live, what’s stale, Phase A/B/C + billing docs |

Cursor always-apply pointer: `.cursor/rules/session-memory.mdc`.

---

## Current honest status (2026-08-16)

Same production answer as 15 Aug. **New:** product dictation sets 1–4 are documented and in Jira. **Shipped in code 2026-08-16:** 47, 48, 50, 51, 53, 54, 55, 58, **46**, **49** (user testing locally). **Still not built:** 52, 56, 59. More items still coming from the user.

- **Customer production go-live / production-ready pipeline: NO.** Do not restart a launch that claims the product is production-complete.
- **Internal using + testing of this existing build: YES.** `bash start.sh` = Docker + API `:8000` + UI `:3000` + ngrok-only inbound. That is a **testing deploy**, not production.
- Prove inbound with a **new** phone reply (old messages do not replay). Public `GET /api/whatsapp/webhook/health` returns counters + `webhookConfigured` — **not** `webhookUrl`, **not** `lastError`, **not** a Facebook trace id. Use `META_WEBHOOK_URL` in `server/.env`.
- Speech: **Sarvam** (Saaras STT, Bulbul TTS, `sarvam-105b-conversations` on calls). Embeddings **Azure**. One **AiBot** for chat + voice.
- Billing: audit + blueprint docs exist. **Not built this session.** Do not start billing code unless asked.

## Product non-negotiables

- Normal users never see Meta App ID / App Secret / `.env` / Advanced override in Settings.
- Inbound WhatsApp needs ngrok HTTPS (`scripts/dev-tunnel.sh`). No Cloudflare fallback. Fail if `NGROK_AUTHTOKEN` is missing.
- Workers run **inside the API** (`startWorkers()`). `npm run start:worker` / `dev:worker` **exit 1**. Do not run PM2 `whatsapp-worker`.
- Each connected WhatsApp number is its own workspace (`whatsappNumberId`). Missing header with multiple numbers → **409**. Disconnect is soft.

## How to add the next session

Add `docs/memory/SESSION_YYYY-MM-DD.md` and update this README + `STATUS_AND_FUTURE.md`. Do not dump another FEATURE_MATRIX. Note what shipped, what was decided **not** to do, and which audit files became stale.
