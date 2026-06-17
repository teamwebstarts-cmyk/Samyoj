# Palerma Public API

Base URL: `{SERVER_URL}/api/v1`

Authentication: `X-Api-Key: wa_...` header (create keys in Settings → Integrations).

## Health

```
GET /api/v1/health
```

No auth required.

## Send message

```
POST /api/v1/messages
X-Api-Key: wa_...
Content-Type: application/json

{
  "phone": "919876543210",
  "name": "Customer",
  "content": "Hello!",
  "type": "TEXT"
}
```

Template message:

```json
{
  "phone": "919876543210",
  "type": "TEMPLATE",
  "templateName": "hello_world",
  "templateLanguage": "en_US",
  "content": "Hello"
}
```

## List contacts

```
GET /api/v1/contacts?page=1&limit=50
X-Api-Key: wa_...
```

## List conversations

```
GET /api/v1/conversations?status=OPEN&page=1&limit=50
X-Api-Key: wa_...
```

## Usage & billing

```
GET /api/v1/usage
GET /api/v1/feature-flags
X-Api-Key: wa_...
```

## Outbound webhooks

Configure in Settings → Integrations. Events:

- `message.received`
- `message.sent`
- `conversation.assigned`
- `conversation.closed`
- `sla.breached`

Verify payloads with `X-Webhook-Signature` (HMAC-SHA256 of body using endpoint secret).

## Legacy send endpoint

JWT or API key:

```
POST /api/messages/send
Authorization: Bearer {token}
# or
X-Api-Key: wa_...
```

## Rate limits

- Global API: 500 requests / 15 min per IP
- Campaign daily send limit: configurable in Settings → Campaigns
- Daily Meta budget cap: configurable in Settings → Campaigns

## Google Sheets export

```
GET /api/integrations/google-sheets/export
Authorization: Bearer {token}
```

Returns CSV compatible with Google Sheets import.

## Payment links (Razorpay)

```
POST /api/billing/payment-link
Authorization: Bearer {token}

{
  "amountPaise": 50000,
  "description": "Invoice #1234",
  "customerPhone": "919876543210"
}
```
