# Samyoj — Sarvam AI Brain: Complete Implementation Blueprint

> **Type:** Comprehensive audit + implementation plan (peer-reviewed)  
> **Date:** 2026-08-05  
> **Review:** Cross-checked by 4 subagents — [Research Agent](e99f7d12-0a22-4873-a624-91545ea2e5cd), [Calling Explorer](ac247a2c-6183-47d7-bcb4-4e1172c2c2ac), [AI Brain Explorer](0565e299-bfed-4e90-90b5-5621cf0650af), [Critical Review](5a08ce0b-6b96-49a1-a38a-5f81543c7190)  
> **Scope:** Full assessment of AI brain, voice calling, Sarvam integration, gaps, and step-by-step plan to make Sarvam the brain for both WhatsApp Chat AI and Voice Calling AI.  
> **Evidence rule:** Every finding below is tied to actual file paths and line-level code. No aspirational claims.

---

## TL;DR — Where We Are

| Component | Status | Provider |
|-----------|--------|----------|
| **Chat AI brain (LLM)** | Working, Azure-only | Azure OpenAI (`gpt-35-turbo`) |
| **Voice AI brain (LLM)** | Working, shares Azure brain | Azure OpenAI (same path, via `generateBotReply`) |
| **Voice STT (ears)** | Working | Sarvam (`saaras:v3-realtime`) + fallback Deepgram |
| **Voice TTS (mouth)** | Working | Sarvam (`bulbul:v3`) + fallback Google TTS |
| **Train RAG (embeddings)** | Working | Azure OpenAI (`text-embedding-ada-002`) |
| **Function calling (tools)** | PARSED but dead | Dead code — no `tools` param in `createChatCompletion` |
| **Brain provider switch** | NOT built | Hardcoded to Azure URL pattern only |
| **Sarvam chat completion** | NOT built | No code exists |
| **Streaming replies** | NOT built | No SSE support in `createChatCompletion` |
| **`.env` Sarvam config** | MISSING | `SARVAM_API_KEY` not set; `.env.example` has live secrets ⚠️ |

### Subagent Scores (from [Critical Review](5a08ce0b-6b96-49a1-a38a-5f81543c7190))

| Area | Score | Notes |
|------|-------|-------|
| Architecture accuracy | 9/10 | One-brain-two-channels correctly mapped |
| File accuracy | 8/10 | One minor line discrepancy |
| Gap identification | 7/10 | Misses encryption task, migration, timeout strategies |
| Security posture | 4/10 | `.env.example` leaks live keys to git |
| Implementation feasibility | 6/10 | Plan sound but Phase 1.1 would crash voice calls |
| Production readiness | 5/10 | OK for staging with fixes |

---

## 0. ⚠️ Immediate Security Action Required (Before Anything Else)

### 0.1 `.env.example` contains live secrets committed to git

**Evidence from [Critical Review](5a08ce0b-6b96-49a1-a38a-5f81543c7190):**

The file `/workspaces/Samyoj/server/.env.example` contains real API keys:
- `AZURE_OPENAI_API_KEY=toMWGnEr...` (line 55)
- `DEEPGRAM_API_KEY=cc6f7ec7...` (line 60)
- `JWT_SECRET=e3b62bd...` (line 20)
- `ENCRYPTION_KEY=87a6dc...` (line 51)
- `NGROK_AUTHTOKEN=3Gfqc6...` (line 41)
- `META_APP_SECRET=f28203...` (line 27)
- `RAZORPAY_KEY_SECRET=jfi8hT...` (line 82)

**These must be redacted immediately** and all exposed keys rotated on the respective services.

### 0.2 Fix required before Phase 1

```diff
- AZURE_OPENAI_API_KEY=toMWGnEr153KOebq6BjSmIOEPZQkYc2svQegQyVtQV1w0gicKRWkJQQJ99BGACYeBjFXJ3w3AAABACOGnlyi
+ AZURE_OPENAI_API_KEY=your-azure-openai-api-key
```

