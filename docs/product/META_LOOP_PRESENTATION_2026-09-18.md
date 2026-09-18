# Samyoj Meta Loop — visual for design seniors

**Name:** Samyoj Meta Loop  
**One line:** WhatsApp stays. Ads / Instagram / Messenger land in the **same Inbox + CRM**. We do not rebuild WhatsApp. We do not clone Ads Manager.

**How to show:** GitHub / Notion / [mermaid.live](https://mermaid.live) — one chart, one sentence, next.

Deep: [V2 plan](META_ECOSYSTEM_V2_PLAN_2026-09-18.md) · [Do / Don’t](META_ECOSYSTEM_DOS_AND_DONTS_2026-09-18.md)

---

## 1. Super flow — the whole product

**Say:** Meta brings the person. Samyoj owns chat + deal. Ads Manager stays in Meta.

```mermaid
flowchart TB
  META["META<br/>Ads Manager · Instant Form · Click-to-chat<br/>Instagram · Messenger · WhatsApp Cloud"]

  SAM["SAMYOJ — one product<br/>Inbox · Contacts · Leads · Flows · AI"]

  META -->|"leadgen / click / DM / comment"| SAM
  SAM -->|"optional CAPI: our stages"| META

  SAM --> WON[Won lives here — we store deal value]
  SAM --> DASH[Dashboard shows Meta spend + our Won]
```

---

## 2. Today vs Loop

**Say:** Left is shipped. Right is what we add. Same CRM.

```mermaid
flowchart LR
  subgraph TODAY["Already built"]
    WA[WhatsApp Inbox]
    CRM[Contacts + Leads]
    FLOW[Flows + Campaigns]
    AI[AI chat + calling]
    WA --> CRM --> FLOW --> AI
  end

  subgraph LOOP["We add"]
    ADS[Lead form + CTWA chip]
    FB[Messenger]
    IG[IG DMs + comments]
    ADS --> CRM2[Same CRM]
    FB --> INBOX[Same Inbox]
    IG --> INBOX --> CRM2
  end

  TODAY -->|"0 Channel first"| LOOP
```

---

## 3. Two ads — never one CPL

**Say:** Form and click-to-chat are different. Design two entry chips, not one “Ads” blob.

```mermaid
flowchart TD
  AD[Customer sees Meta ad] --> SPLIT{Which?}

  SPLIT -->|Fills Instant Form| F[Phase 1 Lead Ads]
  F --> C1[Contact + Lead in CRM]
  C1 --> WA1[Optional WhatsApp template]

  SPLIT -->|Clicks WhatsApp| T[Phase 2 CTWA]
  T --> CHAT[Existing WA Inbox + ad-source chip]

  SPLIT -->|Clicks IG / Messenger| M[Phase 3–4]
  M --> INBOX[Same Inbox · channel badge]
```

---

## 4. Inbox they will design

**Say:** One list. Filter by channel. Badge on every thread. Not three inboxes.

```mermaid
flowchart LR
  subgraph INBOX["Inbox — one screen"]
    FILT["Filter: All · WhatsApp · Instagram · Messenger"]
    LIST["Thread list<br/>badge WA / IG / FB"]
    THREAD["Thread<br/>assign · notes · tags · Open/Pending/Closed"]
    FILT --> LIST --> THREAD
  end

  THREAD --> CRM[Same Contact / Lead]
  THREAD --> BOT[Existing AI + human handoff]
```

---

## 5. Phase 0 — Channel (unlocks everything)

**Say:** If we skip this, IG/FB will break WhatsApp number isolation. Designers wait; this is schema + router.

```mermaid
flowchart LR
  WH[WhatsApp number today] --> CH[Channel row]
  PAGE[Facebook Page] --> CH
  IG[Instagram professional] --> CH

  PERSON[One human] --> ID1[WA phone]
  PERSON --> ID2[IGSID]
  PERSON --> ID3[PSID]
  ID1 --> CPI[ContactPlatformIdentity]
  ID2 --> CPI
  ID3 --> CPI
  CPI --> CONTACT[One Contact — only after phone/email/agent merge]
```

---

## 6. Phase 1 subflow — Lead Ads

**Say:** Customer still creates the form in Ads Manager. We catch the lead.

```mermaid
sequenceDiagram
  participant User
  participant Meta as Ads Manager
  participant Hook as Samyoj webhook
  participant CRM as Contact + Lead
  participant WA as WhatsApp

  User->>Meta: Submit Instant Form
  Meta->>Hook: leadgen
  Hook->>CRM: upsert person
  opt Phone + consent
    CRM->>WA: optional template
  end
```

---

## 7. Phase 2 subflow — CTWA chip

**Say:** No new Graph product. Chip on the chat we already have.

```mermaid
flowchart LR
  CLICK[Click WhatsApp on ad] --> WH[WhatsApp webhook referral]
  WH --> CHIP["Inbox chip: campaign / ad"]
  CHIP --> AGENT[Agent replies in 72h window copy]
```

---

## 8. Phase 3–4 subflow — Messenger then Instagram

**Say:** Same Page token. Messenger first. Instagram DMs + one comment DM. Human always available on IG.

```mermaid
flowchart TD
  PAGE[Page connected in Phase 1] --> MSG[Phase 3 Messenger 24h]
  PAGE --> IGD[Phase 4 IG DMs 24h]
  PAGE --> CMT[Comment PRICE]

  CMT --> PR["1 private reply / 7 days"]
  PR --> WAIT{User taps or replies?}
  WAIT -->|No| STOP[Stop — do not blast]
  WAIT -->|Yes| WIN[24h window]

  IGD --> HUMAN[Human inbox required]
  MSG --> HUMAN
```

---

## 9. Build order — each box unlocks the next

**Say:** Do not design IG screens before Channel. Do not design Ads Manager.

```mermaid
flowchart TD
  P0["0 Foundation<br/>Channel · identities · webhook router"]
  P1["1 Lead Ads<br/>Form → CRM"]
  P2["2 CTWA chip<br/>Ad source on WA chat"]
  P3["3 Messenger<br/>Page DMs in Inbox"]
  P4["4 Instagram<br/>DMs + comment → 1 reply"]
  P5["5 Ads read<br/>Spend / clicks / Meta leads"]
  P6["6 Analytics join<br/>Meta numbers next to Won"]
  P7["7 Portfolio<br/>What is connected"]
  L["Later<br/>Merge UI · publish in Suite · Email/SMS"]

  P0 --> P1 --> P2 --> P3 --> P4 --> P5 --> P6 --> P7 --> L
  P1 -.-> AR["App Review in parallel — not a screen"]
```

---

## 10. Screens by phase (design queue)

```mermaid
flowchart LR
  S0["0 — no new UI<br/>WhatsApp looks the same"]
  S1["1 — Lead source on Contact<br/>Pipeline card"]
  S2["2 — Ad chip on WA thread"]
  S3["3 — Channel filter + FB badge"]
  S4["4 — IG badge + Comments tool"]
  S5["5 — Ads tiles read-only"]
  S6["6 — One analytics page<br/>two columns: spend vs Won"]
  S7["7 — Settings: linked assets"]

  S0 --> S1 --> S2 --> S3 --> S4 --> S5 --> S6 --> S7
```

---

## 11. Doing vs not doing

**Say:** Green is Samyoj. Grey stays in Meta.

```mermaid
flowchart LR
  subgraph DO["We design / build"]
    D1[Channel badges]
    D2[Lead form → CRM]
    D3[Ad chip]
    D4[One Inbox filters]
    D5[Comment → 1 DM]
    D6[Ads numbers read-only]
    D7[Merge by phone / email]
  end

  subgraph DONT["We do not"]
    N1[Rebuild WhatsApp]
    N2[Ads Manager]
    N3[One Meta customer ID]
    N4[IG broadcast like WA]
    N5[Fake ₹ ROI]
    N6[Content studio]
    N7[App ID in Settings]
  end
```

---

## 12. Three ledgers

**Say:** One dashboard may show all three. One price tag may not.

```mermaid
flowchart TB
  DASH[Analytics page]
  L1[Samyoj SaaS — Razorpay]
  L2[WhatsApp Cloud — Meta → WABA]
  L3[Ad spend — Meta → Ad Account]
  L1 --> DASH
  L2 --> DASH
  L3 --> DASH
```

---

## Speaker crib

| # | Sentence |
|---|---------|
| 1 | Meta sends people. We close them. |
| 2 | WhatsApp stays. Loop wraps it. |
| 3 | Form and click-to-chat are two products. |
| 4 | One Inbox, channel filter, one Contact. |
| 5 | Channel first or IG breaks WhatsApp. |
| 6 | Ads Manager creates the form. We catch the lead. |
| 7 | Chip only — chat already exists. |
| 8 | Messenger then IG. One comment DM, then wait. |
| 9 | 0→1→2→3→4 then we only *read* ads. |
| 10 | Design queue matches build order. |
| 11 | CRM destination. Meta keeps ads + posts. |
| 12 | Three bills. |

**If asked “when IG?”** Phase 4 — after Channel, Lead Ads, CTWA chip, Messenger.  
**If asked “Diwali ₹ ROI?”** Spend vs Meta leads after Phase 5. Rupee sales only after we store deal value.
