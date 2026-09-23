# Phase 2 — Click-to-WhatsApp chip

**Ships:** a label on an existing WhatsApp thread when the person tapped WhatsApp on an ad.  
**No new menu. No Marketing API.**

## Do

- Read referral / CTWA fields the WhatsApp webhook already sends on the first message.
- Show chip under the contact name in WhatsApp Inbox: **WhatsApp ad** + campaign or ad name when present.
- Keep the existing 24h pill. Add copy that the free entry window is 72h from the ad click when Meta says so on that payload. If the payload has no timestamp, show the chip without a fake countdown.

## Don't

- Do not create the ad.
- Do not file this chat under Facebook → Leads.
- Do not add it to Meta Ads lead count or CPL.
- Do not request `ads_management` for this phase (phase 1 may already have requested it for leadgen; this phase does not call it).

## How it works

```text
Person taps WhatsApp on a Meta ad
  → normal WhatsApp webhook (object stays whatsapp_business_account)
  → conversation opens as today
  → if referral block present, save ad id + headline on the conversation
  → chip renders in the thread header
```

Store on the conversation (`botState.ctwaReferral` + `ctwaReceivedAt`). Not a new Lead unless the agent creates one by hand.

**Payload fields (Cloud API, as used in code):** `referral.source_id`, `referral.headline`, `referral.body`, `referral.source_type`, `referral.source_url`, `referral.ctwa_clid` (optional). Meta does **not** send campaign name on this webhook — chip `name` is `headline`, else `body`. No click timestamp → no fake 72h countdown.

## UI

Existing `ChatHeader` name row. Chip is a small pill, same height as `ServiceWindowBadge`, emerald, text **WhatsApp ad**. Tooltip is the ad name. No new page, no filter chip required.

## Test

- [x] Inbound with a referral fixture shows the chip.
- [x] Inbound without referral shows no chip.
- [ ] The thread still assigns, notes, and replies like any WhatsApp chat.
- [x] Facebook → Leads count does not change.

## Competitors

Wati tracks CTWA inside the WhatsApp inbox and warns that Meta “clicks” include people who never message. We show only threads we actually received.
