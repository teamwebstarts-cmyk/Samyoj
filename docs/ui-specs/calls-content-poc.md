# Samyoj Calls — UI Design Documentation (Inbox-pattern)

**Scope:** Documentation-only UI redesign for `/calls` (+ ring modal + Inbox/Dashboard entry).  
**Do not invent a new theme.** Match Inbox + glass sidebar language already shipping.  
**Product/logic companion:** [`../calls/CALLS_SHIP_DOCUMENT.md`](../calls/CALLS_SHIP_DOCUMENT.md) (**v2.3** — chosen live handoff + easy personality/train)  
**Inbox content reference:** [`inbox-content-poc.md`](inbox-content-poc.md)  
**Also covers:** easy AI Bot personality + Train UX (§14) linked from Calls Customize.  
**With-content / live call pixel spec:** [`calls-with-content-ui.md`](calls-with-content-ui.md) (list rows, LIVE stage, mobile controls).

---

## 0. Design goal

Show **less, useful, necessary**. Default path ≤ **2 clicks**. Power options live under **Customize** (not on the homepage).

Primary question for every pixel: *Who is calling / who did we call, what’s the state, what’s the next action?*

---

## 1. Existing UI patterns to copy (from Inbox)

### 1.1 Layout DNA

Inbox desktop = **3 regions**: list | work stage | details rail (collapsed icons).  
Calls must use the **same DNA**, not a dashboard of cards.

```
Inbox today:
┌ Conversation list ┬ Chat thread + composer ┬ Details icons ┐

Calls target:
┌ Call list         ┬ Call stage (live/transcript) ┬ Customize icons ┐
```

### 1.2 Visual tokens (reuse — do not redefine)

| Token | Source / use |
|-------|----------------|
| Page shell | `PageShell` + `platform-gradient` / `platform-gradient-subtle` |
| Sidebar context | Glass rail already sets brand green `#0A8954` family |
| Typography | Existing app font (Plus Jakarta stack in index) — same sizes as Inbox headers (~13–14px rows, bold titles) |
| Row hover/active | Same as conversation list rows |
| Primary button | Existing green gradient Auth/AppButton style |
| Pills | Emerald Ready/Live; neutral Done; soft rose Missed/Failed |
| Radius | `rounded-xl` / `rounded-2xl` like Inbox cards |
| Shadows | Soft only; no multi-layer glow |
| Empty states | Same empty illustration density as Inbox placeholder tips (3 bullets max) |
| Glass tips | Reuse Inbox `ComposerGlassTip` / glass tip pattern for icon actions |

**Avoid:** purple themes, KPI walls, newspaper layouts, floating badges on hero media, “telecom admin” tables.

### 1.3 Interaction DNA from Inbox

- Search always in list header.  
- Chips for fast filters (not 5 dropdowns).  
- Deep link `/calls/:id` like `?conversation=`.  
- Mobile: **list XOR stage**.  
- Dangerous action (End call) needs clear primary destructive, not buried.  
- “Open chat” = first-class (parity with Respond.io context).

---

## 2. Audit of current Calls UI (what to remove from primary)

Today’s `CallsPage` stacks:

1. Heavy header (Ready + phone + Live/Today/Total)  
2. Setup progress / system status / info FAQ  
3. Analytics toggle  
4. Filters  
5. List + detail  

**Problem:** Looks like a status dashboard, not a work surface. Setup + FAQ steal attention after Ready.

**Rule:** If status === Ready, never show full setup/FAQ wall.

---

## 3. Target information architecture

### 3.1 Desktop (lg+)

```
┌─ Slim top bar ─────────────────────────────────────────────┐
│ Calls · Ready ✓ · 1555…              Live 1 · Today 3      │
├─ List (~300px) ─┬─ Stage (flex) ─────────────┬─ Rail 40px ─┤
│ Search          │ Header + actions           │ ⚙ 📊 ?      │
│ Chips           │ Transcript / live / empty  │ (expand)    │
│ Rows…           │ Notes                      │             │
└─────────────────┴────────────────────────────┴─────────────┘
```

