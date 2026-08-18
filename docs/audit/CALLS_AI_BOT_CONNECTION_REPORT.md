# Chat AI Bot ↔ Voice Calling AI — Connection Research Report

> **⚠️ STALE — Date 2026-08-05.** This report mentions Deepgram/Google as voice providers; current runtime is **Sarvam** (STT + Bulbul TTS). Live transfer is a stub (`message_only`). Billing is demo-grade.
> Current status: `docs/memory/STATUS_AND_FUTURE.md`.
> Full audit: `audit/FULL_REVIEW_2026-08-18.md`.  
> **Scope:** Why Samyoj connects WhatsApp **message** AI (smart auto-replies) to WhatsApp **voice** AI (Cloud Calling “servant”), what is already built, how the shared brain works, UI redirects, and recent Calls UI work.  
> **Evidence rule:** Claims below are tied to current repo paths. Prefer this over older ship-doc lines that lag the code.

---

## 0. One-sentence verdict

**Same AiBot brain (personality + Train FAQ/RAG + Azure OpenAI) answers both WhatsApp chat and WhatsApp voice calls; only the pipes differ — chat uses text webhook → outbound WhatsApp message; voice uses Meta Calling + WebRTC + STT/TTS (Sarvam or Deepgram/Google).**

They are **not** two separate AIs. They are **one product intelligence** with **two channels**.

---

## 1. Why we connect them (product + engineering rationale)

### 1.1 Product problem

| Channel | User expectation |
|---------|------------------|
| WhatsApp **chat** | Bot already knows business, FAQs, tone; smart auto-replies |
| WhatsApp **voice call** | Caller asks the same questions by speaking |

If voice used a different bot, operators would train twice, tone would drift, and “Use for WhatsApp calls” would be meaningless.

### 1.2 Engineering choice (what the code actually does)

| Layer | Shared? | Implementation |
|-------|---------|----------------|
| Personality (`AiBot.instructions`) | **Yes** | Same row |
| Train data (`KnowledgeBaseItem` FAQ/URL/PDF) | **Yes** | Same RAG (`searchKnowledgeBase`) |
| LLM | **Yes** | `generateBotReply` → Azure OpenAI |
| Handoff keywords / message | **Yes** | Same bot fields; voice may also live-transfer |
| Bot picker for chat (`isDefault`, `activeBotId`) | Chat path | Messaging |
| Bot picker for calls (`CallingSettings.defaultBotId`) | Call path | Calling settings + AiBot “Use for WhatsApp calls” |
| Delivery | **No** | Chat = WhatsApp text; Voice = TTS over WebRTC |
| Speech I/O | **No** | Sarvam / Deepgram / Google — **ears and mouth only**, not the brain |

**Sarvam is not a second chatbot.** It turns speech ↔ text. The “servant” that understands the business is still the AiBot.

### 1.3 Mental model

```
                    ┌──────────────────────────────┐
                    │     AiBot (org intelligence) │
                    │  Personality + Train + LLM   │
                    └─────────────┬────────────────┘
                                  │
                    generateBotReply(channel)
                                  │
              ┌───────────────────┴───────────────────┐
              │                                       │
     channel: 'text'                         channel: 'voice'
     (chat auto-reply)                       (live call)
              │                                       │
   WhatsApp message send              STT → reply → TTS → WebRTC
```

---

## 2. Side-by-side comparison