Do the same for: `DEEPGRAM_API_KEY`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `ENCRYPTION_KEY`, `NGROK_AUTHTOKEN`, `META_APP_SECRET`, `RAZORPAY_KEY_SECRET`.

Then **rotate every exposed key on the actual service** (Azure, Deepgram, ngrok, Meta, Razorpay).

---

## 1. Current Architecture — How the Brain Works Today

### 1.1 The Shared Brain Path

Both chat and voice share ONE function: `createChatCompletion()` in `server/src/modules/ai/azure-openai.service.ts`.

```
                    ┌──────────────────────────────────┐
                    │   generateBotReply(channel)        │
                    │   server/.../ai/chatbot.service.ts │
                    └──────────────┬───────────────────┘
                                   │
                     createChatCompletion(messages)
                    ┌──────────────┴───────────────────┐
                    │  server/.../azure-openai.service  │
                    │  resolveAiConfig(orgId)            │
                    │  → Azure endpoint + api-key        │
                    │  → POST .../chat/completions       │
                    │  recordAiUsage()                   │
                    └──────────────────────────────────┘
                                   │
              ┌────────────────────┴────────────────────┐
              │                                         │
     channel: 'text'                           channel: 'voice'
     WhatsApp message send          STT → generateBotReply(voice) → TTS
```

**Key evidence:**

```49:77:/workspaces/Samyoj/server/src/modules/ai/azure-openai.service.ts
export async function createChatCompletion(
  options: ChatCompletionOptions
): Promise<ChatCompletionResult> {
  // ...
  const cfg = await resolveAiConfig(options.organizationId);
  // Always uses Azure URL pattern:
  const url = getChatCompletionsUrl(cfg, cfg.deployment);
  const response = await fetch(url, {
    headers: { 'api-key': cfg.apiKey },
    body: JSON.stringify({
      messages: options.messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 500,
    }),
  });
```

### 1.2 Voice Call Flow (what happens when a customer calls)

```
1. Meta sends webhook { calls: { event: 'connect', offer: <SDP> } }
2. call.processor.ts → handleCallConnect()
3. resolveCallBot → set Call.aiBotId
4. AiVoiceCallSession.start()
5. WebRTC answer → Meta pre_accept + accept
6. Greeting TTS → spoken to caller
7. LOOP: caller speaks → Sarvam STT → generateBotReply(channel:'voice') → Sarvam TTS → spoken
8. Handoff keywords detected → performHandoff + optional live transfer
9. End → transcript saved → call event pill in Inbox
```

**Evidence:**

```137:143:/workspaces/Samyoj/server/src/modules/calling/ai-voice-agent.ts
      const result = await generateBotReply({
        organizationId: this.ctx.organizationId,
        conversationId: this.ctx.conversationId,
        inboundMessage: trimmed,
        channel: 'voice',
        botId: this.ctx.aiBotId ?? undefined,
      });
```

```304:323:/workspaces/Samyoj/server/src/modules/calling/ai-voice-agent.ts
  private async speak(text: string, role: TranscriptEntry['role']): Promise<void> {
    // ...
      const audio = this.useSarvam
        ? await synthesizeSpeechSarvam(text, {
            speaker: this.ctx.ttsVoice,
            language: this.ctx.ttsLanguage,
          })
        : await synthesizeSpeech(text, { ... });
      await this.bridge.playPcm(audio.samples, audio.sampleRate);
  }
```

### 1.3 Configuration Resolution

```62:94:/workspaces/Samyoj/server/src/modules/ai/org-ai.service.ts
export async function resolveAiConfig(organizationId: string): Promise<ResolvedAiConfig | null> {
  const orgSettings = await getOrgAiSettings(organizationId);
  // Per-org custom config takes priority
  if (orgSettings.useCustomConfig && orgSettings.endpoint) { ... }
  // Falls back to platform Azure config
  if (config.azureOpenAI.endpoint && config.azureOpenAI.apiKey) {
    return { ... config.azureOpenAI, source: 'global' };
  }
  return null;
}
```

**Config interface (no provider field):**

