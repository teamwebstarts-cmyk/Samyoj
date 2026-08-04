# Samyoj Calls — Compress Ship Document

**Type:** Research + existing-build audit + recommendations (documentation only)  
**Review before any code**  
**UI companion:** [`../ui-specs/calls-content-poc.md`](../ui-specs/calls-content-poc.md)  
**Date:** 2026-08-04 (v2.3 — chosen UX: live handoff + easy personality/train; UI POC synced)

---

## A. Prompt compliance (what you asked vs what this doc covers)

| # | Your requirement | Covered in |
|---|------------------|------------|
| 1 | Deep-read **exact existing** FE + BE + Meta + bot + flaws/errors/debug | §B–§D, §H |
| 2 | Research **before** “what to improve” | §E Meta, §F Sarvam, §G Competitors |
| 3 | Collect Meta inbound **and** outbound calling features | §E |
| 4 | Competitor profiles | §G |
| 5 | Match research ↔ existing build; recommend keep / improve / cut / add | §I |
| 6 | User-friendly: less UI, useful, ≤2 clicks, plus Customize | §I + UI POC |
| 7 | Sarvam AI official docs — configure + implement (not “basic” AI calling) | §F |
| 8 | Separate Calls **UI-only** design doc from Inbox patterns | UI POC file |
| 9 | AI talking to client → tool-call / connect / schedule / assign human | §L (**chosen**) |
| 10 | Easy AI agent config: personality + train so bot handles calls/chat well | §N + UI POC §14 |

**Honest gap from v1 docs:** first pass skimmed code, thin Sarvam/config, thin permissions, missed Inbox “Calling coming soon”.  
**v2.1:** Merged deeper inventory from [Explore Calls codebase deep](f2a79bbd-9968-44ac-a1ec-716795eb95ec) + [Full Calls code inventory](b3238377-39be-459f-9b90-6836b6f260b2) (BIC media hole, decline stub, routing name mismatch, Redis/TTL, etc.).

---

## B. What is exactly built today

### B.1 One-sentence truth

Samyoj already has a **working Meta Cloud API Calling product path**: inbound user calls can be answered by **AI** (WebRTC bridge + Deepgram STT + **existing AiBot / Azure OpenAI** + Google TTS) or **human agents** (browser softphone), and outbound **callback** exists on the API — but the **Inbox Call button is currently disabled in UI** (“Calling coming soon”), and **Sarvam is not integrated anywhere**.

### B.2 Frontend map

| Path | Role |
|------|------|
| `client/src/pages/CallsPage.tsx` | List + detail + enable + analytics + notes + terminate |
| `client/src/components/calls/*` | Header, filters, list row, detail, analytics, setup, settings, ring modal, FAQ/overview |
| `CallNotificationProvider` in `Layout.tsx` | App-wide `call:ring` → `CallRingModal` |
| `callingApi` in `services/api.ts` | Full client API for calling module |
| Inbox `useConversationActions.handleCallBack` | Calls `POST /calling/callback` then navigates `/calls/:id` |
| Inbox `ChatHeader.tsx` | **Call UI disabled** — label `"Calling coming soon"`; `onCallBack` unused (`_onCallBack`) |
| Dashboard | Quick Action → `/calls` in `DashboardQuickActions.tsx` (not a live-calls widget on home) |
| Settings | Tab mounts `CallingSettingsPanel` |
| Orphans | `CallOverviewPanel` / `CallSystemStatus` / `CallInfoPanel` exist but are **not** on current `CallsPage` |

### B.3 Backend map (`server/src/modules/calling/`)

| File | Responsibility |
|------|----------------|
| `routes.ts` | REST `/api/calling/*` |
| `meta-calling.service.ts` | Graph Calling: enable, connect, pre_accept, accept, reject, terminate |
| `call.processor.ts` | Webhook `calls` field → create/update Call, route, ring, AI start, terminate |
| `routing.service.ts` | `decideCallRoute` + `resolveCallBot` |
| `ai-voice-agent.ts` | Live AI session loop |
| `webrtc-bridge.ts` | `@roamhq/wrtc` SDP + PCM |
| `deepgram.stt.ts` | Streaming STT |
| `google-tts.service.ts` | Google Neural2 TTS |
| `agent-call.service.ts` | Agent accept/decline |
| `settings.service.ts` | Org calling settings |
| `missed-call.service.ts` | WhatsApp follow-up on miss |
| `session-store.ts` | Redis pending/active |
| `analytics.ts` | Aggregates |
| `call-session.manager.ts` | In-process AI session registry |

