# Samyoj Calls — Product, Architecture & Research Recommendations

> **Superseded for review:** use **[`CALLS_SHIP_DOCUMENT.md`](CALLS_SHIP_DOCUMENT.md)** (v2 — fuller flows, Meta permissions, Sarvam configure/implement, Inbox “coming soon” gap, competitor depth).  
> This file remains as the earlier draft.

**Status:** Research + recommendation doc (no code changes yet)  
**Audience:** Product + eng review before Calls hardening / Sarvam migration  
**Date:** 2026-08-04  
**Related UI doc:** [`docs/ui-specs/calls-content-poc.md`](../ui-specs/calls-content-poc.md)

---

## 0. Executive verdict

Samyoj already has a **real WhatsApp Cloud API Calling stack** (inbound UIC + outbound BIC callback, AI voice loop, agent WebRTC pickup, routing modes, transcripts, analytics). It is **not** a stub.

What it is **not** yet:

1. **India-first voice quality** — STT is Deepgram, TTS is Google Cloud; **Sarvam AI is not wired** (user direction: move call voice to Sarvam).
2. **Operator-simple UX** — Calls page is feature-dense (setup, analytics, FAQ, filters) vs Inbox’s “who needs me → act” clarity.
3. **Production-hardened media** — `@roamhq/wrtc` bridge + browser SDP is fragile; Meta SIP path unused.
4. **Permission-aware outbound** — BIC exists via Inbox “Call back”, but call-permission request UX / expiry / rate limits are under-exposed.
5. **Competitor parity on “useful few clicks”** — Wati Astra / Respond.io sell *one* story: AI answers → transcript → handoff. We expose plumbing.

**Recommendation:** Keep Meta Calling + Samyoj routing/CRM core. Replace Deepgram+Google voice path with **Sarvam STT (Saaras) + Sarvam TTS (Bulbul)** (optional Sarvam LLM later). Redesign Calls UI as an **Inbox-shaped work surface**. Gate advanced settings behind one “Customize” drawer.

---

## 1. What is built today (existing inventory)

### 1.1 Frontend

| Path | Role |
|------|------|
| `client/src/pages/CallsPage.tsx` | Main work surface: status, list, detail, analytics toggle, notes, terminate |
| `client/src/components/calls/CallsPageHeader.tsx` | Ready / phone / Live·Today·Total chips |
| `client/src/components/calls/CallListItem.tsx` | Row: contact, status, handler, preview |
| `client/src/components/calls/CallDetailView.tsx` | Transcript + metadata |
| `client/src/components/calls/CallFiltersBar.tsx` | Search / status / handler |
| `client/src/components/calls/CallAnalyticsPanel.tsx` | 30d analytics drawer |
| `client/src/components/calls/CallSetupProgress.tsx` | Enable calling checklist |
| `client/src/components/calls/CallingSettingsPanel.tsx` | Org routing / greeting / after-hours |
| `client/src/components/calls/CallRingModal.tsx` | In-app ring + Accept/Decline (WebRTC SDP) |
| `client/src/components/calls/CallNotificationProvider.tsx` | Socket-driven ring overlay (app-wide) |
| `client/src/components/calls/CallOverviewPanel.tsx` / `CallSystemStatus.tsx` / `CallInfoPanel.tsx` | Provider readiness + FAQ |
| Inbox: `useConversationActions.ts` + chat header | **Call back** → `callingApi.callback` |

Nav: Main → **Calls** → `/calls`, deep link `/calls/:callId`.

### 1.2 Backend module (`server/src/modules/calling/`)

| File | Role |
|------|------|
| `routes.ts` | REST under `/api/calling` |
| `meta-calling.service.ts` | Graph: enable settings, `pre_accept` / `accept` / `reject` / `terminate` / outbound `connect` |
| `call.processor.ts` | Webhook `calls` field → create Call, route AI vs agents, ring timeout, terminate |
| `ai-voice-agent.ts` | Live loop: WebRTC bridge → Deepgram STT → `generateBotReply` → Google TTS → play |
| `webrtc-bridge.ts` | `@roamhq/wrtc` SDP offer/answer + PCM audio |
| `deepgram.stt.ts` | Streaming STT WebSocket |
| `google-tts.service.ts` | Neural2 TTS |
| `agent-call.service.ts` | Agent accept/decline with browser SDP |
| `routing.service.ts` | `ai_only` \| `agents_first` \| `ai_then_agents` |
| `settings.service.ts` | Org calling settings (greeting, timeouts, languages) |
| `missed-call.service.ts` | Auto WhatsApp follow-up after miss |
| `session-store.ts` | Redis pending/active call state |
| `analytics.ts` | Aggregates for UI |
| `call-session.manager.ts` | In-process AI session registry |