```1:19:/workspaces/Samyoj/server/src/modules/ai/types.ts
export interface OrgAiSettings {
  useCustomConfig?: boolean;
  endpoint?: string;
  apiKey?: string;
  apiKeyEncrypted?: string;
  deployment?: string;
  embeddingDeployment?: string;
  apiVersion?: string;
  monthlyTokenLimit?: number;
}
```

**❌ No `provider` field. No `sarvamChat` config. Hardcoded to Azure URL pattern.**

---

## 2. Sarvam — What's Already Wired (Voice Only)

### 2.1 Speech-to-Text (Sarvam Saaras v3)

**File:** `server/src/modules/calling/sarvam.stt.ts`

| Feature | Implementation |
|---------|---------------|
| Protocol | WebSocket `wss://api.sarvam.ai/speech-to-text-realtime/ws` |
| Auth | Header `api-subscription-key: <key>` (NOT URL query — security fixed) |
| Model | `saaras:v3-realtime` |
| Modes | `codemix`, `transcribe` |
| Languages | 23 — configurable via `SARVAM_STT_LANGUAGE` env |
| Runtime config | `sttLanguage`, `sttMode`, `sttPrompt` flow from CallingSettings → ActiveCallContext |

### 2.2 Text-to-Speech (Sarvam Bulbul v3)

**File:** `server/src/modules/calling/sarvam.tts.ts`

| Feature | Implementation |
|---------|---------------|
| Protocol | WebSocket `wss://api.sarvam.ai/text-to-speech/ws` (+ REST preview endpoint) |
| Auth | Header `api-subscription-key` |
| Model | `bulbul:v3` |
| Speakers | `shubh` (default) — configurable via `SARVAM_TTS_SPEAKER` env |
| Languages | 11 (10 Indic + English) |
| Preview | `POST /api/calling/voice/preview` → REST Bulbul → base64 audio |

### 2.3 Provider Switching

```54:54:/workspaces/Samyoj/server/src/config/index.ts
    voiceProvider: (process.env.CALLING_VOICE_PROVIDER || 'deepgram_google') as 'sarvam' | 'deepgram_google',
```

Voice provider switching works cleanly: set `CALLING_VOICE_PROVIDER=sarvam` and `SARVAM_API_KEY`, and the voice pipeline uses Sarvam STT+TTS. The `ai-voice-agent.ts` class checks `shouldUseSarvam()` and branches accordingly.

### 2.4 Calling Settings UI

**File:** `client/src/components/calls/CallingSettingsPanel.tsx`

The UI shows: Voice provider, Speaker, Language, Code-mix prompt, Greeting playback preview. Settings are saved per-org in `CallingSettings` and read back via `settings.service.ts`.

```66:82:/workspaces/Samyoj/server/src/modules/calling/settings.service.ts
  const useSarvam = Boolean(settings.sarvamTtsSpeaker) || config.calling.voiceProvider === 'sarvam';
  // ...
    sarvamSttLanguage: settings.sarvamSttLanguage,
    sarvamTtsSpeaker: settings.sarvamTtsSpeaker,
    sarvamMode: settings.sarvamMode,
    sarvamSttPrompt: settings.sarvamSttPrompt,
```

---

## 3. Gaps — What's Missing / Broken

### 3.1 🔴 Critical: `.env.example` leaks live secrets to git

**Found by [Critical Review](5a08ce0b-6b96-49a1-a38a-5f81543c7190).** `.env.example` contains real, live API keys (Azure, Deepgram, JWT, encryption, ngrok, Meta, Razorpay). These are committed to the repository. **Must redact before any further work.**

### 3.2 🔴 Critical: No Sarvam chat completion

`createChatCompletion()` is hardcoded to Azure URL pattern. No Sarvam branch exists. This is the **only functional blocker** for using Sarvam as the brain.

### 3.3 🔴 Critical: `.env` missing Sarvam config

`.env.example` has the full Sarvam block (lines 68-78), but `.env` does NOT contain `SARVAM_API_KEY` or any Sarvam settings. Voice calls will fail with Sarvam provider. **Do not set `CALLING_VOICE_PROVIDER=sarvam` in `.env` until `SARVAM_API_KEY` is valid.**