Webhook ingress: WhatsApp webhook handler + workers call `processWebhookFields`.

Mounted: `app.use('/api/calling', callingRoutes)` in `server/src/index.ts`.

### B.4 Data model

`Call` (Prisma): `metaCallId`, direction `USER_INITIATED` \| `BUSINESS_INITIATED`, status `RINGING`…`TERMINATED`, handler `AI` \| `AGENT` \| `UNANSWERED`, phones, duration, JSON `transcript`, `metadata.notes`, FKs to org/contact/conversation/whatsappNumber/aiBot/assignedAgent.

### B.5 Which **bot / board** we use (clarifying your “board”)

| Layer | What Samyoj uses today | What you want |
|-------|------------------------|---------------|
| **Conversation brain** | Org **AiBot** (`resolveCallBot` → `defaultBotId` or conversation `activeBot` or default bot) via `generateBotReply(..., channel: 'voice')` → **Azure OpenAI** | Keep AiBot product UX; optionally later Sarvam-105B as model provider |
| **Speech-to-text** | **Deepgram** WebSocket | **Sarvam Saaras v3** (streaming / realtime) |
| **Text-to-speech** | **Google Cloud TTS** | **Sarvam Bulbul v3** WebSocket |
| **Media transport** | Meta VoIP + local `@roamhq/wrtc` | Keep Meta; evaluate LiveKit later |
| **CRM surface** | Calls page + Conversation link | Inbox-unified like Respond.io |

There is **no** Sarvam env key in `server/src/config` today.

### B.6 Org calling settings (defaults)

From `calling-settings.types.ts`:

- `aiAutoAnswer: true`
- `routingMode: 'ai_then_agents'`
- `agentRingTimeoutSec: 25`
- `maxConcurrentCalls: 10`
- After-hours: `ai` \| `message` \| `missed`
- Missed-call auto WhatsApp message
- Optional recording consent line
- TTS / Deepgram language overrides

---

## C. Exact end-to-end flows (existing)

### C.1 Inbound — User-Initiated Call (UIC)

```
Customer taps Call on WhatsApp business profile/chat
  → Meta sends webhook field "calls" (connect + SDP offer)
  → call.processor.handleCallConnect
  → upsert Contact + Conversation
  → create Call row (USER_INITIATED, RINGING/CONNECTING)
  → decideCallRoute(org):
        max concurrent? → MISSED
        outside hours? → AI / message / MISSED
        ai_only → AI
        agents_first → ring ONLINE agents (socket call:ring) else AI/miss
        ai_then_agents → AI immediately if auto-answer (does NOT ring agents on connect)
  → AI path: AiVoiceCallSession.start(sdpOffer)
        webrtc-bridge createAnswerFromOffer
        Meta pre_accept(sdp answer)
        Meta accept(sdp answer)
        optional consent TTS + greeting TTS
        loop: PCM → Deepgram final → generateBotReply → Google TTS → playPcm
        handoff? speak + terminate COMPLETED
  → Agent path: storePendingCall + call:ring → CallRingModal
        Accept: getSignaling → browser SDP answer → POST accept
        Timeout: fallback AI or mark MISSED + missed-call WhatsApp
  → Terminate webhook → duration, cleanup sessions, flow trigger
```

### C.2 Outbound — Business-Initiated Call (BIC / callback)

```
Inbox handleCallBack (wired in actions, NOT exposed in ChatHeader UI today)
  → POST /calling/callback { contactId, conversationId, phone }
  → create Call BUSINESS_INITIATED, handler AGENT, metaCallId pending-*
  → webrtc-bridge.createOffer()
  → MetaCallingService.initiateOutboundCall(connect + SDP offer + biz_opaque_callback_data=call.id)
  → storePendingCall; return { call, sdpOffer }
  → finally { bridge.close() }  ← server PC destroyed immediately
  → Client navigates /calls/:id and IGNORES sdpOffer
  → Meta connect webhook may store sdpAnswer on pending + emit call:updated
  → No client keeps a live RTCPeerConnection for BIC media
```

**Product gaps:**

1. Meta requires **call permission** before BIC — no `call_permissions` preflight / no `call_permission_request` send.  
2. **Outbound media path incomplete** — offer PC closed server-side; Inbox client never attaches answer PC.  
3. Inbox Call button still **disabled**.

