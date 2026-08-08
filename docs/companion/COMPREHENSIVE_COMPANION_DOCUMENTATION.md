# Samyoj Companion — Comprehensive Documentation

> **Status:** Code-verified + research synthesis (v1.0)  
> **Date:** 2026-08-08  
> **Scope:** The AI Companion — the shared `AiBot` brain that serves customers across **WhatsApp chat** and **WhatsApp voice calls**, with its full connection map, Meta API deep dive, competitor analysis, operator UX, and enhancement plan.  
> **Companion docs:** [`../calls/CALLS_SHIP_DOCUMENT.md`](../calls/CALLS_SHIP_DOCUMENT.md), [`../audit/CALLS_AI_BOT_CONNECTION_REPORT.md`](../audit/CALLS_AI_BOT_CONNECTION_REPORT.md), [`../audit/CALLS_AI_BOT_PRODUCTION_AUDIT_2026-08-08.md`](../audit/CALLS_AI_BOT_PRODUCTION_AUDIT_2026-08-08.md), [`../audit/SARVAM_AS_AI_BRAIN.md`](../audit/SARVAM_AS_AI_BRAIN.md)

---

## 0. Executive Summary

Samyoj's **Companion** is an AI agent (called `AiBot` in the codebase) that serves as a single intelligent entity across two customer-facing channels:

1. **WhatsApp Chat** — text-based auto-replies in the Inbox via automation flows
2. **WhatsApp Voice Calls** — voice-based conversation via the WhatsApp Cloud API Calling feature, using Sarvam STT/TTS for speech I/O

The architecture is already correctly designed: **one AiBot record, one `generateBotReply()` function, one `instructions`/`Train` corpus**, with channel-aware prompting (`channel: 'text'` vs `channel: 'voice'`). This means operators train the bot once and it answers on both chat and voice without duplicating configuration.

**Production status: 4/10** (controlled pilot). The shared-brain architecture is sound and Sarvam is already the default speech stack, but live transfer, compliance gating, security, and several UX paths need work before production readiness.

---

## 1. What is the Companion?

### 1.1 Definition

The **Companion** is an instance of the `AiBot` Prisma model — an AI agent configured by an organization operator to autonomously engage WhatsApp customers. It has:

- **Personality** (`instructions`): The system prompt that defines tone, behavior, and business context
- **Training data** (`KnowledgeBaseItem`): FAQ-style Q&As, pasted content, and uploaded PDFs/PDFs
- **Handoff behavior** (`handoffKeywords`, `handoffMessage`): Rules for when to transfer to a human
- **Channel settings** (`triggerKeywords`, `businessHoursOnly`, `temperature`, `maxTokens`, `rateLimitPerMin`): Channel-specific controls
- **Voice settings** (via `CallingSettings`): Which Sarvam voice/speaker and language to use on calls

