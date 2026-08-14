# 01 — Pricing catalog (TARGET)

User source of truth. Do not substitute CURRENT CODE prices (Growth ₹3,999 / Business ₹11,999).

**Tax:** All list prices below are **exclusive of GST**. Checkout and invoices add 18% (CGST+SGST or IGST). Display: `₹2,499/mo + GST`.

**Cadence rule:** Same entitlements per plan. Only list price and billing period change.

## 1. Discount math (explicit)

Quarterly effective monthly is **~5% off** monthly. Yearly effective monthly is **~20% off** monthly.

| Plan | Monthly list | ×0.95 (quarterly monthly-equiv) | Catalog quarterly monthly-equiv | Quarterly invoice | ×0.80 (yearly monthly-equiv) | Catalog yearly monthly-equiv | Yearly invoice |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Starter | 999 | 949.05 | **950** | **2,850** | 799.20 | **800** | **9,600** |
| Growth | 2,499 | 2,374.05 | **2,375** | **7,125** | 1,999.20 | **2,000** | **24,000** |
| Pro | 4,999 | 4,749.05 | **4,750** | **14,250** | 3,999.20 | **4,000** | **48,000** |

Rounding: catalog uses the **user-supplied** rounded figures, not raw 0.95/0.80. Do not re-derive at runtime from monthly × 0.95 (float paise bugs). Store **invoice paise** as integers.

### Paise (exclusive of GST)

| SKU ID | Plan | Period days (nominal) | Amount paise | Razorpay plan period |
| --- | --- | ---: | ---: | --- |
| `launch_trial` | Launch | 14 | 0 | n/a (internal) |
| `starter_monthly` | Starter | 30 | 99_900 | monthly |
| `starter_quarterly` | Starter | 90 | 285_000 | quarterly |
| `starter_yearly` | Starter | 365 | 960_000 | yearly |
| `growth_monthly` | Growth | 30 | 249_900 | monthly |
| `growth_quarterly` | Growth | 90 | 712_500 | quarterly |
| `growth_yearly` | Growth | 365 | 2_400_000 | yearly |
| `pro_monthly` | Pro | 30 | 499_900 | monthly |
| `pro_quarterly` | Pro | 90 | 1_425_000 | yearly? **No — quarterly** |
| `pro_yearly` | Pro | 365 | 4_800_000 | yearly |

Razorpay Subscriptions `period`: `monthly` + `interval: 1`, `monthly` + `interval: 3`, `yearly` + `interval: 1`.

### Incl. GST (18%) — for UPI Autopay design

AFA-free recurring debit cap for generic SaaS: **₹15,000 per transaction**.

| SKU | Excl. GST | Incl. GST | UPI Autopay AFA-free? |
| --- | ---: | ---: | --- |
| starter_monthly | 999 | 1,178.82 | Yes |
| starter_quarterly | 2,850 | 3,363.00 | Yes |
| starter_yearly | 9,600 | 11,328.00 | Yes |
| growth_monthly | 2,499 | 2,948.82 | Yes |
| growth_quarterly | 7,125 | 8,407.50 | Yes |
| growth_yearly | 24,000 | 28,320.00 | **No** — card / e-NACH or split not allowed; offer quarterly as UPI path |
| pro_monthly | 4,999 | 5,898.82 | Yes |
| pro_quarterly | 14,250 | 16,815.00 | **No** (exceeds 15k incl. GST) |
| pro_yearly | 48,000 | 56,640.00 | **No** |

**Product rule:** On the cadence toggle, if the selected SKU incl. GST > ₹15,000, disable “Pay with UPI Autopay” and show “Use card or netbanking e-mandate for this amount. Or pick quarterly to pay with UPI.”

## 2. Launch (trial) — all cadences

Not a paid SKU. Entitlement tier `launch`.

| | |
| --- | --- |
| Price | ₹0 / 14 days, then choose a paid plan |
| WhatsApp numbers (connect slots) | 1 |
| Team members | 1 |
| Contacts | 100 |
| Shared inbox & CRM | Core |
| Automation | 1 workflow |
| Analytics | Basic |
| Support | Community |
| Integrations | Basic |
| AI Assistant | **Not included** |
| CTA | **Start free trial** |