### C.3 AI voice loop (algorithm)

1. Bridge audio handler → Deepgram `sendPcm` (ignore while `speaking`).  
2. On final transcript → `handleUserSpeech` (guard: not processing/speaking, length ≥2).  
3. Append transcript role `user`; emit `call:transcript`.  
4. `generateBotReply({ channel: 'voice', botId })`.  
5. Speak reply via Google TTS → `playPcm`; append assistant/system lines.  
6. If `result.handoff` → `performHandoff` → speak “connecting you…” → `end('handoff')` (Meta terminate).  

**No barge-in:** while TTS plays, user audio ignored (`speaking` flag). Sarvam docs require client-side barge-in (stop playback + close TTS socket).

### C.4 Routing decision tree (`decideCallRoute`)

```
activeCount >= maxConcurrentCalls → missed
!withinBusinessHours:
  afterHoursMode=ai + aiAutoAnswer → ai
  afterHoursMode=message → missed(+message)
  else → missed
routingMode=ai_only:
  aiAutoAnswer → ai else missed
routingMode=agents_first:
  online agents → ring_agents
  else aiAutoAnswer → ai else missed
routingMode=ai_then_agents (default):
  aiAutoAnswer → ai   ← name is misleading: agents are NOT rung after AI on connect
  else online agents → ring_agents
  else missed
```

Agents get a ring mainly via `agents_first`, or AI fallback after **ring timeout**. Voice “handoff” today ends the call after a spoken message — it is **not** a live audio transfer.

