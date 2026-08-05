# Samyoj Calls — Customize / Settings UX POC

**Type:** Documentation only (no implementation)  
**Role of mocks:** **Reference for patterns** — not a pixel-perfect rebuild  
**Audience:** Non-technical business owners (≤2 clicks for primary choices)  
**Companion docs:**  
- Empty / Calls shell: [`calls-content-poc.md`](calls-content-poc.md)  
- With-content live UI: [`calls-with-content-ui.md`](calls-with-content-ui.md)  
- Product / phases: [`../calls/CALLS_SHIP_DOCUMENT.md`](../calls/CALLS_SHIP_DOCUMENT.md) (§N personality/Train, §L handoff)  

**Date:** 2026-08-05  

**Mock references (patterns only):**

1. Customize shell — nav + “Who answers” cards + “How it works”  
2. Greeting & voice — message + speaker cards + preview  
3. Call behavior — row list of timeouts / handoff / toggles  

---

## 0. Intent

Make **existing** calling configuration understandable and friendly.  
Do **not** invent a second product surface or unnecessary features just because a mock shows them.

**Success:** A non-technical owner can answer “Who picks up my WhatsApp calls?” and “What do callers hear?” without reading Meta docs or seeing `routingMode` / SDP / provider names.

---

## 1. What exists today (audit)

### 1.1 Where settings live

| Surface | Path | What it is |
|---------|------|------------|
| Settings → Calling | `/settings` tab `calling` → `CallingSettingsPanel` | One long form: routing dropdown, bot select, timeouts, greeting, after hours, missed message, consent, Sarvam speaker/language, live-transfer toggles |
| Calls Customize rail | Planned / thin in Calls page | Icons only — not a full editor yet |
| AI Bots | `/ai-bot` | Personality / instructions / knowledge / handoff keywords (real bot brain) |

### 1.2 Fields we already persist (`CallingSettings`)

| Field | User meaning today | UI today |
|-------|--------------------|----------|
| `routingMode` | Who answers first | Dropdown: AI first / Agents first / AI only |
| `aiAutoAnswer` | AI can pick up | Checkbox |
| `defaultBotId` | Which bot | Dropdown + link to `/ai-bot` |
| `aiGreeting` | First spoken line | Textarea |
| `agentRingTimeoutSec` | How long to ring team | Number input |
| `maxConcurrentCalls` | Max simultaneous | Number input |
| `afterHoursMode` + message | Closed hours behavior | Select + textarea |
| `missedCallAutoMessage` + message | WhatsApp after miss | Checkbox + textarea |
| `recordingConsent*` | Consent line | Checkbox + textarea |
| `ttsVoice` / `ttsLanguage` / Sarvam fields | Voice sound | Partially exposed |
| `liveTransferEnabled` / `transferMode` | Connect to person | Checkbox + select (recent) |

### 1.3 Pain for non-technical users

1. **One wall of form** — routing + voice + after hours + consent mixed; no “one job per screen.”  
2. **Jargon** — “AI first (default)”, “Agents first, AI fallback”, “max concurrent”, provider names.  
3. **No “what happens next”** — changing Who answers doesn’t show a simple story.  
4. **Bot training is elsewhere** — personality/knowledge on `/ai-bot` but Calling form doesn’t guide that journey.  
5. **No preview** — greeting is text-only; user can’t hear it.  
6. **Duplicate mental models** — Settings tab vs Calls rail vs AI Bots.

---

## 2. Design patterns to borrow (from mocks — not pixel copy)

Use these **patterns** inside Samyoj’s existing visual language (Inbox green, `SettingsPanel`, soft cards):

| Pattern | Why it helps non-tech users | Apply how |
|---------|----------------------------|-----------|
| **Sectioned nav** (“Customize calls”) | One topic at a time | Left list of sections; not 12 unrelated fields on one scroll |
| **Big choice cards** (radio cards) | Decisions feel human | Who answers = 3 large cards, not a cramped `<select>` |
| **Recommended badge** | Removes fear of wrong choice | Mark AI Bot as Recommended when `ai_only` / AI-first is default |
| **Contextual “How it works”** | Explains without docs | Short 3–5 steps that update when selection changes |
| **Plain language labels** | No API enums | “AI Bot”, “Human agents”, “AI first, human backup” |
| **Tag chips** on cards | Instant mental model | e.g. “24/7”, “Business hours” |
| **Row layout for secondary knobs** | Scanable behavior list | Ring timeout / handoff fallback as icon + title + control rows |
| **Preview panel** | Trust before save | Greeting preview text (+ optional play when TTS available) |
| **Footer: Reset / Cancel / Save** | Familiar save ritual | Keep explicit Save (we already save on button — don’t force autosave unless product wants it) |
| **New / Beta badges sparingly** | Signal new capability | Only for Personality / Train deep-links or Bulbul when Sarvam ships |
| **Configuration guide card** | Onboarding | Reuse existing Calls setup checklist (4 steps) — don’t invent a new wizard product |