| Dimension | Chat AI (“smart auto-replies”) | Voice AI (“servant” / Cloud Calling) |
|-----------|--------------------------------|--------------------------------------|
| **User-facing surface** | Inbox thread + Automations precedence | Calls page + Inbox Call button + ring modal |
| **Trigger** | Inbound WhatsApp `messages` webhook | Meta `calls` webhook (`connect` / `terminate`) |
| **Pipeline entry** | `handleInboundAutomations` → `ai-chatbot` job | `processCallWebhookPayload` → `handleCallConnect` |
| **Bot resolution** | `resolveBotForConversation` (`activeBotId` → keywords → `isDefault`) | `resolveCallBot` (`defaultBotId` → conversation `activeBot` → chat resolver / `ensureDefaultBot`) |
| **Brain API** | `generateBotReply` (default `channel: 'text'`) | `generateBotReply({ channel: 'voice', botId })` |
| **Prompt difference** | Short text, same language | **1–2 short spoken sentences**, no markdown/bullets |
| **History** | Last WhatsApp messages on conversation | Voice path still uses conversation context builder; transcripts also stored on `Call.transcript` |
| **Knowledge** | Same FAQ/RAG | Same FAQ/RAG |
| **Output** | WhatsApp text via `sendAutomationReply` | Spoken audio via Sarvam/Google TTS on WebRTC bridge |
| **Human takeover** | Pause bot / handoff → Inbox `PENDING` | Optional live transfer ring + Inbox assign; settings `liveTransferEnabled` |
| **Config UI** | `/ai-bot` Personality · Train · Connect · Try it | Settings → Calling + Calls rail deep-links to `/ai-bot` |
| **Can run without the other?** | Chat works without calling enabled | Calling needs voice providers + Meta calling; still needs AiBot + Azure for “configured” |

---

## 3. What is already built — Chat AI (messages)

### 3.1 Data model

- **`AiBot`** — personality in `instructions`, `enabled`, `isDefault`, keywords, handoff, temperature, etc. (`server/prisma/schema.prisma`)
- **`KnowledgeBaseItem`** — Train content per bot (`FAQ` / `URL` / `PDF` / `DOCUMENT`) + optional embeddings
- **`Conversation`** — `activeBotId`, `botActive`, handoff timestamps/reasons

### 3.2 Runtime path (built and wired)

1. Meta webhook → message persisted  
2. Flows / static automations may consume the message first  
3. Else `queueAiBotProcessing` (debounced BullMQ `ai-chatbot`)  
4. `generateBotReply` → RAG → Azure → optional handoff  
5. Reply sent as WhatsApp outbound  

**Key files:**  
`server/src/modules/automation/engine.ts`,  
`server/src/modules/ai/chatbot.service.ts`,  
`server/src/modules/ai/bot.service.ts`,  
`server/src/modules/ai/knowledge.service.ts`,  
`server/src/modules/ai-bot/routes.ts`,  
`client/src/pages/AiBotPage.tsx`

### 3.3 Operator UX (built)

| Tab | Role |
|-----|------|
| Personality | Tone presets + business fields → `instructions` |
| Train | FAQ / URL / PDF — copy states used on **chat and voice** |
| Connect | Handoff keywords + message; points to Calls for ring behavior |
| Try it | `POST /api/ai-bot/:id/test` |
| More | Model knobs, analytics, versions |

**“Use for WhatsApp calls”** on AiBotPage writes `callingApi.updateSettings({ defaultBotId: editing.id })` — explicit bridge from chat bot editor to calling.

---

## 4. What is already built — Voice calling AI (servant)

### 4.1 Product surfaces (client)

| Surface | Status |
|---------|--------|
| `/calls`, `/calls/:callId` (`CallsPage`) | **Live** — list, detail, setup sheet, header stats, Settings/Help rail |
| Settings → Calling (`CallingSettingsPanel`) | **Live** — who answers, greetings, after-hours, missed, voice (Sarvam), deep-links to personality/train |
| Inbox Call (`ChatHeader` + `handleCallBack`) | **Live** — permission check → `call_permission_request` → callback |
| `CallRingModal` | **Live** — agent Accept/Decline with WebRTC SDP |
| Overview/analytics orphan components | Exist on disk; **not** mounted on current Calls page |

### 4.2 Server stack (real, not stub)

