# Samyoj Calls — With-content & Live Call UI Spec

**Type:** Documentation only (no implementation in this pass)  
**Scope:** Call list with history + live/completed call stage (desktop + mobile)  
**Companion empty-state / IA:** [`calls-content-poc.md`](calls-content-poc.md)  
**Product logic:** [`../calls/CALLS_SHIP_DOCUMENT.md`](../calls/CALLS_SHIP_DOCUMENT.md)  
**Date:** 2026-08-05  

**Design sources (mock set):**

1. Desktop: list + live stage (transcript + notes)  
2. Call list row anatomy (Live / Missed / Completed) + pagination  
3. Live stage detail (header, metadata, chat bubbles, notes)  
4. Mobile live call (back, controls row, notes)

---

## 0. Goal

Keep the **existing Samyoj / Inbox visual language** (green brand, soft surfaces, WhatsApp-like transcript), but upgrade the **with-data** Calls experience so every call type — live, missed, completed, AI vs human — is scannable in ≤1 glance and actionable in ≤2 clicks.

This doc is the pixel-level contract for **content-rich** states. Empty states stay in `calls-content-poc.md`.

---

## 1. Existing UI vs this design (honest gap)

| Area | What ships today | What the mock improves | Verdict |
|------|------------------|------------------------|---------|
| List row | Avatar + name + time; status + AI/Agent pills; transcript **preview** line | Avatar + name + **phone**; **centered status badge** (LIVE / Missed / Completed); right = time + duration + direction/wave icon; **no preview clutter** | **Adopt mock** — clearer status scanning |
| Selected row | Violet tint + violet left bar | Soft **mint/green** selected background | **Adopt green** (brand consistency; drop violet-as-primary on Calls) |
| Status colors | Emerald live; neutral other | LIVE = green; Missed = soft rose; Completed = soft blue | **Adopt** |
| Stage header | Avatar, name, time·duration, End | Avatar, name, phone, LIVE + live timer, **Open chat** + **End call** + More | **Adopt** |
| Metadata strip | Ad-hoc pills | Icon row: direction · started · handler · duration | **Adopt** |
| Transcript | Left customer / right assistant (inverted vs mock) | **AI left (white + robot)** · **Customer right (green)** + timestamps + read ticks on customer | **Adopt mock** (closer to WhatsApp agent view: bot left, user right) |
| Live affordances | End only | Desktop: Open chat / End / More; Mobile: Mute · Hold · Keypad · Transfer · End + “AI is speaking…” bar | **Adopt** (stub Hold/Keypad if not ready; Transfer = Phase C) |
| Notes | Bottom textarea + Save | Notes label + expand/edit · placeholder · green **Save note** | **Adopt** |
| Pagination | Generic Pagination | “Showing 1–8 of 24 calls” + numbered pages | **Improve copy** to match |
| Filters | Already chips (All/Live/Missed/AI/Human/Out) | Same pattern | **Keep** |

**Theme rule:** Improve pattern and hierarchy; do **not** invent a new purple product theme. Violet may remain only for secondary accents (e.g. Voice AI label), not list selection or primary LIVE.

---

## 2. Information architecture (with content)

```
Desktop:
┌─ Calls title + Ready ─────────────────────────────────────┐
│  Status card (VOICE CALLS · phone · Live N · Today N)     │
├─ List (~320px) ──────────┬─ Stage (flex) ──────┬─ Rail ──┤
│ Search + Filters         │ Header + actions    │ Settings│
│ Chips                    │ Metadata strip      │ Insights│
│ Rows…                    │ [Live activity bar] │ Help    │
│ Pagination footer        │ Transcript          │         │
│                          │ Notes               │         │
└──────────────────────────┴─────────────────────┴─────────┘

Mobile:
List XOR Stage.
Live stage = full screen: back · identity · LIVE timer · Open chat
→ metadata → AI speaking bar → transcript → control row → notes
```

---

## 3. Call list (with history)

### 3.1 List chrome (unchanged from empty-state POC)

- Search: “Search name or phone…”  
- Filters button (overflow for date / exact status later)  
- Chips: **All · Live · Missed · AI · Human · Out** (active = solid brand green)

### 3.2 Row anatomy (exact)

Three columns — left contact · center status · right time/duration.

```
[ Avatar ]  Name                    [ Status ]     12:32 PM
            +91 98765 43210                        00:42  ~icon
```

| Element | Spec |
|---------|------|
| Avatar | Initials circle; varied soft brand hues (green / teal / purple / gray / rose) — reuse `ContactAvatar` color hash |
| Name | Bold ~13–14px; truncate |
| Phone | Muted ~12px; format with `+` and spaces when possible |
| Status badge | Pill, vertically centered in row |
| Time | Top-right; same-day clock (`12:32 PM`); else `Yesterday` / `2d ago` |
| Duration | Bottom-right; `MM:SS` tabular nums |
| Live icon | Small green waveform / activity bars (not phone handset) |
| Missed / Completed icon | Small muted phone or direction glyph |
| Selected | Soft mint/emerald wash (`bg-emerald-50/70`); optional thin left emerald accent — **not violet** |
| Live row | Selected or not: very light mint background optional when status is LIVE |