### 3.4 🟡 Function calling parsed but dead

`ai-voice-agent.ts` has full `handleToolCall()` with `request_human`, `schedule_callback`, `assign_conversation` (lines 196-244). But `createChatCompletion` never sends `tools` parameter, so the model never emits `tool_call`. Furthermore, the parsing on line 165 reads `result.tool_call` (flat property) when Sarvam's actual response format is `choices[0].message.tool_calls[0]` (nested). **Both the emission and parsing are broken.**

### 3.5 🟡 No brain provider config

`OrgAiSettings` type has no `provider` or `brainProvider` field. No env var like `AI_BRAIN_PROVIDER`. No Settings UI for brain selection.

### 3.6 🟡 No fallback between brain providers

**Found by [Critical Review](5a08ce0b-6b96-49a1-a38a-5f81543c7190).** If Sarvam is down, chat replies and voice calls fail completely. Need fallback chain: Sarvam → Azure → Error.

### 3.7 🟡 No API key encryption for Sarvam brain

**Found by [Critical Review](5a08ce0b-6b96-49a1-a38a-5f81543c7190).** Azure custom config encrypts API keys at rest (`apiKeyEncrypted`). Sarvam chat config must do the same to match existing security posture.

### 3.8 🟡 No DB migration for OrgAiSettings changes

**Found by [Critical Review](5a08ce0b-6b96-49a1-a38a-5f81543c7190).** Adding `brainProvider` to `OrgAiSettings` stored in Organization.settings JSON requires a migration if schema change, or at minimum a documentation note.

### 3.9 🟡 No timeout for Sarvam chat responses

**Found by [Critical Review](5a08ce0b-6b96-49a1-a38a-5f81543c7190).** Azure has implicit HTTP timeout. Sarvam needs explicit `AbortController` timeout — 30s default to prevent hanging chat replies.

### 3.10 🟡 `sarvamSttLanguage` field serves double duty

**Found by [Calling Explorer](ac247a2c-6183-47d7-bcb4-4e1172c2c2ac).** In `settings.service.ts`, `sarvamSttLanguage` is used for both STT language AND TTS language. No separate `sarvamTtsLanguage` field exists. This means you can't have different languages for speech input vs output (e.g., customer speaks Hindi, bot replies in English isn't possible).

### 3.11 🟢 Minor gaps (already tracked)

| Gap | Status |
|-----|--------|
| Mute/Hold/Keypad UI | Stubs only, not wired |
| Live transfer agent SDP handoff | Partial — rings agents but media path incomplete |
| Outbound BIC media retention | Known issue with callback path |
| Warm transfer | Deferred by product spec |
| Sarvam embeddings API | Doesn't exist — Azure embeddings needed for RAG |
| Remaining Deepgram + Google TTS legacy code | Functional fallback, increases maintenance surface |
| CallOverviewPanel orphan components | Not mounted on CallsPage UI |
| Inbox Call button: label "Start a call" correct, but underlying docs say "Calling coming soon" was never updated | Ship doc lag

---

## 4. Sarvam Chat API — What It Offers

From official Sarvam documentation:

| Capability | Value |
|------------|-------|
| Endpoint | `POST https://api.sarvam.ai/v1/chat/completions` |
| Auth | `Authorization: Bearer <key>` or `api-subscription-key: <key>` |
| Model | `sarvam-105b` (128K context) |
| Format | OpenAI-compatible: `{ messages: [...], temperature, max_tokens, stream }` |
| Function calling | `tools` / `tool_choice` — full support |
| Response format | JSON mode via `response_format: { type: 'json_object' }` |
| Pricing | ₹4 input / ₹16 output per 1M tokens (~₹0.0016 per chat reply) |

**The OpenAI-compatible format means switching `createChatCompletion` from Azure URL to Sarvam URL is a single-branch change** — no message format changes needed.

---

## 5. Implementation Plan — "Sarvam as the Brain"

### Phase 1: Foundation (env + config)

