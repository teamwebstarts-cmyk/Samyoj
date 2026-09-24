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

Current status: the HTTP route handles `page` and `instagram` through the non-WABA durable path after signature validation. Phase 0 does not create contacts; later dispatchers own Page/Instagram feature writes.

## UI

None. Sidebar stays as shipped.

## Test

- [ ] Send a normal WhatsApp inbound. `totalReceived` still increments.
- [ ] Signed Page and Instagram fixtures reach signature validation, organization resolution, and durable claim. Regression coverage exists; public Meta proof remains pending.
- [ ] After that path exists, POST a signed Page fixture. It must not create a WhatsApp conversation, and a second identical fixture must not double-insert (`ProviderWebhookEvent` unique).
- [ ] Existing lead create still errors with “Connect a WhatsApp number” until phase 1 changes that route on purpose.

## Competitors

None of this is visible. Wati/Gallabox hide the same plumbing. Skipping it is how IG breaks number isolation.