| Piece | File(s) | Role |
|-------|---------|------|
| REST API | `server/src/modules/calling/routes.ts` | status, settings, enable, list, analytics, permission, callback, accept/decline, terminate, notes, voice preview |
| Meta Graph Calling | `meta-calling.service.ts` | connect / pre_accept / accept / reject / terminate / enable / permissions |
| Webhook `calls` | `call.processor.ts` | connect → route; terminate → end |
| Routing | `routing.service.ts` | `decideCallRoute`, `resolveCallBot` |
| AI session | `ai-voice-agent.ts` | WebRTC + STT → `generateBotReply(voice)` → TTS |
| Bridge | `webrtc-bridge.ts` | `@roamhq/wrtc` media |
| Voice providers | `sarvam.stt.ts`, `sarvam.tts.ts`, `deepgram.stt.ts`, `google-tts.service.ts` | Speech I/O |
| Missed call | `missed-call.service.ts` | WhatsApp follow-up / flow |
| Analytics | `analytics.ts` | Header Live/Today/Missed inputs |
| Redis sessions | `session-store.ts`, `call-session.manager.ts` | Active/pending call state |

### 4.3 End-to-end voice flow (as implemented)

```
Caller taps Call on WhatsApp business chat
  → Meta sends webhook field "calls" (event connect + SDP)
  → handleCallConnect
       ensure contact + conversation
       resolveCallBot → set Call.aiBotId / conversation activeBot
       decideCallRoute → AI | ring agents | missed
  → AI: AiVoiceCallSession.start
       WebRTC accept with Meta
       optional consent + greeting TTS
       loop: STT final → generateBotReply(voice) → TTS
       handoff → performHandoff (+ optional live transfer ring)
       transcript → Call.transcript + socket call:transcript
  → terminate (user/Meta/API) → duration, status, optional summary, Inbox call pill
```

Outbound (business-initiated): Inbox Call → Meta permission → `POST /calling/callback`.

### 4.4 Meta compliance pieces that are built

- Official interactive **`call_permission_request`** (not fake reply buttons)  
- `GET …/call_permissions?user_wa_id=` preflight  
- App webhook subscribe includes **`messages,calls`**  
- Enable calling sets Meta calling status + callback permission flags  

Inbound still needs the same public HTTPS tunnel as chat webhooks.

---

## 5. Exact connection map (what is wired today)

### 5.1 Shared brain

| Connection | How |
|------------|-----|
| Same reply generator | `ai-voice-agent.ts` imports `generateBotReply` / `performHandoff` from `chatbot.service.ts` |
| Voice style | `buildConversationMessages(..., 'voice')` appends spoken-sentence system rule |
| Same Train corpus | Voice queries `searchKnowledgeBase(bot.id, …)` inside `generateBotReply` |
| Same personality | Bot `instructions` in system prompt for both channels |
| Call ↔ bot FK | `Call.aiBotId` set on connect via `resolveCallBot` |
| Conversation continuity | Call attaches `conversationId`; may set `botActive` / `activeBotId` |

### 5.2 Bot selection (two knobs, one bot row)

```
CallingSettings.defaultBotId  ──preferred──►  resolveCallBot
Conversation.activeBot        ──fallback───►
Chat isDefault / keywords     ──last───────►  ensureDefaultBot
```

Chat default = **`AiBot.isDefault`**.  
Call preferred bot = **`settings.calling.defaultBotId`**.  
They can (and usually should) point at the **same** `AiBot` UUID via “Use for WhatsApp calls”.

### 5.3 UI redirects (operator never edits the bot twice)

| From | To | Purpose |
|------|----|---------|
| Calls rail → “AI personality” | `/ai-bot` | Edit tone / business facts |
| Calling settings → Personality / Train sections | `/ai-bot` deep-links | Same shell as Customize POC |
| AiBot Connect tab | Calls / Calling settings | Ring / live-transfer behavior |
| AiBot “Use for WhatsApp calls” | `PATCH /calling/settings` `defaultBotId` | Bind this bot to voice |
| Calls setup sheet | WhatsApp / enable calling / `/ai-bot` | Ready checklist |

**Design intent (shipped in UX):** Calls Customize is **routing + greetings + voice sound**; Personality/Train stay on **AI Bots** so there is one brain editor.

### 5.4 What is intentionally NOT shared

