# Critical review — Calls + AI Bot — 2026-08-08 (post Loop 2 + recheck)

> Two fix loops completed, then a full plan recheck with technical tests. Prefer this over Aug-5 Azure-only docs.

## Verdict

**Prototype connect path ~8.0/10.** Scope locked to existing inbound/outbound connect (no new features: live transfer, recording ACL, post-call intel, voice clone, etc.). Connect leftovers fixed: agent softphone remote audio, outbound SDP TTL 180s + socket apply, Inbox mic/SDP guard.

## Scorecard

| Area | Loop0 | Loop1 | Loop2 | Recheck |
|------|-------|-------|-------|---------|
| Shared brain / Inbox | 7 | 8 | 8.5 | 8.5 |
| AI chat bot | 6 | 8 | 8 | 8 |
| Calling product | 4 | 7 | 8 | 7.5 |
| Sarvam / voice latency | 6 | 7 | 8.5 | 8.5 |
| Security / tenancy | 3 | 8 | 8 | 8.5 |
| UX honesty | 5 | 8 | 8.5 | 8.5 |
| **Production overall** | **4** | **~7.5** | **~8.2 claimed** | **~7.9 honest** |

## Recheck (technical) — 2026-08-08

- `tsc --noEmit`: clean
- Vitest AI + calling + media-retention: **32/32 passed**
- Migration `20260808120000_unique_whatsapp_phone_number_id`: applied / DB up to date
- Loop1+2 checklist: **PASS in code** (handoff note-only, agent pause, live transfer stub, outbound SDP, unique phoneNumberId, opt-out gates, injection refuse, empty-KB handoff, schedule_callback ticket, concurrent fail-closed, stream+validate, voiceInstructions, BIC 24h release, recording TTL, callback toast)

### Closed during recheck

1. `speak()` now clears `speaking` in `finally` (TTS throw no longer deafens the call)
2. BIC unread Redis failure **fail-closed** (blocks dial instead of allowing unlimited BIC)
3. Removed dead `VOICE_TOOLS` const; FEATURE_MATRIX TOTAL no longer claims “All DONE”

### Still skipped / needs more work

1. Real live WebRTC media transfer (intentional stub — largest product gap)
2. Softphone Hold / Keypad / Transfer UI stubs
3. Unencrypted local PCM recordings / no download ACL
4. Shallow regex prompt-injection only
5. Agent pause vs in-flight AI job race (TOCTOU)
6. No full Redis/stream integration tests; voice stream hardcodes conversations model

## Loop 2 landed

1. Stream Sarvam LLM → sentence TTS (validate each sentence before speak)
2. Professional brain `voiceInstructions` embedded + extracted on voice channel
3. BIC unanswered cooldown (≥2) with **24h time-based release** + honest copy
4. Call recording TTL purge (`CALL_RECORDING_TTL_DAYS`, default 7)
5. Consent-gated recording (unchanged, still default off)
6. `call:callback_requested` toast in Calls notification provider
7. Unit tests: voice-instructions, BIC helpers, media retention, guardrails

## Still intentionally not done (not blockers for careful beta)

1. Real live WebRTC media transfer (safely stubbed/off)
2. Encrypted recording storage / download ACL
3. Full Redis/stream integration tests
4. Org-custom model override on voice stream path (hardcodes conversations model)

## Teams this loop

- Voice instructions + BIC wiring
- Recording TTL + callback toast + tests
- Streaming voice path + critic High fixes (BIC time release, validate-before-speak)
- Recheck hotfixes: speaking finally, BIC fail-closed, matrix honesty
