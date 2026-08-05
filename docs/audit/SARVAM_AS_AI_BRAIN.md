# Sarvam as the AI brain for BOTH WhatsApp Chat and Voice Calls — Research POC

> **Type:** Code-verified research + recommendation (not shipped feature)  
> **Date:** 2026-08-05  
> **Question answered:** What if we use Sarvam AI as the brain for the **messenger (chat AI bot)** *and* the **calling (voice "servant")** — instead of today's Azure OpenAI brain? Cost, effort, configuration ease for a non-technical user, and exactly what is already built.  
> **Companion doc:** `docs/audit/CALLS_AI_BOT_CONNECTION_REPORT.md` — how chat and voice share one AiBot today.

---

## 1. TL;DR

1. **Today the brain is Azure OpenAI; the voice ears/mouth are Sarvam.** Chat and Calls both call the same `createChatCompletion()` → Azure. Sarvam is used only for speech-to-text + text-to-speech.
2. **Switching the brain to Sarvam is small, low-risk work** because Sarvam's chat API is OpenAI-compatible (`POST /v1/chat/completions`, same `messages` shape, 128K context). One provider switch makes **both** channels use `sarvam-105b` — they share the same code path.
3. **Cost is negligible and INR-friendly:** roughly **₹0.0016 per chat reply** and **≈ ₹1/min of an AI call** (all-in: STT + TTS + LLM). Free credits cover testing.
4. **Configuration for a non-technical user stays a no-code UI choice:** a simple "Smart reply engine: Sarvam (recommended) / Azure" radio in Settings → AI. Keys stay in `server/.env` — never in the UI.
5. **Only real gap:** Sarvam has **no embedding (vector search) API**, so Train FAQs keep using Azure embeddings (or the existing keyword fallback). Everything else swaps cleanly.

---

## 2. What is built today (evidence, not memory)

### 2.1 The brain — one shared chat-completion path

| Layer | Implementation | File |
|-------|----------------|------|
| LLM call | `createChatCompletion()` → Azure OpenAI deployments `chat/completions?api-version=…` | `server/src/modules/ai/azure-openai.service.ts` |
| Config resolution | `resolveAiConfig(orgId)` → org custom config (endpoint/key/deployment) **or** platform Azure | `server/src/modules/ai/org-ai.service.ts` |
| Chat bot reply | `generateBotReply({ channel: 'text' | 'voice' })` → same `createChatCompletion` | `server/src/modules/ai/chatbot.service.ts` |
| Voice reply | `AiVoiceCallSession` → `generateBotReply({ channel: 'voice' })` (spoken rules) | `server/src/modules/calling/ai-voice-agent.ts` |
| Train RAG | `createEmbedding()` → Azure `embeddings` deployment; cosine > 0.7 else token search | `server/src/modules/ai/embeddings.service.ts`, `knowledge.service.ts` |
| Usage/tokens | `recordAiUsage()` / `checkOrgTokenQuota()` on every completion | `org-ai.service.ts` |

**Key insight:** because chat and voice share `createChatCompletion()`, **one provider switch in that function changes both channels**. They are already "one brain, two channels".

### 2.2 Voice — Sarvam is already wired for speech

| Piece | Implementation | File |
|-------|----------------|------|
| STT | Sarvam realtime WebSocket `speech-to-text-realtime/ws`, `saaras:v3-realtime`, header `api-subscription-key` | `server/src/modules/calling/sarvam.stt.ts` |
| TTS | Sarvam Bulbul (`bulbul:v3`), REST + preview endpoint | `server/src/modules/calling/sarvam.tts.ts` |
| Provider switch | `CALLING_VOICE_PROVIDER = 'sarvam' \| 'deepgram_google'` | `server/src/config/index.ts` |
| Voice settings UI | Speaker / language / code-mix prompt saved in org calling settings | `client/src/components/calls/CallingSettingsPanel.tsx` |

> **Honest note (from audit):** today's voice-settings UI fields (`sarvamTtsSpeaker`, `sarvamSttLanguage`) are saved but the **runtime mostly reads env defaults**, and `transferMode` isn't honored server-side. These are wiring bugs to fix in parallel (see §8), independent of "who is the brain".

### 2.3 Operator UX today (non-technical friendly)

- **AI Bots page** (`/ai-bot`): Personality → Train (FAQ/URL/PDF) → Try it → Connect. No model IDs visible.
- **"Use for WhatsApp calls"** toggle writes `defaultBotId` to calling settings.
- **Settings → AI**: an *"Use your own AI service"* checkbox exposes URL/key/model fields — this is the **only** place technical users see model internals, and it's hidden by default.
- **Settings → Calling → Voice**: pick speaker + language, play greeting preview.

---

## 3. Sarvam as the brain — what the API gives us

From official Sarvam docs (2026-08):