| Not shared | Why |
|------------|-----|
| STT/TTS keys | Platform env (`SARVAM_*` or Deepgram/Google); never in tenant Settings as App Secret style fields |
| Meta call Graph | Calling-only |
| Chat debounce / static automations precedence | Messaging-only gates |
| Softphone Mute/Hold/Keypad | UI stubs; not part of AiBot |

---

## 6. Are “chat AI” and “talking AI” the same?

| Question | Answer |
|----------|--------|
| Same product feature name in UI? | No — **AI Bots** vs **Calls** |
| Same underlying bot record? | **Yes**, when `defaultBotId` / conversation bot points at it |
| Same training? | **Yes** |
| Same LLM call path? | **Yes** (`generateBotReply`) |
| Same reply length / format? | **No** — voice forced short spoken style |
| Same delivery? | **No** — text vs audio |
| Is Sarvam the “talking AI”? | **No** — Sarvam is speech I/O; AiBot is the talking intelligence |

**Implemented reality:** one intelligence, two channels, channel-aware prompting.

---

## 7. Recent Calls UI work (this iteration — already in tree)

These are **client UX** changes on top of the existing calling backend; they do not invent a second AI.

| Change | Why |
|--------|-----|
| Full-page + list skeleton loaders (`CallsPageSkeleton`) | Avoid packed “Loading…” flash; match Inbox shimmer |
| Removed page title row (“Calls / Ready / subtitle”) | Reduce density; status card remains |
| Header stats: **Live · Today · Missed** | Surface important insights on the boat; avoid burying them |
| Removed **Insights** rail icon/panel | Stop duplicating stats inside the rail |
| Redesigned Settings/Help rail (`CallsRailPanel`) | Clear action rows + deep-links to Calling settings and `/ai-bot` |
| Calling settings skeleton | No blank panel while settings load |

---

## 8. What was solved vs what remains (honest)

### 8.1 Solved / real in code

- Meta Cloud Calling enable + inbound AI answer loop  
- Shared AiBot brain for chat + voice  
- Sarvam realtime STT + Bulbul TTS path (plus legacy Deepgram/Google)  
- Official call permission request for outbound  
- Org calling settings (who answers, greetings, after-hours, missed, voice, live-transfer flags)  
- Transcripts, notes, terminate, analytics API, Inbox call events  
- Agent ring modal accept/decline  
- Operator UX: Personality/Train redirects; “Use for WhatsApp calls”  
- Calls work UI: list/detail/setup/rail/header stats/skeletons  

### 8.2 Incomplete / known gaps (do not oversell)

| Gap | Reality |
|-----|---------|
| Mute / Hold / Keypad / Transfer buttons on live stage | UI disabled stubs |
| Live transfer media | Can ring agents; agent SDP handoff still incomplete |
| Outbound BIC media retention | Callback path has known media hole vs inbound AI path |
| LLM `tool_call` voice tools | Parsed in voice agent; `generateBotReply` does not emit `tool_call` today — handoff uses chatbot handoff logic |
| Warm transfer | Deferred by product docs |
| Docs lag | Some lines in `CALLS_SHIP_DOCUMENT.md` still say Sarvam not integrated / Inbox Call coming soon — **code has moved past that**; trust this report + code |

**Resolved since first audit (2026-08-05):**
- Voice settings → runtime wiring complete on **both** AI answer paths (`call.processor.ts` direct + ring-timeout) — `ttsVoice`, `ttsLanguage`, `sarvamMode`, `sarvamSttPrompt`, and now a dedicated `sttLanguage` all flow into the AI session (`types.ts` `ActiveCallContext`).
- `transferMode` honored — live transfer only when `liveTransferEnabled && transferMode === 'live'`; message-only falls back to end + WhatsApp handoff (`ai-voice-agent.ts` `performHandoffAndTransfer`).
- Sarvam STT key sent via `api-subscription-key` header, not URL query string (`sarvam.stt.ts`).
- **Security:** decrypted Meta tokens are no longer stored in Redis pending calls. `PendingCallSignaling` stores `whatsappNumberId`; the token is re-derived from the DB on demand via `resolvePendingCallAccessToken` (`session-store.ts`, used by `agent-call.service.ts` accept/decline).