**Do not** copy: heavy multi-column marketing chrome, purple “New” spam, unrelated mock features (see §4).

---

## 3. Target IA — “Customize calls” (friendly shell)

### 3.1 Entry points (same config, two doors)

1. **Settings → Calling** — full Customize shell (primary for admins).  
2. **Calls page → Customize rail → Settings** — opens the **same** shell (slide-over or `/settings?tab=calling&section=who`) — one source of truth.

Never maintain two different editors.

### 3.2 Section list (map to existing only)

| Nav item | Maps to existing | Show by default? |
|----------|------------------|------------------|
| **Who answers** | `routingMode` + `aiAutoAnswer` + `defaultBotId` | Yes |
| **Call behavior** | Ring timeout, live transfer / human-ask fallback, max concurrent (advanced fold) | Yes |
| **Greetings** | `aiGreeting` (+ optional consent as sub) | Yes |
| **After hours** | `afterHoursMode` + `afterHoursMessage` | Yes |
| **Missed call reply** | `missedCallAutoMessage` + `missedCallMessage` | Yes |
| **Voice & language** | Sarvam/legacy speaker + language fields | Yes when voice ready |
| **AI Bot personality** | Deep-link to `/ai-bot` (Personality) — **not** a duplicate editor | Yes (badge optional) |
| **Training data** | Deep-link to `/ai-bot` (Train) | Yes (badge optional) |
| **Advanced** | Max concurrent, recording consent, raw TTS ids, provider — collapsed | Yes, last |

**Bulbul speaker:** Do **not** make a separate top-level nav forever. Fold into **Voice & language** (mock’s separate item is optional label only).  
**Meta & permissions:** Do **not** rebuild Meta admin here — link “Enable calling / Ask to call” to existing Calls setup + Inbox permission flows.

### 3.3 Layout pattern (desktop)

```
┌ Customize calls ──┬ Main section ────────────┬ How it works (optional) ┐
│ Nav sections      │ Title + plain subtitle   │ 3–5 steps for selection │
│ Guide card        │ Cards / rows / fields    │ Tips / Need help?       │
└───────────────────┴──────────────────────────┴─────────────────────────┘
┌ Reset default                    Cancel · Save changes                   ┐
```

**Mobile:** Section picker (list) → full-screen section → sticky Save. No three columns.

### 3.4 Click budget

| Task | Target clicks |
|------|----------------|
| Change who answers | 1 (tap card) + Save |
| Edit greeting | Open Greetings → edit → Save |
| Train bot | Open Training → lands on `/ai-bot` Train tab (already built) |
| After-hours message | Open After hours → edit → Save |

---

## 4. Feature triage (mock vs product)

### 4.1 Implement as UX improvement (genuine — we have or planned)

| Mock idea | Decision | Notes |
|-----------|----------|-------|
| Who answers as 3 cards | **Yes** | Map to `routingMode` (+ ensure `aiAutoAnswer` coherent) |
| How it works steps | **Yes** | Static copy per mode; no new API |
| Greeting textarea + Reset | **Yes** | Existing `aiGreeting` |
| Voice speaker cards | **Yes** | Existing Sarvam speaker / TTS voice fields — friendly names, no API keys |
| Language select | **Yes** | Existing language fields |
| Ring timeout row | **Yes** | `agentRingTimeoutSec` — presets 20/30/45/60s |
| After “human” / no agent available | **Yes** | Map to `liveTransferEnabled` + `transferMode` + existing handoff/missed paths — plain labels |
| After hours / Missed reply sections | **Yes** | Split out of mega-form |
| Link Personality / Train | **Yes** | Deep-link `/ai-bot` per §N |
| Setup / Configuration guide | **Yes** | Reuse Calls setup sheet checklist |
| Optional TTS preview “Play greeting” | **Yes if** voice stack configured | Calls existing TTS synthesize once; stub disabled if not |
| Post-call summary toggle | **Only when** Phase C summary ships | Don’t show dead control |

