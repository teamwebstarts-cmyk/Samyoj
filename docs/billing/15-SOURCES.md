# 15 — Sources

**Accessed:** 2026-08-14 unless noted. URLs were fetched or searched that day. Pages change; re-fetch before engineering.

Official Meta/WhatsApp first. Then Razorpay, GST, competitors. Third-party blogs are **not** rate cards.

## Meta / WhatsApp — commercial

1. [Pricing on the WhatsApp Business Platform](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing) — updated **2026-08-05**. PMP from 1 Jul 2025; CSW/FEP free rules; INR rate-card links; India localization; volume tiers. Also: https://developers.facebook.com/docs/whatsapp/pricing/
2. [Conversation-based pricing (Deprecated)](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing/conversation-based-pricing) — updated **2026-05-21**. Historical CBP; service conversations free from 1 Nov 2024.
3. [Upcoming pricing updates for Meta Business Agent, service and utility messages](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing/non-template-messages) — 1 Aug 2026 agent tokens; **1 Oct 2026** service + in-CSW utility charged; no volume tiers for service.
4. [Authentication-international rates](https://developers.facebook.com/docs/whatsapp/pricing/authentication-international-rates/) — when auth-international applies (India listed).
5. [Calling API Pricing](https://developers.facebook.com/docs/whatsapp/cloud-api/calling/pricing/) — updated **2026-07-09**. User-initiated free; 6-second pulses; INR cards; permission requests = PMP.
6. [Pricing updates / volume tiers notes](https://developers.facebook.com/docs/whatsapp/pricing/updates-to-pricing/) — India migrate WABAs to INR by **2026-12-31**.
7. [Send messages / customer service windows](https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/send-messages) — 24h CSW; quality rating explanation.
8. [Service messages (Cloud API guides)](https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages/) — CSW; quality 7-day feedback.
9. Help Center: About billing for your WhatsApp Business Account (linked from Pricing “Billing” section) — Meta Business Suite / Billing Hub. Entry: search Meta Business Help “WhatsApp Business Account billing.”

## Meta / WhatsApp — partners, assets, limits

10. [Partners overview (Tech Provider vs Solution Partner vs Tech Partner)](https://developers.facebook.com/documentation/business-messaging/whatsapp/solution-providers/overview) — updated **2026-05-21**. Credit line vs Meta bills client.
11. [Partners (docs/whatsapp/solution-providers)](https://developers.facebook.com/docs/whatsapp/solution-providers/) — same comparison table.
12. [Become a Tech Provider](https://developers.facebook.com/documentation/business-messaging/whatsapp/solution-providers/get-started-for-tech-providers) — clients add a card; Embedded Signup.
13. [Embedded Signup](https://developers.facebook.com/docs/whatsapp/embedded-signup/) — Tech Provider must attach customer payment method; SP shares credit line.
14. [Embedded Signup FAQ](https://developers.facebook.com/docs/whatsapp/embedded-signup/faq/)
15. [Onboard WhatsApp Business app users (coexistence)](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users) — app messages free; do not open Cloud API CSW.
16. [Coexistence custom flow](https://developers.facebook.com/docs/whatsapp/embedded-signup/custom-flows/onboarding-business-app-users/)
17. [Business phone numbers](https://developers.facebook.com/docs/whatsapp/cloud-api/phone-numbers/) — quality_rating GREEN/YELLOW/RED; cap 2 → 20.
18. [Phone numbers reference](https://developers.facebook.com/docs/whatsapp/cloud-api/reference/phone-numbers/)
19. [Messaging limits](https://developers.facebook.com/docs/whatsapp/messaging-limits/) — portfolio-level unique users / 24h outside CSW.
20. [Upcoming changes to messaging limits](https://developers.facebook.com/documentation/business-messaging/whatsapp/upcoming-messaging-limits-changes/)
21. [About the WhatsApp Business Platform](https://developers.facebook.com/documentation/business-messaging/whatsapp/about-the-platform) — Cloud API vs test numbers (no payment method).
22. [Webhooks](https://developers.facebook.com/docs/whatsapp/cloud-api/guides/set-up-webhooks/) — quality, `smb_message_echoes`.
23. [Platform changelog](https://developers.facebook.com/docs/whatsapp/business-platform/changelog/) — Embedded Signup v2 deprecation **2026-10-15** (confirm before build).

## WhatsApp / Meta — legal & policy

24. [WhatsApp Legal index](https://www.whatsapp.com/legal/?lang=en) — notes terms update **effective 2026-09-23**.
25. [WhatsApp Business Terms of Service](https://www.whatsapp.com/legal/business-terms/) — opt-in, fees/taxes, service providers + metrics.
26. [WhatsApp Business Solution Terms](https://www.whatsapp.com/legal/business-solution-terms/) — last modified **2026-03-06**. Third Party Service Provider; **AI Providers**; no profile-building.
27. [WhatsApp Business Terms for Service Providers](https://www.whatsapp.com/legal/business-terms-for-service-providers/) — last modified **2018-06-12**. Price Transparency; portability 30 days; no WABA for future unnamed client; do not block Client WABA.
28. [WhatsApp Business Policy (Messaging + Commerce)](https://www.whatsapp.com/legal/business-policy) — opt-in; templates; Meta Commerce Policy for catalogs.
29. [WhatsApp Messaging Guidelines](https://www.whatsapp.com/legal/messaging-guidelines)
30. [Meta Commerce Policy](https://www.facebook.com/policies/commerce) — linked from Business Policy commerce section.
31. [WhatsApp Brand Guidelines](https://about.meta.com/brand/resources/whatsapp/whatsapp-brand/) — do not spoof official WhatsApp (confirm live URL via legal index “WhatsApp Brand Guidelines”).
32. Meta Terms for WhatsApp Business — listed on legal index under WhatsApp Business API.

## Razorpay / RBI / PCI

33. [Razorpay Subscriptions](https://razorpay.com/docs/payments/subscriptions/) — plans, periods, webhooks.
34. [Razorpay Subscription webhooks](https://razorpay.com/docs/webhooks/payments/subscriptions/) — authenticated/charged/halted/etc.
35. [Razorpay UPI Autopay](https://razorpay.com/docs/payments/subscriptions/upi-autopay/) — e-mandate / recurring.
36. [Razorpay Orders](https://razorpay.com/docs/api/orders/) — CURRENT CODE path.
37. [Razorpay Payment Links](https://razorpay.com/docs/payments/payment-links/) — org-customer collection, not SaaS.
38. RBI e-mandate AFA-free limit **₹15,000** for generic MCC — RBI circulars / NPCI UPI Autopay FAQs (re-read current circular before go-live).
39. PCI DSS SAQ A — hosted checkout; [PCI SSC SAQ](https://www.pcisecuritystandards.org/document_library/).
40. RBI card-on-file tokenization — RBI CoF directions (cards stay with gateway).

## GST / India tax

41. CGST Act / **Rule 46** tax invoice particulars — CBIC GST portal.
42. GST rate **18%** on IT/SaaS (SAC 9983xx) — GST rate schedule; confirm SAC 998314 vs 998315 with CA.
43. Place of supply for services — IGST Act s.12 (B2B recipient location).
44. E-invoicing threshold (₹5 crore historical) — CBIC e-invoice notifications; confirm current.

## Competitors & explainers (not official Meta rates)

45. Interakt / Wati / AiSensy / Gallabox public pricing pages (India WhatsApp inbox) — packaging only.
46. [360dialog pricing](https://www.360dialog.com/) — zero Meta markup positioning.
47. Twilio WhatsApp pricing — Meta pass-through + Twilio fee.
48. [Zendesk: upcoming WhatsApp pricing changes](https://support.zendesk.com/hc/en-us/articles/11113277351322-Announcing-upcoming-changes-to-WhatsApp-Business-messaging-pricing) — restates Oct 2026 service messages; useful as a second reader, not a substitute for Meta.
49. Chargebee dunning documentation — UX reference only.
50. Samyoj `docs/audit/BILLING_SYSTEM_REVIEW.md` — CURRENT CODE 2026-08-14.

## Internal code cited (not URLs)

- `server/src/modules/billing/plans.ts`, `routes.ts`, `razorpay.service.ts`, `usage.service.ts`
- `client/src/components/billing/QualityRatingBanner.tsx`
- `server/src/modules/team/types.ts` `DEFAULT_TEAM_SETTINGS.seatLimit`

**Do not use** unofficial blogs as India ₹/msg. Download **INR CSV** from source 1.