### 3.3 Status badge tokens

| Status | Label | Fill | Text |
|--------|-------|------|------|
| CONNECTING / RINGING / CONNECTED | **LIVE** | Emerald-50 + ring | Emerald-700, bold, optional ping dot |
| MISSED / REJECTED (unanswered) | **Missed** | Rose-50 | Rose-700 |
| COMPLETED / TERMINATED (answered) | **Completed** | Sky-50 | Sky-700 |
| FAILED | **Failed** | Neutral / soft rose | Neutral-700 |

Do **not** show AI/Human micro-pills on the row in this design — handler lives in the **stage metadata**. Filters still use AI / Human chips.

### 3.4 Pagination footer

- Left: `Showing {from} – {to} of {total} calls`  
- Right: `<` · page numbers · `>` ; active page = solid green  
- Row page size: 8–25 (product choice; mock shows 8 — prefer **keep 25** for power users or make 10 default; document either)

### 3.5 Click behavior

1 click row → select + deep link `/calls/:id`  
Mobile → navigate to full stage (list hidden)

---

## 4. Stage — Live call (desktop)

### 4.1 Header

| Left | Center / inline | Right |
|------|-----------------|-------|
| Avatar (lg) + **Name** + **phone** | **LIVE** pill + live elapsed `00:42` (updates every 1s while CONNECTED) | **Open chat** (outline) · **End call** (soft red) · **More** (⋮) |

- Open chat → Inbox conversation for same contact (disabled + tip if no `conversationId`)  
- End call → terminate API; confirm only if accidental-risk later (v1: immediate)  
- More → notes focus, copy number, open contact (keep ≤4 items)

### 4.2 Metadata strip (one line, wrap on narrow)

Icons + muted text:

1. **Inbound call** / **Outbound call** (direction)  
2. **Started** `{time}`  
3. **Handler** `AI (Samyoj AI)` or `Agent ({name})`  
4. **Duration** `{live or final}`  

Optional fifth (when Sarvam live): **Voice AI: {speaker}** (e.g. Asha) — secondary; hide if unknown.

### 4.3 Live activity bar (only while AI is speaking / processing)

- Soft emerald background strip  
- Left: robot icon + “AI is speaking…” or “AI is typing…”  
- Right: small waveform visualizer (CSS/SVG; decorative, not real FFT required)

Hide when human agent is on the call or call is not active.

### 4.4 Transcript (chat rhythm)

Background: Inbox-style soft patterned / warm off-white (`inbox-placeholder-bg` family).

| Role | Alignment | Bubble | Affordance |
|------|-----------|--------|------------|
| AI / system / greeting | **Left** | White + thin border + soft shadow | Green **robot** avatar left of bubble |
| Customer (user) | **Right** | Light green fill | Timestamp + blue double-check (read semantics optional; ticks = “logged”) |

- Timestamp inside/under bubble (~10–11px muted)  
- Auto-scroll to bottom on new transcript lines while Live  
- Empty live: “Listening…” soft hint, not a wall of FAQ  

**Logic note:** Existing code maps customer left / assistant right — **flip to match this mock** when implementing.

### 4.5 Notes (always available on selected call)

- Header: **Notes** + expand/maximize or pencil  
- Textarea placeholder: `Add notes about this call...`  
- Primary: green **Save note** (bottom-right of notes block)  
- Persist via existing `callingApi.updateNotes`

---

## 5. Stage — Completed / Missed (desktop)

Same shell as live, with differences:

| Element | Completed | Missed |
|---------|-----------|--------|
| LIVE / timer | Replace with status pill **Completed** / **Missed** | Same |
| End call | Hide | Hide |
| Open chat | Keep | Keep |
| Duration | Final duration | `00:00` or hide |
| Activity bar | Hide | Hide |
| Transcript | Full history or empty state “No speech captured” | Often empty — show gentle empty + tip “Customer didn’t connect” |
| Notes | Keep | Keep |

---

## 6. Mobile live call (full stage)

From mock 4 — vertical stack:

1. **Top bar:** Back · Avatar + name + phone · LIVE pill + timer · **Open chat** (End moves to control row)  
2. **Metadata strip** (scroll/wrap)  
3. **AI is speaking…** bar + waveform  
4. **Transcript** (flex grow)  
5. **Control row** (5 equal buttons):  
   - Mute · Hold · Keypad · Transfer · **End call** (solid red)  