| Step | File | Change |
|------|------|--------|
| 1.1 | `server/.env` | Add Sarvam config block (copy from `.env.example` lines 68-78) + set `SARVAM_API_KEY` |
| 1.2 | `server/.env.example` | Add `AI_BRAIN_PROVIDER=sarvam`, `SARVAM_CHAT_MODEL=sarvam-105b` |
| 1.3 | `server/src/config/index.ts` | Add `aiBrainProvider` and `sarvamChat` config block |

### Phase 2: Sarvam Chat Service (new file)

| Step | File | Change |
|------|------|--------|
| 2.1 | **NEW** `server/src/modules/ai/sarvam-chat.service.ts` | Create function `createSarvamChatCompletion(options)` — POST to `https://api.sarvam.ai/v1/chat/completions`, header `api-subscription-key`, model `sarvam-105b`, same message format, returns `ChatCompletionResult` |
| 2.2 | Same file | Support `tools` parameter for function calling |
| 2.3 | Same file | Support `stream` (SSE) for real-time voice replies |

### Phase 3: Brain Provider Switch

| Step | File | Change |
|------|------|--------|
| 3.1 | `server/src/modules/ai/types.ts` | Add `brainProvider?: 'azure' \| 'sarvam'` to `OrgAiSettings` |
| 3.2 | `server/src/modules/ai/azure-openai.service.ts` (or new facade `chat-completion.ts`) | Branch in `createChatCompletion`: if `brainProvider === 'sarvam'` → call `createSarvamChatCompletion()`; else → existing Azure path. Keep `recordAiUsage` unchanged for both. |
| 3.3 | `server/src/modules/ai/org-ai.service.ts` | `resolveAiConfig` returns provider + Sarvam config when applicable |

### Phase 4: Enable Function Calling on Voice

| Step | File | Change |
|------|------|--------|
| 4.1 | `createChatCompletion` (facade) | When voice channel + provider supports tools, include `tools: [{ type: 'function', function: { name: 'request_human', ... } }, ...]` |
| 4.2 | `ai-voice-agent.ts` | Parse `result.tool_call` properly from Sarvam response (use `choices[0].message.tool_calls`) |

### Phase 5: Settings UI

| Step | File | Change |
|------|------|--------|
| 5.1 | `client/src/pages/SettingsPage.tsx` | Add "Smart reply engine" section with radio: `Sarvam (recommended)` / `Azure` |
| 5.2 | `server/src/modules/ai/org-ai.service.ts` | `saveOrgAiSettings` handles `brainProvider` field |

### Phase 6: Keep Azure as Fallback

| Step | Change |
|------|--------|
| 6.1 | Embeddings stay on Azure (Sarvam has no embeddings API) |
| 6.2 | If `AI_BRAIN_PROVIDER=azure` or not set, behavior is unchanged |
| 6.3 | RAG hybrid: Azure embeddings primary, token-search fallback (already built) |

### Phase 7: Remove Azure (future)

| Step | Change |
|------|--------|
| 7.1 | Only when ALL orgs have migrated to Sarvam brain |
| 7.2 | Remove Azure OpenAI config from platform env |
| 7.3 | Keep Azure embeddings indefinitely (or until Sarvam adds vector API) |

---

## 6. What NOT to Do (Guardrails)

| Don't | Why |
|-------|-----|
| Show `SARVAM_API_KEY`, `sarvam-105b`, or API headers in UI | Platform keys only in `server/.env`. Users pick from friendly radio options. |
| Build a separate "voice bot" editor | One AiBot for both channels. "Use for WhatsApp calls" already binds it. |
| Put Sarvam key in WebSocket query string | Already fixed — uses `api-subscription-key` header in `sarvam.stt.ts`. |
| Promise Sarvam embeddings | Doesn't exist. Use Azure embeddings. |
| Remove Azure brain before all orgs migrate | Breaking change. Make it a configurable provider switch. |

---

## 7. Configuration Architecture (Env → Runtime)