### C.5 API surface

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/calling/status` | Ready flags, Meta enabled, active count, hints |
| GET/PATCH | `/api/calling/settings` | Org settings (admin patch) |
| POST | `/api/calling/enable` `/disable` | Meta phone calling status |
| GET | `/api/calling/analytics` | Stats |
| GET | `/api/calling` | List + filters |
| POST | `/api/calling/callback` | BIC start |
| GET | `/api/calling/:id/signaling` | Pending SDP for agent |
| POST | `/api/calling/:id/accept` `/decline` | Agent answer/reject |
| GET/PATCH | `/api/calling/:id` | Detail / notes |
| POST | `/api/calling/:id/terminate` | Hang up |

### C.6 Socket events

- `call:ring` / `call:ring_timeout`  
- `call:updated`  
- `call:transcript`  

### C.7 Env (today)

`DEEPGRAM_API_KEY`, `DEEPGRAM_LANGUAGE`, `DEEPGRAM_SAMPLE_RATE`, `GOOGLE_APPLICATION_CREDENTIALS`, `GOOGLE_TTS_VOICE`, `GOOGLE_TTS_LANGUAGE`, `CALLING_AI_AUTO_ANSWER`, `CALLING_AI_GREETING`, Azure OpenAI vars. **No `SARVAM_*`.**

---

## D. Flaws, errors, debug map (existing)

| ID | Flaw | Evidence | Impact |
|----|------|----------|--------|
| F1 | Inbox Call button disabled | `ChatHeader.tsx` “Calling coming soon”; `_onCallBack` | Outbound UX dead despite backend |
| F2 | No call-permission preflight | No `call_permissions` usage | BIC fails cryptically |
| F3 | No permission-request send | No interactive `call_permission_request` | Can’t legally/reliably outbound |
| F4 | Voice stack ≠ Sarvam | Deepgram + Google only | Indic quality / your product direction |
| F5 | `@roamhq/wrtc` unofficial | `webrtc-bridge.ts` | Stability/maintenance risk |
| F6 | No barge-in | `speaking` blocks STT | Feels laggy / ignores interrupters |
| F7 | Handoff ends call instead of live transfer | `ai-voice-agent` speaks then terminate | Unlike Respond.io live transfer |
| F8 | BIC outbound media incomplete | `routes.ts` `bridge.close()` after offer; client ignores `sdpOffer` | Outbound “Call” cannot carry audio reliably |
| F9 | Agent decline is a socket stub | `declineCallAsAgent` — no Meta `reject`, no MISSED, no clear timeout | Caller may keep ringing |
| F10 | `ai_then_agents` misnamed | Returns AI on connect; never rings agents first | Product/settings lie |
| F11 | Org `deepgramLanguage` unused | STT always env `DEEPGRAM_LANGUAGE` | Settings UI/API false control |
| F12 | Pending SDP TTL 60s vs ring up to 120s | `session-store` TTL vs `agentRingTimeoutSec` | Accept can 404 signaling |
| F13 | Access tokens in Redis pending JSON | `storePendingCall` | Security hygiene |
| F14 | STUN-only ICE (no TURN) | bridge + `CallRingModal` | Fail behind strict NAT |
| F15 | In-memory AI sessions | `call-session.manager` | Multi-instance / restart split-brain |
| F16 | Calls UI overloaded / orphan panels | Setup+FAQ; `CallOverviewPanel` unused | Not Inbox-simple |
| F17 | Enable prerequisites opaque | 422 CALLING_PREREQUISITES | Users stuck without guided BM steps |
| F18 | Recording consent spoken only | No recording pipeline | Compliance illusion |
| F19 | Calling feature flag unused | `feature-flags` lists `calling` | Routes never gate |
| F20 | Meta “API access blocked” | Ops logs | Webhook status / templates fail independently |

**Debug checklist when “calls broken”:**

1. `/api/calling/status` → whatsappConnected, callingEnabled, deepgram, googleTts, azureOpenAI, voiceReady.  
2. Meta app subscribed to webhook field **`calls`**.  
3. Tunnel + `META_WEBHOOK_URL` current (same as messaging inbound).  
4. WABA payment + Cloud API + messaging limit / test number.  
5. For outbound: permission state + ChatHeader not disabled.  
6. Logs: `call-processor`, `ai-voice-agent`, `meta-calling`, `deepgram-stt`.

---

## E. Meta WhatsApp Calling — research digest

Official: [Calling overview](https://developers.facebook.com/docs/whatsapp/cloud-api/calling/), [UIC](https://developers.facebook.com/documentation/business-messaging/whatsapp/calling/user-initiated-calls), [BIC](https://developers.facebook.com/documentation/business-messaging/whatsapp/calling/business-initiated-calls), [Permissions](https://developers.facebook.com/documentation/business-messaging/whatsapp/calling/user-call-permissions), [Pricing](https://developers.facebook.com/docs/whatsapp/cloud-api/calling/pricing), [SIP](https://developers.facebook.com/docs/whatsapp/cloud-api/calling/sip/).

### E.1 Features Meta provides (must support both)

| Feature | Notes | In Samyoj? |
|---------|-------|------------|
| User-initiated calls | Free; connect webhook + pre_accept/accept/reject/terminate | Yes (core) |
| Business-initiated calls | Paid pulses; need permission; connect with offer | Partial (API yes, permission UX no, Inbox UI off) |
| Call settings | status enabled/disabled, call_icon_visibility, call_hours | Enable/disable yes; hours/icon thin |
| Callback permission status | Auto-prompt when user calls you | Not configured in product UI |
| Call permission request | Interactive free-form (CSW) or template MARKETING/UTILITY | **Missing** |
| GET call_permissions | Check status/expiry before dial | **Missing** |
| Permission webhooks | User allow/deny/revoke | Not productized |
| DTMF | Dialpad tones on call | Not used |
| SIP alternative | PBX trunk vs Graph WebRTC | Not used (optional scale) |
| G.711 codecs | Newer Meta audio options | Not exposed |
| biz_opaque_callback_data | Track outbound | Used on callback |
| Pricing | UIC free; BIC 6s pulses + country tiers; permission msgs = message pricing | Not shown to admin |

### E.2 Prerequisites (Meta)

Cloud API number; app subscribed to WABA; `calls` webhook; messaging permission; ~2k unique recipients/day (or sandbox/test rules); payment method; enable calling on phone settings.

Sandbox vs production: looser permission send limits / revoke thresholds on sandbox.

### E.3 UIC timing

~30–60s to accept after connect webhook or user sees Not Answered + terminate webhook.

### E.4 BIC permission model (research)

Ways to get permission: free-form interactive `call_permission_request`; template with `call_permission_request` component; callback_permission_status auto-prompt; user grants on business profile. Temporary vs permanent; consecutive unanswered can revoke. **Must request near dial time.**

---

## F. Sarvam AI — official configure & implement guide (for Calls)

Sources: [llms.txt](https://docs.sarvam.ai/api/llms.txt), [Quickstart](https://docs.sarvam.ai/api/getting-started/quickstart.md), [STT streaming](https://docs.sarvam.ai/api/api-guides-tutorials/speech-to-text/streaming-api), [TTS WebSocket](https://docs.sarvam.ai/api/api-guides-tutorials/text-to-speech/streaming-api/web-socket.md), [IVR/contact center](https://docs.sarvam.ai/api/api-guides-tutorials/speech-to-text/use-cases/ivr-contact-center.md), [LiveKit voice agent](https://docs.sarvam.ai/api/integration/build-voice-agent-with-live-kit.md).

### F.1 Why Sarvam for Samyoj

India-first STT/TTS, Hinglish code-mix, telephony 8 kHz, streaming low latency, Bulbul natural voices, optional Sarvam-105B LLM, LiveKit/Pipecat recipes for production voice agents.

### F.2 Accounts & auth

1. Create key at [dashboard.sarvam.ai](https://dashboard.sarvam.ai).  
2. Env: `SARVAM_API_KEY` (header `api-subscription-key`).  
3. SDK: `npm install sarvamai` (Node) or `pip install sarvamai`.  
4. Never put key in client UI.

### F.3 Recommended live-call stack (Sarvam contact-center preset)

| Layer | Setting |
|-------|---------|
| STT | `saaras:v3`, `mode=transcribe` or `codemix`, `language=unknown` (auto) |
| LLM | Keep Azure short-term OR `sarvam-105b` with `reasoning_effort=None`, short max_tokens |
| TTS | `bulbul:v3` WebSocket stream; `pace≈1.1`; speaker e.g. `aditya`/`shubh`/`simran` |
| Audio format to Meta bridge | Prefer PCM/`linear16` into wrtc; Sarvam can output `linear16` / `mulaw` |
| Turn-taking | flush_signal / speech_start for barge-in; close TTS socket on interrupt |

### F.4 STT streaming (implement notes)

- WS: `wss://api.sarvam.ai/speech-to-text/ws` (legacy) or **realtime** `saaras:v3-realtime` for partials.  
- Codecs: wav / pcm_s16le / pcm_l16 / pcm_raw — **not** MP3/AAC on stream.  
- Sample rate 16000 default or **8000** telephony.  
- Idle close ~60s → ping / silent keep-alive.  
- Base64 audio chunks in many SDK paths.