Webhook entry: WhatsApp webhook → `processWebhookFields` (also from workers).

### 1.3 Data model (`Call`)

Enums: `USER_INITIATED` / `BUSINESS_INITIATED`; status `RINGING`…`TERMINATED`; handler `AI` / `AGENT` / `UNANSWERED`.

Fields: `metaCallId`, phones, duration, JSON `transcript`, `metadata` (notes), links to contact / conversation / bot / agent / WhatsApp number.

### 1.4 API surface (`/api/calling`)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/status` | Ready flags, Meta calling enabled, active count, hints |
| GET/PATCH | `/settings` | Org routing & voice config (admin patch) |
| POST | `/enable` `/disable` | Meta phone calling status |
| GET | `/analytics` | Period stats |
| GET | `/` | Paginated call list + filters |
| POST | `/callback` | **Business-initiated** call (SDP offer → Meta connect) |
| GET | `/:id/signaling` | Pending SDP for agent UI |
| POST | `/:id/accept` `/decline` | Agent answer / reject |
| GET/PATCH | `/:id` | Detail / notes |
| POST | `/:id/terminate` | Hang up via Meta |

### 1.5 Current voice AI stack (important)

```
WhatsApp user ↔ Meta VoIP (OPUS/WebRTC)
        ↔ Samyoj webrtc-bridge (@roamhq/wrtc)
        ↔ Deepgram streaming STT
        ↔ Existing AI bot (Azure OpenAI via chatbot.service)
        ↔ Google Cloud TTS
        ↔ back into bridge → Meta
```

**Sarvam is not in this path today.** Env today: `DEEPGRAM_*`, `GOOGLE_TTS_*`, `CALLING_AI_*`, Azure OpenAI. No `SARVAM_*` in config.

### 1.6 Routing algorithm (already solid)

1. Inbound connect webhook → upsert contact/conversation → `Call` row.
2. `decideCallRoute` from org settings + hours:
   - **ai_only** → start `AiVoiceCallSession` (pre_accept + accept).
   - **agents_first** → ring agents (socket + timeout) → AI fallback or miss.
   - **ai_then_agents** → AI first; handoff path exists via bot tools.
3. After-hours: AI / message / missed.
4. Terminate webhook → duration, transcript persist, missed-call message, flow trigger.

Keep this brain; swap only the STT/TTS adapters.

---

## 2. Meta WhatsApp Calling — research summary