### 4.2 Do **not** implement (mock-only / new product / unnecessary)

| Mock idea | Why skip |
|-----------|----------|
| Schedule or book appointments toggle | New product surface; use Flows later if needed |
| Capture lead details toggle | New CRM capture product — out of Calls settings |
| Speaking speed / Voice tone / Response style dropdowns | Tone = Personality presets on `/ai-bot`; don’t add parallel knobs |
| “More voices – Browse all” marketplace | Overkill; 3–5 speakers enough |
| Autosave without Save | Conflicts with Cancel; keep Save unless product later chooses autosave |
| “View comparison” heavy modal | Optional later; How it works steps enough for v1 |
| Separate Meta & permissions admin inside Customize | Already in setup / WhatsApp connect |
| Pixel-identical purple New badges everywhere | Noise; one badge max per new deep-link |

### 4.3 Variables in greeting (`{{business_name}}`)

**Reasonable but optional:**

- If org already has business name in settings, support **1–2** tokens (`{{business_name}}`, maybe `{{contact_name}}` on outbound only).  
- If interpolation is not ready, **don’t** show variable chips — keep plain greeting text (current behavior).  
- Do not invent a template language UI.

---

## 5. Section specs (friendly copy + field map)

### 5.1 Who answers

**Title:** Who answers calls  
**Subtitle:** Choose who should handle incoming WhatsApp calls.

| Card | Maps to | Tags (copy) | Recommended? |
|------|---------|-------------|--------------|
| AI Bot ({bot name}) | `routingMode: ai_only` + `aiAutoAnswer: true` | 24/7 · Instant reply | Yes (default SMB) |
| Human agents | `routingMode: agents_first` (or ring-only when AI off) | Personal touch · When team online | |
| AI first, human backup | `routingMode: ai_then_agents` | Best of both · Smart handoff | |

**Honesty note for product:** Today `ai_then_agents` mostly means “AI answers” (agents ring mainly on `agents_first` or timeout). Copy must match **real** behavior — or fix routing in Phase A/B before promising “backup” falsely. Prefer:

- Card 3 copy: “AI answers first. If you turn on connect-to-person, callers can reach your team.”  
  until live transfer ships fully.

**Bot picker:** Under AI cards — “Which AI” select (`defaultBotId`) + link **Edit personality & training**.

**How it works (example for AI Bot):**

1. Call comes in  
2. AI answers and greets  
3. Talks using your training  
4. Can connect a person if you allow it  
5. Chat stays in Inbox  

### 5.2 Call behavior

**Title:** Call behavior  
**Subtitle:** Control what happens during and after the call.

Rows (existing fields only):

| Row label (friendly) | Control | Field |
|----------------------|---------|-------|
| Ring team for | Select 20 / 30 / 45 / 60s | `agentRingTimeoutSec` |
| When caller asks for a person | Connect live if online / Message on WhatsApp | `liveTransferEnabled` + `transferMode` |
| If no one is available | Bot continues / Send WhatsApp / Mark missed | Align with transfer + missed settings — don’t invent fourth mode |
| Max calls at once | Number (Advanced subsection) | `maxConcurrentCalls` |

**Preview flow** button: opens the same How-it-works / simple diagram — **no** new simulator backend.

Privacy box: one line + link to existing privacy/docs if any — optional; don’t invent compliance product.

### 5.3 Greetings

**Title:** Greeting & voice (or split Greeting vs Voice)

| Control | Field |
|---------|-------|
| Greeting message | `aiGreeting` |
| Reset to default | Restore `DEFAULT_CALLING_SETTINGS.aiGreeting` |
| Recording consent (secondary) | `recordingConsentEnabled` + message |

Optional: Play greeting (TTS) when voice configured.

### 5.4 After hours / Missed call reply

Unchanged fields; friendlier titles:

- After hours: “When you’re closed”  
- Missed: “If nobody answers”

### 5.5 Voice & language

| Control | Field |
|---------|-------|
| Language | `sarvamSttLanguage` / `ttsLanguage` |
| Speaker cards (3–5) | `sarvamTtsSpeaker` / `ttsVoice` |
| Mode (optional Advanced) | `sarvamMode` codemix |