### 1.2 The "One Brain, Two Channels" Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    AiBot (Companion)                        │
│  ┌──────────┐  ┌──────────┐  ┌─────────┐  ┌──────────┐      │
│  │ Personality  │ Train      │ Handoff   │ Voice cfg  │      │
│  │ (instructions) │ (KB items)  │ (keywords) │ (speaker)  │      │
│  └──────────┘  └──────────┘  └─────────┘  └──────────┘      │
│                    │                                         │
│                    ▼                                         │
│            generateBotReply()                                  │
│            (chatbot.service.ts)                              │
│               │                                              │
│         createChatCompletion()                                │
│         (sarvam-chat.service.ts)                             │
│         ┌───────────────────┴───────────────────┐             │
│    channel: 'text'                    channel: 'voice'       │
│         │                              │                     │
│  automation → WhatsApp               Sarvam STT → TTS         │
│  Inbox thread                         WebRTC + Meta Calling    │
└─────────────────────────────────────────────────────────────┘
```

**Key insight:** Because chat and voice both call `generateBotReply()`, **one provider switch changes both channels**. They are already "one brain, two channels."

### 1.3 Companion vs. Human Agent

The Companion works alongside human agents through a **transfer pipeline**:
- The AI answers first (by default) for both chat and voice
- When customers ask for a human, the Companion uses `handoffKeywords` or LLM `tool_call` (`request_human`) to trigger handoff
- On handoff: the AI stops, the call is assigned to a human agent in the Inbox
- Optionally (Phase C): a **cold live transfer** holds the customer, rings the agent, and bridges audio

---

## 2. Frontend Connection Map — Every Companion Connection

### 2.1 AI Bot Management Page (`/ai-bot`)

**File:** `client/src/pages/AiBotPage.tsx`

The AI Bot page is the **single companion editor** — operators never edit the bot from the Calls UI. Four primary tabs:

#### Personality Tab
- **Tone presets** — cards for: Friendly helper, Professional, Sales assist, Custom
- **Premium brains** — `AiBotProfessionalBrainPicker.tsx` offers pre-built brains:
  - `Support Pro` — full support instructions, voice-optimized instructions, KPIs, trigger keywords, FAQ seed items
  - `Sales Pro` — sales instructions, voice instructions, KPIs, trigger keywords, FAQ seed items
- **Business fields** — business name, "What you do", "Never do/promise" (refunds, medical, legal)
- **Preset** writes into `AiBot.instructions` — no schema change needed
- **Voice channel append** — product-owned system rule appended for `channel: 'voice'` in `chatbot.service.ts`

#### Train Tab
- **Add Q&A** — customer question + your answer → `KnowledgeBaseItem` (FAQ source type)
- **Paste info** — price lists, policies, hours → document ingest
- **Upload PDF** — menus, brochures, manuals → PDF ingest
- **Status indicator** — "Ready" / "Still learning…" (hides embedding/token counts)
- **RAG retrieval** — `searchKnowledgeBase()` with cosine similarity > 0.7, token fallback if no embeddings

#### Connect Tab
- **Handoff keywords** — chips for common phrases ("talk to human", "agent", "manager")
- **Handoff message** — custom message when connecting to a person
- **When to connect a person** — plain toggle: "Connect if team online" (links to Calls settings for ring behavior)
- Deep-links to `/calls` and Calling Settings

#### Try It Tab
- Text input → `POST /api/ai-bot/:id/test` → see reply + "Would connect person: Yes/No"
- Can simulate a call line (Phase B enhancement)

#### "Use for WhatsApp Calls" Toggle
```
AiBotPage → PATCH /api/calling/settings { defaultBotId: editing.id }
```
This is the **primary bridge** from chat bot to voice — explicitly binds the AiBot to the calling system.

### 2.2 Calls Page (`/calls`)

**File:** `client/src/pages/CallsPage.tsx` + `client/src/components/calls/*`

#### Call List
- **Header stats:** Live · Today · Missed (always visible)
- **List rows:** Avatar, name/phone, direction · relative time, status pill, handler micro-label (AI/Human), transcript preview
- **Live row:** subtle pulse when call in progress
- **Search + filter chips:** status, handler, date range

#### Call Detail View
- **Header:** name · phone · status · Open chat · More
- **Meta strip:** direction · duration · handler · time
- **Transcript bubbles:** customer left / business right (chat rhythm)
- **AI indicator:** Bot name shows in call records
- **Actions:** Open chat · End call · Transfer (Phase C; stub disabled for now)
- **Live call stage:** LIVE + elapsed timer, streaming transcript, "Connecting human…" status

#### Call Ring Modal (`CallRingModal.tsx`)
- Glass sheet with agent name/phone
- Accept (primary) / Decline (secondary)
- Shows AI brief (why handoff + last transcript lines)
- Mic permission inline error handling

#### Inbox Call Entry (`useConversationActions.ts` + `ChatHeader.tsx`)
- **Permission gate:** checks `/calling/permission/:contactId`
- States: Not enabled / Permission needed → "Ask to call" / Permission granted → "Call" (1 click) / In progress → "Open live call"
- `POST /calling/callback` → creates business-initiated call (BIC)

### 2.3 Calling Settings (`CallingSettingsForm.tsx`, `CallingSettingsStage.tsx`, `CallingSettingsPanel.tsx`)

**API:** `PATCH /api/calling/settings`

| Section | Fields | Companion Connection |
|---------|--------|---------------------|
| Who answers | `routingMode` (AI / Human / AI then Human), `aiAutoAnswer` | Determines if Companion answers |
| Which AI | `defaultBotId` (deep-link to `/ai-bot`) | Binds voice to AiBot personality |
| Greeting | `aiGreeting`, `consentMessage`, `playGreeting` | What Companion says first |
| Voice sound | `ttsVoice`, `ttsLanguage`, `sarvamMode`, `sarvamSttPrompt`, `sttLanguage` | Sarvam voice for Companion |
| After hours | `afterHoursMode`, `businessHours`, `afterHoursGreeting` | Companion behavior outside hours |
| Missed | `missedCallReply` | Fallback WhatsApp message |
| Connect to person | `liveTransferEnabled`, `transferMode`, `ringTimeoutSec` | Handoff from Companion to human |

### 2.4 Calls Setup Sheet & Rail

- **Setup sheet** (first Ready only): WhatsApp connected · Enable calling on Meta · AI ready (personality + ≥3 Train Q&As) · Voice ready
- **CallsRailPanel**: Settings, Insights (compact 30d), Help (3 FAQs + Meta checklist)

### 2.5 API Service Layer

**File:** `client/src/services/api.ts`

```typescript
// AI Bot companion management
aiBotApi: {
  status: () => GET /ai-bot/status
  providerStatus: () => GET /ai-bot/provider-status
  list: () => GET /ai-bot
  get, create, update, delete
  default: GET/POST /ai-bot/default
  test: POST /ai-bot/:id/test
  faq, ingestUrl, ingestPdf, seedKnowledge
  analytics, versions, audit, restore
}

// Calling/Companion voice API
callingApi: {
  status: () => GET /calling/status
  settings: () => GET /calling/settings  +  updateSettings: PATCH
  enable: () => POST /calling/enable
  list: () => GET /calling
  get: (id) => GET /calling/:id
  callback: POST /calling/callback          // BIC outbound
  accept/decline, terminate
  getSignaling: GET /calling/:id/signaling
  permission: GET /calling/permission/:contactId
  requestPermission: POST /calling/permission/request
  previewVoice: POST /calling/voice/preview
  analytics: GET /calling/analytics
  updateNotes: PATCH /calling/:id
}
```

### 2.6 Socket.IO Real-time

```typescript
// Emitted to org on companion events:
'call:ring'           → Agent ring modal popup
'call:ring_timeout'   → Ring expired
'call:updated'        → Call status changed
'call:transcript'     → Live transcript line (during AI answer)
'presence'            → Agent online/offline status

// Also via emitToOrg / emitToUser:
conversation:updated   → Bot state changes
ai-bot:*               → Bot config changes (draft mode)
```

### 2.7 Dashboard Integration

- **Dashboard Quick Action:** "Calls" tile on dashboard — one entry to calls feature
- **Calls header:** Live · Today · Missed always visible
- **Inbox AI toggle:** `[ AI ON ] · [ Call ] · [⋯]` in chat header — Call button is Companion entry from any conversation

### 2.8 Professional Brains (`professionalBrains.ts`)

**File:** `client/src/ai-bot/professionalBrains.ts`

Two pre-built companions with complete instructions:

| Brain | Name | Tone | Voice Instructions | KPIs | Trigger Keywords | FAQ Seeds |
|-------|------|------|-------------------|------|-----------------|-----------|
| **Support Pro** | "Sam" | Friendly, efficient, clear | Concise, empathetic, action-oriented | CSAT ↑, resolution time ↓ | order status, refund, return, track, cancel | Order status, Return policy, Hours, Contact |
| **Sales Pro** | "Aria" | Friendly, curious, light | Warm, suggestion-oriented, not pushy | Conversion ↑, engagement ↑ | price, cost, discount, demo, custom, buy now | Pricing, Features, Trial, Demo, Custom orders |

These are picked via `AiBotProfessionalBrainPicker.tsx` on bot creation — giving operators a **ready-made companion** with zero configuration.

---

## 3. Backend Connection Map — Every Companion Connection

### 3.1 Module Layout

```
server/src/
├── modules/
│   ├── ai/                    # Shared AI brain
│   │   ├── chatbot.service.ts   ← generateBotReply() — THE companion core
│   │   ├── bot.service.ts       ← resolveBotForConversation, ensureDefaultBot
│   │   ├── knowledge.service.ts ← Train FAQ retrieval (RAG)
│   │   ├── sarvam-chat.service.ts ← Sarvam-105B LLM (chat completions)
│   │   ├── sarvam-embeddings.service.ts OR azure embeddings
│   │   ├── chat-completion.service.ts ← Unified completion facade
│   │   ├── org-ai.service.ts   ← resolveAiConfig, saveOrgAiSettings
│   │   ├── types.ts            ← BotChannelType, BotTone, etc.
│   │   └── routes.ts            ← /api/ai-bot/* REST API
│   ├── calling/                # Voice companion (servant)
│   │   ├── ai-voice-agent.ts   ← AiVoiceCallSession — voice companion
│   │   ├── sarvam.stt.ts       ← Sarvam STT (ears)
│   │   ├── sarvam.tts.ts       ← Sarvam TTS (mouth)
│   │   ├── deepgram.stt.ts     ← Legacy STT (fallback)
│   │   ├── google-tts.service.ts ← Legacy TTS (fallback)
│   │   ├── meta-calling.service.ts ← Meta Graph Calling API
│   │   ├── webrtc-bridge.ts    ← @roamhq/wrtc audio bridge
│   │   ├── call.processor.ts   ← Webhook: calls field handler
│   │   ├── routing.service.ts  ← decideCallRoute, resolveCallBot
│   │   ├── agent-call.service.ts ← Agent accept/decline (SIP bridge)
│   │   ├── settings.service.ts ← CallingSettings service
│   │   ├── session-store.ts    ← Redis pending/active call state
│   │   ├── missed-call.service.ts ← Auto WhatsApp follow-up
│   │   ├── call-event-message.ts ← Call event message in chat
│   │   ├── audio-utils.ts      ← PCM audio processing
│   │   ├── calling.routes.ts   ← /api/calling/* REST API
│   │   ├── calling-settings.types.ts ← Settings interface
│   │   ├── types.ts            ← CallWebhookEntry, ActiveCallContext, etc.
│   │   ├── analytics.ts        ← Call analytics aggregation
│   │   └── call-session.manager.ts ← In-process session registry
│   ├── automation/
│   │   ├── engine.ts          ← Route messages → bot + automations
│   │   └── flows/             ← Visual flow builder (connects to bot)
│   └── inbox/ (integrated)
│       └── useConversationActions.ts (backend) / ChatHeader.tsx (frontend)
├── workers/
│   ├── webhook.worker.ts      ← WhatsApp webhook processing
│   ├── message.worker.ts      ← Message sending
│   ├── ai.worker.ts           ← Async AI replies
│   └── flows.worker.ts        ← Flow execution
```

### 3.2 The Companion Brain — `chatbot.service.ts`

**File:** `server/src/modules/ai/chatbot.service.ts`

This is the **single source of truth** for companion replies across both channels.

#### `generateBotReply()` — The Core Function

```typescript
export async function generateBotReply({
  organizationId,
  conversationId,
  inboundMessage,
  channel = 'text',         // ← 'text' | 'voice'
  botId,
  forceHandoff,
  contactId,
}: GenerateBotReplyArgs): Promise<BotReplyResult>
```

**Flow:**
1. **Rate limiting** — `checkRateLimit(botId, orgId)` using `AiBot.rateLimitPerMin`
2. **Bot resolution** — `resolveBotForConversation()` or explicit `botId`
3. **Conversation context** — load conversation + contact + recent messages
4. **Knowledge retrieval** — `searchKnowledgeBase(bot.id, query, topK=5)`
5. **Message building** — `buildConversationMessages()` with channel-aware system prompt:
   - `channel: 'text'` → standard instructions + FAQ grounding
   - `channel: 'voice'` → appends spoken-sentence rule: "Respond in short, spoken sentences suitable for voice."
6. **LLM call** — `createChatCompletion()` with temperature, maxTokens from AiBot
7. **Token tracking** — `recordAiUsage()` writes to `AiUsageLog`
8. **Handoff detection** — checks `handoffKeywords` + LLM handoff signal
9. **Response** — `{ reply, handoff, handoffReason, tool, citations }`

#### Bot Resolution (`bot.service.ts`)

```typescript
// Bot selection (two knobs, one bot row):
CallingSettings.defaultBotId  ──preferred──►  resolveCallBot
Conversation.activeBot        ──fallback───►
Chat isDefault / keywords     ──last───────►  ensureDefaultBot
```

### 3.3 The Voice Companion — `ai-voice-agent.ts`

**File:** `server/src/modules/calling/ai-voice-agent.ts`

The `AiVoiceCallSession` class is the companion's **voice body** — it handles everything from WebRTC negotiation to speech synthesis.

#### Constructor & Initialization

```typescript
class AiVoiceCallSession {
  constructor(private ctx: ActiveCallContext) { ... }
  async start(sdpOffer: string) { ... }  // Called on inbound call
}
```

`ActiveCallContext` (from `types.ts`):
- `callId`, `metaCallId`, `organizationId`, `conversationId`, `contactId`
- `phoneNumberId`, `accessToken`, `whatsappNumberId`
- `fromPhone`, `toPhone`, `direction`
- `aiBotId` (the companion!), `greeting`, `consentMessage`
- `ttsVoice`, `ttsLanguage`, `sttPrompt`, `sttMode`, `sttLanguage`

#### Inbound Voice Flow (Companion Answers)

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
        agents_first → ring ONLINE agents (socket call:ring) else AI/missed
        ai_then_agents → AI immediately if auto-answer
  → AI path: AiVoiceCallSession.start(sdpOffer)
        webrtc-bridge createAnswerFromOffer
        Meta pre_accept(sdp answer)
        Meta accept(sdp answer)
        optional consent TTS + greeting TTS
        loop: PCM → Sarvam STT → generateBotReply(channel:'voice') → Sarvam TTS → playPcm
        handoff? speak + terminate COMPLETED
```

#### AI Voice Loop (Algorithm)

```typescript
// 1. Bridge audio handler → Sarvam STT (ignore while speaking)
// 2. On final transcript → handleUserSpeech (guard: not processing/speaking, ≥2 chars)
// 3. Append transcript entry (role: 'user'); emit call:transcript
// 4. generateBotReply({ channel: 'voice', botId: this.ctx.aiBotId })
// 5. Speak reply via Sarvam TTS → playPcm; append assistant/system lines
// 6. If result.handoff → performHandoff → speak "connecting…" → end('handoff')
```

#### Voice Tools (`request_human`, `schedule_callback`)

The voice agent parses LLM tool calls:
- `request_human({ reason })` → if agents online: hold music + ring agents / else: WhatsApp follow-up
- `schedule_callback({ phone, time })` → **currently theater** (no ticket/task/calendar job created)

#### Call Recording

- Raw PCM saved under `uploads/calls/` (security risk — see §12)
- Consent message spoken first (configurable: `consentMessage`)
- No encryption/TTL/ACL on recordings

#### Handoff & Transfer

```typescript
performHandoffAndTransfer(handoffReason) {
  // 1. Check liveTransferEnabled && transferMode === 'live'
  // 2. If live + agents online → hold → ring agents (call:ring)
  // 3. If accepted → swap audio bridge to agent
  // 4. If declined/timeout → speak fallback → WhatsApp follow-up + Inbox assignment
  // 5. If message-only → end call + WhatsApp handoff
}
```

### 3.4 Sarvam Integration — The Companion's Speech

#### Speech-to-Text (`sarvam.stt.ts`)

| Aspect | Detail |
|--------|--------|
| Protocol | WebSocket `wss://api.sarvam.ai/speech-to-text-realtime/ws` |
| Auth | Header `api-subscription-key: <SARVAM_API_KEY>` (env only) |
| Model | `saaras:v3-realtime` |
| Modes | `codemix` (code-mixed Indian languages), `transcribe` |
| Languages | 23 (auto-detect via `language=unknown`) |
| Sample rate | 16000 default, 8000 for telephony |
| Idle timeout | ~60s → ping/keepalive |

#### Text-to-Speech (`sarvam.tts.ts`)

| Aspect | Detail |
|--------|--------|
| Protocol | WebSocket `wss://api.sarvam.ai/text-to-speech/ws` + REST preview |
| Auth | Header `api-subscription-key` |
| Model | `bulbul:v3` |
| Speakers | 30+ voices across 11 languages (10 Indic + English) |
| Default speaker | `shubh` (configurable via `SARVAM_TTS_SPEAKER`) |
| Preview | `POST /calling/voice/preview` → REST → base64 audio |
| Barge-in | Client-side: stop playback + close TTS socket + new connection |

#### Chat Completions (`sarvam-chat.service.ts`)

| Aspect | Detail |
|--------|--------|
| Endpoint | `POST https://api.sarvam.ai/v1/chat/completions` |
| Model | `sarvam-105b` (128K context) |
| Format | OpenAI-compatible `messages` body |
| Streaming | SSE (`stream: true`) — exists but **unused** in voice path today |
| Function calling | `tools` / `tool_choice` — supported by API, but `generateBotReply` does not emit tools on voice |
| Pricing | ₹4 input / ₹2.5 cached / ₹16 output per 1M tokens |

### 3.5 Meta Calling API Integration

**File:** `server/src/modules/calling/meta-calling.service.ts`

#### Meta Calling Actions

| Action | Meta Graph API | Samyoj Usage |
|--------|---------------|-------------|
| `connect` | `POST /{phone_number_id}/calls` with `session.sdp` | Outbound BIC + inbound answer |
| `pre_accept` | `POST /{phone_number_id}/calls` with `call_id` + SDP answer | Faster media setup (optional) |
| `accept` | `POST /{phone_number_id}/calls` with `call_id` + SDP answer | Accept inbound call (30-60s window) |
| `reject` | `POST /{phone_number_id}/calls` with `call_id` + `action: reject` | Agent decline, miss |
| `terminate` | `POST /{phone_number_id}/calls` with `call_id` + `action: terminate` | End call |
| Enable | `POST /{phone_number_id}/settings` with `calling.status: ENABLED` | Setup wizard |
| Call permissions | `GET /{phone_number_id}/call_permissions?user_wa_id=` | **Built** (preflight check) |
| Permission request | Interactive `call_permission_request` message | **Built** (outbound flow) |

#### Meta Prerequisites (`CALLING_ENABLE_HINTS`)

1. WhatsApp number must use Cloud API (not WhatsApp Business mobile app)
2. Add a payment method to WhatsApp Business Account in Meta Business Manager
3. Reach a messaging limit of at least 2,000 unique customers per day (or use a Meta test number for development)
4. Subscribe your app webhook to the "calls" field in Meta Developer Console

#### Meta Pricing Model

- **User-Initiated Calls (UIC):** Free — customer taps call on business
- **Business-Initiated Calls (BIC):** Paid — 6-second pulse billing + country tier + volume tier
- **Call permission request messages:** Billed at message pricing rates
- SDP must be RFC-compliant (OPUS, ICE, DTLS-SRTP); Meta also documented G.711 (PCMA/PCMU) as of 2026

### 3.6 WebSocket Bridge — `webrtc-bridge.ts`

Uses `@roamhq/wrtc` (unofficial WebRTC implementation for Node.js):

- `createOffer()` — for outbound BIC WebRTC handshake
- `createAnswerFromOffer(offer)` — for inbound UIC answer
- `playPcm(samples, sampleRate)` — plays TTS audio into the call
- Audio source/sink PCM buffering, playback queue
- Connection monitoring + disconnect handling
- **Note:** STUN-only ICE (no TURN) — fails behind strict NAT
- **Security concern:** Raw PCM recording under `uploads/calls/`

### 3.7 Routing — `routing.service.ts`

```typescript
async function decideCallRoute(org: Organization, ctx: ActiveCallContext) {
  // 1. Concurrent call limit check (atomic counter)
  if (activeCount >= maxConcurrentCalls) return 'missed'
  
  // 2. After-hours handling
  if (!withinBusinessHours) {
    switch (afterHoursMode) {
      case 'ai': return aiAutoAnswer ? 'ai' : 'missed'
      case 'message': return 'missed'
      default: return 'missed'
    }
  }
  
  // 3. Routing mode
  switch (routingMode) {
    case 'ai_only': return aiAutoAnswer ? 'ai' : 'missed'
    case 'agents_first': return hasOnlineAgents ? 'ring_agents' : (aiAutoAnswer ? 'ai' : 'missed')
    case 'ai_then_agents':  // default — misleading name
      return aiAutoAnswer ? 'ai' : (hasOnlineAgents ? 'ring_agents' : 'missed')
  }
}
```

### 3.8 Database Schema — Companion Models

**File:** `server/prisma/schema.prisma`

#### `AiBot` Model (The Companion Brain)

```prisma
model AiBot {
  id                String   @id @default(uuid())
  organizationId    String   @map("organization_id")
  name              String
  enabled           Boolean  @default(true)
  isDefault         Boolean  @default(false) @map("is_default")
  instructions      String   @default("")          // ← Personality (system prompt)
  handoffMessage    String   @default("Let me connect you with our team...") @map("handoff_message")
  triggerKeywords   String[] @default([]) @map("trigger_keywords")
  handoffKeywords   String[] @default([]) @map("handoff_keywords")
  businessHoursOnly Boolean  @default(false) @map("business_hours_only")
  temperature       Float    @default(0.7)
  maxTokens         Int      @default(500) @map("max_tokens")
  rateLimitPerMin   Int      @default(30) @map("rate_limit_per_min")
  createdAt         DateTime @default(now()) @map("created_at")
  updatedAt         DateTime @updatedAt @map("updated_at")

  organization    Organization        @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  knowledgeItems  KnowledgeBaseItem[]  @relation("bot_knowledge")
  conversations   Conversation[]       @relation("ActiveBot")
  calls           Call[]
  versions        AiBotVersion[]
  auditLogs       AiBotAuditLog[]

  @@index([organizationId])
  @@map("ai_bots")
}
```

#### `KnowledgeBaseItem` (Train Content)

```prisma
model KnowledgeBaseItem {
  id         String              @id @default(uuid())
  botId      String              @map("bot_id")
  title      String
  content    String              // ← FAQ answer, pasted content, or PDF text
  sourceType KnowledgeSourceType @default(FAQ) @map("source_type")
  sourceUrl  String?             @map("source_url")
  embedding  Json?               // ← Azure embeddings vector
  createdAt  DateTime            @default(now()) @map("created_at")
  updatedAt  DateTime            @updatedAt @map("updated_at")

  bot AiBot @relation(fields: [botId], references: [id], onDelete: Cascade)
  @@index([botId])
  @@map("knowledge_base_items")
}
```

#### `AiBotVersion` (Version History)

```prisma
model AiBotVersion {
  id         String   @id @default(uuid())
  botId      String   @map("bot_id")
  version    Int
  snapshot   Json     // ← Full bot config snapshot
  changedBy  String?  @map("changed_by")
  changeNote String?  @map("change_note")
  createdAt  DateTime @default(now()) @map("created_at")
  @@unique([botId, version])
  @@map("ai_bot_versions")
}
```

#### `AiBotAuditLog` (Audit Trail)

```prisma
model AiBotAuditLog {
  id             String   @id @default(uuid())
  botId          String   @map("bot_id")
  organizationId String   @map("organization_id")
  userId         String?  @map("user_id")
  action         String   // ← "create", "update", "delete", "train"
  changes        Json?    // ← Field-level diff
  createdAt      DateTime @default(now()) @map("created_at")
  @@index([botId, createdAt])
  @@map("ai_bot_audit_logs")
}
```

#### `Call` Model (Voice Companion Records)

```prisma
model Call {
  id              String        @id @default(uuid())
  organizationId  String        @map("organization_id")
  contactId       String        @map("contact_id")
  conversationId  String?       @map("conversation_id")  // ← links to chat
  whatsappNumberId String?      @map("whatsapp_number_id")
  aiBotId         String?       @map("ai_bot_id")  // ← the companion!
  assignedAgentId String?       @map("assigned_agent_id")
  metaCallId      String        @unique @map("meta_call_id")
  direction       CallDirection // USER_INITIATED | BUSINESS_INITIATED
  status          CallStatus    // RINGING|CONNECTING|CONNECTED|COMPLETED|FAILED|REJECTED|MISSED|TERMINATED
  handler         CallHandler   // AI | AGENT | UNANSWERED
  fromPhone       String        @map("from_phone")
  toPhone         String        @map("to_phone")
  startedAt       DateTime?     @map("started_at")
  answeredAt      DateTime?     @map("answered_at")
  endedAt         DateTime?     @map("ended_at")
  durationSeconds Int?          @map("duration_seconds")
  transcript      Json?         // ← array of {role, text, at}
  metadata        Json?         // ← notes, recording URL, summary
  createdAt       DateTime      @default(now()) @map("created_at")
  updatedAt       DateTime      @updatedAt @map("updated_at")

  organization    Organization  @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  contact         Contact       @relation(fields: [contactId], references: [id], onDelete: Cascade)
  conversation    Conversation? @relation(fields: [conversationId], references: [id])
  ai             AiBot?         @relation(fields: [aiBotId], references: [id])
  @@map("calls")
}
```

#### `AiUsageLog` (Token Tracking)

```prisma
model AiUsageLog {
  id              String   @id @default(uuid())
  organizationId  String   @map("organization_id")
  botId           String?  @map("bot_id")        // ← companion bot
  conversationId  String?  @map("conversation_id")
  action          String   // ← "chat_reply" | "voice_reply" | "knowledge_ingest"
  promptTokens    Int      @default(0) @map("prompt_tokens")
  completionTokens Int     @default(0) @map("completion_tokens")
  totalTokens     Int      @default(0) @map("total_tokens")
  createdAt       DateTime @default(now()) @map("created_at")
  @@index([organizationId, createdAt])
  @@map("ai_usage_logs")
}
```

#### `CallRecording` Model

```prisma
model CallRecording {
  id        String   @id @default(uuid())
  callId    String   @unique @map("call_id")
  path      String   // ← file path in uploads/
  duration  Int?     // ← seconds
  size      Int?     // ← bytes
  createdAt DateTime @default(now()) @map("created_at")
  @@map("call_recordings")
}
```

#### Other Connected Models

- **`Conversation`** — `activeBotId`, `botActive`, `botHandoffAt`, `botHandoffReason`, `botState` (links calls ↔ chats)
- **`WhatsappNumber`** — has calling settings (enable/disable)
- **`Organization`** — stores `settings` JSON (calling + AI settings, including `defaultBotId`)
- **`Contact`** — `optedIn` (compliance gate), `tags`, `notes`, phone number
- **`CannedReply`** — pre-written responses for agents after handoff
- **`Label`** — tagging for conversations
- **`User` / `Department`** — agent management for handoff routing

#### Enums

```prisma
enum CallDirection { USER_INITIATED BUSINESS_INITIATED }
enum CallStatus { RINGING CONNECTING CONNECTED COMPLETED FAILED REJECTED MISSED TERMINATED }
enum CallHandler { AI AGENT UNANSWERED }
enum KnowledgeSourceType { FAQ URL PDF }
enum ConversationStatus { OPEN ARCHIVED }
enum UserRole { OWNER ADMIN SUPERVISOR AGENT }
enum TriggerType { KEYWORD WELCOME AWAY BUSINESS_HOURS LEAD_CAPTURE }
enum FlowTriggerType { WELCOME KEYWORD ANY_MESSAGE BUSINESS_HOURS OFF_HOURS CONTACT_TAG SEGMENT MISSED_CALL CAMPAIGN_REPLY CALL_COMPLETED }
```

### 3.9 Automation Engine Connection

**File:** `server/src/modules/automation/engine.ts`

The companion is also wired into the **chat automation engine**:

```typescript
// When a message arrives:
// 1. Check if conversation has activeBotId + botActive
// 2. If botActive → route to generateBotReply(channel: 'text')
// 3. Also check automation rules (welcome, away, keyword triggers)
// 4. If bot handoff → assign to agent, send handoff summary to Inbox internal note
```

Flow triggers connected to companion: `CALL_COMPLETED`, `MISSED_CALL`, `CONTACT_TAG`

### 3.10 Worker Connections (BullMQ)

The companion is touched by multiple background workers:

| Worker | Companion Connection |
|--------|---------------------|
| `webhook.worker.ts` | Processes WhatsApp webhook → routes messages to companion (`generateBotReply`) |
| `message.worker.ts` | Sends companion replies as WhatsApp messages |
| `ai.worker.ts` | Async AI replies for chat |
| `flows.worker.ts` | Executes flows triggered by companion handoff |
| `media.worker.ts` | Generates media (profile images, etc.) |
| `compliance.worker.ts` | Handles GDPR/opt-out (stops companion from replying to opted-out contacts) |

### 3.11 Session Store

**File:** `server/src/modules/calling/session-store.ts`

Redis-backed in-memory store for call state:
- `storePendingCall()` — pending agent accept/decline (stores `whatsappNumberId`, NOT tokens)
- `storeActiveCall()` — active call session
- `getActiveCall()` / `removeActiveCall()` — lifecycle management

### 3.12 Environment Variables

```
# AI Brain (chat completions)
AZURE_OPENAI_DEPLOYMENT, AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_KEY, AZURE_OPENAI_API_VERSION
OPENAI_KEY (if used)
AI_BRAIN_PROVIDER (planned: 'azure' | 'sarvam')

# Sarvam Speech (STT/TTS)
SARVAM_API_KEY
SARVAM_STT_LANGUAGE, SARVAM_STT_MODE, SARVAM_STT_PROMPT
SARVAM_TTS_SPEAKER, SARVAM_TTS_LANGUAGE
CALLING_VOICE_PROVIDER=sarvam|deepgram_google  (feature flag)

# Meta Calling
META_ACCESS_TOKEN, META_PHONE_NUMBER_ID, META_WABA_ID, META_APP_ID, META_APP_SECRET
META_WEBHOOK_URL, META_API_VERSION=v18.0

# Google Cloud (legacy TTS)
GOOGLE_APPLICATION_CREDENTIALS, GOOGLE_TTS_VOICE, GOOGLE_TTS_LANGUAGE

# Deepgram (legacy STT)
DEEPGRAM_API_KEY, DEEPGRAM_LANGUAGE, DEEPGRAM_SAMPLE_RATE

# Calling defaults
CALLING_AI_AUTO_ANSWER, CALLING_AI_GREETING
```

### 3.13 Error Handling & Observability

**File:** `server/src/utils/response.ts`, `server/src/utils/logger.ts`

- Unified error normalization (`AppError` wraps Zod, Prisma, Meta API errors into JSON)
- Sentry integration for crash reporting
- Module-scoped Winston loggers (`server:src/modules/calling/meta-calling`, etc.)
- `recordAiUsage()` tracks token usage per org/bot for quota management

---

## 4. Meta Documentation Deep Dive — Companion & Calling

### 4.1 WhatsApp Cloud API Calling Overview

Meta's calling feature allows businesses to receive and make **voice calls** directly through the WhatsApp Business Platform. Calls are conducted over WebRTC with OPUS audio codec (G.711 also supported as of 2026).

#### Two Call Types

| Type | Who initiates | Permission | Pricing | Samyoj status |
|------|--------------|------------|---------|---------------|
| **User-Initiated Call (UIC)** | Customer taps "Call" on business profile/chat | None (business must be enabled) | **Free** | ✅ Fully implemented |
| **Business-Initiated Call (BIC)** | Business initiates call to customer | **Explicit call permission** required | 6-second pulse + country tier | ⚠️ API built, UI off, media incomplete |

#### UIC Flow (Implemented)

1. Customer taps Call on WhatsApp business chat
2. Meta sends webhook `calls` field with `connect` event + SDP offer
3. Business responds within 30-60 seconds with `pre_accept` (optional) + `accept` with SDP answer
4. If not answered in time → user sees "Not Answered" + `terminate` webhook fires
5. Call ends → `terminate` webhook → duration, status

#### BIC Flow (Partially Implemented)

1. **Call permission request** — Must send `call_permission_request` (interactive free-form message or template) **before** dialing
2. Customer grants permission → `GET /call_permissions?user_wa_id=` to check status/expiry
3. `POST /calls` with `action: connect` + SDP offer
4. Meta sends `connect` webhook with SDP answer
5. Call status webhooks: RINGING → ACCEPTED → REJECTED → TERMINATED

**Critical Meta constraints:**
- Call permission is **short-lived** — consecutive unanswered calls can revoke permission
- Permission request messages cost at **message pricing** (not free)
- BIC is billed at **6-second pulse** intervals + country tier pricing
- Must use `biz_opaque_callback_data` to track outbound calls (max 512 chars)

#### Meta Call Settings (Configurable)

| Setting | Values | Samyoj Implementation |
|---------|--------|----------------------|
| `calling.status` | ENABLED / DISABLED | ✅ `/calling/enable` |
| `call_icon_visibility` | DEFAULT (shown on profile) | ✅ Set on enable |
| `calling.callback_permission_status` | ENABLED / DISABLED | ✅ Set on enable |
| `call_hours` | Business hours JSON | ⚠️ Partial — env-based only |
| `call_forwarding` | Number to forward to | ❌ Not used |
| `greeting` | Audio URL for unanswered | ❌ Not used (TTS instead) |

#### Meta Call Actions (Graph API)

All via `POST /{phone-number-id}/calls`:

| Action | When | SDP required? |
|--------|------|--------------|
| `connect` | Start new call (inbound answer or outbound BIC) | ✅ Yes (offer) |
| `pre_accept` | Early answer before full accept | ✅ Yes (answer) |
| `accept` | Fully answer the call | ✅ Yes (answer) |
| `reject` | Decline incoming call | ❌ No |
| `terminate` | End active call | ❌ No |
| `ring_user` | Ring a specific user (agent) | ⚠️ Requires setup |

#### DTMF Support

Meta sends DTMF tones via the `calls` webhook `dtmf` field (digits 0-9, *, #). Samyoj receives them in `CallWebhookEntry.dtmf` but **does not use them** — could enable IVR keypad navigation.

#### Meta Prerequisites

1. ✅ Cloud API number (not WA Business mobile app)
2. ✅ Payment method on WhatsApp Business Account (WABA)
3. ✅ Messaging limit ~2,000 unique customers/day (or test number for dev)
4. ✅ Webhook subscribed to `calls` field
5. ✅ SDP must be RFC-compliant (OPUS, ICE, DTLS-SRTP)
6. ✅ `biz_opaque_callback_data` for outbound tracking

#### Meta Pricing

- **User-Initiated Calls:** Free
- **Business-Initiated Calls:** 6-second pulse billing + country tier
- **Permission request messages:** Billed at standard message rates
- **No charge for unanswered calls** (customer doesn't pick up)

#### Sandbox vs Production

- Sandbox: looser permission send limits, revoke thresholds
- Production: stricter limits, requires 2k messaging tier
- Recommendation: use test number for development

### 4.2 Companion on Meta — Product Requirements

For the Companion to work on Meta's calling platform, the following Meta-side capabilities must be used:

1. **Webhooks** — Subscribe `messages` and `calls` fields to the WhatsApp webhook
2. **Graph API** — Use `POST /calls` for connect/accept/terminate actions
3. **SDP negotiation** — The companion's WebRTC bridge must produce valid SDP answers
4. **Call permissions** — For outbound, send `call_permission_request` before BCD
5. **Audio codecs** — OPUS for WebRTC, with 8kHz option for telephony
6. **Business hours** — Use `call_hours` setting (currently env-only in Samyoj)

---

## 5. Sarvam AI Documentation Deep Dive — The Companion's Speech

### 5.1 Why Sarvam for the Companion

Sarvam AI provides India-first speech AI capabilities that are critical for the Companion's voice channel:

- **23 STT languages** including all major Indian languages
- **Code-mix support** — handles Hinglish (Hindi + English mixed) natively
- **8 kHz telephony** sampling for PSTN-quality calls
- **Bulbul v3 voices** — 30+ natural-sounding voices across 11 languages
- **Sub-250ms first-byte latency** for near-real-time speech synthesis
- **Optional 105B LLM** — can be used as the brain (currently Azure)

### 5.2 Speech-to-Text (Saaras)

```
Endpoint: wss://api.sarvam.ai/speech-to-text-realtime/ws
Model: saaras:v3-realtime
Modes: transcribe | codemix | translate | translit
Languages: 23 (auto-detect via language=unknown)
Sample rates: 16000 (default) or 8000 (telephony)
Codecs: wav / pcm_s16le / pcm_l16 / pcm_raw (NOT MP3/AAC)
Idle timeout: ~60s (needs keepalive/ping)
Auth: api-subscription-key header
```

**Sarvam IVR/contact-center guidance:**
- Use `high_vad_sensitivity` for noisy callers
- Prefer realtime endpoint for barge-in/partial transcripts
- Batch STT + diarization + LLM summary available for post-call intelligence

### 5.3 Text-to-Speech (Bulbul v3)

```
Endpoint: wss://api.sarvam.ai/text-to-speech/ws (streaming)
           POST /v1/text-to-speech (REST for preview)
Model: bulbul:v3
Speakers: 30+ voices (shubh, aditya, simran, etc.) — 11 languages
Config: speaker, language_code, pace (~1.1), pitch, pronunciation
Audio: base64 chunks → decode → PCM for WebRTC bridge
Barge-in: No server-side cancel — must close socket + start new connection
```

**TTS workflow:**
1. Connect `bulbul:v3` WebSocket
2. Send `config` message (speaker, language, pace, codec, bitrate)
3. Send `text` messages (<500 chars chunks preferred)
4. Send `flush` to force synthesis
5. Send `ping` keep-alive
6. Receive base64 audio chunks → decode → PCM
7. On interrupt: close socket + start new connection

### 5.4 Chat Completions (sarvam-105b)

```
Endpoint: POST https://api.sarvam.ai/v1/chat/completions
Model: sarvam-105b (128K context)
Auth: Authorization: Bearer OR api-subscription-key
Format: OpenAI-compatible messages array
Options: temperature, max_tokens, stream (SSE), tools/function calling, response_format (JSON)
Pricing: ₹4 input / ₹2.5 cached / ₹16 output per 1M tokens
```

**Key capability for companion:** Function calling (`tools`) — this would unlock the Phase C `request_human` and `schedule_callback` voice tools that are currently dead code.

### 5.5 Sarvam Cost Model

| Service | Price | Billing Unit | Estimated per Interaction |
|---------|-------|--------------|--------------------------|
| Chat (sarvam-105b) | ₹4 in / ₹2.5 cached out / ₹16 out | per 1M tokens | ~₹0.0016 per chat reply |
| Speech-to-text (Saaras) | ₹30 (₹45 w/ diarization) | per hour of audio | ~₹0.01 per 2-min call |
| Text-to-speech (Bulbul) | ₹30 (v2: ₹15) | per 10K characters | ~₹0.02 per minute of speech |

**Total estimated all-in per AI voice call:** ~₹1-2 per minute (STT + TTS + LLM)

### 5.6 Implementation Gaps

| Gap | Current | Fix |
|-----|---------|-----|
| Chat brain still Azure | `createChatCompletion` hardcoded to Azure | Add Sarvam branch |
| No brain provider config | No `provider` field in `OrgAiSettings` | Add `brainProvider` to settings |
| Streaming unused | `streamSarvamChatCompletion` exists but voice waits for full LLM | Wire streaming + chunked TTS |
| Function calling dead | `ai-voice-agent.ts` parses `tool_call` but never emits | Include `tools` in voice LLM calls |
| No Sarvam embeddings | Knowledge retrieval uses Azure embeddings | Keep Azure embeddings (no Sarvam alternative) |
| Dual-duty language field | `sarvamSttLanguage` used for STT AND TTS | Add `sarvamTtsLanguage` |

---

## 6. Competitor Analysis — What "Good" Looks Like

### 6.1 Competitive Landscape

| Player | Voice AI Story | UX Takeaways | Samyoj Position |
|--------|---------------|--------------|-----------------|
| **Respond.io** | WhatsApp Calling inside same inbox as chat. Voice AI answers inbound; live handoff with transcript + chat context. Auto transcript + AI summary. CRM webhook sync. | Unify Calls with Inbox; handoff must not hang up | Deeper Meta Calling integration, weaker Inbox unity |
| **Wati Astra Voice** | Voice clone, WhatsApp + web AI agent, BANT qualification, memory across channels. | One setup → "AI answers calls"; hide telephony plumbing | No voice clone; needs simpler setup story |
| **AiSensy** | SMB WhatsApp automation; voice often for outbound reminders/support positioning. | Simple outbound later, not day-1 dialer farm | Outbound BIC incomplete |
| **Gallabox** | Strong analytics; voice on higher tiers. | Insights secondary, not homepage clutter | Analytics good but can be simplified |
| **Twilio Voice** | Programmable voice APIs, SIP trunking, call recording, IVR. | Developer-first, not operator-first | Samyoj is higher-level (good advantage) |
| **MessageBird** | Conversations API with WhatsApp calling, flow builder. | One-flow approach | Samyoj flows more visual |
| **Vapi** | Voice AI agent platform, real-time streaming, function calling, barge-in. | Enterprise voice AI features | Samyoj needs barge-in, real-time streaming |
| **LiveKit** | Voice AI infrastructure, voice agents, SIP trunking. | LiveKit = infrastructure, Samyoj = app | Could replace wrtc bridge |

### 6.2 Industry Best Practices (2026)

Based on competitor production guides and industry standards:

1. **Unified inbox** — Calls and chat live in the same conversation thread (Respond.io leads this)
2. **Live handoff with context** — Transfer call to agent without dropping, with transcript in hand (Respond.io, Vapi)
3. **Barge-in** — Customer can interrupt AI mid-sentence; AI stops and listens (Vapi, LiveKit)
4. **Real-time streaming** — LLM responses stream as they generate; first word <500ms (Vapi)
5. **Function calling for tool use** — AI decides to schedule, transfer, lookup CRM via tools (Vapi, LiveKit)
6. **Post-call intelligence** — Auto-summarize call with diarization (Sarvam, Rev.ai, Deepgram)
7. **Voice cloning** — Custom voice for brand consistency (Wati, Resemble AI)
8. **Multi-channel memory** — Bot remembers context across chat, voice, and other channels (Wati, respond.io)

### 6.3 Feature Comparison Matrix

| Feature | Samyoj | Respond.io | Wati | Vapi |
|---------|--------|-----------|------|------|
| AI answers voice calls | ✅ (Sarvam) | ✅ | ✅ | ✅ |
| Live transfer to human | ⚠️ (cold ring only) | ✅ (warm) | ✅ | ✅ (warm) |
| Barge-in support | ❌ | ✅ | ✅ | ✅ |
| Real-time streaming | ❌ (full LLM wait) | ✅ | ✅ | ✅ |
| Post-call summary | ❌ | ✅ | ✅ | ✅ |
| Transcript in chat | ⚠️ (Calls only) | ✅ (unified) | ✅ | ✅ |
| Voice clone | ❌ | ✅ | ✅ | ✅ |
| Multi-channel memory | ⚠️ (same bot) | ✅ | ✅ | ✅ |
| One setup for chat+voice | ✅ | ⚠️ | ✅ | ⚠️ |
| Permission UX for outbound | ⚠️ | ✅ | ✅ | ✅ |
| India-first Indic quality | ✅ (Sarvam) | ❌ | ⚠️ | ❌ |

---

## 7. User Perspective — How Operators & Customers Want the Companion

### 7.1 Operator Personas

#### Sarah — Support Team Lead (Support Pro user)
- **Goal:** Reduce response time and agent workload
- **Wants:** A companion that handles 80% of support queries, escalates intelligently, works 24/7
- **Pain points:** Complex setup, unreliable handoffs, no context continuity between chat and phone
- **Key needs:**
  - Personality presets that match her brand voice (already provided: Friendly helper, Professional, Support Pro)
  - Easy training (FAQ, paste, PDF) without technical jargon
  - Clear handoff: AI says "let me note this for the team" + customer gets WhatsApp follow-up
  - Post-call summary to review missed context
  - Metrics: resolution rate, handoff rate, CSAT impact

#### Raj — Sales Owner (Sales Pro user)
- **Goal:** Convert more WhatsApp inquiries into sales
- **Wants:** A companion that qualifies leads, answers product questions, schedules demos
- **Pain points:** Missed inbound calls after hours, no follow-up automation
- **Key needs:**
  - Sales personality preset that's helpful but not pushy (already provided: Sales Pro)
  - Trigger keywords: "price", "demo", "custom", "buy now"
  - Schedule callback integration (needs real implementation, not theater)
  - Lead capture forms and CRM sync
  - After-hours: "I've noted this, someone will call back" + callback scheduling

### 7.2 Customer Journey — Calling the Companion

```
Customer → WhatsApp Business Profile → Taps "Call"
    ↓
WhatsApp → Meta Cloud API → Webhook "calls" field
    ↓
Samyoj webhook worker → Call processor → decideCallRoute
    ↓
RoutingMode = ai_then_agents (default):
    → AI auto-answer: AiVoiceCallSession starts immediately
    → Agent ring: CallRingModal → Accept/Decline

Customer: "Hi, I want to check my order status"
    ↓
Sarvam STT → transcript → generateBotReply(channel: 'voice')
    ↓
Companion: "Sure, may I have your order number?"
    (via Sarvam TTS through WebRTC bridge)

Customer: "Actually, I want to talk to a human"
    ↓
Handoff keywords detected + LLM tool call: request_human
    ↓
Companion: "Please hold — connecting you to our team…"
    → Ring agents via socket call:ring
    → Agent accepts → audio bridge swap
    → OR: all declined → "I've messaged our team, they'll reply on WhatsApp"
```

### 7.3 Customization Expectations

Operators expect to be able to customize:

| Customization | Current Support | Enhancement Need |
|---------------|----------------|-----------------|
| Tone/personality | ✅ Personality presets | Add more presets, custom tone slider |
| Business context | ✅ Business name, description | Add logo/voice sample |
| FAQ/training | ✅ FAQ/URL/PDF ingest | Better status, smarter retrieval |
| Voice/speaker | ✅ Sarvam speaker picker | Voice preview, clone option |
| Greeting | ✅ Configurable | Multi-language greetings |
| Handoff triggers | ✅ Keywords + message | LLM-based intent detection |
| After-hours | ✅ Configurable | Custom away messages |
| Business hours | ✅ Configurable | Timezone awareness |
| Post-call | ❌ | Auto-summary, follow-up message |
| Metrics | ✅ Analytics | Per-bot performance |

### 7.4 Pain Points Identified

1. **Setup complexity** — Too many technical fields (codec, SDP, vendor names) in primary UI
2. **Permission confusion** — Customers don't understand calling permissions; unclear UX
3. **Handoff reliability** — Voice handoff ends the call instead of live transfer
4. **Context loss** — No transcript in chat thread; agent sees no call context
5. **Voice quality** — Currently uses Deepgram (English-first) before Sarvam (Indic-first)
6. **No barge-in** — Customers can't interrupt the AI; feels robotic and slow
7. **No post-call** — No summary, no follow-up, no learning from calls
8. **Security concerns** — Raw PCM recordings, env secret residue in `.env.example`

---

## 8. Existing Features Assessment

### 8.1 What is Already Built (Complete Features)

| Feature | Status | Confidence |
|---------|--------|------------|
| ✅ Meta Cloud Calling enable/disable | Built | High |
| ✅ Inbound UIC AI answer loop | Built | High |
| ✅ Outbound BIC callback API | Built | Medium (media incomplete) |
| ✅ Call permission request (interactive) | Built | High |
| ✅ GET call_permissions preflight | Built | High |
| ✅ Call permission in Inbox UI | Built | Medium (status display) |
| ✅ Shared AiBot brain (chat + voice) | Built | High |
| ✅ Sarvam STT (Saaras v3) | Built | High |
| ✅ Sarvam TTS (Bulbul v3) | Built | High |
| ✅ Professional bots (Support Pro, Sales Pro) | Built | High |
| ✅ Agent ring modal (Accept/Decline) | Built | High |
| ✅ Call transcript in database | Built | High |
| ✅ Call event message in Inbox | Built | High |
| ✅ Post-call analytics API | Built | High |
| ✅ After-hours behavior | Built | High |
| ✅ Missed call WhatsApp follow-up | Built | High |
| ✅ Operator UX: Personality/Train redirects | Built | High |
| ✅ "Use for WhatsApp calls" toggle | Built | High |
| ✅ Agent availability tracking | Built | High |
| ✅ Org settings per-bot override | Built | High |

### 8.2 What is Partial / Incomplete

| Feature | Status | Gap | Priority |
|---------|--------|-----|----------|
| ⚠️ Outbound BIC media | Built (API) | Offer PC closed server-side; client ignores SDP answer | P0 |
| ⚠️ Live transfer | Partial | Can ring agents but agent SDP handoff incomplete | P0 |
| ⚠️ Inbox Call button | Live | Was disabled, now shows permission state | Done ✓ |
| ⚠️ Voice settings UI | Live | Settings saved but runtime reads env defaults sometimes | P1 |
| ⚠️ Handoff summary | Live | Can leak to customer WhatsApp (should be Inbox internal only) | P0 |
| ⚠️ Barge-in | Partial | STT blocked while TTS plays; no true interrupt | P1 |
| ⚠️ Sarvam chat brain | Not built | Chat still uses Azure OpenAI; Sarvam only for speech | P1 |
| ⚠️ Streaming LLM→TTS | Not built | Voice waits for full LLM before TTS (latency) | P1 |
| ⚠️ Call recording | Partial | Raw PCM, no encryption/TTL/ACL, consent default off | P2 |
| ⚠️ Warm transfer | Deferred | Phase D | P2 |
| ⚠️ DTMF/Keypad | Stub | Not used | P3 |
| ⚠️ SIP trunking | Not used | Meta optional scale path | P3 |
| ⚠️ Mute/Hold buttons | Stubs | UI disabled | P3 |
| ⚠️ @roamhq/wrtc bridge | Built | Unofficial; maintenance risk | P2 |
| ⚠️ STUN-only ICE | Built | No TURN server; fails behind strict NAT | P1 |
| ⚠️ In-memory AI sessions | Built | Multi-instance split-brain risk | P2 |

### 8.3 Production Readiness Scorecard

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
| **Overall** | **4/10** | Controlled pilot only — blockers must land first |

---

## 9. Enhancement Opportunities — Make It Better

### 9.1 UX Enhancements (Smooth Flow)

#### A. Simplify the Companion Setup Flow

**Current:** 8 steps across multiple pages
**Target:** 3 steps in <5 minutes

| Current Step | Streamlined |
|-------------|-------------|
| Connect WhatsApp | → Keep |
| Pick professional brain (Support Pro / Sales Pro) | → Make this the default first choice |
| Manual personality editing | → Use presets + 3 short fields only |
| Train separately | → Inline "Add your first 3 FAQs" during setup |
| Enable calling on Meta | → Wizard with guided steps |
| Settings → Calling (scatter settings) | → Single "Voice sound" picker in AI Bot flow |

#### B. Inline Voice Preview During Setup

Add a "Hear your AI" button in the AI Bot edit flow that plays the Sarvam TTS preview with the selected personality + voice. This lets operators **experience the companion before going live**.

#### C. Transcript-in-Chat Integration

Currently transcripts only appear in the Calls detail view. Enhance by:
- Posting call transcript as messages in the Inbox conversation thread
- AI call entries show as assistant messages; human entries as user messages
- Post-call summary as an internal note (agent-only)

#### D. Call Event Context in Inbox

When a call completes, show a compact summary card in the conversation thread:
- Duration, cost (for BIC), handler (AI/Human)
- "Open full call detail" link
- Quick-actions: "Send follow-up message", "Assign to me"

### 9.2 Conversation Flow Enhancements

#### A. Barge-in Support

**Current:** `speaking` flag blocks STT during TTS playback — no interrupt
**Enhancement:** Use streaming TTS + Sarvam `flush_signal` / `speech_start` for barge-in:
1. Stream TTS audio to bridge in chunks
2. Listen for voice activity in the STT stream simultaneously
3. On interrupt: stop TTS playback, close TTS socket, resume STT
4. Restart AI reply after customer finishes

#### B. Real-time LLM Streaming

**Current:** Voice path waits for full LLM completion before TTS
**Enhancement:** Stream LLM output and chunk to TTS as sentences complete:
1. Use `streamSarvamChatCompletion` (already exists, unused)
2. Buffer by sentence boundaries
3. Pipe each sentence to Sarvam TTS as it arrives
4. Reduces perceived latency from ~2-4s to ~0.5-1s

#### C. Post-Call Intelligence Pipeline

After call termination:
1. Send full transcript to Sarvam batch STT (with diarization) for quality
2. Feed to LLM (Sarvam-105B) for:
   - **Summary** → internal note in conversation
   - **Action items** → extract and show to agent
   - **Sentiment** → positive/neutral/negative tag
   - **Topics** → auto-tag conversation
3. Send to analytics for bot training signals

### 9.3 Handoff Flow Enhancements

#### A. Cold Live Transfer (Phase C Target)

**Current:** Handoff speaks a message then terminates the call
**Enhancement:** True cold live transfer:

```
Customer → AI: "I want a human"
AI tool: request_human({ reason })

1. AI stops generating, plays hold message: "Please hold…"
2. Socket 'call:ring' → CallRingModal for ONLINE agents
3. Agent Accept:
   a. Get browser SDP answer via signaling
   b. Post to /calling/:id/accept
   c. Bridge swaps: AI audio → agent audio
   d. Stage shows: "Connected — AI brief" panel
4. Agent Decline / Timeout:
   a. AI plays: "I've messaged our team — they'll reply here"
   b. End call + assign to Inbox + WhatsApp follow-up
```

#### B. Handoff Summary → Inbox Only (Never Customer)

**Current bug:** `performHandoff` + `sendContext` in `automation/engine.ts` sends "AI Handoff Summary" to the customer's WhatsApp number.
**Fix:** Send summary only as:
- Internal note in the conversation thread (agent-only)
- Socket emission to the agent's view
- Agent sees summary before accepting the ring

#### C. Confidence-Based Handoff

Beyond keyword detection, use:
- Low confidence in knowledge base answer (>30% of replies have no KB match)
- Repeated questions from same customer
- Sentiment analysis (frustration detected)
- Explicit tool call: `request_human` from LLM

### 9.4 Settings & Configuration Enhancements

#### A. Separate STT/TTS Languages

**Current:** `sarvamSttLanguage` is used for both STT and TTS language (dual-purpose field)
**Enhancement:** Add `sarvamTtsLanguage` field:
- Customer speaks Hindi → STT in `hi` → reply in English → TTS in `en`
- Or customer speaks Hinglish → STT in `codemix` → reply in Hinglish → TTS in appropriate Indic language

#### B. Voice Customization Panel

In Calling Settings → Voice:
- Speaker picker (30+ Sarvam voices with preview)
- Language dropdown with flags
- Pace control (0.8x - 1.5x)
- Pitch control
- Code-mix toggle (for Hinglish regions)
- Preview audio button

#### C. Greeting Editor

- Text editor for `aiGreeting` and `consentMessage`
- Preview button (plays TTS of the greeting)
- Multi-language variant support
- Template suggestions ("Hi, this is [Name] from [Company]...")

### 9.5 Recording Enhancements

**Current:** Raw PCM under `uploads/calls`, consent default off
**Enhancement:**
1. **Consent flow:** Speak consent message → wait for customer to stay on line → record
2. **Encryption at rest:** AES-256 encrypt recordings before storage
3. **TTL-based deletion:** Auto-delete after 30/90 days (configurable)
4. **Access control:** Signed URL with expiry for playing recordings
5. **Recording indicator:** Visual "Recording" badge during call
6. **Opt-out:** Customer can say "stop recording" to disable

---

## 10. New Features to Add

### 10.1 Voice Cloning Studio

Let operators create a custom voice for their companion:
- Upload 5-10 minutes of sample audio
- Sarvam voice cloning API
- Preview + compare with stock voices
- Use for both chat (voice messages) and calls
- Premium feature (higher tier)

### 10.2 Conversation Continuity

**Problem:** Chat and voice are separate — companion doesn't remember across channels
**Solution:**
```
Call ends → transcript + summary stored in Conversation
Customer texts next day → "You called about your order yesterday..."
```
Implementation:
- Link calls to conversations via `conversationId` (already in Call model)
- When voice call ends, append summary as internal note to conversation
- Next chat message includes call summary in context via `botState`

### 10.3 Multi-Language Companion

For businesses serving customers in India:
- Detect language from customer's message (STT) or text (NLP)
- Respond in detected language (TTS)
- Auto-switch between languages mid-conversation
- Configure supported languages per bot

### 10.4 Agent Assist During Live Transfer

When an agent accepts a transferred call:
- **Real-time suggested replies** — AI suggestions based on transcript
- **Knowledge base peek** — instant access to relevant FAQs
- **Tone adjustment** — AI coach helps agent mirror customer sentiment
- **Next-best-action** — AI recommends next steps

### 10.5 Campaigns × Voice

**Outbound AI voice campaigns** — use the companion for proactive outreach:
- Select audience segment (tags, contact list)
- Choose companion bot + script
- Schedule (time zone aware)
- Track: delivered, connected, completed, outcomes
- Integration with Campaigns module (already exists for chat)

### 10.6 Companion Analytics Dashboard

Dedicated analytics for the companion:

| Metric | Description |
|--------|-------------|
| Resolution rate | % of conversations resolved without human |
| Handoff rate | % where customer asked for human |
| CSAT lift | Customer satisfaction before/after AI |
| Engagement | Average conversation length |
| Channel comparison | Chat vs voice performance |
| Knowledge gap | Top questions bot couldn't answer |
| Voice quality | STT confidence, transcription accuracy |

### 10.7 Companion API (for integrations)

Allow third-party systems to:
- Trigger the companion programmatically (e.g., CRM click-to-call)
- Send conversation context (customer history, preferences)
- Receive real-time transcript events
- Control bot behavior (e.g., force human handoff)

### 10.8 Companion A/B Testing

Let operators test different companion personalities:
- Variant A: Professional tone
- Variant B: Friendly tone
- Split traffic 50/50
- Measure engagement, resolution rate, CSAT
- Roll out winner

---

## 11. Features to Remove / Defer (Not Needed)

### 11.1 Defer / Hide from UI

| Feature | Why Remove/Defer | Recommendation |
|---------|-----------------|----------------|
| Warm transfer (Phase D) | Complex; needs consult rooms + LiveKit; not needed for MVP | Defer entirely |
| SIP trunking | Overkill for AI-answer-first; scale path only | Defer — document as advanced option |
| Voice clone studio | High cost, not SMB priority | Defer — Phase 2 |
| Dialer campaigns | Not SMB; compliance-heavy | Defer — outbound is BIC only for now |
| Agent headset softphone | Full SIP client too complex | Defer — ring modal is enough for Phase A/B |
| Mute / Hold / Keypad buttons | No clear use case for AI-first flows | Remove stubs from UI; add back if needed |
| Call hours Meta settings in UI | Too technical for most operators | Advanced-only setting |
| Provider status dots (Deepgram/Google) | Jargon in primary UI | Move to Settings → AI (developer section) |
| Insights rail in Calls rail panel | Duplicates header stats | Remove; header stats suffice |
| Long FAQ wall in setup | Steals attention after Ready | Move to Help panel in rail |

### 11.2 Clean Up Dead Code

- `CallOverviewPanel.tsx`, `CallSystemStatus.tsx`, `CallInfoPanel.tsx` — orphan components on disk, not mounted
- `botTemplates.ts` / `AiBotTemplatePicker.tsx` — dead code from prior "Start from" template cards (mentioned in git history)
- Legacy Deepgram + Google TTS code paths — keep as fallback but flag for deprecation

---

## 12. Production Hardening Checklist

Based on the production audit (4/10 → must reach 8/10):

### 12.1 Security & Tenancy (3/10 → 8/10)

| Issue | Fix |
|-------|-----|
| Non-unique `phoneNumberId` | Add `@@unique([phoneNumberId])` on `WhatsappNumber` + conflict check |
| `.env.example` secret residue | Redact all live keys in `.env.example`; rotate exposed keys |
| Raw PCM recordings | Encrypt at rest (AES-256) + TTL auto-delete + signed URL playback |
| Meta tokens in Redis | ✅ Already fixed — `PendingCallSignaling` stores only `whatsappNumberId` |
| Token encryption | Add `brainProvider` + encrypted `sarvamApiKeyEncrypted` to `OrgAiSettings` |

### 12.2 Compliance (5/10 → 8/10)

| Issue | Fix |
|-------|-----|
| Opt-out ignored | Add `contact.optedIn` check in AI reply path + missed-call path |
| Recording consent default off | Make consent explicit: speak message, wait for stay-on-line |
| Handoff summary to customer | Fix `performHandoff` to send summary only to Inbox internal note |
| DND/after-hours promise | Never promise live human outside hours; only WhatsApp follow-up |

### 12.3 Reliability (5/10 → 8/10)

| Issue | Fix |
|-------|-----|
| Fire-and-forget connect webhook | Make `handleCallConnect` async-awaited, idempotent lock |
| Redis fail-open (concurrent) | Atomic counter with DB fallback; fail-closed without Redis |
| Pending SDP TTL 60s vs ring 120s | Match TTL to ring timeout; extend if needed |
| In-memory AI sessions | Move to Redis-backed session store for multi-instance |
| Sarvam down mid-call | Graceful degradation: speak "I'm having trouble, message our team" + end |
| No streaming | Wire `streamSarvamChatCompletion` + chunked TTS for <2s reply latency |

### 12.4 Error Handling (5/10 → 8/10)

| Issue | Fix |
|-------|-----|
| Module logging | ✅ Exists — standardize error codes across modules |
| Webhook failures | Add retry with backoff + dead letter queue |
| Meta "API access blocked" | Surface as user-friendly error, not ops log only |
| Empty KB hallucination | Add hard refusal: "I don't know about that — let me connect you to a human" |

---

## 13. Implementation Roadmap

### Phase A — Outbound Fix + Permission UX (P0, ≤2 weeks)

| Task | Priority | Owner |
|------|----------|-------|
| Re-enable Inbox Call button | P0 | FE |
| Fix BIC media path: don't close offer PC, client attach answer | P0 | BE/FE |
| Call permission preflight in Inbox UI | P0 | FE/BE |
| Meta `reject` on agent Decline | P0 | BE |
| Pending SDP TTL ≥ ring timeout | P1 | BE |
| Friendly Meta prerequisite wizard | P1 | FE |

### Phase B — Sarvam Voice + Easy AI Setup (P0-P1, ≤3 weeks)

| Task | Priority | Owner |
|------|----------|-------|
| Wire SARVAM_API_KEY to chat brain (`createSarvamChatCompletion`) | P0 | BE |
| Add `brainProvider` to OrgAiSettings + Settings UI | P1 | BE/FE |
| Enable streaming LLM → TTS pipeline | P1 | BE |
| Barge-in: stop TTS on voice activity | P1 | BE |
| Personality presets write to `instructions` | P0 | FE |
| "Train" tab redesign with friendly copy | P1 | FE |
| Voice preview in AI Bot flow | P1 | FE/BE |
| Separate STT/TTS language fields | P1 | BE/FE |

### Phase C — Chosen Handoff (P0, ≤2 weeks)

| Task | Priority | Owner |
|------|----------|-------|
| Cold live transfer: hold → ring agents → bridge swap | P0 | BE/FE |
| `request_human` tool call emission from LLM | P0 | BE |
| Handoff summary → Inbox internal note (never customer) | P0 | BE |
| AI brief panel on Accept | P0 | FE |
| Auto-pause bot when agent sends message | P0 | BE |
| `schedule_callback` → real ticket/task creation | P1 | BE |
| WhatsApp follow-up after handoff | P0 | BE |

### Phase D — Post-Call Intelligence (P1, ≤2 weeks)

| Task | Priority | Owner |
|------|----------|-------|
| Sarvam batch STT + LLM summary after terminate | P1 | BE |
| Post-call summary → conversation internal note | P1 | BE |
| Action items extraction | P2 | BE |
| Sentiment + topic tagging | P2 | BE |

### Phase E — Polish & Scale (P2, ongoing)

| Task | Priority | Owner |
|------|----------|-------|
| Transcript in chat thread | P1 | BE/FE |
| Voice clone studio | P2 | BE/FE |
| A/B testing personalities | P2 | BE/FE |
| Companion analytics dashboard | P2 | FE |
| Warm transfer (LiveKit/SIP) | P2 | BE |
| Companion API for integrations | P2 | BE |

---

## 14. Priority Matrix

### P0 — Ship First (Blocks production / user value)

| # | Task | Impact | Effort |
|---|------|--------|--------|
| 1 | Fix handoff summary leak (customer WhatsApp) | 🔴 Critical | Small |
| 2 | Fix live transfer media (SDP handoff) | 🔴 Critical | Medium |
| 3 | Add `@@unique` on phoneNumberId | 🔴 Critical | Small |
| 4 | Compliance gate (opt-out in AI + missed path) | 🔴 Critical | Small |
| 5 | Auto-pause bot when agent sends message | 🟠 High | Small |
| 6 | Idempotent call connect + await handler | 🟠 High | Medium |
| 7 | Atomic concurrent call counter (fail-closed) | 🟠 High | Medium |
| 8 | Re-enable Inbox Call + permission UX | 🟠 High | Medium |
| 9 | Fix BIC media path (WebRTC) | 🟠 High | Medium |
| 10 | Sarvam chat brain switch | 🟠 High | Small |

### P1 — Ship Second (Enhances UX significantly)

| # | Task | Impact | Effort |
|---|------|--------|--------|
| 1 | Streaming LLM → TTS | 🟠 High | Medium |
| 2 | Barge-in support | 🟠 High | Medium |
| 3 | Cold live transfer | 🟠 High | Medium |
| 4 | Separate STT/TTS languages | 🟡 Medium | Small |
| 5 | Post-call summary | 🟡 Medium | Medium |
| 6 | Voice preview in AI Bot setup | 🟡 Medium | Small |
| 7 | Agent AI brief panel | 🟡 Medium | Small |
| 8 | Recording encryption + TTL | 🟡 Medium | Medium |

### P2 — Ship Third (Nice to have / advanced)

| # | Task | Impact | Effort |
|---|------|--------|--------|
| 1 | Voice clone studio | 🟢 Low | Large |
| 2 | Warm transfer (Phase D) | 🟢 Low | Large |
| 3 | A/B testing personalities | 🟢 Low | Medium |
| 4 | Companion analytics dashboard | 🟢 Low | Medium |
| 5 | Companion API for integrations | 🟢 Low | Large |

---

## 15. Meta Platform Connections — Every Detail

### 15.1 Webhook Fields

The companion requires these webhook fields subscribed on the Meta app:

| Field | Required | Companion Use |
|-------|----------|---------------|
| `messages` | ✅ | Chat messages → trigger AI reply |
| `calls` | ✅ | Voice call events → trigger AI answer |
| `message_template_statuses` | ✅ | Template approval status |
| `message_template_template_messages` | ⚠️ | Template usage stats |
| `account_review_update` | ⚠️ | WABA verification status |
| `payment` | ⚠️ | Billing (if applicable) |
| `security` | ✅ | App security notifications |

### 15.2 Call Permission Lifecycle

```
Operator initiates BIC from Inbox:
    ↓
1. GET /{phone-id}/call_permissions?user_wa_id={customer-phone}
   → Check if permission exists + not expired
    ↓
2. If NOT granted:
   → Send interactive call_permission_request message
   → Customer taps "Allow" in WhatsApp
   → Permission webhook fires (allow/deny/revoke)
    ↓
3. Permission granted → POST /calls with action: connect + SDP offer
   → Meta sends connect webhook with SDP answer
    ↓
4. Call status webhooks: RINGING → ACCEPTED → REJECTED → TERMINATED
```

**Permission TTL:** Short-lived — varies by customer behavior and Meta policies. Consecutive unanswered calls can revoke permission. Must re-check before each outbound.

### 15.3 Audio Codec Support

| Codec | Meta Support | Samyoj |
|-------|-------------|--------|
| OPUS (WebRTC) | ✅ Default | ✅ (via wrtc bridge) |
| G.711 (PCMA/PCMU) | ✅ 2026+ | ❌ (not exposed) |
| AAC | ❌ WebSocket | ❌ |
| MP3 | ❌ WebSocket | ❌ |

For Sarvam STT: prefer PCM/raw WAV, not MP3/AAC on WebSocket streams.

### 15.4 SDP Requirements

- **Format:** RFC-compliant WebRTC SDP
- **Codec:** OPUS (default), G.711 (optional)
- **ICE:** STUN (default), TURN (recommended for strict NAT)
- **DTLS-SRTP:** Required for media encryption
- **Sample rate:** 16000 Hz (default), 8000 Hz (telephony)

### 15.5 Enterprise Considerations

| Feature | Meta Support | Samyoj |
|---------|-------------|--------|
| SIP trunking | ✅ Alt to Graph WebRTC | ❌ (deferred) |
| IVR menu | ✅ via DTMF | ⚠️ (DTMF not used) |
| Call recording | ⚠️ (partner-side) | ⚠️ (raw PCM, no encryption) |
| Call monitoring | ⚠️ (agent assist) | ❌ |
| Quality of service | ⚠️ (priority routing) | ❌ |
| Multi-region | ✅ | ❌ |

---

## 16. Decision Record

| Decision | Choice | Why |
|----------|--------|-----|
| One brain or two? | **One AiBot** | Avoid double training; Inbox + Calls stay consistent |
| Where do operators edit personality? | **`/ai-bot`**, linked from Calls/Calling | No second bot editor in Calls |
| What does Sarvam do? | **Speech only** | India-first STT/TTS; LLM stays Azure/AiBot (short-term) |
| What does Calls Customize own? | Routing, greetings, hours, missed, voice sound, deep-links | Not Meta App secrets; not a second Train UI |
| Where do Live/Today/Missed live? | **Calls header** | Important metrics always visible; Insights rail removed |
| Voice speech stack | **Sarvam STT+TTS** default | Indic quality, Hinglish code-mix, 8kHz telephony |
| AI→human transfer | **Cold live transfer** + always Inbox assign + WhatsApp/schedule fallback | Friendly + reliable on current WebRTC stack |
| Bot setup UX | **Personality presets + Train + Try it** | No "system prompt" for non-technical users |
| Warm transfer | **Defer** to Phase D | Harder on current WebRTC; less reliable first ship |
| Sarvam chat brain | **Migrate Phase B** | One vendor, INR pricing, function calling for tools |
| Post-call summary | **Auto-generate** via Sarvam batch STT + LLM | Surface insights, never to customer |
| Call recording | **Encrypt + TTL + ACL** | Compliance (GDPR/data retention) |
| SIP trunking | **Defer** | Not needed for AI-answer-first; scale path only |

---

## 17. Success Metrics

### 17.1 Product Metrics

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| Inbound answer rate | ~80% | >95% | % of inbound calls answered by AI or agent |
| Outbound connect rate | <50% | >80% | After permission request, % of calls that connect |
| Median AI reply latency | ~3-4s | <2s | End-to-end from STT final to TTS playback |
| AI resolution rate | Unknown | >60% | % of conversations resolved without human |
| Handoff success rate | <50% | >85% | % of handoff requests that reach a human |
| ≤2 clicks for key actions | Partial | 100% | Accept/End/Open chat/Call |
| Bot setup time | ~15 min | <5 min | New org reaches "bot can answer FAQ" |

### 17.2 Technical Metrics

| Metric | Target |
|--------|--------|
| Call connect error rate | <1% |
| Transcript accuracy (STT) | >90% for English/Hindi, >80% for other Indic langs |
| TTS first-byte latency | <250ms |
| Post-call summary accuracy | >80% factual |
| Concurrent call handling | Scale to 100+ simultaneous |
| Recording encryption | 100% AES-256 |
| Opt-out compliance | 100% (no messages to opted-out) |

---

## 18. File & Connection Index

### 18.1 Companion Core Files

| Layer | File | Role |
|-------|------|------|
| **Shared Brain** | `server/src/modules/ai/chatbot.service.ts` | `generateBotReply()`, voice system rule |
| | `server/src/modules/ai/bot.service.ts` | `resolveBotForConversation`, `ensureDefaultBot` |
| | `server/src/modules/ai/knowledge.service.ts` | Train FAQ retrieval (RAG) |
| | `server/src/modules/ai/org-ai.service.ts` | `resolveAiConfig`, `recordAiUsage`, `checkOrgTokenQuota` |
| | `server/src/modules/ai/sarvam-chat.service.ts` | Sarvam-105B LLM |
| | `server/src/modules/ai/chat-completion.service.ts` | Completion facade |
| | `server/src/modules/ai/types.ts` | `BotChannelType`, `BotTone`, `BotPersonalityType` |
| | `server/src/modules/ai/routes.ts` | `/api/ai-bot/*` REST |
| **Voice Companion** | `server/src/modules/calling/ai-voice-agent.ts` | `AiVoiceCallSession` — voice body |
| | `server/src/modules/calling/sarvam.stt.ts` | Sarvam STT (ears) |
| | `server/src/modules/calling/sarvam.tts.ts` | Sarvam TTS (mouth) |
| | `server/src/modules/calling/meta-calling.service.ts` | Meta Graph Calling API |
| | `server/src/modules/calling/webrtc-bridge.ts` | @roamhq/wrtc audio bridge |
| | `server/src/modules/calling/call.processor.ts` | Webhook: calls field |
| | `server/src/modules/calling/routing.service.ts` | `decideCallRoute`, `resolveCallBot` |
| | `server/src/modules/calling/settings.service.ts` | CallingSettings service |
| | `server/src/modules/calling/types.ts` | `ActiveCallContext`, `CallWebhookEntry` |
| | `server/src/modules/calling/session-store.ts` | Redis session state |
| | `server/src/modules/calling/missed-call.service.ts` | Auto WhatsApp follow-up |
| | `server/src/modules/calling/routes.ts` | `/api/calling/*` REST |
| | `server/src/modules/calling/calling-settings.types.ts` | Settings interface |
| | `server/src/modules/calling/agent-call.service.ts` | Agent accept/decline bridge |
| | `server/src/modules/calling/analytics.ts` | Call analytics |
| | `server/src/modules/calling/call-event-message.ts` | Call event in chat |
| **Automation** | `server/src/modules/automation/engine.ts` | Routes to bot + automations |
| | `server/src/modules/automation/flows/*` | Visual flow builder |
| **Frontend** | `client/src/pages/AiBotPage.tsx` | AI Bot management (Personality/Train/Connect) |
| | `client/src/pages/CallsPage.tsx` | Call list + detail |
| | `client/src/components/calls/*` | All call components (list, detail, ring, settings) |
| | `client/src/components/inbox/ChatHeader.tsx` | Call button from chat |
| | `client/src/components/inbox/useConversationActions.ts` | Inbox Call + permission action |
| | `client/src/services/api.ts` | `aiBotApi` + `callingApi` |
| **Database** | `server/prisma/schema.prisma` | `AiBot`, `KnowledgeBaseItem`, `Call`, `Conversation`, etc. |

### 18.2 Meta API Endpoints Used

| Method | Endpoint | Companion Purpose |
|--------|----------|------------------|
| POST | `/{phone-id}/calls` | Connect, pre_accept, accept, reject, terminate |
| GET | `/{phone-id}/settings` | Check/modify calling status |
| POST | `/{phone-id}/settings` | Enable/disable calling |
| POST | `/{phone-id}/settings` | Set call_icon_visibility, callback_permission_status |
| GET | `/{phone-id}/call_permissions?user_wa_id=` | Check outbound call permission |
| POST | `/messages` | Send call_permission_request message |
| Webhook | `calls` field | Receive call connect/terminate events |

### 18.3 Sarvam API Endpoints Used

| Method | Endpoint | Companion Purpose |
|--------|----------|------------------|
| POST | `/v1/chat/completions` | LLM brain (planned Sarvam, currently Azure) |
| WS | `wss://api.sarvam.ai/speech-to-text-realtime/ws` | Real-time STT (ears) |
| WS | `wss://api.sarvam.ai/text-to-speech/ws` | Streaming TTS (mouth) |
| POST | `/v1/text-to-speech` | REST TTS preview |

### 18.4 Environment Variables

```
# Sarvam Speech
SARVAM_API_KEY=           # API key for STT/TTS/chat
SARVAM_STT_LANGUAGE=      # Default STT language
SARVAM_STT_MODE=          # transcribe | codemix
SARVAM_TTS_SPEAKER=       # Default TTS voice (e.g., shubh)
SARVAM_TTS_LANGUAGE=      # Default TTS language
CALLING_VOICE_PROVIDER=   # sarvam | deepgram_google

# Azure OpenAI (currently the brain)
AZURE_OPENAI_DEPLOYMENT=
AZURE_OPENAI_ENDPOINT=
AZURE_OPENAI_KEY=
AZURE_OPENAI_API_VERSION=
AZURE_OPENAI_EMBEDDING_DEPLOYMENT=  # For RAG/knowledge retrieval
```

---

## 19. Conclusion

The Companion feature in Samyoj represents a sophisticated "one brain, two channels" architecture that is fundamentally sound but needs production hardening. The existing code demonstrates that the shared `AiBot` can already serve both WhatsApp chat and voice calls through a single `generateBotReply()` entry point, with Sarvam providing India-first speech I/O.

**The path to 100% is clear:**

1. **Phase A** — Ship the outbound fix (Inbox Call + permissions + BIC media + live transfer SDP) — removes the biggest trust gap
2. **Phase B** — Flip the brain to Sarvam + easy AI setup (personality presets + Train + Try it) — makes it India-first and no-code
3. **Phase C** — Ship the chosen cold live handoff — gives operators confidence the AI won't strand customers
4. **Phase D/E** — Post-call intelligence + polish (streaming, barge-in, analytics, recording security)

The biggest wins for the user experience are:
- **Trust:** Never say "connecting" unless a ring actually starts; always leave an Inbox assignment
- **Simplicity:** One setup → bot answers chat and calls; hide all telephony/SDK jargon
- **Reliability:** Fix handoff summary leak, concurrent call limit, opt-out compliance
- **Latency:** Stream LLM→TTS, add barge-in, aim for <2s reply time
- **Context:** Transcripts in chat, post-call summaries, conversation continuity

The companion is already 70% of the way to a world-class AI voice agent. The remaining 30% is about **polish, honesty, and reliability** — not new invention.

---

*This document was compiled from code analysis of the Samyoj codebase (server + client), Prisma schema, and existing research documentation. It synthesizes findings from `CALLS_SHIP_DOCUMENT.md`, `CALLS_AI_BOT_CONNECTION_REPORT.md`, `CALLS_AI_BOT_PRODUCTION_AUDIT_2026-08-08.md`, `SARVAM_AS_AI_BRAIN.md`, `SARVAM_BRAIN_IMPLEMENTATION_BLUEPRINT.md`, `AUDIT.md`, `calls-content-poc.md`, and all source files in `server/src/modules/ai/`, `server/src/modules/calling/`, `server/src/modules/automation/`, `client/src/pages/AiBotPage.tsx`, `client/src/pages/CallsPage.tsx`, `client/src/components/calls/*`, and `client/src/components/inbox/*`.*