| Capability | Value |
|------------|-------|
| Endpoint | `POST https://api.sarvam.ai/v1/chat/completions` |
| Auth | `Authorization: Bearer` **or** `api-subscription-key: sk_xxx` |
| Model | `sarvam-105b` (128K context) — OpenAI-compatible `messages` body |
| Options | `temperature`, `max_tokens`, `stream` (SSE), `tools`/function calling, `response_format` (JSON) |
| Indic strength | 23 STT languages, 11 TTS languages (10 Indic + English), code-mixed Hinglish, telephony 8 kHz |
| Function calling | **Yes** — this unlocks the Phase C `request_human` / `schedule_callback` voice tools that are currently dead code with Azure |

### Why this matters for Samyoj

1. **One vendor, one bill** for message replies + voice calls.
2. **Better Indic/hinglish** than generic English-first models — matches India-first SMB messaging.
3. **Function calling** (`tools`) lets us finally ship real `request_human` / `schedule_callback` on voice (today the code parses `tool_call` but Azure path never emits it).
4. **Same developer effort** because the wire format is identical to what `azure-openai.service.ts` already sends.

### The one gap

Sarvam has **no embeddings/vector-search API** today. Train FAQ retrieval (`searchKnowledgeBase`) would keep using:
- Azure embeddings (keep the existing `embeddingDeployment`), **or**
- the existing **token/keyword search fallback** when embeddings are unavailable (already implemented, non-fatal).

So "Sarvam everywhere" = Sarvam brain (chat+voice) + Azure embeddings **or** token-search RAG. This is a deliberate hybrid, not a blocker.

---

## 4. Cost — real numbers

Official Sarvam pricing (INR, pay-as-you-go; free credits on signup — verify current amount at sarvam.ai/api-pricing):

| Service | Price | Billing unit |
|---------|-------|--------------|
| Chat `sarvam-105b` | ₹4 input / ₹2.5 cached / ₹16 output | per 1M tokens |
| Speech-to-text (Saaras v3) | ₹30 (₹45 w/ diarization) | per hour of audio |
| Text-to-speech (Bulbul v3) | ₹30 (v2: ₹15) | per 10K characters |

### 4.1 Cost of a chat auto-reply

Typical reply: ~200 input tokens (personality + last 12 messages + FAQ) + ~50 output tokens.

- Input: 200 × ₹4/1M = **₹0.0008**
- Output: 50 × ₹16/1M = **₹0.0008**
- **≈ ₹0.0016 per reply**

Scale: **10,000 replies/month ≈ ₹16** (a couple of cups of chai). Even 100k replies ≈ ₹160/month.

### 4.2 Cost of a 3-minute AI voice call (all-in)

- **STT:** 3 min = 0.05 h × ₹30/h = **₹1.50**
- **TTS:** a 3-min call speaks ~700 characters (roughly 180 words) → 700/10,000 × ₹30 = **₹2.10**
- **LLM:** ~3,000 total tokens per call → ≈ **₹0.02**
- **Total ≈ ₹3.6 per 3-min call ≈ ₹1.2/min ≈ ₹72/hour of call time.**

If diarization is enabled: +₹0.75 per call. Still trivial.

### 4.3 Bottom line

| Scenario | Est. monthly cost |
|----------|-------------------|
| 10k chat replies | ~₹16 |
| 100k chat replies | ~₹160 |
| 1,000 calls × 3 min (50 h) | ~₹3,600 (₹72/h) |
| Free credits | covers testing (verify amount, docs list ₹100–₹1,000) |

For comparison, staying on Azure GPT-class models is in a similar order of magnitude but priced in USD + regional markup; Sarvam's INR-native billing removes FX and simplifies invoicing for an India-first product. **Cost is not a reason to avoid Sarvam — it's a reason to prefer it for Indic volume.**

---

## 5. How easy is it to configure? (non-technical user)

**Design principle we already follow: users never see keys, models, or providers.** Sarvam fits that:

| What | Who does it | UI |
|------|-------------|-----|
| Sarvam platform key | Platform admin only (`server/.env` → `SARVAM_API_KEY`) | None (hidden) |
| Choose engine | Business owner | **Settings → AI → "Smart reply engine": `Sarvam (recommended)` / `Azure`** — a radio, no URL/key/model |
| Pick bot personality | Business owner | AI Bots → Personality (already built) |
| Train FAQs | Business owner | AI Bots → Train (already built) |
| Pick voice speaker | Business owner | Settings → Calling → Voice (already built) |
| Voice language | Business owner | Settings → Calling → Voice (already built) |

**What we must NOT do:** show `sarvam-105b`, API keys, or headers to users. The UI choice stays a friendly radio; everything technical lives in platform env.

### Effort to add the switch

