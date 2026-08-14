# 16 — Self-QA

Questions asked while writing this pack, with researched answers. Date **2026-08-14**. Meta answers cite [17](17-META-WHATSAPP-BILLING-AND-POLICY.md).

---

### Q1. Can Samyoj legally sell a WhatsApp inbox SaaS with our own INR plans? Under what partner model?

**Yes, as a Tech Provider** (or later Tech Provider + Solution Partner multi-partner). Partners overview (updated 2026-05-21): Tech Providers offer full Cloud API services; **Meta bills clients for API usage**; the Tech Provider **bills for other services**. Service Provider Terms allow charging for integration, support, management, storage, and bundling with other products. We must not resell “WhatsApp itself,” hide Meta fees, spoof the brand, create WABAs for unnamed future clients, or block WABA access. App Review + Embedded Signup required. Solution Partner is optional (credit line).

### Q2. Must we show Meta fees separately from Samyoj subscription on invoices?

**Tech Provider (TARGET):** Samyoj GST invoice = **SaaS only**. Meta fees appear on **WhatsApp Manager / Billing Hub**. Still **disclose in UI and contract** that PMP/calling charges apply and are billed by Meta. **Solution Partner:** Price Transparency **requires** disclosing Facebook’s charge **separate from** our charge. Never blend into one “WhatsApp ₹X” line. Recommendation: never mix Meta INR into the Razorpay subscription invoice.

### Q3. Who is the Meta billed party — customer’s BM or Samyoj’s BM?

**Tech Provider:** customer’s BM / WABA payment method. **Solution Partner:** partner credit line; partner is Bill-To and liable to Meta, then invoices the client. Embedded Signup: if not SP, customer **must attach a card before messaging**.

### Q4. What if we connect numbers beyond plan — product gate vs Meta?

Meta cap: **2** registered numbers per new portfolio, **20** when verified or messaging limit 2,000. Independent of Starter=1 / Growth=2 / Pro=5. **Samyoj must product-gate** connect/register. “1 WhatsApp number” = **in-product connect slot**, not Meta’s phone-number fee and not the portfolio cap. Meta may allow more; we must not attach extras.

### Q5. Calling / AI voice — Meta billing or policy in entitlements?

Calling API (updated 2026-07-09): **user-initiated free**; business-initiated **6-second pulses** × country × volume tiers; **payment method required**; permission-request messages = **PMP**. Separate from Samyoj Calling **module**. AI: Business Solution Terms **2026-03-06** — AI as **primary** WhatsApp product prohibited (EEA/Brazil exception); no training general models on Business Solution Data; exclusive fine-tune OK. Disclose third-party AI; keep inbox AI **ancillary**.

### Q6. What must we disclose in UI?

