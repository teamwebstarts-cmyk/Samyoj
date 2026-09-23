# Phase 0 — Foundation

**Ships:** schema + webhook router. **No screen.** WhatsApp must look the same.  
**Depends on:** nothing. **Blocks:** every later phase.  
**Official:** Page webhooks are a different `object` than WhatsApp. Today we drop them. See [ARCHITECTURE.md](../ARCHITECTURE.md).

## Do

- Add `Channel` and `ContactPlatformIdentity`.
- Leave `WhatsappNumber` in place. Inbox still keys off it.
- Update the HTTP webhook route, `processWebhookPayload`, and `dispatchNonMessageWebhookFields` together: branch on `payload.object` instead of returning before signature, organization resolution, and durability.
- Keep the WhatsApp branch byte-for-byte in behavior.
- Store Page tokens with the existing encrypt helper. New table, same crypto.

## Don't

- No Facebook menu item.
- No Instagram.
- No ads tiles.
- Do not put a Page id on `WhatsappNumber`.
- Do not nullable-wipe `Contact.phone` for WhatsApp rows.

## How it works

```text
Meta POST /webhook
  object = whatsapp_business_account → existing processor
  object = page, field = leadgen      → claim event, stop (handler is phase 1)
  anything else                        → claim + ignore (so we can see it in logs)
```

This is the target behavior, not the current behavior. Today the HTTP route returns before non-WABA payloads reach organization resolution or the durable event path. Phase 0 does not create contacts.

## UI

None. Sidebar stays as shipped.

## Test

- [ ] Send a normal WhatsApp inbound. `totalReceived` still increments.
- [ ] **Not implemented today:** the HTTP route currently returns `200` for `{ "object": "page", "entry": [...] }` before signature, organization resolution, and durable claim. Do not mark this gate passed until the route and Page/IG ownership path are implemented.
- [ ] After that path exists, POST a signed Page fixture. It must not create a WhatsApp conversation, and a second identical fixture must not double-insert (`ProviderWebhookEvent` unique).
- [ ] Existing lead create still errors with “Connect a WhatsApp number” until phase 1 changes that route on purpose.

## Competitors

None of this is visible. Wati/Gallabox hide the same plumbing. Skipping it is how IG breaks number isolation.