CURRENT CODE: signup creates `plan = "starter"`, `subscriptionStatus = "active"`, `planExpiresAt = null`. There is **no trial**. TARGET replaces default `starter` with `launch` + `trialEndsAt`.

## 3. Starter

| | Monthly | Quarterly | Yearly |
| --- | --- | --- | --- |
| Effective / month | ₹999 | ₹950 | ₹800 |
| Billed | ₹999 / month | ₹2,850 / 3 months | ₹9,600 / year |

Entitlements: WA 1 · Team 3 · Contacts 5,000 · Inbox Included · Automation 5 workflows · Analytics Basic · Support Email · Integrations Standard · AI **Not included**.

CTA: Choose Starter.

## 4. Growth — MOST POPULAR

| | Monthly | Quarterly | Yearly |
| --- | --- | --- | --- |
| Effective / month | ₹2,499 | ₹2,375 | ₹2,000 |
| Billed | ₹2,499 / month | ₹7,125 / 3 months | ₹24,000 / year |

Entitlements: WA 2 · Team 10 · Contacts 25,000 · Inbox Advanced · Automation Unlimited · AI **Included** · Analytics Advanced · Support Priority · Integrations Advanced.

CTA: **Unlock Growth** (from Launch/Starter paywalls) or Choose Growth.

Badge: Most Popular. Default cadence on pricing page: **quarterly** (India SMB habit) with yearly as savings callout.

## 5. Pro

| | Monthly | Quarterly | Yearly |
| --- | --- | --- | --- |
| Effective / month | ₹4,999 | ₹4,750 | ₹4,000 |
| Billed | ₹4,999 / month | ₹14,250 / 3 months | ₹48,000 / year |

Entitlements: WA 5 · Team 25 · Contacts 100,000 · Inbox Advanced · Automation Unlimited · AI **Advanced** · Analytics Advanced · Support Priority · Integrations Advanced.

CURRENT CODE `business` (₹11,999, 50 seats, “voice calling / API”) is **retired as a public SKU**. Map existing `business` orgs via grandfathering ([04](04-SUBSCRIPTION-LIFECYCLE.md)).

## 6. Enterprise

Custom pricing. CTA: **Talk to Experts**.

| | |
| --- | --- |
| WhatsApp numbers | Unlimited (Samyoj slots; Meta portfolio cap still applies) |
| Team | Custom |
| Contacts | Unlimited |
| Inbox | Advanced |
| Automation | Unlimited |
| AI | Dedicated |
| Analytics | Custom |
| Support | Dedicated |
| Integrations | Custom |

Process: sales form → quote PDF (validity 14 days) → Razorpay Subscription with custom plan **or** invoice + e-mandate. Optional Meta **pass-through** only if Samyoj is (or partners as) Solution Partner and the contract says so. Default: customer still pays Meta.

## 7. What is not in the catalog

- Per-seat add-ons (v1). Hit the seat cap → Unlock Growth / Pro.
- Conversation packs.
- Meta message credits sold by Samyoj (Tech Provider model).
- USD SKUs.
- Forever-free Starter (Launch expires; unpaid → read-only / community lock per [03](03-TRIAL-AND-CONVERSION.md)).

## 8. Display rules

- Show **effective monthly** large, **billed amount** in secondary type: “₹2,000/mo · billed ₹24,000 yearly + GST”.
- Always show a footnote: Meta WhatsApp fees extra.
- Do not show App ID, App Secret, or “Advanced override.”
- Enterprise card: no price, Talk to Experts.

## 9. CURRENT CODE catalog (do not ship)

`server/src/modules/billing/plans.ts`: starter ₹0 / 5 seats / “500 contacts”; growth 399900 paise; business 1199900 paise; enterprise custom / 200 seats. `create-order` only accepts `growth|business`. Replace wholesale in Phase 1.