Sources: [Cloud API Calling](https://developers.facebook.com/docs/whatsapp/cloud-api/calling/), [UIC](https://developers.facebook.com/documentation/business-messaging/whatsapp/calling/user-initiated-calls), [BIC](https://developers.facebook.com/documentation/business-messaging/whatsapp/calling/business-initiated-calls), [Pricing](https://developers.facebook.com/docs/whatsapp/cloud-api/calling/pricing), [SIP](https://developers.facebook.com/docs/whatsapp/cloud-api/calling/sip/), Dualhook field guides.

### 2.1 Two initiation paths

| | User-initiated (UIC) | Business-initiated (BIC) |
|--|----------------------|---------------------------|
| Who starts | Customer taps call on business | Business `POST …/calls` `action:connect` |
| Permission | Call hours + icon visibility | **Explicit call permission** first |
| Pricing | **Free** | Per **6-second pulse**, country + volume tier |
| Samyoj today | Primary AI / agent path | Inbox **Call back** |

### 2.2 Prerequisites (match our `CALLING_ENABLE_HINTS`)

- Cloud API number (not WA Business app alone).
- Payment method on WABA.
- Messaging limit historically ~1k–2k unique customers/day (Meta docs evolve; test numbers for sandbox).
- Webhook subscribed to **`calls`** field.
- SDP must be RFC-compliant (OPUS, ICE, DTLS-SRTP). Meta also documented G.711 (PCMA/PCMU) options (2026).

### 2.3 UIC signaling (what we implement)

1. Connect webhook with **SDP offer**.
2. Optional **`pre_accept`** (faster media) with SDP answer.
3. **`accept`** with SDP answer (30–60s window or user sees Missed).
4. **`terminate`** when done (API terminate still needed for clean billing/state).

### 2.4 BIC signaling (what we partially implement)

1. Send **call permission request** (free-form in open window or **template**).
2. User Allow → permission window (policy timing varies; treat as **short-lived**; re-check via `call_permissions` API).
3. `POST /calls` connect + SDP **offer**.
4. Connect webhook returns SDP **answer**.
5. Status webhooks: RINGING / ACCEPTED / REJECTED → Terminate.

**Gap:** UI does not clearly show “permission needed / granted / expired” before Call back. Meta has `GET …/call_permissions?user_wa_id=`.

### 2.5 SIP vs Graph WebRTC

Meta supports **SIP** trunking as alternative to Graph SDP. Samyoj uses **Graph + local wrtc** only. SIP is a later scale option (PBX / contact-center), not required for v1 AI answers.

### 2.6 Pricing & product messaging

- Tell customers: **inbound free**; **outbound billed by Meta** (plus our AI minutes).
- Permission request messages still cost **message** pricing.
- Show pulse estimate on outbound confirm (even rough).

---

## 3. Competitor landscape (what “good” looks like)

| Player | Calls / voice story | UX takeaway for Samyoj |
|--------|---------------------|-------------------------|
| **Wati Astra Voice** | Clone voice, WhatsApp+web AI agent, BANT, memory | One setup → “AI answers calls”; hide codecs |
| **Respond.io** | Omnichannel + WA Calling + AI → human handoff + transcript | Inbox and Calls feel like one conversation |
| **AiSensy** | SMB outbound reminders / support voice | Simple outbound campaigns later; not day-1 |
| **Gallabox** | Voice on higher tiers + analytics | Strong reporting; don’t bury stats on home |
| Classic BSPs | Often chat-only; weak native WA Calling | Our Meta Calling depth is a **differentiator** if UX is simple |

**Parity target (MVP polish):**

1. One readiness state: Ready / Needs setup / Offline.  
2. Live call + ring modal that always works.  
3. Transcript next to chat history.  
4. One-click Call from Inbox with permission gate.  
5. AI answers by default; “Transfer to agent” is the power move.

---

## 4. Sarvam AI — research & how to plug in

Official index: [docs.sarvam.ai/llms.txt](https://docs.sarvam.ai/api/llms.txt) · Product: [sarvam.ai](https://www.sarvam.ai/).

### 4.1 Why Sarvam for Samyoj Calls

- Built for **Indian languages + Hinglish code-mix** (our default market).
- STT: **Saaras v3** / Saarika; streaming WebSocket; **8 kHz telephony** guidance; modes: `transcribe` / `codemix` / translate / translit.
- TTS: **Bulbul v3** — 30+ voices, sub-250ms streaming first byte, pace/pitch, pronunciation dictionary.
- Optional LLM: **Sarvam-105B** (chat) — can stay on Azure OpenAI short-term; migrate later for Indic quality.
- Integrates with LiveKit / Pipecat / Vapi patterns — useful if we later replace `@roamhq/wrtc`.
- Cookbook: [Call analytics pipeline](https://docs.sarvam.ai/api/cookbook/guides/call-analytics-pipeline.md) (batch STT + diarization + LLM summary) — post-call intelligence.

### 4.2 Recommended voice pipeline (target)

```
Meta VoIP ↔ webrtc-bridge (keep short-term)
         ↔ Sarvam STT WS (saaras:v3 / saaras:v3-realtime)
         ↔ Bot brain (existing chatbot.service → Azure or Sarvam LLM)
         ↔ Sarvam TTS WS Bulbul v3
         ↔ bridge → Meta
```

Auth: `api-subscription-key` / `SARVAM_API_KEY` (env only; never UI).

### 4.3 Implementation map (no code yet — planned adapters)

| New module | Replaces | Notes |
|------------|----------|-------|
| `sarvam.stt.ts` | `deepgram.stt.ts` | PCM/WAV base64 chunks; sample_rate 8000 or 16000; keep-alive &lt;60s idle |
| `sarvam.tts.ts` | `google-tts.service.ts` | Streaming WS for barge-in friendliness; speaker from org settings |
| Settings fields | `deepgramLanguage` / Google voice | `sarvamSttLanguage`, `sarvamTtsSpeaker`, `sarvamMode=codemix` |
| Feature flag | — | `CALLING_VOICE_PROVIDER=sarvam\|deepgram_google` for rollback |

### 4.4 Latency & quality checklist (from Sarvam docs)

- Prefer **realtime** STT endpoint for barge-in / partials when stable.
- Use `high_vad_sensitivity` for noisy callers.
- Telephony: **8 kHz** if bridge downsamples; don’t send MP3/AAC on WS.
- TTS: stream; don’t wait for full reply paragraph if we can chunk sentences.
- Budget end-to-end: aim &lt;1.5–2s agent response after end-of-utterance for “feels live”.

### 4.5 Cost model (product)

Show org admins in Settings → Calls (advanced):

- Meta BIC pulses (outbound only).  
- Sarvam STT minutes + TTS characters.  
- LLM tokens (existing AI usage panel).

---

## 5. Gap analysis — keep / improve / cut / add

### 5.1 Keep (already correct)

- Meta UIC accept/pre_accept/terminate path.  
- BIC callback from Inbox.  
- Routing modes + after-hours + missed-call WhatsApp message.  
- Transcript JSON on `Call` + socket `call:*` events.  
- Link call ↔ contact ↔ conversation.  
- Enable hints for Meta prerequisites.

### 5.2 Improve (high priority)

| Gap | Why it hurts | Recommendation |
|-----|--------------|----------------|
| Deepgram + Google | Weaker Indic / dual-vendor ops | **Sarvam STT+TTS** as default |
| Calls UI density | Setup/FAQ/analytics compete with work | Inbox-like **list + detail**; see UI POC |
| Call permission UX | Outbound fails cryptically | Preflight `call_permissions`; request permission CTA in Inbox |
| `@roamhq/wrtc` | Unofficial / maintenance risk | Short-term keep; mid-term evaluate LiveKit or Meta SIP |
| Agent device UX | No mic picker / test tone | Ring modal: device select + “Test mic” |
| Error copy | Meta Graph jargon | Map to 3-step fix (quality, payment, webhook `calls`) |
| Analytics on home | Noise | Default off; “Insights” secondary |

### 5.3 Cut or hide (unnecessary for most users)

- Always-visible provider checklist (Deepgram/Google/Azure dots) → one **System health** in Advanced.  
- Long FAQ panel on main Calls page → docs link / empty-state tips only.  
- Exposing SDP / signaling language in UI.  
- Too many filter dimensions on day-1 (keep search + status + AI/Human).

### 5.4 Add (user-valuable, 1–2 clicks)

1. **Permission chip** on chat header before Call.  
2. **Live call dock** (minimize) while browsing Inbox.  
3. **Post-call summary** (Sarvam batch or LLM) → internal note on conversation.  
4. **Transfer to agent** during AI call (softphone accept).  
5. **Call hours** editor mirroring Meta `call_hours` (not only org after-hours).  
6. **Recording consent** already in settings — surface once in onboarding, not every screen.  
7. Optional later: outbound “call campaigns” (AiSensy-style) — **not** MVP.

---

## 6. Failure modes & debug map

| Symptom | Likely cause | Where to look |
|---------|--------------|---------------|
| Enable fails 422 | Meta prerequisites | `meta-calling.service` CALLING_PREREQUISITES; Business Manager |
| Inbound rings then drops | No accept in 30–60s; bridge crash | `call.processor`, `ai-voice-agent`, wrtc logs |
| AI silent | STT/TTS key missing; bot skip | `/calling/status` flags; Azure/Sarvam keys |
| Agent Accept fails | SDP mismatch; pending expired | `/:id/signaling`, `agent-call.service` |
| Outbound instant fail | No call permission; country BIC ban | `call_permissions` API; Meta country list |
| Transcript empty | STT disconnect; speaking lock | `deepgram.stt` / future Sarvam STT |
| Inbox Call works, Calls page empty | Number filter / cache | `activeWhatsappNumberId` on list |
| Webhook never fires | Tunnel / `calls` field not subscribed | Same as messaging inbound + Meta app fields |
| “API access blocked” | Meta app / token policy | Separate from calling logic; reconnect WA |

---

## 7. Phased roadmap (recommended)

### Phase A — Stabilize & UX (1–2 weeks)

- Ship Calls UI per [`calls-content-poc.md`](../ui-specs/calls-content-poc.md).  
- Permission preflight + request message from Inbox.  
- Friendly enable checklist.  
- Softphone mic test.

### Phase B — Sarvam voice (2–3 weeks)

- Adapters + feature flag.  
- Org voice: language + Bulbul speaker.  
- Side-by-side A/B on staging (Deepgram vs Sarvam).  
- Latency dashboard (p50/p95 STT+TTS).

### Phase C — Intelligence (ongoing)

- Post-call summary → conversation note.  
- Transfer AI → agent mid-call polished.  
- Evaluate LiveKit/SIP if concurrent calls &gt; org needs.

### Phase D — Outbound scale (later)

- Permission templates library.  
- Soft dialer queue (not blast spam).  
- Pulse cost estimator.

---

## 8. Configuration contract (proposed)

```bash
# Voice provider
CALLING_VOICE_PROVIDER=sarvam   # or deepgram_google

# Sarvam (platform secrets — never in UI)
SARVAM_API_KEY=
SARVAM_STT_MODEL=saaras:v3
SARVAM_STT_MODE=codemix
SARVAM_STT_LANGUAGE=hi-IN
SARVAM_TTS_MODEL=bulbul:v3
SARVAM_TTS_SPEAKER=shubh
SARVAM_SAMPLE_RATE=16000

# Legacy (fallback)
DEEPGRAM_API_KEY=
GOOGLE_TTS_VOICE=
GOOGLE_TTS_LANGUAGE=
CALLING_AI_AUTO_ANSWER=true
CALLING_AI_GREETING=...
```

User-facing: language + voice + routing only. Keys stay in `server/.env`.

---

## 9. Success metrics

| Metric | Target |
|--------|--------|
| Time-to-first useful Calls screen | &lt; 3s after Ready |
| Inbound answer rate (AI or agent) | ↑ vs baseline |
| Median AI response latency | &lt; 2s after utterance end |
| Outbound success after permission | &gt; 80% connect |
| Support tickets “calling cryptic error” | ↓ |
| Agent clicks to answer | ≤ 2 (Accept) |

---

## 10. Decision asks for review

1. Confirm **Sarvam replaces Deepgram+Google** as default for Calls (keep flag).  
2. Confirm **Azure OpenAI stays** for bot brain in Phase B (Sarvam-105B later).  
3. Approve UI direction in companion POC (Inbox-shaped, less chrome).  
4. Approve Phase A before media-stack rewrite (UX + permissions first).  
5. Defer SIP / LiveKit until concurrent-call pain is real.

---

## 11. Source links (research)

- Meta Calling overview: https://developers.facebook.com/docs/whatsapp/cloud-api/calling/  
- UIC: https://developers.facebook.com/documentation/business-messaging/whatsapp/calling/user-initiated-calls  
- BIC: https://developers.facebook.com/documentation/business-messaging/whatsapp/calling/business-initiated-calls  
- Pricing: https://developers.facebook.com/docs/whatsapp/cloud-api/calling/pricing  
- SIP: https://developers.facebook.com/docs/whatsapp/cloud-api/calling/sip/  
- Sarvam docs index: https://docs.sarvam.ai/api/llms.txt  
- Sarvam STT streaming: https://docs.sarvam.ai/api/api-guides-tutorials/speech-to-text/streaming-api  
- Sarvam TTS: https://docs.sarvam.ai/api/api-guides-tutorials/text-to-speech/overview  
- Sarvam LiveKit voice agent: https://docs.sarvam.ai/api/integration/build-voice-agent-with-live-kit  
- Wati Astra: https://www.wati.io/products/astra/voice-ai/  
- Dualhook Calling guide: https://dualhook.com/docs/calling  

Internal: `docs/AUDIT.md` §Calling, `docs/ENHANCEMENT_PLAN.md` (calling items), `server/src/modules/calling/*`.
