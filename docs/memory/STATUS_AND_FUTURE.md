# Status, leftovers, do not redo

Last updated: **2026-08-14**.

## Ready or not

| Question | Answer |
|----------|--------|
| Deploy for **using and testing**? | **Yes** — `bash start.sh`, then a **new** inbound WhatsApp reply + an AI call. |
| **Customer production**? | **No** — auth storage, OAuth query secret, no live voice transfer. |
| “Every possible problem solved”? | **No.** Major issues **this stretch targeted** are in the repo. |

Do not treat `docs/audit/FEATURE_MATRIX.md` “Voice Calling All DONE” / Google TTS / Deepgram as current. Runtime voice is **Sarvam**. Older `docs/audit/CALLS_AI_BOT_CONNECTION_REPORT.md` (2026-08-05) still talks Azure chat brain + Deepgram/Google ears — **stale**. Prefer this folder.

---

## Automations — what next looks like

Full map: `docs/memory/RESEARCH_MAP.md`. Short version:

| Bucket | Status |
|--------|--------|
| Phase A (make it true) | Mostly in code. Open: pause-bot vs journeys, draft vs in-flight delay, CSW fallback template. |
| Phase B leftovers we **did** ship | Frequency cap, conflict preview at save, default tab = flows, Inbox waiting chip. |
| Phase B still open | Keyword word-boundary, campaign picker, send-test, pause journeys, interrupt-vs-continue node setting. |
| Phase C | **Do not start** unless the user asks. |

## Still left — and why we did not “just fix it”

| Leftover | Why not this pass |
|----------|-------------------|
| Live agent on the **same phone call** | WebRTC media transfer not production-ready; settings force `message_only`. Copy is honest. Do not promise “please hold”. |
| Access + refresh in `localStorage` | Full auth cookie migration. Out of scope. Refresh **does** rotate now (`rotateRefreshSession`). `docs/audit/AUTH_DEEP_REVIEW.md` (July) is **stale on rotation**. |
| `GET /oauth/access_token?client_secret=` | Meta token-exchange URL; not the Graph GET helper. POST would be a contract change. |
| Leftover org App Secret in DB | Used only if platform `.env` Meta creds are missing. PATCH is 410. Do not re-add UI. |
| Interrupt **while** TTS is playing | Disabled on purpose (echo loop on speaker). Gap interrupt only. Do not add AEC/WebSocket TTS unless user explicitly asks. |
| Inbox pause does not stop **flows** | Known; AI path honors `botActive`, journeys do not. Needs an explicit product pick. |
| Phase C automations | User said do not start: tickets/SLA, catalog, NL generate-flow, form-builder merge, `goto_flow` stack, wait-for-media. |
| Public health `totalReceived: 0` after restart | Not proof inbound is dead. Prove with a **new** phone message. Public health **does not** return `webhookUrl` — use `.env`. |

---

## Do not redo (already built)

- Re-research “is Train connected to calls?” — yes, `pickCallBotId` + `searchKnowledgeBase`.
- Re-split TTS on every `।` / `.` for “lower latency” — that was the रुक-रुक gap.
- Re-enable STT during TTS playback — echo loop.
- Re-dump latest FAQs when search misses — hallucination.
- Re-add Settings App ID / App Secret / Advanced override.
- Cloudflare/cloudflared tunnel fallback.
- Dual `npm run dev:worker` in local.
- Live transfer “coming soon” copy.
- Broad hang-up on `bye` / `रख दे` / `टीम से बात`.

---

## If the next session is asked to “make it production”

Order (smallest first): OAuth token-exchange without `client_secret` in query → lock leftover org Meta rows when platform env exists (already first) → HttpOnly refresh cookies → only then live transfer research.

Until then: **test-deploy is the goal.**