Third-party platform (not WhatsApp); conversation/**per-message** charges apply, billed by Meta (or BSP); add payment method in WhatsApp Manager; opt-in for templates/calls; quality/bans are Meta’s; from **1 Oct 2026** service replies may be charged; India INR WABA migration by **31 Dec 2026**. No App Secret. No “unlimited WhatsApp included.”

---

### Q7. Is conversation-based pricing still live?

**No.** Deprecated; replaced **1 Jul 2025** by per-message pricing. CBP page kept for historical webhooks (`pricing_model: CBP`). Our `ConversationCharge` poll is **legacy**.

### Q8. Are service messages still free?

**As of 2026-08-14, yes** (since 1 Nov 2024 for CBP service; PMP non-templates free in CSW). **From 1 Oct 2026 they are charged** per message at utility/auth market rates, **no volume tiers**. Utility **inside CSW** also loses its free ride that day. Rates due by 1 Sep 2026.

### Q9. Should list prices include GST?

**No — exclusive + “+ GST”.** 18%. Display ₹2,499/mo + GST. Razorpay debit may be **GST-inclusive** so UPI Autopay amount is stable ([05](05-PAYMENTS-RAZORPAY.md)).

### Q10. Why quarterly ~5% and yearly ~20%?

User-specified. Catalog uses **rounded** 950 / 2,375 / 4,750 and 800 / 2,000 / 4,000 — do not recompute 0.95× in float paise.

### Q11. Which SKUs break UPI Autopay ₹15,000 AFA-free?

Incl. GST: **growth_yearly ₹28,320**, **pro_quarterly ₹16,815**, **pro_yearly ₹56,640**. Hide UPI; card/eNACH or steer to quarterly.

### Q12. Razorpay Subscriptions vs Orders vs Chargebee vs Stripe?

**Subscriptions** for recurring INR+UPI. Orders = Phase 0 / one-shots. Chargebee = later dunning luxury. Stripe = not first India rail.

### Q13. Can Razorpay Invoices be our GST invoice?

**No** (no SAC/tax API). We issue Rule 46 PDFs.

### Q14. One trial per what?

**Per organization.** Start at **org create**. No card. 14 days. No silent convert.

### Q15. Proration: Stripe-style second or day?

**Day-based IST.** Upgrades charge net now. Downgrades **end of term**, no prepaid refund.

### Q16. Should we overage-bill extra seats?

**v1 no.** Unlock Growth. Avoid G2-hated surprise overages.

### Q17. Is QualityRatingBanner → /billing correct?

**Partially.** Keep signal; add WhatsApp Manager; do not imply paying Samyoj fixes GREEN.

### Q18. Are campaign heuristics OK to show?

As **estimates** with disclaimer. ₹0.78/0.35/FX83 are **wrong vs live INR CSV**. Never invoice them.

### Q19. FEATURE_MATRIX says billing DONE?

**False.** Audit 4/10. Ignore that row.

### Q20. Seat limit 25 default vs starter 5?

CURRENT bug. TARGET Launch 1 / Starter 3 / Growth 10 / Pro 25. PATCH must clamp.

### Q21. Payment Links for SaaS?

**No.** Those are for the org’s end customers.

### Q22. Grandfather ₹3,999 Growth customers?

Map to Growth monthly **₹2,499** (price drop). Don’t auto-mandate. `business` 50 seats → `legacy_business` until they pick Pro.

### Q23. Who pays if Inbox reply volume explodes?

**Today:** Meta $0 for non-templates in CSW. **From 2026-10-01:** customer’s Meta bill. Samyoj SaaS unchanged. Do not market “unlimited free replies” without the date.

### Q24. Multi-tenant one WABA for all customers?

**Forbidden pattern.** Each client’s WABA. No WABA for future unnamed client.

### Q25. Train our LLM on all tenants’ chats?

**No.** Solution Terms AI Providers. Fine-tune **exclusive per client** only.

### Q26. Sell Meta message credits on Starter?

Not under Tech Provider (Meta already bills them). Credits = we became SP/BSP. Out of v1.

### Q27. Enterprise “Meta included”?

Only with **written pass-through**, Solution Partner credit line, and split invoice lines. Default Enterprise still pays Meta.

### Q28. Display name / green tick in entitlements?

**No SKU.** Meta eligibility. Never sell.

### Q29. Coexistence: does Business app open our 24h window?

**No.** App messages free and do not create/extend Cloud API CSW. Cloud API sends still billed.

### Q30. Client GET estimateCost vs server POST?

CURRENT bug — campaign preview broken. Fix in Phase 0/1 when coding; documented only here.

### Q31. Empty `RAZORPAY_WEBHOOK_SECRET`?

CURRENT: signature fail. TARGET: **do not start** webhook route.

### Q32. verify uses client planId?

CURRENT critical bug. Phase 0 #1.

### Q33. Is BSP the same as Tech Provider?

**No.** Industry “BSP” ≈ **Solution Partner** (credit line). We should say **Tech Provider** in contracts until we are SP.

### Q34. Must customers pay Meta even if they pay Samyoj?

**Yes** (Tech Provider). Two merchants, two cards.

### Q35. Legal pages changing 2026-09-23?

WhatsApp Legal index says Business terms update that day. **Re-read** 24–27 in [15](15-SOURCES.md) after that date.

### Q36. Can we product-gate below Meta’s 2-number floor?

**Yes.** Starter 1 slot is our license, not Meta’s cap.

### Q37. Should Growth include Calling?

This pack: **Calling entitled on Pro+**, Meta minutes extra. Growth stays AI+automation without promising Calling.

### Q38. Opt-in WhatsApp-specific?

Business Policy: lawful opt-in required; best practice category-specific; separate opt-in to **call**. Don’t send marketing templates without recorded opt-in in CRM.

### Q39. Portability if they churn?

Assist WABA transfer within **30 days**; delete our copies unless instructed. Do not hold the number hostage.

### Q40. Is this pack implementation?

**No.** Markdown only under `docs/billing/`. Zero `server/` `client/` edits.
