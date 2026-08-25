# 15 — Curriculum + quiz bank (Sonu, 2-day Meta literacy)

**Audience:** Sonu — founder building WhatsApp SaaS (Samyoj). Product + Meta literacy, not coding.  
**Mode:** Read → pause → self-quiz. Hinglish OK.  
**Goal:** After 2 days, explain Graph / WABA / templates / CSW / two-ledger pricing / Tech Provider / Dev vs Live / bans / Samyoj surface / future IG·FB without hand-waving.  
**Companion notes:** `01`–`14` in this folder + later master guide `docs/learning/META_BUSINESS_PLATFORM_MASTER_GUIDE_2026.md`.  
**Canonical money facts:** `docs/billing/17-META-WHATSAPP-BILLING-AND-POLICY.md` (fetched 2026-08-14).  
**Samyoj truth:** `docs/memory/STATUS_AND_FUTURE.md` — test-deploy yes; customer production **no**.

**Rules for this sprint**

- No coding tasks. No “fix the OAuth popup.” No PR.
- Do not claim Samyoj is customer-production-ready.
- Do not mix Meta Cloud API fees into Samyoj plan price.
- Prefer official Meta docs over blogs. Numbers from Meta Pricing CSV / WhatsApp Manager only.

---

## How to use (5 min setup)

1. Block calendar: **Day 1** and **Day 2**, ~8 focused hours each (plus breaks).
2. Keep a paper / Notion page titled **“Sonu Meta dump”** — one line per “aha.”
3. After each block: write 3 bullets *without looking*. Then check the reading.
4. End of Day 2: full quiz bank (Q1–Q48). Score yourself honestly. Re-read any topic &lt; 70%.

**Suggested daily rhythm:** 50 min study + 10 min break. Lunch 60 min. Evening quiz is open-book first pass, closed-book second pass if energy allows.

---

## Reading order (do this sequence — don’t jump)

Official / primary first; Samyoj docs second; blogs never as source of truth.

### Track A — Meta platform (must)

