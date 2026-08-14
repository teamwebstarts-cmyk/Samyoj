# Agent memory — Samyoj

**Read this folder at the start of a new session** before re-researching calling, Train/AI bot, automations, WhatsApp connect, or “is this production-ready?”

This is **session memory**, not a second feature matrix. Short, path-backed, honest. Prefer these files over stale `docs/audit/FEATURE_MATRIX.md` (that file still says Google TTS / Deepgram / Voice Calling “All DONE” — **false**).

| File | Use |
|------|-----|
| [SESSION_2026-08-14.md](./SESSION_2026-08-14.md) | What we **built** this stretch, file paths, how it works |
| [STATUS_AND_FUTURE.md](./STATUS_AND_FUTURE.md) | Test-deploy vs production, leftovers, do-not-redo |
| [RESEARCH_MAP.md](./RESEARCH_MAP.md) | Where the long audits live, what’s stale, Phase A/B/C truth |

Cursor always-apply pointer: `.cursor/rules/session-memory.mdc`.

---

## Current honest status (2026-08-14 night)

- Ready to **deploy for using and testing** (`bash start.sh`). Prove inbound with a **new** phone reply. Public `GET /api/whatsapp/webhook/health` returns `webhookConfigured` — **not** `webhookUrl`. Use `META_WEBHOOK_URL` in `server/.env`.
- **Not** customer-production (JWT in `localStorage`, OAuth `client_secret` in query, no live voice transfer).
- Speech: **Sarvam** (Saaras STT, Bulbul TTS, `sarvam-105b-conversations` on calls). Embeddings **Azure**. One **AiBot** for chat + voice.

## Product non-negotiables

- Normal users never see Meta App ID / App Secret / `.env` in Settings.
- Inbound WhatsApp needs ngrok HTTPS (`scripts/dev-tunnel.sh`). No Cloudflare fallback.
- Workers run **inside the API** (`startWorkers()`). Do not also run `npm run dev:worker` locally.

## How to add the next session

Add `docs/memory/SESSION_YYYY-MM-DD.md` and update this README + `STATUS_AND_FUTURE.md`. Do not dump another FEATURE_MATRIX. Note what shipped, what was decided **not** to do, and which audit files became stale.
