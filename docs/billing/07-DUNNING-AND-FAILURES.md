# 07 — Dunning and payment failures

## 1. Goal

Maximize recovery without lying that the org is `active`. CURRENT CODE: failures do not write `past_due`; expiry never downgrades.

## 2. Razorpay behaviour (cards)

Typical: retry **T+1, T+2, T+3** then subscription **`halted`**. UPI Autopay: fail often **no retry** or limited — treat first fail as `past_due` immediately and prompt in-app “Update UPI mandate.”

## 3. Samyoj states

| Day | Status | Product |
| --- | --- | --- |
| 0 fail | `past_due` | Banner + email. **Sending still on** (paid they already had). |
| After Razorpay retries exhausted or T+3 | `grace` (3–7 days, pick **5**) | Soft lock: campaigns off, AI off, Connect extra numbers off. Inbox send **on** (do not strand support). |
| Grace end / `halted` | `locked` | Send off. Read Inbox on. Unlock Growth/pay CTA. |
| Customer cancels | `cancelled` | Access through period end if they cancelled while current, else locked. |

Do not delete data. Do not disconnect WABA.

## 4. Emails / in-app

1. Payment failed (amount, last4 / VPA, update payment).
2. Retry scheduled (if card).
3. Grace started.
4. Locked.
5. Receipt on success.

Channels: email + in-app billing banner. Not WhatsApp templates to the **owner’s personal chat** unless they opted in (irony: that would be a marketing/utility template billed to **our** WABA).

## 5. Idempotency

`payment.failed` then later `charged`: flip to `active`, clear banner. Do not double-extend.

## 6. Chargebee-style (reference only)

Smart retries, card updater, dunning emails. We implement a **thin** version on Razorpay webhooks. Do not buy Chargebee in Phase 0–2.

## 7. Meta payment fail ≠ Samyoj dunning

If Meta declines the **customer’s BM card**, templates stop at Meta. Samyoj subscription can still be healthy. Surface: “WhatsApp Manager payment method failed” from send errors (`(#131042)` payment issues — confirm live error catalog). Do not lock Samyoj for Meta card failure; do show a Connect/Inbox banner.
