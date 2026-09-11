# Samyoj — 15 din, sirf major

> English detail alag hai, usko mat padho roz. Yeh working list hai.  
> **30 din nahi. Billing / Ads / ES v4 is list mein nahi.**  
> Kaam files + order: [IMPLEMENTATION_PLAN_EXISTING_15D.md](./IMPLEMENTATION_PLAN_EXISTING_15D.md)  
> Tick tab jab proof ho.

---

## Aaj

| | |
|---|---|
| Internal test | **Haan** — `bash start.sh` |
| Customer live | **Nahi** |
| Packets | **A + E + B + D + C + F done.** Next **Manual** (naya phone reply, off-host restore, GO/NO-GO) |
| 15 din ka kaam | Jo **already bana hai**, error-free + crash-safe |
| Baad (15 ke baad) | Billing, Ads, Embedded Signup, Content Studio real |

---

## 15 din ka flow

```text
Din 1–2     customer ko jo jhoot/bug dikhe, woh band
Din 3–7     message: lost na ho, duplicate na ho, galat org na dikhe
Din 8–11    1000 send + crash/restore prove
Din 12–15   naya phone reply + GO / NO-GO
```

---

## Din 1–2 — major, pehle yeh

- [x] 1 client test fail (campaign error) fix — Packet A
- [x] GST / Autopay / “Full backup” / Content Studio success — jo jhoot hai, hatao — Packet A
- [x] User ko App ID / App Secret mat dikhao — Packet A
- [x] Doosre org / doosre WhatsApp number ka data mix nahi (quick check) — Packet B `active-number` tests. Full org-leak audit script still later.

**Gate:** jhoot band. Known fail test green. (met, Packet A 4/4)

---

## Din 3–7 — major, messages + leak

- [x] Webhook save **pehle**, phir Meta ko “mil gaya” — Packet C (unit). Live phone still Manual.
- [x] Crash ke baad wahi inbound dubara chale (replay) — Packet C unit + operator `POST /api/whatsapp/webhook-replay`. Live still Manual.
- [x] Double-click / retry = **2 WhatsApp messages nahi** — Packet D (unit) + Packet F restart/count.
- [x] Agent URL se extra permission bypass nahi — Packet B
- [x] Campaign `+91` / `91` = ek contact, do send nahi — Packet E

**Gate:** test mein duplicate send = 0. Lost inbound after ack = 0 (unit, Packet C). Live phone reply still Manual.

---

## Din 8–11 — major, scale + tootna

- [x] 1 org × ~1000 recipients complete (simulator) — Packet F: 1000 Graph calls, 0 dups
- [x] API / Redis restart beech mein → duplicate nahi — Packet F: restart after `providerCallStartedAt` = 0 extra sends; Redis-down throttle fallback
- [x] Backup → dusri database restore chale — Packet F isolated rehearsal (`samyoj_packet_f_restore`). Off-host / doosre machine still Manual

**Gate:** numbers likhe. Guess nahi. (met, Packet F 4/4; other-host restore still Manual)

---

## Din 12–15 — major, live + faisla

- [ ] **Naya** phone reply → Inbox + counter (purana message nahi)
- [ ] Connect → send → template → campaign, ek test account
- [ ] **GO / NO-GO** — tick nahi to customer nahi

| Result | Next |
|---|---|
| Inbound + restore + no leak/duplicate | 2–5 org internal pilot |
| Leak / lost message / duplicate | Stop |
| Meta approval pending | Public onboard nahi, limited test ok |

---

## 15 din ke 8 must-tick

- [ ] Doosre org ka data nahi
- [ ] Number mix nahi
- [ ] Inbound lost nahi
- [x] Duplicate send nahi — Packet D unit/lease + Packet F restart/count
- [x] 1000-send numbers likhe — 1000 eligible = 1000 unique Graph `to`, 0 dups
- [x] Restore chala — isolated second DB on this host. Off-host encrypt still later
- [ ] Naya phone reply prove
- [x] Jhoot (GST / backup / Studio) nahi — Packet A

**Stop turant:** leak, lost inbound, duplicate send, restore fail.

---

## Is 15 din mein mat

- Recurring billing / GST invoice product
- Embedded Signup v4 / Ads Manager / Lead Ads
- Content Studio real AI
- Live call transfer
- Phase C automations
- Instagram / Messenger
- “Production ready” bolna

English kyun: [EXECUTIVE_GAP_ANALYSIS_AND_ROADMAP_2026.md](./EXECUTIVE_GAP_ANALYSIS_AND_ROADMAP_2026.md)