### 8.3 Env readiness (operators)

Voice “configured” needs:

- Meta WhatsApp number with calling enabled  
- Platform Azure OpenAI (AiBot brain)  
- `CALLING_VOICE_PROVIDER=sarvam` + `SARVAM_API_KEY` **or** Deepgram + Google credentials  
- Public HTTPS webhook for inbound `calls` (same tunnel story as messages)

---

## 9. How it works for an operator (happy path)

1. Connect WhatsApp (platform Meta app — no App ID in UI).  
2. Build/select an **AI Bot** → Personality + Train FAQs.  
3. Click **Use for WhatsApp calls** (sets `defaultBotId`).  
4. Settings → Calling: who answers, greeting, after-hours, voice speaker/language; optionally Play greeting preview.  
5. Calls setup: Enable calling on Meta.  
6. **Chat:** customers text → same bot auto-replies in Inbox.  
7. **Voice:** customers call the business WhatsApp → same bot speaks via STT/TTS; transcript lands on Calls + conversation context.  
8. If human needed → handoff keywords / confidence → Inbox (and optional live ring if enabled).  

One train session. Two channels. No duplicate “voice prompt marketplace.”

---

## 10. File index (absolute paths)

### Shared brain
- `/workspaces/Samyoj/server/src/modules/ai/chatbot.service.ts` — `generateBotReply`, voice system rule  
- `/workspaces/Samyoj/server/src/modules/ai/bot.service.ts` — `resolveBotForConversation`, `ensureDefaultBot`  
- `/workspaces/Samyoj/server/src/modules/ai/knowledge.service.ts` — Train retrieval  
- `/workspaces/Samyoj/server/prisma/schema.prisma` — `AiBot`, `KnowledgeBaseItem`, `Call`, `Conversation`  

### Calling
- `/workspaces/Samyoj/server/src/modules/calling/` — full module (routes, Meta, AI session, Sarvam, routing, settings)  
- `/workspaces/Samyoj/client/src/pages/CallsPage.tsx`  
- `/workspaces/Samyoj/client/src/components/calls/*`  
- `/workspaces/Samyoj/client/src/components/inbox/useConversationActions.ts` — Call + permission  

### Chat AI UI
- `/workspaces/Samyoj/client/src/pages/AiBotPage.tsx` — Personality / Train / Connect / Use for WhatsApp calls  

### Prior research / UI specs
- `/workspaces/Samyoj/docs/calls/CALLS_SHIP_DOCUMENT.md`  
- `/workspaces/Samyoj/docs/ui-specs/calls-content-poc.md`  
- `/workspaces/Samyoj/docs/ui-specs/calls-with-content-ui.md`  
- `/workspaces/Samyoj/docs/ui-specs/calls-customize-settings-poc.md`  

---

## 11. Closing comparison (decision record)

| Decision | Choice | Why |
|----------|--------|-----|
| One brain or two? | **One AiBot** | Avoid double training; Inbox + Calls stay consistent |
| Where do operators edit personality? | **`/ai-bot`**, linked from Calls/Calling | No second bot editor in Calls |
| What does Sarvam do? | **Speech only** | India-first STT/TTS; LLM stays Azure/AiBot |
| Where do Live/Today/Missed live? | **Calls header** | Important metrics always visible; Insights rail removed as duplicate |
| What does Calls Customize own? | Routing, greetings, hours, missed, voice sound, deep-links | Not Meta App secrets; not a second Train UI |

---

*End of report. For Meta tunnel / Connect ops, see `docs/WHATSAPP_CONNECT_DEVELOPER_GUIDE.md` and `docs/DEV_SETUP_CHECKLIST.md`. For phase roadmap language, cross-check `docs/calls/CALLS_SHIP_DOCUMENT.md` against this file when they disagree — **code wins**.*
