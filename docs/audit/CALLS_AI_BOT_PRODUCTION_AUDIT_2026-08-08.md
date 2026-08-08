# Critical review — Calls + AI Bot — 2026-08-08 (post-fix loop)

> Follow-up to the morning audit. Critical/High blockers closed in two fix loops. Prefer code over older Aug-5 docs.

## Verdict

**Pilot-ready shared brain is now much safer for customers and platform users.** Customer-facing leaks, dual-reply, tenancy uniqueness, opt-out gates, and dishonest live-transfer paths are fixed or safely disabled. Overall production readiness: **~7.5/10** (was 4/10). Remaining work is latency polish, true live media transfer, and recording retention productization — not silent data leaks.

## Scorecard (after fixes)

| Area | Was | Now | Notes |
|------|-----|-----|-------|
| Shared brain | 7 | 8 | Injection refuse + KB no-match handoff |
| AI chat bot | 6 | 8 | Opt-out, after-hours reply, agent pause |
| Calling product | 4 | 7 | Inbound solid; live transfer safely off |
| Inbox integration | 5 | 8 | Internal handoff notes; no dual-reply |
| Sarvam integration | 6 | 7 | Still non-stream voice LLM |
| Error handling | 5 | 7 | Connect lock + Redis fail-closed |
| Security / tenancy | 3 | 8 | Unique phoneNumberId; secrets redacted |
| UX honesty | 5 | 8 | No “please hold” lie; matrix honest |
| **Production overall** | **4** | **~7.5** | Friendly pilot → careful beta |

## Fixed this session

1. Handoff summary → internal note only (never customer WhatsApp)
2. Agent send auto-pauses `botActive`
3. Live transfer coerced off API/UI; stubbed handler; message-only handoff copy
4. Outbound `/callback` requires browser SDP
5. `@@unique(phoneNumberId)` migration applied + connect 409
6. AI queue/job + missed-call skip when opted out
7. Prompt injection refuses LLM
8. Trained bot + 0 KB match → handoff
9. `schedule_callback` → Ticket + note + socket
10. Concurrent Redis fail-closed; connect lock fail-closed; await connect
11. Voice error speaks then ends
12. Recording only when consent enabled (default off)
13. After-hours still sends polite reply
14. `.env.example` placeholders only
15. FEATURE_MATRIX Voice Calling marked PARTIAL

## Remaining (next loop, not blockers for careful beta)

1. Stream LLM → TTS for lower voice latency
2. Real live media transfer (WebRTC renegotiation) — currently intentionally disabled
3. Recording TTL/encryption/download ACL when consent on
4. Wire `voiceInstructions` presets
5. Integration tests for connect / handoff / opt-out / tenancy
6. Local unanswered BIC cooldown vs Meta quality limits

## Teams

- Fix: handoff + bot pause · calling honesty · tenancy/opt-out/KB
- Critic re-verify then second loop for recording/copy/lock/stub