### F.5 TTS WebSocket (implement notes)

1. Connect `bulbul:v3`.  
2. First message: `config` (speaker, language_code, pace, codec, bitrate, buffers).  
3. `text` messages (prefer &lt;500 chars chunks).  
4. `flush` to force synthesis.  
5. `ping` keep-alive.  
6. Receive base64 audio chunks; decode → PCM for bridge.  
7. **No server cancel** — barge-in = stop local playback + `close()` socket + new connection next turn.  
8. `send_completion_event` for clean end.

### F.6 Adapter plan inside Samyoj (no code yet)

```
ai-voice-agent.ts
  ├── sarvam.stt.ts     replaces deepgram.stt.ts
  ├── chatbot.service   (Azure now; flag for Sarvam LLM later)
  └── sarvam.tts.ts     replaces google-tts.service.ts
Feature flag: CALLING_VOICE_PROVIDER=sarvam|deepgram_google
```

Settings UI (Customize): language + Bulbul speaker only — not API keys.

### F.7 Post-call intelligence (utilize)

Sarvam batch STT + diarization + LLM summary cookbook → write summary into conversation internal note / call metadata after terminate.

---

## G. Competitor profiles (compressed)

### G.1 Respond.io

- WhatsApp Calling inside **same inbox** as chat.  
- Voice AI answers inbound; **live handoff** to human with transcript + chat context.  
- Auto transcript + AI summary; CRM webhook sync.  
- Lesson: unify Calls with Inbox; handoff must not hang up.

### G.2 Wati Astra Voice

- Voice clone, WhatsApp + web agents, multilingual, no-code, memory across channels.  
- Lesson: one “AI answers calls” story; hide telephony plumbing.

### G.3 AiSensy

- SMB WhatsApp automation; voice often outbound reminders / support positioning.  
- Lesson: simple outbound later; not day-1 dialer farm.

### G.4 Gallabox

- Strong analytics; voice on higher tiers.  
- Lesson: insights secondary, not homepage clutter.

### G.5 Samyoj position

We already have deeper Meta Calling + routing than many BSP “marketing pages”. We lose on: Inbox unity, permission UX, Indic voice (Sarvam), live transfer, simple UI.

---

## H. Research ↔ build matrix

