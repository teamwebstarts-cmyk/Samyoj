# WhatsApp Cloud API - Coexistence Reference

> **Author:** Issac
> **API Version:** v25.0
> **Last Updated:** 2026-06-26

---

## Overview

**Coexistence** lets a single phone number run on the **WhatsApp Business App** and the **WhatsApp Cloud API at the same time**. The business keeps using the app on their phone for day-to-day chats while you send and receive messages through the API. Chat history is preserved, and messages flow both ways:

- Messages **you send via the Cloud API** appear in the business's WhatsApp Business App.
- Messages the **business sends from the app** are mirrored to your API webhook (`smb_message_echoes`).

Coexistence rolled out through Embedded Signup on **May 6, 2025**. It is enabled with a customized Embedded Signup flow (not the standard Cloud API number registration), and onboarding triggers a one-time sync of past messages and contacts.

**Billing:** Messages the business sends from the app remain **free**. Messages you send via the Cloud API are billed normally under per-message pricing — see [CONVERSATIONS.md](CONVERSATIONS.md).

---

## Eligibility & Requirements

| Requirement | Detail |
|-------------|--------|
| App version | WhatsApp Business app **v2.24.17 or newer** on the phone holding the number |
| Prior usage | Number actively used on the WhatsApp Business app for **at least 7 days** |
| Partner role | Solution Partner / Tech Provider with a configured webhook endpoint |
| Number origin | Only numbers **currently on the WhatsApp Business app** — a WABA originally created via a developer app **cannot** be onboarded through coexistence |

> **Keep-alive:** The business should open the WhatsApp Business app regularly to keep coexistence active. Meta documents a minimum cadence of roughly **once every 13 days**; if the app goes unused beyond that, coexistence can be disrupted.

---

## Onboarding via Embedded Signup

Coexistence uses a customized Embedded Signup flow flagged with `featureType: "whatsapp_business_app_onboarding"`. Pass it in the `extras` of your Embedded Signup launch configuration:

```json
{
  "config_id": "<CONFIGURATION_ID>",
  "response_type": "code",
  "override_default_response_type": true,
  "extras": {
    "setup": {},
    "featureType": "whatsapp_business_app_onboarding",
    "sessionInfoVersion": "3"
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `config_id` | `string` | Your Embedded Signup configuration ID |
| `response_type` | `string` | Always `"code"` to receive an authorization code |
| `override_default_response_type` | `boolean` | Set `true` to use the code response type |
| `extras.featureType` | `string` | Must be `"whatsapp_business_app_onboarding"` to enable the coexistence flow |
| `extras.sessionInfoVersion` | `string` | Session info schema version (e.g., `"3"`) |

When the user completes the flow, the JS SDK posts a session-completion message you can listen for:

```json
{
  "data": { "waba_id": "<CUSTOMER_WABA_ID>" },
  "type": "WA_EMBEDDED_SIGNUP",
  "event": "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING",
  "version": 3
}
```

| Field | Type | Description |
|-------|------|-------------|
| `data.waba_id` | `string` | WhatsApp Business Account ID of the onboarded business |
| `type` | `string` | Always `"WA_EMBEDDED_SIGNUP"` |
| `event` | `string` | `"FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING"` on successful coexistence onboarding |
| `version` | `number` | Session info version |

**Onboarding limits:** By default you can onboard up to **10** new business customers in a rolling 7-day window. This increases to **200** new business customers per rolling 7-day window after you complete **Business Verification**, **App Review**, and **Access Verification**.

---

## Checking Coexistence Status

To confirm a number is set up for coexistence, query its `is_on_biz_app` and `platform_type` fields:

```bash
curl 'https://graph.facebook.com/v25.0/<PHONE_NUMBER_ID>?fields=is_on_biz_app,platform_type' \
  -H 'Authorization: Bearer <ACCESS_TOKEN>'