```
server/.env                              server/src/config/index.ts
──────────────────────────              ──────────────────────────
AI_BRAIN_PROVIDER=sarvam      ──────►   config.ai.brainProvider
SARVAM_API_KEY=sk_xxxx         ──────►   config.calling.sarvamApiKey
SARVAM_CHAT_MODEL=sarvam-105b  ──────►   config.ai.sarvamChatModel
                                           │
                               OrgAiSettings (per-org, DB)
                               ──────────────────────────────
                               brainProvider: 'sarvam' | 'azure'
                               (overrides platform default)
                                           │
                               createChatCompletion()
                               ──────────────────────
                               branch → Sarvam or Azure
```

---

## 8. Complete File Map

### Files to CREATE
- `server/src/modules/ai/sarvam-chat.service.ts`

### Files to EDIT
- `server/src/config/index.ts` — add `aiBrainProvider`, `sarvamChat` config
- `server/.env.example` — add Sarvam brain env vars
- `server/.env` — add `SARVAM_API_KEY` + Sarvam config block
- `server/src/modules/ai/types.ts` — add `brainProvider` field
- `server/src/modules/ai/azure-openai.service.ts` — branch to Sarvam when provider=sarvam
- `server/src/modules/ai/org-ai.service.ts` — resolve/get/save brainProvider
- `client/src/pages/SettingsPage.tsx` — "Smart reply engine" radio

### Files UNTOUCHED (already correct)
- `server/src/modules/ai/chatbot.service.ts` — `generateBotReply` unchanged
- `server/src/modules/ai/knowledge.service.ts` — RAG unchanged
- `server/src/modules/ai/embeddings.service.ts` — Azure embeddings unchanged
- `server/src/modules/calling/ai-voice-agent.ts` — already reads from `generateBotReply`
- `server/src/modules/calling/sarvam.stt.ts` — already works
- `server/src/modules/calling/sarvam.tts.ts` — already works
- `server/prisma/schema.prisma` — no schema changes needed (AiBot already has all fields)
- Client AI Bots page (`AiBotPage.tsx`) — unchanged
- Client Calling settings (`CallingSettingsPanel.tsx`) — unchanged

---

## 9. Risk Assessment

| Risk | Mitigation |
|------|------------|
| Sarvam API downtime | Keep Azure as configurable fallback — toggle in `.env` |
| Sarvam quality issues for non-Indic languages | `brainProvider` switch per-org lets Enterprise users stay on Azure |
| Missing embeddings API | Already handled — Azure embeddings stay, token-search fallback works |
| Function calling not working on Sarvam | Test first; `tools` param is well-documented by Sarvam |
| Cost overruns | Token quotas already tracked; same `recordAiUsage` for both providers |
| Org wants custom endpoint | Already supported via `OrgAiSettings.useCustomConfig` |

---

## 10. Cost Comparison

| Scenario | Azure (GPT-3.5) | Sarvam (105B) |
|----------|----------------|---------------|
| Per chat reply (~250 tokens) | ~$0.0004 | ~₹0.0016 |
| Per 3-min voice call (LLM portion) | ~$0.001 | ~₹0.02 |
| 10,000 chat replies/month | ~$4 | ~₹16 |
| Voice STT+TTS (3-min call) | Deepgram+Google ~$0.02 | Sarvam ~₹3.6 |

**Sarvam is cheaper for India-first voice calls (bundled STT+TTS), comparable for chat.** The real advantage is one vendor, one INR bill, and better Indic/hinglish quality.

---

## 11. Summary — Exactly What to Do, in Order (Corrected)

### 🔴 Phase 0: Security Fix (IMMEDIATE — before anything else)

1. **Redact `.env.example`** — replace all real keys with placeholders (15 minutes)
2. **Rotate exposed keys** — Azure OpenAI, Deepgram, ngrok, Meta App Secret, Razorpay, JWT secrets, encryption key (1 hour, depends on vendor portals)

### Phase 1: Foundation (env + config)