### 3.2 Mobile

- Default: list.  
- Select: full-stage. Back returns to list.  
- Ring: full-screen sheet (existing modal polish).

### 3.3 Global (not page chrome)

| Surface | Behavior |
|---------|----------|
| `CallRingModal` | Accept / Decline only by default |
| Live dock (new) | Pill when navigating away during live call |
| Inbox header Call | Re-enable (remove “coming soon”) |
| Dashboard | One Quick Action “Voice calls” → `/calls` |

---

## 4. Region specs

### 4.1 Slim top bar

| Element | Spec |
|---------|------|
| Title | **Calls** |
| Status pill | `Ready` / `Setup needed` / `Offline` |
| Phone | Truncated business number |
| Counters | Only `Live` (if &gt;0) + `Today` — drop TOTAL from default |

**Enable calling** button only when Setup needed.

### 4.2 List

**Search:** `Search name or phone…` (Inbox copy rhythm).

**Chips:**

| Chip | Filter |
|------|--------|
| All | — |
| Live | RINGING, CONNECTING, CONNECTED |
| Missed | MISSED, REJECTED (unanswered) |
| AI | handler AI |
| Human | handler AGENT |
| Out | BUSINESS_INITIATED |

More filters (date, exact status) → overflow menu **Filters**.

**Row:**

- Avatar / initials  
- Name or phone  
- Direction · relative time  
- Status pill  
- Handler micro-label AI/Human  
- Transcript preview one line  

Live row: subtle pulse (opacity), not loud animation.

### 4.3 Stage

#### Empty (no selection)

3 tips max:

1. Answer rings from the banner.  
2. Open a call to read the transcript.  
3. Call back from Inbox when the customer allows calls.

#### Completed call

1. Header: name · phone · status · **Open chat** · More  
2. Meta strip one line: direction · duration · handler · time  
3. Transcript bubbles (customer left / business right — chat rhythm)  
4. Notes textarea + Save  

#### Live call

1. LIVE + elapsed timer  
2. Streaming transcript  
3. Actions: **End call** · Open chat · Transfer (Phase C; stub disabled OK)  
4. If AI→human transfer in progress: **Connecting human…** + reason from tool call (no extra buttons for agent until Accept)

### 4.3b AI→human transfer UX (Phase C — **chosen**, ship doc §L)

**Chosen:** cold live hold → ring ONLINE agents → WhatsApp/schedule if miss. Never fake “connecting”.

**Caller:** “Please hold — connecting you…” → human voice, **or** “I’ve noted this for our team — they’ll reply on WhatsApp.”

**Agent (≤2 clicks):** ring **Accept** / **Decline** → on Accept, stage shows **AI brief** (why + last lines) above live controls.

### 4.4 Right rail (Customize)

Collapsed icon rail like Inbox details:

| Icon | Panel content |
|------|----------------|
| Settings | Who answers (3 radios); **which AI** (`defaultBotId`); greeting; ring timeout; after hours; missed-call reply; voice language + speaker (Sarvam); **Connect to a person** (live if online / WhatsApp if busy); link **Edit personality & training** |
| Insights | Compact 30d: total, missed rate, AI vs human, avg duration — no giant charts |
| Help | 3 FAQs + “Meta checklist” link |

**Connect to a person** (plain controls — no “tool call” wording):

| Control | Default |
|---------|---------|
| When they ask for a person | Connect if team online |
| If team busy / after hours | Message on WhatsApp |
| Ring for | 30 seconds |

Default **collapsed**. Keys/codecs/providers never shown. Do **not** duplicate the full bot editor here — one deep-link to `/ai-bot`.

---

## 5. Setup sheet (first Ready only)

When not Ready, primary CTA opens sheet (not permanent page block):

