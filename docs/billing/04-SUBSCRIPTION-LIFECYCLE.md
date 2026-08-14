# 04 — Subscription lifecycle (TARGET)

CURRENT CODE: `activatePlan` = `now + 30 calendar days`. UI says “Billed monthly · cancel anytime.” There is **no** subscription, cancel, pause, or status write except `active`. This chapter is TARGET.

## 1. States

`trial` → `active` → (`past_due` → `grace` → `halted`/`locked`) or `cancelled` (access until period end) → `expired`.

`paused` (Razorpay pause) = no charges, entitlements frozen at pause (treat as locked send).

Never leave paid entitlements on `active` after halt.

## 2. Create

1. Catalog SKU → Razorpay Plan id (mapped in server config, not client).
2. Razorpay Subscription `create` + Checkout authorize mandate (UPI Autopay / card / eNACH).
3. Webhook `subscription.authenticated` / `activated` / first `charged` → write `plan`, `cadence`, `razorpaySubscriptionId`, `currentPeriodEnd`, `subscriptionStatus=active`.
4. Bind amount: charged paise **must** equal catalog SKU. Ignore client `planId`.

## 3. Renew

Razorpay auto-debits. On `subscription.charged` + `payment.captured`: extend `currentPeriodEnd`, issue GST invoice for that period (see [06](06-INVOICING-TAX-COMPLIANCE.md)).

If debit fails: [07](07-DUNNING-AND-FAILURES.md).

## 4. Upgrade (mid-cycle)

Always allowed Launch→Starter→Growth→Pro. Cadence may stay or change.

**Day-based proration (IST calendar), exclusive of GST:**

```
remaining_days     = currentPeriodEnd.date - today (IST), inclusive of today or exclusive — pick exclusive remaining whole days and document in code comments
period_days        = days in the *current paid* period (30 / 90 / 365 as stored, not “always 30”)
unused_credit      = remaining_days / period_days * amount_paid_ex_gst
new_period_days    = days of the *new* SKU period
new_debit          = remaining_days / new_period_days * new_plan_amount_ex_gst
net                = max(0, new_debit - unused_credit)
```

- Charge **net** now (Razorpay add-on / update subscription + invoice). Reset cycle to today (simpler) **or** keep anniversary (Razorpay default). **Recommendation: keep Razorpay billing cycle; use add-on for net.** Document which in implementation ticket — do not mix.
- GST: tax on the **net upgrade invoice**, plus credit note if unused_credit is refunded in cash (prefer **credit against new invoice**, not refund, for upgrades).
- Entitlements flip **immediately** on paid upgrade.

Yearly → monthly upgrade is unusual (higher effective rate); allow but show “you lose yearly discount.”

## 5. Downgrade

**End of term only.** No mid-cycle refund of prepaid yearly/quarterly. Schedule `pendingPlanId` + `pendingCadence`. At period end, Razorpay update plan / new subscription.

If seats/numbers/contacts **over** the target plan: block schedule until they shed (disconnect extra WA, deactivate seats, export contacts). Show counts.

GST: no credit note unless they cancel and policy grants refund (default: no refund of unused prepaid).

## 6. Cancel

Customer: Settings → Billing → Cancel. Access until `currentPeriodEnd`. Then Launch-expired lock (read Inbox) or hard lock — **same as trial expiry**, not a free Starter forever.

Do not delete WABA. Portability 30 days if they leave to another ISP ([17](17-META-WHATSAPP-BILLING-AND-POLICY.md)).

## 7. Pause

Razorpay `subscription.pause`. Rare; offer only via support. Sending locked.

## 8. Reactivate

New Checkout if halted/cancelled. No second Launch trial.

## 9. Grandfathering CURRENT CODE orgs

| Today | TARGET mapping |
| --- | --- |
| `starter` free unlimited time | Convert to **Launch expired** or complimentary **Starter monthly ₹0 until they pick** — **do not** silently charge. Recommended: banner “Choose a plan by DATE”; after DATE, Launch lock. Sales call. |
| `growth` paid ₹3,999 / 30d | Map to **Growth monthly** at **₹2,499** going forward (price **drop** — honor, do not charge 3999). If `planExpiresAt` in future, wait until that date then start Razorpay Subscription. |
| `business` ₹11,999 / 30d | Map to **Pro monthly ₹4,999** (also a drop) **or** grandfather 50 seats as custom until they change. Do not strand 50-seat orgs on 25-seat Pro without notice. Recommended: `legacy_business` entitlement 50 seats / 5 WA until they switch SKU. |
| `enterprise` | Stay custom. |

Never auto-enroll a mandate on grandfathered orgs without Checkout.

## 10. Clock

Use **IST** for “billing day” display. Store UTC in DB. `activatePlan(+30d)` is retired.