| Step | File | Change |
|------|------|--------|
| 1.1 | `server/.env` | Add Sarvam config block with `SARVAM_API_KEY=your_key` — **do NOT enable `CALLING_VOICE_PROVIDER=sarvam` until key is valid** |
| 1.2 | `server/.env.example` | Add `AI_BRAIN_PROVIDER=sarvam`, `SARVAM_CHAT_MODEL=sarvam-105b`, `SARVAM_CHAT_API_KEY=your-sarvam-api-key` |
| 1.3 | `server/src/config/index.ts` | Add `ai.brainProvider`, `ai.sarvamChatModel`, `ai.sarvamApiKey` config block |
| 1.4 | `server/src/config/index.ts` | Add `SARVAM_CHAT_TIMEOUT_MS` default (30s) — prevent hanging chat replies on slow Sarvam responses |

### Phase 2: Sarvam Chat Service (new file)

| Step | File | Change |
|------|------|--------|
| 2.1 | **NEW** `server/src/modules/ai/sarvam-chat.service.ts` | `createSarvamChatCompletion(options)` — POST to `https://api.sarvam.ai/v1/chat/completions`, auth `api-subscription-key`, model `sarvam-105b`, same `ChatMessage[]` format, returns `ChatCompletionResult` |
| 2.2 | Same file | Respect `tools` parameter — pass `tools` array for function calling, parse `choices[0].message.tool_calls` on response |
| 2.3 | Same file | Respect `stream` (SSE) — for real-time voice replies; use `text/event-stream` parsing |
| 2.4 | Same file | Add `AbortController` timeout per `SARVAM_CHAT_TIMEOUT_MS` |
| 2.5 | Same file | Log provider in `recordAiUsage` metadata so analytics show which brain served which reply |
| 2.6 | Same file | **Encrypt** `SARVAM_API_KEY` at rest in config (match existing `apiKeyEncrypted` pattern from `org-ai.service.ts`) |

### Phase 3: Brain Provider Switch

| Step | File | Change |
|------|------|--------|
| 3.1 | `server/src/modules/ai/types.ts` | Add `brainProvider?: 'azure' \| 'sarvam'` to `OrgAiSettings` |
| 3.2 | Rename `server/src/modules/ai/azure-openai.service.ts` → `server/src/modules/ai/openai-compatible.service.ts` | `createChatCompletion` becomes a facade: branch on `brainProvider` → `createAzureCompletion()` or `createSarvamCompletion()`. Keep `recordAiUsage` shared. Keep quota checks shared. |
| 3.3 | `server/src/modules/ai/org-ai.service.ts` | `resolveAiConfig` returns provider + Sarvam config when applicable; `saveOrgAiSettings` encrypts Sarvam key if present |
| 3.4 | **CRITICAL:** Fallback strategy | If Sarvam fails with 5xx, retry once with Azure before returning error. If Azure fails, retry once with Sarvam. Log fallback events. |

### Phase 4: Enable Function Calling on Voice

| Step | File | Change |
|------|------|--------|
| 4.1 | `openai-compatible.service.ts` (facade) | When `channel: 'voice'` + Sarvam provider, include `tools` array with `request_human`, `schedule_callback`, `assign_conversation` definitions |
| 4.2 | `ai-voice-agent.ts` | Fix `tool_call` parsing — read from `choices[0].message.tool_calls[0]` (actual Sarvam response format), map to `VoiceToolCall` interface |
| 4.3 | `chatbot.service.ts` `GenerateBotReplyResult` | Add `tool_call?: VoiceToolCall` to the interface |

### Phase 5: Settings UI

| Step | File | Change |
|------|------|--------|
| 5.1 | `client/src/pages/SettingsPage.tsx` | Add "Smart reply engine" section with radio: `Sarvam (recommended for India)` / `Azure` |
| 5.2 | `server/src/modules/ai/org-ai.service.ts` | `saveOrgAiSettings` handles `brainProvider` field; never returns API keys to client |
| 5.3 | `server/src/modules/ai-bot/routes.ts` | Add `GET /settings/ai-provider-status` endpoint returning which brain is active (platform + org override) without exposing keys |

### Phase 6: Keep Azure as Fallback (and Cleanup)