| Capability | Meta / market | Samyoj now | Verdict |
|------------|---------------|------------|---------|
| Inbound AI answer | Required | Built | **Keep** |
| Inbound agent softphone | Required | Built | **Keep** + mic UX |
| Outbound callback | Meta BIC | API yes / Inbox UI off / **media incomplete** | **Enable UI** + permissions + fix WebRTC |
| Call permission request | Meta required for BIC | Missing | **Add** |
| call_hours / icon visibility | Meta settings | Partial | **Improve** |
| Indic STT/TTS | Sarvam / competitors | Deepgram+Google | **Replace → Sarvam** |
| Live AI→agent transfer | Respond.io | Ends call | **Chosen: cold live + WhatsApp fallback** (§L) |
| Easy personality + train | Market “no prompt eng” | Raw instructions + jargon Knowledge | **Chosen: presets + Train** (§N) |
| Agent decline | Meta reject | Socket-only stub | **Fix** |
| Transcript in chat thread | Market | Call detail only | **Add** link + snippet in Inbox |
| Post-call summary | Market | Notes manual | **Add** (Sarvam/LLM) |
| SIP | Meta optional | No | Defer |
| Dashboard Calls entry | Nice | Quick Action exists | Keep; optional live badge later |
| Less UI / Customize | UX goal | Heavy Calls page | **UI redesign** |

---

## I. Recommendations (confident)

### I.1 Keep

Meta UIC path; routing modes; missed-call WhatsApp; Call model + transcripts; ring modal plumbing; AiBot as product brain selector; enable hints.

### I.2 Improve (priority order)

1. Re-enable Inbox Call; wire `onCallBack`.  
2. Permission preflight + request message (interactive + template).  
3. **Fix BIC media** (don’t close offer PC blindly; client attach answer) + **Meta reject on decline**.  
4. Calls UI → Inbox-shaped (see UI POC).  
5. Sarvam STT+TTS behind flag.  
6. Barge-in + chunked TTS.  
7. **AI→human cold live transfer + always WhatsApp fallback** (see §L — **chosen**).  
8. **Easy AI personality + Train** on `/ai-bot` + Calls link (see §N — **chosen**).  
9. Friendly Meta prerequisite wizard; pending SDP TTL ≥ ring timeout.  
10. Optional: live Calls badge on Dashboard Quick Action.

### I.3 Cut / hide from primary UI

Provider dots (Deepgram/Google), long FAQ, always-on analytics, SDP language, setup wall when Ready.  
On AI Bots: hide “Creativity / tokens / RAG / Semantic search / temperature” from default path (Advanced only).

### I.4 Add (user value, ≤2 clicks)