1. WhatsApp connected  
2. Enable calling on Meta (button)  
3. **AI ready** — personality + ≥3 Train Q&As (link `/ai-bot`)  
4. Voice ready (“Voice sound” — no Deepgram/Google names)

On failure of Enable: show Meta prerequisite steps (payment, Cloud API, 2k limit, webhook `calls`).

---

## 6. Inbox Call entry (UI contract)

Replace `"Calling coming soon"` with real control:

| State | Control |
|-------|---------|
| Calling not enabled | Disabled + tip “Enable in Calls” |
| Permission unknown/missing | **Ask to call** (sends permission request) |
| Permission granted | **Call** (1 click → callback) |
| In progress | **Open live call** |

Still ≤2 clicks for the happy path after permission exists.

---

## 7. Ring modal polish

- Glass sheet, large name/phone.  
- **Accept** (primary) · **Decline** (secondary).  
- Mic permission inline error if blocked.  
- “Audio devices” under Advanced (hidden).  
- Same green/neutral language as app.

---

## 8. Copy bank

| Context | Copy |
|---------|------|
| Ready | Voice calls are live |
| Setup | Finish setup to answer WhatsApp calls |
| Empty | No calls yet |
| Permission | Ask for permission before calling |
| Enable fail | WhatsApp isn’t ready for calling yet |
| Accept / Decline / End | Accept / Decline / End call |
| Open chat | Open chat |
| Connecting human | Connecting you to the team… |
| Team busy fallback | I’ve noted this — someone will reply on WhatsApp |
| Edit AI | Edit personality & training |
| Coming soon removal | — (must not appear) |

---

## 9. Wireframes

### 9.1 Ready + live selected

```
Calls  Ready ✓  · 15551977746                 Live 1 · Today 3
┌──────────────┬─────────────────────────────────────┬──┐
│ Search…      │ Priya Sharma          LIVE  00:42   │⚙ │
│ All Live …   │ Open chat · End call                │📊│
│ ● Priya Live │ AI: Hello! How can I help…          │? │
│ ○ Ravi Miss  │ User: Order status please           │  │
│ ○ …          │ AI: Sure — order id?                │  │
└──────────────┴─────────────────────────────────────┴──┘
```

### 9.2 Setup needed

```
Calls  Setup needed
[ Finish call setup ]  → sheet with 4 checklist steps
List can still show past calls greyed with tip.
```

### 9.3 Inbox header

```
[ AI ON ▾ ] [ Call ] [ ⋯ ]
                 └ permission tip if needed
```

### 9.4 AI Bot easy setup (linked from Calls)

```
AI  ·  Support bot                    [ On ]  Default
┌ Personality  Train  Connect  Try it  ··· More ┐
│  ○ Friendly  ● Professional  ○ Sales  ○ Custom │
│  Business: Acme  ·  We sell…                   │
│  [ Save ]                                      │
└────────────────────────────────────────────────┘
Train: [ + Q&A ] [ Paste info ] [ Upload PDF ]
Try it: “What are your hours?” → reply + “Would connect person: No”
```

---

## 10. Motion (2–3 only)

1. Live row pulse.  
2. Ring modal fade+scale.  
3. Transcript line fade-in.

No KPI count-up animations.

---

## 11. Accessibility

- Ring modal focus trap; Esc = Decline confirm or focus Decline.  
- Live status not color-only (text LIVE).  
- Accept/Decline min 44px hit targets mobile.  
- `aria-label` on rail icons.

---

## 12. Acceptance checklist (for your review)

- [ ] Ready state = list + stage first; no FAQ wall.  
- [ ] Setup only as sheet when needed.  
- [ ] ≤2 clicks: Accept; End; Open chat; Call (when permitted).  
- [ ] Customize in rail, not header.  
- [ ] Transcript reads like chat.  
- [ ] Inbox “coming soon” gone.  
- [ ] Dashboard has one Calls entry.  
- [ ] Same fonts/colors/radius as Inbox.  
- [ ] No vendor jargon in primary UI.  
- [ ] Mobile list XOR stage + usable ring sheet.  
- [ ] Connect-to-person uses plain language (no “tool call” / “RAG”).  
- [ ] Calls Customize links to Edit personality & training — no second bot editor.  
- [ ] `/ai-bot` default path = Personality → Train → Try it (§14).

