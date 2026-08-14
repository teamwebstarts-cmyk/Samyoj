# 03 — Trial and conversion (TARGET)

## 1. Launch trial

| | TARGET | CURRENT CODE |
| --- | --- | --- |
| Length | **14 days** | None. Signup = `plan=starter`, `subscriptionStatus=active`, `planExpiresAt=null` |
| Price | ₹0 | ₹0 starter forever |
| Card | **Not required** (India SMB / UPI). Conversion emails do the work. | n/a |
| Entitlements | Launch: 1 WA, 1 seat, 100 contacts, 1 workflow, Inbox Core, AI **off** | Ungated starter |
| CTA | Start free trial | Implicit |

**Start event (pick one — recommended): organization create.** Clock starts even if they never Connect WhatsApp. Alternative (Connect-start) inflates “active trials” and delays conversion; reject unless sales insists.

**One trial per org.** Fingerprint later: GSTIN / PAN / phone / payment instrument. Do not offer a second Launch after expiry without sales (Enterprise POC).

## 2. During trial

- Full Launch entitlements. Connect WhatsApp (1 number). Send inside CSW; templates if they attached a **Meta** payment method (Tech Provider — Meta still requires their card).
- Banner: “Trial · N days left · Unlock Growth” + cadence picker.
- Day 7 email: inbox value + Growth AI unlock.
- Day 12: expiry warning + Starter as cheaper landing vs Growth as Most Popular.
- No AI teaser that trains abuse (user decision: AI not included on Launch).

## 3. Expiry without conversion

**Soft lock (recommended):**

- Inbox **read** + search history.
- Send blocked (composer: Unlock).
- Campaigns / automations paused (not deleted).
- Keep the **1 connected number** registered so inbound is not lost — store inbound, show “subscribe to reply.”
- Team stays at 1; extra invites already impossible on Launch.

**Hard lock after 14 more days (day 28):** disconnect webhooks optional; still do **not** delete WABA (Service Provider portability — customer owns it). Data retention per DPA (recommend 90 days then export prompt).

Never silently convert to paid. Never keep `subscriptionStatus=active` on Launch after `trialEndsAt`.

## 4. Conversion

Checkout: Razorpay Subscription for `starter_*` / `growth_*` / `pro_*`. Default highlight **Growth quarterly**.

Proration: trial leftover days are **not** credited (trial was free). First paid period starts at conversion timestamp.

GST: first invoice on conversion. Collect GSTIN on checkout (optional for B2C; required prompt for B2B).

## 5. Abuse

- Serial orgs from same email domain: review queue.
- Trial + 5,000 campaign blast: Launch campaign budget should be **stricter** than paid (recommend 50 recipients/day on Launch). CURRENT CODE 5,000/day would let a trial burn Meta quality. Meta still bills **their** WABA — we still owe them a quality guard.

## 6. Card-on-file debate

Industry: no-card trials convert ~8–25%; card-on-file ~30–60% with higher start friction. India UPI culture: **no card on Launch**. Compensate with in-app paywall + WhatsApp/email dunning-style trial nags (not Razorpay dunning — there is no mandate yet).