Permission chip; Live dock; Open chat from call; Customize rail (routing/voice/after-hours/**when to connect a person**); post-call summary; optional callback_permission_status.  
AI Bots: Personality presets; **Train** tab (FAQ/paste/PDF); Try it; Connect-to-person plain toggles.

### I.5 Phased ship

| Phase | Scope |
|-------|--------|
| **A** | Inbox Call on + permissions + BIC media fix + decline→Meta reject + UI POC slim |
| **B** | Sarvam STT/TTS + voice picker **and** Easy AI setup UX (§N): Personality + Train + Try it |
| **C** | **Chosen handoff:** cold live ring + tool `request_human` + schedule/WhatsApp fallback + AI brief on Accept + summaries + barge-in |
| **D** | Warm transfer / SIP/LiveKit only if concurrency or consult-rooms demand |

### I.6 Success metrics

Inbound answer rate ↑; outbound connect after permission &gt;80%; median AI reply &lt;2s; ≤2 clicks Accept/End/Open chat; “cryptic calling error” tickets ↓.  
Bot setup: new org reaches “bot can answer a sample FAQ” in **&lt;5 minutes** without writing a system prompt.

---

## J. Locked product choices (docs v2.3)

| # | Topic | **Chosen** (user-friendly + reliable) |
|---|--------|----------------------------------------|
| 1 | Voice speech | Sarvam STT+TTS default; keep AiBot as brain |
| 2 | Ship order | Phase A → B (voice + easy train) → C (live handoff) |
| 3 | Calls UI | Inbox-shaped POC |
| 4 | Outbound | In Phase A (permissions + Inbox Call) |
| 5 | AI→human | **Cold live transfer** + **always** Inbox assign + WhatsApp/schedule fallback (§L) |
| 6 | Bot setup | **Personality presets + Train + Try it** — not raw prompt-first (§N) |
| 7 | Warm transfer | **Defer** to Phase D (harder on current WebRTC; less reliable first ship) |

Open only if you disagree with a row above.

---

## L. AI → Human — **chosen** model (research → decision)

**Ask:** Customer talking to AI wants a human — can AI tool-call, connect, schedule, assign?

**Answer:** Yes. **Chosen for Samyoj:** cold **live** transfer when an agent is ONLINE; otherwise schedule / WhatsApp assign. Never hang up and pretend someone is joining.

### L.1 What Samyoj does today (gap)

| Step | Today | Chosen target |
|------|-------|----------------|
| Trigger | Handoff keywords (+ low confidence / blocked) | Same + LLM tool `request_human` |
| Assign | `assignAgentOnHandoff` | **Always** assign Inbox (even if live connects) |
| Voice | Speak → **terminate call** | Hold → **ring human on same Meta call** → or fallback speak |
| Miss / after hours | Soft chat only | WhatsApp follow-up **or** `schedule_callback` |

### L.2 Why this shape (friendly + reliable)

| Option | Friendly? | Reliable on our stack? | Verdict |
|--------|-----------|------------------------|---------|
| Hang up + Inbox only (today) | Weak (“call dropped”) | High | Keep only as **Off** / after-hours |
| **Cold live** (hold → ring → swap AI audio for agent PC) | High | High — reuses ring modal + bridge swap | **Ship Phase C** |
| Warm consult (brief agent privately then merge) | Highest | Medium — needs room/consult infra | Phase D |
| Full ACD queue (“you are #3”) | Mixed | High effort / low SMB need | **Skip v1** |

Competitors: Respond.io live transfer + miss→AI; LiveKit warm transfer is the aspirational Phase D. Meta: no transfer API — partner-side media swap only.

### L.3 Chosen caller flow (plain language)

```
Customer: "I want to talk to someone"
  → Bot tool: request_human({ reason })
  → If ONLINE agents: "Please hold — connecting you…"
       → Ring agents (Accept / Decline) · show AI brief
       → Accept: human hears caller; AI stops talking
       → Miss all: "I've messaged our team — they'll reply here on WhatsApp"
  → If nobody ONLINE / after hours:
       → "I've noted this for [Name/team]. They'll message you on WhatsApp."
       → Optional: offer callback slot → schedule_callback
```

**Reliability rules (non-negotiable):**

1. Never say “connecting…” unless a ring actually starts.  
2. Always leave an Inbox assignment + thread.  
3. Keywords remain a **fast path**; tools handle intent without exact phrases.  
4. After hours: **no live promise** — schedule/assign only.

### L.4 Tools (engine) vs toggles (user)

**Engine (hidden from normal user):** `request_human`, `check_agent_availability`, `schedule_callback`, `assign_conversation`.

**User sees plain Customize controls** (Calls rail + AI Bot “Connect to a person”):

| Control | Default | Meaning |
|---------|---------|---------|
| Connect to a person when they ask | On | Enables tool + keyword path |
| Prefer live call if team online | On | Cold live vs WhatsApp-only |
| If team busy | Message on WhatsApp | Fallback (alt: offer callback) |
| Ring for | 30s | Then fallback |
| Who gets the chat | Online → team rules (existing assign) | Reuse `assignAgentOnHandoff` |

### L.5 Agent UX (≤2 clicks)

1. Ring: **Accept** / **Decline**  
2. Accept → AI brief (why + last lines) already on stage — talk  
3. **Open chat** if they need history beyond brief  

### L.6 Implement later (Phase C) — shape only

Keep Meta↔bridge; on tool: pause AI, hold TTS, `call:ring` without Meta terminate; on Accept swap audio to agent; on timeout fallback + assign; persist `handler` AI→AGENT; attach summary. Warm transfer = Phase D.

---

## N. Easy AI agent — personality + train (**chosen**)

**Ask:** Configure the AI agent easily — personality, train it so it handles chat/calls well.

**Answer:** Yes. Reuse `/ai-bot` + Calling `defaultBotId`, but **redesign the default path** so owners never write a system prompt or see RAG jargon.

### N.1 What exists today (reuse)

| Already there | Problem for users |
|---------------|-------------------|
| `AiBot.instructions` | Feels like “prompt engineering” |
| Templates Support/Sales/FAQ | Good start; not framed as personality |
| Knowledge FAQ / URL / PDF | Buried; “Semantic search / Indexed / tokens” |
| `handoffKeywords` + `handoffMessage` | Comma lists — not “when to connect a person” |
| Calling: `defaultBotId`, `aiGreeting` | Split across Settings; TTS knobs not in UI |
| Test tab | Good — rename to **Try it** |

No separate `personality` field — **presets write into `instructions`** (no schema required for v1).

### N.2 Chosen easy path (3 steps, &lt;5 min)

```
1. Personality   → pick tone + role (writes instructions + voice channel rules)
2. Train         → add FAQs / paste text / PDF (same Knowledge APIs, friendly copy)
3. Try it        → type or “simulate call line”; see reply + when it would connect a person
```

Then one link from Calls Customize: **“Edit voice AI” → `/ai-bot?id=…`**.

### N.3 Personality (user-friendly)

**Primary UI:** cards, not a blank textarea.

| Preset | Tone (writes into instructions) |
|--------|----------------------------------|
| Friendly helper | Warm, short sentences, Hinglish OK if customer uses it |
| Professional | Clear, formal, no slang |
| Sales assist | Helpful + suggest next step, never pushy hard-sell |
| Custom | Show editable “How should I speak?” (still plain language, not “system prompt”) |

Plus 3 short fields (always visible):

1. **Business name**  
2. **What you do** (1–2 sentences)  
3. **Never do / never promise** (refunds, medical, legal — optional)

Advanced (collapsed): full instructions editor, temperature, rate limits, versions.

Voice channel append (product-owned, not user-edited): short spoken lines, no markdown — already in `chatbot.service` for `channel: 'voice'`.

### N.4 Train (user-friendly)

Rename Knowledge → **Train your AI**.

| Action | Copy | Tech under the hood |
|--------|------|---------------------|
| Add Q&A | “Question customers ask” / “Your answer” | FAQ items |
| Paste info | “Paste price list, policies, hours…” | Document ingest |
| Upload PDF | “Menus, brochures, manuals” | PDF ingest |
| Status | “Ready” / “Still learning…” | Hide embedding/token counts |

**Rule:** if Train is empty, Try it warns: “Add at least 3 Q&As so answers stay accurate.”

### N.5 Connect-to-person (on the same bot)

On AI Bot Setup (simple), not only comma keywords:

- Toggle: **Offer to connect a person when asked / stuck**  
- Chips for common phrases (prefill `handoffKeywords`): “talk to human”, “agent”, “manager”…  
- Message when connecting / when team is busy (`handoffMessage` + live vs WhatsApp from Calls settings)  

Engine still uses tools (§L); UI stays human.

### N.6 Calls Customize link (no duplicate brain)

Calls rail **does not** become a second bot editor. It only has:

- Which AI answers calls (`defaultBotId`)  
- First line greeting (`aiGreeting`)  
- Voice sound / language (Sarvam picker — Phase B)  
- When to connect a person (live vs WhatsApp — §L)  
- Link: **Edit personality & training →**

### N.7 Reliability for “bot handles things”

1. Same bot for chat + voice (one brain — already `resolveCallBot`).  
2. Train content always RAG’d into replies (existing knowledge service).  
3. Low confidence / blocked → connect-to-person path (existing) + live when enabled.  
4. Try it required before “Use for calls” badge.  
5. Hide provider/model keys from bot page (Settings → AI stays for developers).

### N.8 UI companion

Full screen specs: [`../ui-specs/calls-content-poc.md`](../ui-specs/calls-content-poc.md) **§14** (AI Bot easy config + Calls rail).

---

## M. Source index

Meta UIC/BIC/permissions/pricing/SIP docs (links in §E).  
Sarvam quickstart, STT streaming, TTS WS, IVR guide, LiveKit guide (§F).  
Respond.io / Wati / AiSensy / Gallabox (§G).  
AI transfer: Respond.io Voice AI live transfer; Meta partner-side media FAQ; LiveKit warm-transfer (§L).  
Easy bot UX: existing `/ai-bot` + Knowledge + templates (§N); files `AiBotPage.tsx`, `botTemplates.ts`, `chatbot.service.ts`, `CallingSettingsPanel.tsx`.  
Code: `server/src/modules/calling/*`, `client/src/pages/CallsPage.tsx`, `client/src/components/calls/*`, `ChatHeader.tsx`, Prisma `Call` + `AiBot`.  
Deep inventories: [Explore Calls codebase deep](f2a79bbd-9968-44ac-a1ec-716795eb95ec), [Full Calls code inventory](b3238377-39be-459f-9b90-6836b6f260b2), [AiBot config explore](41e998e1-4217-4d2e-b444-505eb3f6401b).