---

## 13. Implementation note (after you approve)

Refactor existing `calls/*` components — do not greenfield. Slim `CallsPageHeader`, move `CallInfoPanel`/heavy analytics into rail, re-enable `ChatHeader` Call, keep `CallRingModal` + APIs.  
AI Bot: reshape `AiBotPage` tabs to match §14; keep Advanced; presets write `instructions`; Train = existing Knowledge APIs with friendlier copy.

**Out of scope here:** SIP admin, voice cloning studio, dialer campaigns, login redesign, warm-consult rooms (Phase D).

---

## 14. Easy AI agent UI (personality + train) — **chosen**

**Goal:** Owner configures a bot that handles WhatsApp chat **and** voice calls without writing a system prompt. Same DNA as Inbox/Calls (glass, green, ≤2 clicks primary actions).

**Screen:** `/ai-bot` (existing) — reshape default path; do not invent a parallel “voice bot” product.

### 14.1 Default tabs (rename)

| Today | **Chosen** |
|-------|------------|
| Setup | **Personality** |
| Knowledge | **Train** |
| (part of Setup) | **Connect** (when to bring a human) |
| Test | **Try it** |
| Advanced | **More** (collapsed / last) |

### 14.2 Personality tab

1. **Preset cards** (one selected): Friendly helper · Professional · Sales assist · Custom.  
2. Three fields: Business name · What you do · Never promise / never do.  
3. Primary **Save**.  
4. Custom (or “Edit how I speak”) expands a plain textarea — label **How should I speak?**, never “System prompt”.  
5. Optional tip: “This AI also answers WhatsApp voice calls when Calls is set to AI.”

Presets compile into `instructions` (+ keep name/role line server already adds).

### 14.3 Train tab

| Control | Copy |
|---------|------|
| Add Q&A | Question customers ask / Your answer |
| Paste info | Paste policies, hours, prices… |
| Upload PDF | Menus, manuals, brochures |
| List status | Ready · Still learning… (no token/embedding counts) |

Empty state: “Add 3 answers so the AI stays accurate on calls and chat.”

### 14.4 Connect tab (human escalation — plain)

| Control | Maps to |
|---------|---------|
| Offer to connect a person when asked or stuck | enables handoff path + tools |
| Common phrases (chips) | `handoffKeywords` |
| What to say when connecting | `handoffMessage` |
| Tip | “Live ring vs WhatsApp if busy is set in Calls → Customize” |

No Meta/SDP language. No “function tools” wording.

### 14.5 Try it tab

- Text box (chat) + optional toggle **As on a call** (uses voice channel rules: short spoken lines).  
- Result: reply · **Would connect a person?** Yes/No + reason · matched Train snippets (label “From your training”, not “RAG hits”).  
- CTA after good try: **Use for WhatsApp calls** → sets Calling `defaultBotId` if permitted.

### 14.6 More (Advanced) — hide by default

Creativity, max length, rate limit, versions, activity log, raw instructions. Provider keys stay in Settings → AI only.

### 14.7 Create flow

Templates stay (Support / Sales / FAQ) but present as **Start from**: Support desk · Sales desk · FAQ helper — each lands on Personality with preset + sample Train Q&As.

### 14.8 Acceptance (AI easy path)

- [ ] New bot usable without opening More.  
- [ ] No “RAG / Semantic / temperature / system prompt” on Personality/Train/Connect/Try it.  
- [ ] Train empty → Try it shows gentle warning.  
- [ ] Calls Customize → Edit personality & training opens the right bot.  
- [ ] One brain for chat + voice.