6. **Notes** + Save note  

### 6.1 Control row product rules

| Control | v1 ship? | Behavior |
|---------|----------|----------|
| Mute | Yes if agent softphone | Toggle local mic on `RTCPeerConnection` |
| Hold | Stub OK | Disabled + tip “Coming soon” unless hold audio exists |
| Keypad | Stub OK | Disabled (DTMF later) |
| Transfer | Phase C | Opens transfer / rings team; disabled until live transfer ships |
| End call | Yes | Same as desktop terminate |

Touch targets ≥ 44px height.

---

## 7. Content & copy bank (with-data)

| Context | Copy |
|---------|------|
| LIVE badge | LIVE |
| Missed badge | Missed |
| Completed badge | Completed |
| Pagination | Showing {from} – {to} of {total} calls |
| Open chat | Open chat |
| End call | End call |
| Save note | Save note |
| Notes placeholder | Add notes about this call... |
| AI speaking | AI is speaking… |
| AI typing | AI is typing… |
| Handler AI | Handler AI ({botName}) |
| Handler agent | Handler {agentName} |
| Inbound / Outbound | Inbound call / Outbound call |
| Started | Started {time} |
| Duration | Duration {mm:ss} |
| Empty transcript | No speech on this call yet |
| Missed empty | This call wasn’t answered |
| Transfer disabled tip | Live transfer comes next |

---

## 8. Logic mapping (status → UI)

```
Meta / DB status          → List badge     → Stage mode
─────────────────────────────────────────────────────────
RINGING, CONNECTING,
CONNECTED                 → LIVE           → Live stage (+ timer)
MISSED, REJECTED*         → Missed         → Missed stage
COMPLETED, TERMINATED**   → Completed      → Completed stage
FAILED                    → Failed         → Failed stage (rare)

* unanswered only
** if answeredAt set or duration > 0; else treat as Missed when appropriate
```

Handler:

- `AI` → metadata “Handler AI (bot name)”  
- `AGENT` → “Handler {agent}”  
- `UNANSWERED` → omit handler or “Unanswered”

Direction:

- `USER_INITIATED` → Inbound  
- `BUSINESS_INITIATED` → Outbound  

Chips → API (already planned):

| Chip | Filter |
|------|--------|
| Live | status in RINGING/CONNECTING/CONNECTED |
| Missed | MISSED |
| AI | handler AI |
| Human | handler AGENT |
| Out | direction BUSINESS_INITIATED |

---

## 9. Motion (keep 2–3)

1. Live badge / list LIVE row subtle pulse  
2. Transcript line fade-in  
3. AI speaking waveform (lightweight CSS)  

No KPI count-ups.

---

## 10. Accessibility

- LIVE not color-only (text label required)  
- End call: clear accessible name; danger styling  
- Control row: `aria-pressed` on Mute  
- Focus order: header actions → transcript region → notes → controls (mobile)  
- Ring modal + live stage: don’t trap focus incorrectly across pages  

---

## 11. Components to reshape (when implementing)

| File | Change |
|------|--------|
| `CallListItem.tsx` | New 3-column anatomy; status colors; green selected; drop preview/AI pills from row |
| `CallDetailView.tsx` | Header actions; metadata strip; flip bubble sides; activity bar; notes chrome |
| `CallFiltersBar.tsx` | Keep chips (already aligned) |
| `CallsPage.tsx` | Pagination copy; wire live timer; mobile control dock |
| `callUtils.ts` | Status label map LIVE/Missed/Completed; duration `MM:SS`; relative time |
| New (optional) | `CallLiveControls.tsx`, `CallTranscriptBubbles.tsx`, `CallMetadataStrip.tsx` |

Refactor — do not greenfield the page.

---

## 12. Acceptance checklist (with-data)

- [ ] List rows match: avatar · name · phone · centered status · time · duration  
- [ ] LIVE / Missed / Completed colors match tokens  
- [ ] Selected row is soft green, not violet  
- [ ] Live stage: Open chat + End call + LIVE timer  
- [ ] Metadata: direction · started · handler · duration  
- [ ] Transcript: AI left + robot; customer right + green bubble  
- [ ] Notes + Save note present  
- [ ] Mobile: list XOR stage; live controls row present (stubs OK where noted)  
- [ ] Pagination shows “Showing X – Y of Z calls”  
- [ ] Same fonts / radius / green as Inbox — no new theme  

---

## 13. Relationship to other docs

| Doc | Role |
|-----|------|
| `calls-content-poc.md` | Empty state, setup sheet, Customize rail, AI Bot easy path |
| **This file** | With-history list + live/completed stage + mobile live controls |
| `CALLS_SHIP_DOCUMENT.md` | Backend / Meta / Sarvam / handoff phases |

Implement empty-state POC first if not done; then this with-content layer on the same shell.
