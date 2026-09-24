# Phase 7 — Linked assets (Settings only)

**Code status (25 Sep 2026):** shipped as Settings → Channels. WhatsApp, Facebook, and Instagram connect cards are grouped there; duplicate standalone channel tabs were removed. Inboxes stay separate.

**Ships:** one Settings list of what is connected. Optional. Do this after the inboxes exist, not before.

## Do

- Settings → a **Channels** list: WhatsApp numbers, Facebook Page, Instagram account. Same card row as today’s numbers.
- Disconnect = soft (`isActive=false`). History stays.
- Topbar switcher stays the WhatsApp number switcher until more than one **WhatsApp** number exists. Do not make it switch Page vs number in the same control (different inboxes).

## Don't

- Do not merge the three inboxes.
- Do not show App ID.
- Do not add X, email, or SMS.
- Do not block phase 1 on this screen. Phase 1 uses the Facebook Page card alone.

## How it works

Read `Channel` + `WhatsappNumber` for the org. Render cards. Connect buttons deep-link to the existing connect actions.

## UI

`WhatsAppChannelsPanel` card, repeated. Section titles: WhatsApp, Facebook, Instagram. Empty section hidden until that phase has shipped.

## Test

- [ ] Disconnect Page stops new leads and does not delete old leads.
- [ ] WhatsApp disconnect behavior stays the current soft disconnect.
- [ ] No secret fields.
- [ ] Browser smoke confirms WhatsApp, Facebook, and Instagram appear once under Channels.

## Competitors

Chatwoot puts “add inbox” in Settings and the threads in the inbox list. Same split.
