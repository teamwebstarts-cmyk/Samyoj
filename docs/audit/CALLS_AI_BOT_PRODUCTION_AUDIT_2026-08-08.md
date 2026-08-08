# Critical review — Calls + AI Bot — 2026-08-08

> Code-verified production audit of **WhatsApp Calling** + **AI Bot** + **shared Sarvam brain** + **Inbox** linkage.  
> Prefer this over Aug-5 docs (`SARVAM_AS_AI_BRAIN.md`, blueprint) which still claim Azure-only brain.

## Verdict

**Demo-grade “one brain, two channels” is real and Sarvam is already the default LLM + STT/TTS stack — but live transfer, handoff-summary leakage, tenancy, opt-out, and several compliance/UX paths block production.**

Overall production readiness: **4/10** (controlled pilot only).

## Scorecard

| Area | Score | Why |
|------|-------|-----|
| Shared brain architecture | 7/10 | Same `AiBot` + `generateBotReply` for chat and voice |
| AI chat bot | 6/10 | Debounce, RAG, handoff, Try-it work; silent BH skip; weak injection; dual-reply risk |
| Calling product | 4/10 | Inbound AI real; outbound permission OK; live transfer broken; softphone stubs |
| Inbox integration | 5/10 | Transcripts/events exist; ownership AI↔agent messy; summary can leak to customer |
| Sarvam integration | 6/10 | Chat+STT+TTS solid; streaming unused; embeddings still Azure |
| Error handling / logs | 5/10 | Module logs OK; fire-and-forget connect; Redis fail-open |
| Security / tenancy | 3/10 | Non-unique `phoneNumberId`; `.env.example` secret residue; raw PCM |
| UX honesty | 5/10 | Deep-links good; Transfer/Hold/Keypad stubs; FEATURE_MATRIX oversells |
| **Production overall** | **4/10** | Blockers below must land first |

## Architecture (current code)

```
                    ┌──────────────────────────────┐
                    │  AiBot (personality + Train) │
                    │  generateBotReply(channel)   │
                    └─────────────┬────────────────┘
                                  │
                     createChatCompletion()
                     (Sarvam default / Azure legacy)
                                  │
              ┌───────────────────┴───────────────────┐
     channel: text                          channel: voice
     automation → WhatsApp                  Sarvam STT → TTS
     Inbox thread                           WebRTC + Meta Calling
```

**Sarvam is brain + ears + mouth.** Azure remains for embeddings/RAG only (optional).

## Confirmed working

- Shared brain path: `chatbot.service.ts` ← chat worker + `ai-voice-agent.ts`
- Sarvam chat: `sarvam-chat.service.ts` + `chat-completion.service.ts`
- Inbound call route AI / agents / missed: `routing.service.ts`, `call.processor.ts`
- Outbound agent BIC + `call_permission_request`: `routes.ts`, `meta-calling.service.ts`
- Voice tools `request_human` / `schedule_callback` (callback is handoff-only)
- Inbox Call button + ring modal for *initial* agent rings
- Missed-call WhatsApp/flow follow-up
- “Use for WhatsApp calls” → `CallingSettings.defaultBotId`

## Critical / High (ordered)

1. **Live transfer is not media-complete** — rings with empty SDP; never sets `RINGING`; accept rejects CONNECTED calls. Evidence: `call.processor.ts` `handleLiveTransfer`, `agent-call.service.ts:27-29`.
2. **Handoff summary sent to customer WhatsApp** — `performHandoff` + `sendContext` in `automation/engine.ts` sends `AI Handoff Summary` to `contactPhone`.
3. **Non-unique `phoneNumberId`** — `WhatsappNumber` has no `@@unique`; webhook/call `findFirst` can cross tenants.
4. **Opt-out ignored after STOP message** — later AI / missed-call paths do not check `contact.optedIn`.
5. **Human agent reply does not pause bot** — dual replies possible until handoff/pause.
6. **Concurrent-call fail-open** — Redis error → count `0` → over-admit.
7. **Webhook connect fire-and-forget** — `void handleCallConnect` race risk.
8. **`.env.example` secret residue** — commented live-looking keys including `SARVAM_API_KEY=sk_…`.
9. **Empty KB hallucination** — no hard refuse when 0 FAQ matches.
10. **`schedule_callback` theater** — no ticket/task/calendar job.
11. **Streaming unused** — `streamSarvamChatCompletion` exists; voice waits full LLM before TTS (latency).
12. **Recording hygiene** — raw PCM under `uploads/calls`; consent default off.

## Scenario matrix (selected)

| Scenario | Actor | Expected | Actual | Sev |
|----------|-------|----------|--------|-----|
| Inbound → AI | Customer | Answer + converse | Works if Sarvam configured | Med |
| Live transfer | Both | Media to agent | Broken SDP/status | Crit |
| Chat handoff | Both | Agent-only context | Summary to customer | Crit |
| STOP then chat | Customer | No bot spam | AI can still reply later | Crit |
| Agent answers inbox | Platform | Bot pauses | Bot stays active | High |
| After-hours chat (`businessHoursOnly`) | Customer | Closed reply | Silent skip | High |
| Outbound without mic SDP | Platform | Fail clear | Dead server bridge | High |
| Concurrent > max | Customer | Missed | Redis fail-open | High |
| Empty Train | Customer | Refuse / handoff | Can hallucinate | High |
| Prompt injection | Customer | Block | Sanitize + warn; still completes | High |
| Cross-tenant webhook | Infra | Unique phone | `findFirst` no unique | Crit |
| Sarvam down mid-call | Customer | Speak + end | May hang silent | High |

## Industry gap vs 2026 best practice

Competitors (respond.io / production agent guides) expect: message-first voice escalation, RAG grounded answers, **internal** handoff summaries, live transfer with context, consent + unanswered BIC cooldowns, explicit AI vs human ownership. Samyoj has the shared-brain architecture right; execution gaps are handoff, transfer, compliance, and honesty of “DONE”.

## Do next (work one-by-one)

1. Disable / hide live transfer until media works; default message-only handoff.
2. Fix handoff summary → Inbox internal note / socket only (never customer WhatsApp).
3. Add `@@unique([phoneNumberId])` + connect conflict.
4. Compliance gate: AI + missed-call respect opt-out policy.
5. Auto-pause bot when agent sends a message.
6. Idempotent call connect lock; await handler.
7. Concurrent calls: atomic counter; fail-closed without Redis.
8. Empty KB → refuse / force handoff.
9. Prompt injection → refuse + handoff.
10. Real `schedule_callback` → ticket/task + agent notify.
11. Stream LLM → TTS for voice latency.
12. Redact `.env.example` + rotate exposed keys.
13. Rewrite FEATURE_MATRIX + Sarvam audit docs to match code.
14. Recording: encrypt/TTL/ACL or disable by default.
15. Integration tests: connect, missed, handoff, opt-out, tenant isolation.

## Evidence sources

- Subagents: calling explore, AI/Sarvam explore, senior critic
- Code: `server/src/modules/calling/**`, `server/src/modules/ai/**`, `automation/engine.ts`, `prisma/schema.prisma`
- External: Meta Cloud Calling docs (2025–2026), Sarvam LiveKit/voice best practices, respond.io / production WhatsApp agent handoff guides