1. [Graph API overview](https://developers.facebook.com/docs/graph-api/overview) — what Graph *is*
2. [WhatsApp Cloud API get started](https://developers.facebook.com/docs/whatsapp/cloud-api/get-started)
3. [Business Portfolio / Business Manager concepts](https://www.facebook.com/business/help) (Business settings mental model)
4. [WABA / WhatsApp accounts in Business Manager](https://developers.facebook.com/docs/whatsapp/overview) + Manager UI walkthrough (your own test BM)
5. [Send messages + customer service windows](https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/send-messages)
6. [Message templates](https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates)
7. [Template categories + quality](https://developers.facebook.com/docs/whatsapp/message-templates/guidelines)
8. [Pricing (per-message, current)](https://developers.facebook.com/docs/whatsapp/pricing/) — read calendar dates carefully
9. [Conversation-based pricing — Deprecated banner only](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing/conversation-based-pricing) — know what *died* 1 Jul 2025
10. [Upcoming pricing updates (service / utility in CSW)](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing/non-template-messages)
11. [Solution providers overview](https://developers.facebook.com/docs/whatsapp/solution-providers/) — Tech Provider vs Solution Partner
12. [Embedded Signup](https://developers.facebook.com/docs/whatsapp/embedded-signup/)
13. [App Development vs Live + App Review](https://developers.facebook.com/docs/development/release)
14. [WhatsApp Business Messaging Policy](https://www.whatsapp.com/legal/business-policy) + [Business Solution Terms](https://www.whatsapp.com/legal/business-solution-terms/)
15. [Webhooks](https://developers.facebook.com/docs/graph-api/webhooks) + WhatsApp webhook fields

### Track B — Future channels (skim Day 2 afternoon)

16. [Instagram Messaging API](https://developers.facebook.com/docs/messenger-platform/instagram)
17. [Messenger Platform](https://developers.facebook.com/docs/messenger-platform)
18. Ads / Marketing API — **adjacency only**: know what you must *not* mix into WhatsApp SaaS billing ([Marketing API](https://developers.facebook.com/docs/marketing-apis))

### Track C — Samyoj (always after Track A topics)

19. `docs/billing/17-META-WHATSAPP-BILLING-AND-POLICY.md` (especially §§0–2)
20. `docs/billing/README.md` + `00-PRINCIPLES.md` (two ledgers)
21. `docs/memory/STATUS_AND_FUTURE.md` (what is shipped vs open)
22. `docs/WHATSAPP_CONNECT_DEVELOPER_GUIDE.md` (Connect + inbound tunnel — conceptual)
23. Sibling notes `01`–`14` when they exist (fill gaps; this file is the study *plan*)

---

## Day 1 — Foundations + money + partner model

**Theme:** “Meta ka universe samajh lo — phir Samyoj kahan baitha hai.”

| Block | Clock (example) | Focus | Read / do | Output (write, no code) |
| --- | --- | --- | --- | --- |
| **D1-0** | 09:00–09:20 | Orient | This file §§How to use + Reading order. Skim STATUS_AND_FUTURE “Ready or not.” | 5 lines: what you will *not* claim after Day 2 |
| **D1-1** | 09:20–10:20 | Graph + App | Graph overview; App Dashboard mental model: App ID, App Secret, access tokens, permissions | Draw: User → App → Graph → asset |
| **D1-2** | 10:30–11:30 | Business stack | Business Portfolio, ad account vs WABA vs Page vs System User (definitions only) | Glossary: 8 terms in Hinglish |
| **D1-3** | 11:30–12:30 | WABA + number | Cloud API get-started; phone number ID vs display number; test vs production number | “Ek customer = unka WABA” paragraph |
| **Lunch** | 12:30–13:30 | — | Offline. No Slack doomscroll. | — |
| **D1-4** | 13:30–14:30 | Templates | Template docs: categories Marketing / Utility / Authentication; approval; variables; quality | Table: category → typical use → when billable |
| **D1-5** | 14:40–15:40 | CSW | Send-messages + CSW: open/reset/closed; template-only outside window | Timeline sketch: hours 0 / 2 / 26 |
| **D1-6** | 15:50–17:00 | Pricing PMP | Pricing page + doc 17 §0–1. CBP deprecated. India INR migration dates. | “4 messages, 2 bills” example in your words |
| **D1-7** | 17:10–18:00 | Two ledgers | Doc 17 §1.7 + billing README principles. Tech Provider table §2.1 | One slide worth of text: Samyoj invoice vs Meta invoice |
| **D1-8** | 18:00–18:40 | Day 1 quiz | Q1–Q20 closed notes if possible | Score + re-read weak topics 20 min |

**Day 1 must-know (self-check before sleep)**

- [ ] Graph ≠ WhatsApp only — WhatsApp is one Graph product surface.
- [ ] WABA sits under customer Business Portfolio; Samyoj must not run all tenants on one shared WABA.
- [ ] Outside CSW → only approved templates.
- [ ] Meta charges **delivered templates** (PMP since 1 Jul 2025), not “one conversation fee.”
- [ ] Samyoj SaaS (Razorpay) and Meta Cloud API are **two ledgers**.
- [ ] TARGET partner posture: **Tech Provider** (Meta bills WABA; we bill software).

---

## Day 2 — Risk, Samyoj surface, future channels

**Theme:** “Ban mat khana; product honesty; IG/FB baad mein.”

| Block | Clock (example) | Focus | Read / do | Output (write, no code) |
| --- | --- | --- | --- | --- |
| **D2-0** | 09:00–09:15 | Recap | Day 1 dump aloud (5 min). Fix wrong lines. | Corrected dump |
| **D2-1** | 09:15–10:15 | Tech Provider + ES | Solution providers + Embedded Signup. Payment method on customer WABA. Credit line = Solution Partner only | “Why we are not BSP in UI” paragraph |
| **D2-2** | 10:25–11:25 | Dev vs Live | Development mode, Live mode, App Review, Advanced Access for WA permissions | Checklist: what blocks real customer onboard |
| **D2-3** | 11:25–12:25 | Policy + bans | Messaging Policy + Solution Terms (AI clause, opt-in, portability). Quality rating / throughput mental model | Ban risk top-10 list for Samyoj customers |
| **Lunch** | 12:25–13:25 | — | — | — |
| **D2-4** | 13:25–14:40 | Samyoj surface | STATUS_AND_FUTURE + Connect guide (conceptual) + note `14-samyoj-surface` if present. Map: Connect OAuth, webhook inbound, templates UI, campaigns, calling stub, admin | One-page “what Meta APIs we already touch” |
| **D2-5** | 14:50–15:50 | Product honesty | Two-ledger sales talk; Oct 2026 service fees; inbound needs HTTPS; test-deploy ≠ production | Script: 90-second pitch to a Growth customer |
| **D2-6** | 16:00–17:00 | Future IG / FB | Instagram Messaging + Messenger skim. Ads adjacency: do not fold Ad Account spend into WhatsApp SaaS | “Phase later” note: what we reuse (tokens, webhooks) vs rebuild |
| **D2-7** | 17:10–18:00 | Full quiz | Q1–Q48. Mark unsure. | Score; list 5 follow-up URLs |
| **D2-8** | 18:00–18:30 | Close | Re-read only weak sections. Update Sonu Meta dump. | “I can teach X / I still confuse Y” |

**Day 2 must-know**

- [ ] Tech Provider ≠ Solution Partner (credit line / who Meta invoices).
- [ ] Dev Mode limits who can use the app; Live + Review needed for scale.
- [ ] Opt-in, category honesty, quality — ban vectors.
- [ ] Samyoj: platform App credentials in server `.env`; users never see App Secret in Settings.
- [ ] Outbound localhost OK; inbound needs public HTTPS (ngrok in our dev).
- [ ] IG/Messenger = future product scope, not current production claim.
- [ ] SAMYOJ-35 TARGET subscriptions / live transfer / customer-host inbound proof still open.

---

## Hourly cheat-sheet (compressed)

If a day slips, keep this order — drop depth, not sequence:

1. Graph + Business + WABA  
2. Templates + CSW  
3. Pricing PMP + two ledgers  
4. Tech Provider + Embedded Signup  
5. Dev/Live + bans  
6. Samyoj surface honesty  
7. IG/FB future skim  
8. Quiz

---

## Quiz bank (48 Q&A)

Answer first, then peek. Mix English + Hinglish prompts on purpose.

### A. Graph / Business / WABA

**Q1.** Graph API kya hai — ek sentence mein?  
**A1.** Meta ka HTTP API layer jisse apps Business assets (Pages, WhatsApp, IG, ads, etc.) ko programmatically read/write karti hain — WhatsApp Cloud API Graph ke through hi chalti hai.

**Q2.** App ID aur App Secret ka farq?  
**A2.** App ID public-ish identifier of your Meta app; App Secret server-side secret for token exchange / app auth. UI mein kabhi mat dikhao (Samyoj: sirf `server/.env`).

**Q3.** Access token kis cheez ki permission carry karta hai?  
**A3.** Specific app + user/system-user + granted scopes — bina sahi scopes ke Graph calls fail / empty milte hain.

**Q4.** Business Portfolio (Business Manager) aur Meta App same cheez hain kya?  
**A4.** Nahi. Portfolio = company assets + people + billing hub; App = developer product that gets permission to act on those assets.

**Q5.** WABA expand karke bolo.  
**A5.** WhatsApp Business Account — Cloud API messaging, templates, phone numbers, quality, Meta usage billing ka container.

**Q6.** `phone_number_id` vs display phone number?  
**A6.** Display = user-facing E.164-ish number; `phone_number_id` = Graph ID jo send/webhook routing mein use hota hai. Samyoj DB alag `whatsappNumberId` rakhta hai (workspace).

**Q7.** Multi-tenant SaaS mein sab customers ko ek shared WABA pe daalna theek hai?  
**A7.** Nahi. Har client ka WABA (unka portfolio) — policy + portability + billing isolation. Shared mega-WABA = anti-pattern for Tech Provider SaaS.

**Q8.** System User kis liye hota hai (high level)?  
**A8.** Long-lived server automation tokens for Business assets without a human session — partner/ops patterns; still permission-scoped.

### B. Templates

**Q9.** Template ke bina user ko pehli baar (CSW band) message bhej sakte ho?  
**A9.** Nahi. CSW closed = sirf approved templates.

**Q10.** Teen template categories?  
**A10.** Marketing, Utility, Authentication. (Service template category nahi hai — service = non-template replies inside CSW.)

**Q11.** Template approve kaun karta hai?  
**A11.** Meta review (WhatsApp). Reject / pause / recategorize ho sakta hai — category accept at use time.

**Q12.** Marketing template kab almost always bill hota hai (PMP)?  
**A12.** Jab deliver ho — except free entry point (FEP) windows etc. Marketing pe volume discount nahi.

**Q13.** Utility template andar open CSW — Meta bill aaj (2026-08 docs) vs 1 Oct 2026?  
**A13.** Aaj docs: free inside CSW. **1 Oct 2026 se** utility-in-CSW bhi charged (upcoming). Product copy mein date disclose karo.

**Q14.** Template quality kharab hone se kya hota hai?  
**A14.** Quality rating drop, throughput limits, template pause — campaigns mar sakti hain. Ban risk rises with spam / wrong category.

**Q15.** Variables `{{1}}` customer ko random PII dump karne ke liye free pass hain?  
**A15.** Nahi. Guidelines + policy; misleading / spammy content reject or enforcement trigger.

### C. CSW (customer service window)

**Q16.** CSW kab khulti hai?  
**A16.** Jab user business ko message (ya call, per docs) karta hai — reset on subsequent user message/call.

**Q17.** CSW kitne hours?  
**A17.** 24 hours from last qualifying user interaction (standard Cloud API CSW).

**Q18.** CSW open hone par business kya bhej sakta hai?  
**A18.** Almost any message type (text, media, interactive, templates…).

**Q19.** CSW closed hone par?  
**A19.** Sirf approved templates (business-initiated).

**Q20.** Inbound user → business pe Meta charge?  
**A20.** Nahi — user messages free (Meta does not charge inbound).

**Q21.** Free entry point (FEP) CSW se same hai kya?  
**A21.** Nahi. FEP (e.g. Click-to-WA ads) alag free window rules; CSW independent. Donoth confuse in sales talk.

### D. Pricing — two ledgers

**Q22.** 1 Jul 2025 se Meta ka dominant model?  
**A22.** Per-message pricing (PMP) for delivered template messages — conversation-based pricing deprecated.

**Q23.** “Conversation charge” UI copy aaj bhi theek hai?  
**A23.** Nahi — legacy. Live bill = delivered templates (+ upcoming service from Oct 2026).

**Q24.** Do ledgers kaun se?  
**A24.** (1) Samyoj SaaS — Razorpay INR, software seats/AI/features. (2) Meta Cloud API — customer WABA Billing Hub. Kabhi mix mat karo ek blended “WhatsApp ₹X.”

**Q25.** Tech Provider hone par Meta API usage ka invoice kispe aata hai?  
**A25.** Customer ke Meta / WABA payment method pe. Samyoj sirf software charge kare.

**Q26.** Solution Partner ka bada farq?  
**A26.** Meta credit line; partner clients ko API usage invoice kar sakta hai; onboarding pe customer card skip possible.

**Q27.** India WABA INR migration hard date (docs)?  
**A27.** Eligible customers: migrate WABAs to INR by **31 Dec 2026** or Meta may stop delivering non-INR WABAs from **1 Jan 2027**.

**Q28.** 1 Oct 2026 upcoming — service messages?  
**A28.** Service (non-template in CSW) become billable per-message; utility-in-CSW also charged; no volume tiers for service (per upcoming docs).

**Q29.** Samyoj plan price mein Meta per-msg rate fold karna?  
**A29.** **Never** as product truth. Disclose Meta bills separately. CURRENT CODE heuristics ≠ official invoice.

**Q30.** Volume tiers kis categories pe (today)?  
**A30.** Utility + Authentication (when charged). Marketing — no volume discount. Aggregated at business portfolio.

### E. Tech Provider / Embedded Signup

**Q31.** Samyoj TARGET partner model?  
**A31.** Tech Provider — sell inbox/AI/automation software; Meta bills Cloud API.

**Q32.** UI mein “BSP” likhna kab OK?  
**A32.** Tabhi jab tum really Solution Partner ho. Industry slang BSP ≈ SP. Samyoj aaj/TARGET = Tech Provider language.

**Q33.** Embedded Signup kya solve karta hai?  
**A33.** Customer ko guided flow mein WABA/number create + app ko permissions — multi-tenant onboard without manual BM gymnastics.

**Q34.** Tech Provider customer ko production messaging se pehle kya add karna padta hai?  
**A34.** Payment method on their WhatsApp Business account (Meta bills them).

**Q35.** App Review / Advanced Access bina Embedded Signup permissions?  
**A35.** `whatsapp_business_management` + `whatsapp_business_messaging` typically need Advanced Access — warna ES grants fail / API error patterns.

**Q36.** Price transparency (Service Provider terms) ka spirit?  
**A36.** Client ko clearly dikhao: tumhare software fees vs Meta API charges — blend mat karo; portability / client owns WABA.

### F. Dev vs Live

**Q37.** Development Mode mein app kaun use kar sakta hai (concept)?  
**A37.** Mostly roles/testers on the app — not arbitrary public businesses at scale.

**Q38.** Live mode switch karne se App Review skip?  
**A38.** Nahi. Permissions / products often still need App Review & policy compliance for Advanced Access.

**Q39.** Test WABA / test numbers ka billing twist?  
**A39.** Docs: relaxed limits; often no payment method required for template sends — **not** production customer path.

**Q40.** “Humara OAuth localhost pe chal gaya = customers live onboard ho sakte hain”?  
**A40.** Galat. Live app, review, Tech Provider setup, customer payment method, production webhook HTTPS — alag gates.

### G. Bans / policy

**Q41.** Opt-in kyun non-negotiable hai?  
**A41.** Business Terms / Messaging Policy — spam reports → quality drop → restrictions / disable. Campaigns fail-closed consent Samyoj mein intentional.

**Q42.** AI-as-primary-product-via-WhatsApp policy vibe?  
**A42.** Solution Terms: AI/ML as primary product offered via WhatsApp generally prohibited (region exceptions). Ancillary AI inside inbox OK with constraints; no training general models on Business Solution Data.

**Q43.** Client ne WABA transfer manga — spirit of portability?  
**A43.** Don’t hostage the WABA; terms expect transfer assistance then delete as instructed — SaaS lock-in via Meta asset = policy risk.

**Q44.** Wrong template category (utility dikha ke promo) risk?  
**A44.** Recategorization, enforcement, trust hit — Meta category gaming = ban vector.

### H. Samyoj current surface

**Q45.** Connect UX mein normal user ko App ID/Secret dikhana hai?  
**A45.** **Nahi.** Platform credentials `META_APP_ID` / `META_APP_SECRET` server `.env`. User: Connect → OAuth → pick number.

**Q46.** Outbound vs inbound tunnel?  
**A46.** Outbound Graph localhost pe chal sakta hai. Inbound phone→Inbox needs public HTTPS webhook (dev: ngrok). `totalReceived: 0` usually infra, not Inbox cosmetics.

**Q47.** Workers kaun chalata hai Samyoj mein?  
**A47.** Embedded in API (`startWorkers`). PM2 whatsapp-api only; standalone `start:worker` exits 1 — don’t run separate worker process.

**Q48.** Aaj (2026-08-25 memory) customer production-ready claim?  
**A48.** **No.** Test-deploy (`bash start.sh`) OK for internal testing. Open: customer-host inbound proof, restore drill on customer host, SAMYOJ-35 TARGET subscriptions, live WebRTC transfer stub, etc. Auth cookies + manual billing landed in code — still not “production complete.”

### I. Future IG / FB (bonus depth)

**Q49.** Instagram Messaging API Samyoj ke current WhatsApp Inbox ka drop-in clone hai?  
**A49.** Nahi. Alag product surface (Page/IG professional account, Messenger Platform family). Tokens/webhooks patterns reuse possible; UX + policy + rate limits alag. Future scope — don’t sell as shipped.

**Q50.** Messenger / Page automation ko WhatsApp WABA billing se mix?  
**A50.** Mat mix. Different assets, often different commercial models. Ads Marketing API spend ≠ Cloud API template PMP ≠ Samyoj SaaS.

**Q51.** Ek Meta App se theoretically multi-product (WA + IG + Page)?  
**A51.** Haan possible architecture — same app, multiple products/permissions — lekin App Review, UX, and data isolation per channel still separate hard work.

**Q52.** “Phase C / IG ship next sprint” bolne se pehle kya clear hona chahiye?  
**A52.** WhatsApp production honesty first (inbound proof, partner Live, two-ledger billing TARGET). IG/FB = adjacent roadmap, not a patch on broken WA foundations.

---

## Scoring guide

| Score | Meaning |
| --- | --- |
| 45–52 | Teach a teammate tomorrow |
| 35–44 | Solid; re-read pricing + partner + Samyoj surface |
| 25–34 | Day 1 foundations incomplete — repeat D1-1…D1-7 |
| &lt; 25 | Stop building features; finish Track A readings only |

**Pass bar for Sonu (founder):** ≥ 40/52 **and** you can deliver the 90-second two-ledger pitch without notes.

---

## 90-second pitch (memorize Day 2)

> Samyoj software hai — inbox, campaigns, AI, automations. Aap Razorpay pe SaaS pay karte ho. WhatsApp messages Meta Cloud API pe chalte hain — aapka WABA, aapka Meta bill, per delivered template (aur Oct 2026 se service replies bhi). Hum Tech Provider posture lete hain: Meta aapse API usage leta hai, hum software. Template categories, 24h window, aur opt-in follow karna padega warna quality/ban risk aapka number pe hai. Hum WhatsApp nahi hain; hum aapka control plane hain.

---

## Sources to keep open while studying

- https://developers.facebook.com/docs/whatsapp/pricing/
- https://developers.facebook.com/docs/whatsapp/cloud-api/get-started
- https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/send-messages
- https://developers.facebook.com/docs/whatsapp/solution-providers/
- https://developers.facebook.com/docs/whatsapp/embedded-signup/
- https://www.whatsapp.com/legal/business-solution-terms/
- `docs/billing/17-META-WHATSAPP-BILLING-AND-POLICY.md`
- `docs/memory/STATUS_AND_FUTURE.md`

---

## Out of scope (this sprint)

- Writing code, migrations, or App Review screenshots submission
- Implementing SAMYOJ-35 / IG / Messenger
- Claiming production-ready
- Memorizing unofficial ₹/msg blog rates as “official”

---

*Leaf L15 — curriculum + quiz. Feed master guide “Quiz” + “2-day study” sections from this file.*