No API keys. No Deepgram/Google names in primary UI.

### 5.6 AI Bot personality / Training data

**Not editors** — navigation cards:

- “Set how your AI speaks” → `/ai-bot` Personality  
- “Add FAQs and documents” → `/ai-bot` Train  

Copy: “Same AI for chat and calls.”

### 5.7 Advanced

Fold: max concurrent, consent, provider read-only status, dangerous resets.

---

## 6. Visual language (Samyoj, not mock clone)

| Token | Use |
|-------|-----|
| Active nav | Soft emerald wash + emerald icon (like Inbox active) |
| Recommended card | Emerald border + Recommended pill |
| Human card accent | Sky (already used for agents) |
| Hybrid card accent | Amber (soft) — optional |
| Primary Save | Existing green `AppButton` |
| Danger / reset | Ghost / secondary — confirm on Reset |
| Typography | Existing app font; section title ~18–20px bold; body 13–14px |
| Cards | `rounded-2xl`, light border — same as Inbox/Settings |

Avoid: violet as primary for Calling (align with green brand); neon badges; dense tables.

---

## 7. Mobile pattern

1. List of Customize sections (icons + titles).  
2. Tap section → stacked fields.  
3. Sticky **Save changes**.  
4. How it works → collapsible accordion under Who answers (not a third column).

---

## 8. Copy bank (plain language)

| Avoid | Prefer |
|-------|--------|
| routingMode / ai_then_agents | AI first, human backup |
| agentRingTimeoutSec | Ring team for |
| maxConcurrentCalls | Max calls at once (Advanced) |
| TTS / Bulbul / Saaras | Voice / Speaker / Language |
| Handoff keywords | When they ask for a person |
| SDP / WebRTC / Meta Graph | Never in Customize |

---

## 9. POC wireframes (text)

### 9.1 Who answers

```
Customize calls          Who answers calls              How it works
───────────────          ─────────────────              ────────────
● Who answers            Choose who handles…            1 Call comes in
  Call behavior          ┌─────────────────────┐        2 AI answers
  Greetings              │ ● AI Bot  Recommended│        3 Helps from training
  After hours            │   24/7 · Instant     │        4 Can connect person
  Missed reply           └─────────────────────┘        5 Inbox keeps chat
  Voice & language       ┌ Human agents ───────┐
  → Personality          ┌ AI first, backup ───┐
  → Training             Which AI: [ Support ▾ ]
  Advanced               Edit personality →
[ Guide: 4 steps ]
                         Reset · Cancel · Save
```

### 9.2 Call behavior (rows)

```
Ring team for          [ 30 seconds ▾ ]     Recommended 20–40s
When asks for person   [ Connect if online ▾ ]
If no one available    [ Message on WhatsApp ▾ ]
Max calls at once      [ 10 ]               (Advanced)
```

---

## 10. Implementation notes (when approved — not now)

1. Reshape `CallingSettingsPanel` into sectioned shell OR `CallsCustomizeShell` shared by Settings + Calls rail.  
2. Keep `callingApi.settings` / `updateSettings` — same payload.  
3. Coerce card selection → `{ routingMode, aiAutoAnswer }` consistently.  
4. Deep-links to `/ai-bot` with tab query if available.  
5. TTS preview: optional thin endpoint wrapping existing synthesize — only if voice ready.  
6. Fix or soften `ai_then_agents` copy until live transfer matches the story.

**Out of scope:** New appointment/lead products, voice marketplace, pixel clone of reference images.

---

## 11. Acceptance checklist (docs → future UI)

- [ ] Non-tech user can set Who answers in one card tap + Save  
- [ ] No Meta/provider jargon on primary sections  
- [ ] Personality / Train are links, not duplicated forms  
- [ ] Greeting / after hours / missed are separate clear sections  
- [ ] Mock-only features (appointments, lead capture, tone dropdowns) absent  
- [ ] Same Save model as today; Reset restores defaults with confirm  
- [ ] Mobile = section list → detail → sticky Save  
- [ ] How it works matches real routing behavior  

---

## 12. Relation to other docs

| Doc | Role |
|-----|------|
| This file | Friendly **Customize / Settings** UX POC |
| `calls-content-poc.md` | Calls page empty + rail entry |
| `calls-with-content-ui.md` | List + live stage |
| `CALLS_SHIP_DOCUMENT.md` §N / §L | Personality/Train + handoff product truth |
