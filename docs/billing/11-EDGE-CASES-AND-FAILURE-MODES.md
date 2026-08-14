# 11 — Edge cases and failure modes

Forty-plus. CURRENT CODE callouts where already true.

1. **Client `planId` spoof** — pay Growth, POST `business`. CURRENT: works. TARGET: ignore client; use session SKU.
2. **Webhook without payment notes** — CURRENT: may never activate. TARGET: key off subscription id / our session row.
3. **Verify replay** — CURRENT: +30d again. TARGET: idempotent `event.id` / already-CAPTURED.
4. **Empty webhook secret** — CURRENT: 400/false. TARGET: fail boot.
5. **HMAC `===`** — timing leak. TARGET: `timingSafeEqual`.
6. **Amount mismatch** — tampered Checkout. Reject; do not activate.
7. **GSTIN invalid** — allow B2C without; block “B2B invoice” claim.
8. **UPI Autopay > ₹15k incl GST** — Growth yearly / Pro quarterly+yearly. Hide UPI; offer card or cheaper cadence.
9. **Partial capture** — rare; do not entitle until full amount.
10. **Double Checkout tabs** — two Orders; one pays. Entitlements once; refund duplicate via support.
11. **Upgrade during past_due** — collect fail + upgrade net; or block upgrade until card works.
12. **Downgrade with 12 seats on Starter** — block schedule until seats ≤ 3.
13. **Extra WA numbers on Meta, 1 slot on Starter** — do not auto-import; list “unmanaged numbers.”
14. **Meta test number vs production** — test WABA may send templates without Meta card; do not teach customers that’s production.
15. **Meta card missing** — send template 4xx. Banner: add card in BM. Do not refund Samyoj.
16. **Meta quality RED** — campaigns paused optional; SaaS still billed.
17. **Meta ban** — SaaS continues until cancel; no automatic refund (Terms).
18. **INR WABA not migrated by 2026-12-31** — Meta stops delivery 2027-01-01. Settings warning.
19. **Auth-international surprise** — India WABA messaging UAE OTPs. Estimate UI must not assume all IN.
20. **Service messages become paid 2026-10-01** — copy update; estimates SERVICE ≠ 0.
21. **Coexistence app send** — free at Meta; Inbox must show echo or agent double-sends (and Cloud API send **is** billed).
22. **Calling without Meta payment method** — cannot place business-initiated. Feature entitled ≠ call succeeds.
23. **AI primary-product risk** — positioning “WhatsApp GPT” as the product. Keep AI ancillary.
24. **Vendor trains on chats** — contract + DPA; Solution Terms breach → Meta can kill WABA.
25. **Seat PATCH 500** — CURRENT. TARGET: clamp to plan.
26. **Contact 100,001 inbound** — park vs drop ([02](02-ENTITLEMENTS-AND-QUOTAS.md)).
27. **Trial serial orgs** — fingerprint; one Launch.
28. **Grandfather business 50 seats** — don’t slam to Pro 25.
29. **Clock IST vs UTC** — period end 18:30 UTC ≠ midnight IST.
30. **Leap year yearly** — 365 vs 366; store period_days on subscription.
31. **Razorpay halted vs our active** — reconcile job daily.
32. **Webhook before verify** — either path entitles once.
33. **`subscriptionStatus` never expired** — CURRENT. Worker must write it.
34. **`billing:expiring` no listener** — CURRENT. Client must subscribe or use REST poll.
35. **estimateCost GET vs POST** — CURRENT client GET, server POST. Campaign preview broken.
36. **Payment Links mixed with SaaS** — agent confusion. Separate nav: “Collect from your customers.”
37. **Enterprise verbal discount** — only custom Razorpay plan + PDF quote id.
38. **Refund without credit note** — GST break.
39. **Charge Meta usage on Razorpay** — Tech Provider must not; SP must split lines.
40. **Selling green tick** — never.
41. **Creating WABA for unnamed future client** — Service Provider Terms forbid.
42. **Blocking client WABA on churn** — forbidden; 30-day portability.
43. **Embedded Signup v2 after 2026-10-15** — migrate v4.
44. **Portfolio 2-number cap vs Pro 5 slots** — Meta may refuse 3rd number until verified; UX: “Verify business in Meta to add more numbers” **and** “Upgrade Samyoj” are different errors — show the right one.
45. **Currency 83 FX** — never show as official.
46. **FEATURE_MATRIX DONE** — ignore.
47. **OrgFeatureFlag unused** — don’t sell flags that don’t gate.
48. **Empty `RAZORPAY_KEY`** — UI still shows plans; CURRENT `razorpayConfigured`. Keep; disable Checkout CTA.
49. **Agent opens /billing** — 403. Nav already ADMIN; deep link must match.
50. **GST 18% change** — tax rate in config, not hardcoded forever.