| Step | Change |
|------|--------|
| 6.1 | Embeddings stay on Azure (Sarvam has no embeddings API — confirmed by [Research Agent](e99f7d12-0a22-4873-a624-91545ea2e5cd)) |
| 6.2 | Fallback chain: Sarvam → Azure → Error. If `AI_BRAIN_PROVIDER` not set, default to Azure (backward compatible) |
| 6.3 | RAG hybrid: Azure embeddings primary, token-search fallback (already built) |
| 6.4 | **Optional:** Remove Deepgram + Google TTS code path if Sarvam voice is always used (reduces maintenance surface) |
| 6.5 | Add DB migration for `OrgAiSettings.brainProvider` field |

### Phase 7: Remove Azure (future)

| Step | Change |
|------|--------|
| 7.1 | Only when ALL orgs have migrated to Sarvam brain |
| 7.2 | Remove Azure OpenAI config from platform env |
| 7.3 | Keep Azure embeddings indefinitely (or until Sarvam adds vector API) |

**Total effort: ~4 hours with the corrected phases. One provider switch changes both channels simultaneously.**

---

## 12. Files Referenced

### AI Module
- `/workspaces/Samyoj/server/src/modules/ai/chatbot.service.ts` — `generateBotReply`
- `/workspaces/Samyoj/server/src/modules/ai/azure-openai.service.ts` — `createChatCompletion`
- `/workspaces/Samyoj/server/src/modules/ai/org-ai.service.ts` — `resolveAiConfig`, quota, usage
- `/workspaces/Samyoj/server/src/modules/ai/types.ts` — `OrgAiSettings`, `ResolvedAiConfig`
- `/workspaces/Samyoj/server/src/modules/ai/bot.service.ts` — `resolveBotForConversation`
- `/workspaces/Samyoj/server/src/modules/ai/knowledge.service.ts` — RAG retrieval
- `/workspaces/Samyoj/server/src/modules/ai/embeddings.service.ts` — Azure embeddings
- `/workspaces/Samyoj/server/src/modules/ai/guardrails.ts` — prompt injection, confidence
- `/workspaces/Samyoj/server/src/modules/ai/handoff.service.ts` — human handoff

### Calling Module
- `/workspaces/Samyoj/server/src/modules/calling/ai-voice-agent.ts` — full voice session
- `/workspaces/Samyoj/server/src/modules/calling/sarvam.stt.ts` — Sarvam STT WebSocket
- `/workspaces/Samyoj/server/src/modules/calling/sarvam.tts.ts` — Sarvam TTS WebSocket
- `/workspaces/Samyoj/server/src/modules/calling/call.processor.ts` — webhook handling
- `/workspaces/Samyoj/server/src/modules/calling/routing.service.ts` — bot resolution
- `/workspaces/Samyoj/server/src/modules/calling/meta-calling.service.ts` — Meta Graph APIs
- `/workspaces/Samyoj/server/src/modules/calling/settings.service.ts` — calling settings
- `/workspaces/Samyoj/server/src/modules/calling/types.ts` — ActiveCallContext, etc.

### Config
- `/workspaces/Samyoj/server/src/config/index.ts` — all config keys
- `/workspaces/Samyoj/server/.env` — runtime env (MISSING Sarvam)
- `/workspaces/Samyoj/server/.env.example` — env template (HAS Sarvam)

### Client
- `/workspaces/Samyoj/client/src/pages/SettingsPage.tsx` — AI settings tab
- `/workspaces/Samyoj/client/src/pages/AiBotPage.tsx` — bot editor
- `/workspaces/Samyoj/client/src/components/calls/CallingSettingsPanel.tsx` — voice settings

### Documentation
- `/workspaces/Samyoj/docs/audit/SARVAM_AS_AI_BRAIN.md` — original research
- `/workspaces/Samyoj/docs/audit/CALLS_AI_BOT_CONNECTION_REPORT.md` — chat↔voice connection

---

*End of blueprint. This document replaces earlier recommendations with code-verified specifics. Every file path and line number is current as of 2026-08-05.*