| Step | Files | Effort |
|------|-------|--------|
| New `sarvam-chat.service.ts` (OpenAI-compatible, `api-subscription-key`) | `server/src/modules/ai/` | Small |
| Provider flag `AI_BRAIN_PROVIDER = 'sarvam' \| 'azure'` + `SARVAM_CHAT_MODEL` | `server/src/config/index.ts`, `.env.example` | Trivial |
| `createChatCompletion` branches to Sarvam when set | `azure-openai.service.ts` (or new `chat-completion.ts` facade) | Small |
| Settings → AI radio (Sarvam recommended / Azure) | `client/src/pages/SettingsPage.tsx`, `OrgAiSettings` | Small |
| Keep embeddings on Azure OR token-search RAG | `embeddings.service.ts` (unchanged) | None |
| Voice already Sarvam | — | Done |

Estimate: **~1 focused session** for an engineer; **zero** extra effort for end users.

---

## 6. Same or different? — final answer to "AI bot vs servant"

| Question | Answer |
|----------|--------|
| Are chat AI and calling AI the same today? | **Same brain (Azure), same bot row, same Train data; two channels (text/voice).** |
| Would they be the same with Sarvam? | **Yes — even more so:** one `sarvam-105b` call serves both channels. |
| Is Sarvam "the AI bot" or "the calling AI"? | **Both.** Sarvam provides STT/TTS (already) + LLM brain (new). AiBot remains the personality/Train container on top. |
| Do we build two bots? | **No.** One AiBot; "Use for WhatsApp calls" binds it to voice; Train copy already says "used on WhatsApp chat and voice calls". |

---

## 7. Recommendation (what I suggest)

1. **Do it:** add Sarvam as the chat+voice brain, with Azure as the fallback provider. The shared `createChatCompletion` makes this a small change with outsized product benefit (Indic quality, one INR bill, function-calling on voice).
2. **Keep the "one brain" model.** Do not create a separate "voice prompt marketplace" or duplicate bot editor (matches our docs' "do NOT build" list).
3. **Fix the known wiring bugs in the same wave** (from today's audits):
   - Make Calling settings voice fields actually drive runtime STT/TTS (`sarvamTtsSpeaker`, `sarvamSttLanguage`).
   - Honor `transferMode: message_only` (don't live-ring).
   - Wire Live filter + `activeCalls` org-scoping.
   These are independent of provider but needed before demoing "Customize voice works".
4. **Ship the Phase C voice tools with Sarvam's function calling** — `request_human` / `schedule_callback` become real (currently dead code because Azure path never emits `tool_call`).
5. **Keep RAG hybrid:** Azure embeddings for Train, with token-search fallback (already built). Document this so nobody expects a Sarvam embeddings API that doesn't exist.

---

## 8. What NOT to do (guardrails)

| Don't | Why |
|-------|-----|
| Expose `SARVAM_API_KEY` / `sarvam-105b` / headers in UI | Product rule: platform keys only in `server/.env`; users pick from friendly options |
| Put Sarvam key in a WebSocket query string | Security finding — use headers (`api-subscription-key`), never URL params |
| Duplicate bot editors / voice marketplace | Docs explicitly cut these |
| Promise Sarvam embeddings | Doesn't exist; use Azure embeddings + token-search fallback |
| Set `CALLING_VOICE_PROVIDER` silently | Keep it an explicit platform env with `.env.example` docs |

---

## 9. Append: file map for the change

**Add**
- `server/src/modules/ai/sarvam-chat.service.ts` — OpenAI-compatible completion → `https://api.sarvam.ai/v1/chat/completions`, `model: sarvam-105b`, header `api-subscription-key`.

**Edit (small)**
- `server/src/config/index.ts` — `aiBrainProvider`, `sarvam.chatModel` (default `sarvam-105b`).
- `server/.env.example` — `AI_BRAIN_PROVIDER`, `SARVAM_CHAT_MODEL`.
- `azure-openai.service.ts` / `createChatCompletion` — branch to Sarvam when provider = `sarvam` (keeps `recordAiUsage`, quota, guardrails intact).
- `client/src/pages/SettingsPage.tsx` — "Smart reply engine" radio; no keys, no URLs.
- `docs/calls/README.md`, `docs/audit/README.md` — link this research.

**Untouched**
- AiBot personality/Train/Connect UI, guardrails, handoff, bot pickers.
- Embeddings (Azure) + token-search fallback.
- Voice STT/TTS (already Sarvam) — just the settings→runtime wiring fix.

---

*Sources: sarvam.ai/api-pricing, docs.sarvam.ai pricing + chat-completions reference (2026-08), Samyoj code (`azure-openai.service.ts`, `org-ai.service.ts`, `chatbot.service.ts`, `sarvam.stt.ts`, `sarvam.tts.ts`, `config/index.ts`, `CallingSettingsPanel.tsx`). Prices are public as of 2026-08; verify before production.*