```

**Response:**

```json
{
  "is_on_biz_app": true,
  "platform_type": "CLOUD_API",
  "id": "<PHONE_NUMBER_ID>"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `is_on_biz_app` | `boolean` | `true` when the number is also active on the WhatsApp Business app (i.e., in coexistence) |
| `platform_type` | `string` | The platform the number is registered on, e.g. `"CLOUD_API"` |
| `id` | `string` | The phone number ID |

---

## Coexistence Webhooks

Onboarding a coexistence number subscribes three additional webhook fields **on top of** the standard `messages` field. Each arrives in Meta's native webhook envelope (`object` → `entry[]` → `changes[]` → `value` + `field`), identical in shape to the standard webhooks in [WEBHOOKS.md](WEBHOOKS.md).

| Webhook (`field`) | Purpose | When it fires |
|-------------------|---------|---------------|
| `history` | One-time sync of past messages (up to 180 days) the business sent/received in the app | Minutes after onboarding succeeds — only if the business opted to share history |
| `smb_app_state_sync` | Sync of the business's contacts — existing contacts, plus ongoing additions/changes | Minutes after onboarding, then whenever contacts change in the app |
| `smb_message_echoes` | Ongoing mirror of messages the business sends from the app into your API inbox | Continuously, post-onboarding |

---

### `history` Webhook

Delivers past conversation threads in chunks. Each chunk reports its `phase` and `progress` so you can track sync completion.

```json
{
  "object": "whatsapp_business_account",
  "entry": [
    {
      "id": "<WABA_ID>",
      "changes": [
        {
          "value": {
            "messaging_product": "whatsapp",
            "metadata": {
              "display_phone_number": "<BUSINESS_PHONE_NUMBER>",
              "phone_number_id": "<BUSINESS_PHONE_NUMBER_ID>"
            },
            "history": [
              {
                "metadata": {
                  "phase": 0,
                  "chunk_order": 1,
                  "progress": 55
                },
                "threads": [
                  {
                    "id": "<WHATSAPP_USER_PHONE_NUMBER>",
                    "messages": [
                      {
                        "from": "<BUSINESS_OR_WHATSAPP_USER_PHONE_NUMBER>",
                        "to": "<WHATSAPP_USER_PHONE_NUMBER>",
                        "id": "<WHATSAPP_MESSAGE_ID>",
                        "timestamp": "<DEVICE_TIMESTAMP>",
                        "type": "<MESSAGE_TYPE>",
                        "<MESSAGE_TYPE>": {},
                        "history_context": {
                          "status": "<MESSAGE_STATUS>"
                        }
                      }
                    ]
                  }
                ]
              }
            ]
          },
          "field": "history"
        }
      ]
    }
  ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `changes[].field` | `string` | Always `"history"` |
| `value.history[].metadata.phase` | `number` | Sync phase / time window: `0` = 0–1 day, `1` = 1–90 days, `2` = 90–180 days |
| `value.history[].metadata.chunk_order` | `number` | Order of this chunk within the phase |
| `value.history[].metadata.progress` | `number` | Sync progress as a percentage (0–100) |
| `value.history[].threads[].id` | `string` | The WhatsApp user's phone number (the conversation thread) |
| `value.history[].threads[].messages[].from` | `string` | Sender — the business or the WhatsApp user |
| `value.history[].threads[].messages[].to` | `string` | Recipient phone number |
| `value.history[].threads[].messages[].id` | `string` | Original WhatsApp message ID (`wamid`) |
| `value.history[].threads[].messages[].timestamp` | `string` | Device timestamp of the original message |
| `value.history[].threads[].messages[].type` | `string` | Message type; content is nested under a key matching the type (e.g., `text`) |
| `value.history[].threads[].messages[].history_context.status` | `string` | Message status at sync time (e.g., `delivered`, `read`) |

If the business **declined** to share history, the `history` array contains an error instead of threads:

```json
{
  "messaging_product": "whatsapp",
  "metadata": {
    "display_phone_number": "<BUSINESS_PHONE_NUMBER>",
    "phone_number_id": "<BUSINESS_PHONE_NUMBER_ID>"
  },
  "history": [
    {
      "errors": [
        {
          "code": 2593109,
          "title": "History sync is turned off by the business from the WhatsApp Business App",
          "message": "History sync is turned off by the business from the WhatsApp Business App",
          "error_data": {
            "details": "History sharing is turned off by the business"
          }
        }
      ]
    }
  ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `history[].errors[].code` | `number` | `2593109` when history sharing is turned off by the business |
| `history[].errors[].title` | `string` | Short error description |
| `history[].errors[].message` | `string` | Detailed error message |
| `history[].errors[].error_data.details` | `string` | Additional context |

---

### `smb_app_state_sync` Webhook

Syncs the business's contacts from the app — both the initial contact list after onboarding and any later additions or changes. Contacts arrive in the `state_sync` array.

```json
{
  "object": "whatsapp_business_account",
  "entry": [
    {
      "id": "<WABA_ID>",
      "changes": [
        {
          "value": {
            "messaging_product": "whatsapp",
            "metadata": {
              "display_phone_number": "<BUSINESS_PHONE_NUMBER>",
              "phone_number_id": "<BUSINESS_PHONE_NUMBER_ID>"
            },
            "state_sync": [
              {
                "type": "contact",
                "contact": {
                  "full_name": "<CONTACT_FULL_NAME>",
                  "first_name": "<CONTACT_FIRST_NAME>",
                  "phone_number": "<CONTACT_PHONE_NUMBER>"
                },
                "action": "<ACTION>",
                "metadata": {
                  "timestamp": "<WEBHOOK_TIMESTAMP>"
                }
              }
            ]
          },
          "field": "smb_app_state_sync"
        }
      ]
    }
  ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `changes[].field` | `string` | Always `"smb_app_state_sync"` |
| `value.state_sync[].type` | `string` | Sync entity type, e.g. `"contact"` |
| `value.state_sync[].contact.full_name` | `string` | Contact's full name as saved in the app |
| `value.state_sync[].contact.first_name` | `string` | Contact's first name |
| `value.state_sync[].contact.phone_number` | `string` | Contact's phone number |
| `value.state_sync[].action` | `string` | The contact change being synced (e.g., a contact added or updated) |
| `value.state_sync[].metadata.timestamp` | `string` | Unix timestamp of the sync event |

---

### `smb_message_echoes` Webhook

Mirrors messages the business sends from the WhatsApp Business app (or a linked device) after onboarding, so app-originated conversations show up in your API inbox. Echoed messages are **outbound from the business** — note `from` is the business number.

```json
{
  "object": "whatsapp_business_account",
  "entry": [
    {
      "id": "<WABA_ID>",
      "changes": [
        {
          "value": {
            "messaging_product": "whatsapp",
            "metadata": {
              "display_phone_number": "<BUSINESS_PHONE_NUMBER>",
              "phone_number_id": "<BUSINESS_PHONE_NUMBER_ID>"
            },
            "message_echoes": [
              {
                "from": "<BUSINESS_PHONE_NUMBER>",
                "to": "<WHATSAPP_USER_PHONE_NUMBER>",
                "id": "<WHATSAPP_MESSAGE_ID>",
                "timestamp": "<WEBHOOK_TIMESTAMP>",
                "type": "<MESSAGE_TYPE>",
                "<MESSAGE_TYPE>": {}
              }
            ]
          },
          "field": "smb_message_echoes"
        }
      ]
    }
  ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `changes[].field` | `string` | Always `"smb_message_echoes"` |
| `value.message_echoes[].from` | `string` | The business phone number (sender — echoes are outbound) |
| `value.message_echoes[].to` | `string` | The WhatsApp user the business messaged |
| `value.message_echoes[].id` | `string` | Message ID (`wamid`) |
| `value.message_echoes[].timestamp` | `string` | Unix timestamp the message was sent |
| `value.message_echoes[].type` | `string` | Message type; content nested under a key matching the type (e.g., `text`) |

> **Edits and deletions:** An echo `type` can also be `edit` or `revoke` when the business edits or deletes a message from the app. These carry the same `original_message_id` shape used by edit/revoke events on the standard `messages` webhook (see [WEBHOOKS.md](WEBHOOKS.md)).

---

## Handling Coexistence Webhooks

Route on `changes[].field` and branch the coexistence fields off your standard webhook handler:

```typescript
function routeCoexistenceWebhook(body: WebhookPayload): void {
  const change = body.entry?.[0]?.changes?.[0];

  switch (change?.field) {
    case 'history':
      // One-time backfill of past threads (check metadata.progress for completion)
      syncHistory(change.value.history);
      break;
    case 'smb_app_state_sync':
      // Existing + new contacts from the Business App
      syncContacts(change.value.state_sync);
      break;
    case 'smb_message_echoes':
      // Messages the business sent from the app — mirror into your inbox
      mirrorEchoes(change.value.message_echoes);
      break;
    default:
      // 'messages' and status updates are handled by the standard router
      handleStandardWebhook(body);
  }
}
```

---

## Manual Sync (Re-triggering)

You can request a history or contacts sync via the `smb_app_data` endpoint on the phone number:

```bash
curl -X POST 'https://graph.facebook.com/v25.0/<PHONE_NUMBER_ID>/smb_app_data' \
  -H 'Authorization: Bearer <ACCESS_TOKEN>' \
  -H 'Content-Type: application/json' \
  -d '{
    "messaging_product": "whatsapp",
    "sync_type": "history"
  }'
```

**Response:**

```json
{
  "messaging_product": "whatsapp",
  "request_id": "<REQUEST_ID>"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `messaging_product` | `string` | Always `"whatsapp"` |
| `sync_type` | `string` | What to sync: `"history"` or `"smb_app_state_sync"` |
| `request_id` | `string` | ID of the sync request; results arrive on the corresponding webhook |

> **One-time:** Contact sync and history sync are one-time operations — they cannot be repeated for the same number without offboarding and re-onboarding.

---

## Sync Constraints & Limits

| Constraint | Detail |
|------------|--------|
| Sync window | Complete the sync within **24 hours** of onboarding, or the flow must be restarted |
| History range | **Last 180 days** — `phase 0` = 0–1 day, `phase 1` = 1–90 days, `phase 2` = 90–180 days |
| Media history | Media asset details are available only for messages within the **last 14 days** |
| Throughput | Coexistence (dual-platform) numbers are capped at **20 messages/second** — lower than the standard 80/sec Cloud API rate |
| Repeatability | Contact sync and history sync are **one-time** (see above) |

---

## Offboarding & Account Updates

Coexistence lifecycle changes are delivered on the `account_update` webhook field.

```json
{
  "object": "whatsapp_business_account",
  "entry": [
    {
      "id": "<WABA_ID>",
      "time": 1739212624,
      "changes": [
        {
          "value": {
            "phone_number": "<BUSINESS_PHONE_NUMBER>",
            "event": "PARTNER_REMOVED",
            "disconnection_info": {
              "reason": "<DISCONNECTION_REASON>",
              "initiated_by": "<DISCONNECTION_INITIATED_BY>"
            }
          },
          "field": "account_update"
        }
      ]
    }
  ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `changes[].field` | `string` | Always `"account_update"` |
| `value.event` | `string` | Lifecycle event — `PARTNER_REMOVED`, `ACCOUNT_OFFBOARDED`, or `ACCOUNT_RECONNECTED` |
| `value.phone_number` | `string` | The affected business phone number (present on `PARTNER_REMOVED`) |
| `value.disconnection_info.reason` | `string` | Why the number was disconnected |
| `value.disconnection_info.initiated_by` | `string` | Who initiated the disconnection |

`ACCOUNT_OFFBOARDED` (the business left coexistence) and `ACCOUNT_RECONNECTED` (coexistence restored) carry just the `event` field:

```json
{
  "object": "whatsapp_business_account",
  "entry": [
    {
      "id": "<WABA_ID>",
      "time": "<WEBHOOK_TIMESTAMP>",
      "changes": [
        {
          "value": { "event": "ACCOUNT_OFFBOARDED" },
          "field": "account_update"
        }
      ]
    }
  ]
}
```

---

## Capabilities & Limitations

- **Template messages** can still be sent on a coexistence number, and the standard **24-hour customer service window** rules still apply — see [CONVERSATIONS.md](CONVERSATIONS.md).
- Messages the business sends from the app are mirrored to the API via `smb_message_echoes`; messages you send via the API appear in the app.
- **No Official Business Account (OBA) green badge** and no standard Business Verification on coexistence numbers.
- App-sent messages remain **free**; API-sent messages are billed normally.
- The customer service window opens only when the user initiates contact after Cloud API onboarding.

---

## See Also

- [WEBHOOKS.md](WEBHOOKS.md) — Standard webhook verification, message, and status payloads
- [CONVERSATIONS.md](CONVERSATIONS.md) — 24-hour window and pricing categories
- [PHONE-NUMBERS.md](PHONE-NUMBERS.md) — Phone number IDs, registration, and E.164 format
- [MESSAGING.md](MESSAGING.md) — Sending all message types via the Cloud API
