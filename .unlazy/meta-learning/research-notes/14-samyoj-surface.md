# L14 — Samyoj codebase Meta surface map

**Source of truth:** repo code (read 2026-08-25). Do not invent endpoints.
**Primary files:**
- `server/src/modules/whatsapp/meta.service.ts`
- `server/src/modules/calling/meta-calling.service.ts`
- `server/src/modules/whatsapp/routes.ts` (webhook + OAuth Connect)
- `server/src/modules/templates/routes.ts`
- `server/src/modules/calling/routes.ts`
- `server/src/config/index.ts`
- `docs/billing/17-META-WHATSAPP-BILLING-AND-POLICY.md` (policy/pricing context; not Graph call sites)

**Base URL:** `https://graph.facebook.com/${config.meta.apiVersion}`  
**OAuth dialog host:** `https://www.facebook.com/${config.meta.apiVersion}/dialog/oauth`

---

## Config defaults (code)

| Env | Code default (`server/src/config/index.ts`) | Notes |
| --- | --- | --- |
| `META_API_VERSION` | **`v21.0`** | `.env.example` comments `v25.0` as a suggested override — **runtime default is still v21.0** unless env is set. |
| `META_APP_ID` / `META_APP_SECRET` | empty string | Platform credentials only (not in tenant UI). |
| `META_VERIFY_TOKEN` | `whatsapp_verify_token` | Webhook challenge + WABA override. |
| `META_REDIRECT_URI` | `http://localhost:3000/settings/whatsapp/callback` | Connect OAuth. |
| `META_WEBHOOK_URL` | empty | Must end with `/api/whatsapp/webhook` for inbound. |
| `META_ALLOW_TUNNEL_WEBHOOK` | false | Local-only; ignored when `NODE_ENV=production`. |

---

## OAuth scopes (exact string in code)

From `MetaWhatsAppService.getEmbeddedSignupUrl`:

```text
whatsapp_business_management,whatsapp_business_messaging
```

`debug_token` granular scope scan looks for the same two scope names and collects `target_ids` (WABA IDs).

Doc 17 notes App Review needs **Advanced Access** on both scopes or Embedded Signup / API returns permission error `200`.

---

## `META_WEBHOOK_FIELDS` (exact list)

Exported from `meta.service.ts` and POSTed when registering app webhook (`/{app-id}/subscriptions`, object `whatsapp_business_account`):

| Field |
| --- |
| `messages` |
| `calls` |
| `account_alerts` |
| `business_capability_update` |
| `phone_number_quality_update` |
| `phone_number_name_update` |
| `message_template_status_update` |
| `message_template_quality_update` |
| `message_template_components_update` |
| `template_category_update` |
| `user_preferences` |

Inbound HTTP: `GET/POST /api/whatsapp/webhook` in `whatsapp/routes.ts` (verify challenge + HMAC + queue/inline process). Dispatcher handles template/quality/prefs/alerts fields in `webhook-dispatcher.ts`.

---

## Feature map (Graph path / permission → file → purpose)

| Feature | Meta path / permission | File | Purpose | Official doc URL guess |
| --- | --- | --- | --- | --- |
| OAuth Connect dialog | `GET www.facebook.com/{ver}/dialog/oauth` · scopes `whatsapp_business_management`, `whatsapp_business_messaging` | `meta.service.ts` (`getEmbeddedSignupUrl`); wired from `whatsapp/routes.ts` | Start Facebook Login / Embedded Signup for Connect WhatsApp | https://developers.facebook.com/docs/facebook-login/guides/advanced/manual-flow |
| Code → short-lived token | `POST /{ver}/oauth/access_token` (form: client_id/secret, redirect_uri, code) | `meta.service.ts` (`exchangeCodeForToken`) | Exchange OAuth `code` without putting `client_secret` on query string | https://developers.facebook.com/docs/facebook-login/guides/access-tokens/get-long-lived |
| Short → long-lived token | `POST /{ver}/oauth/access_token` (`grant_type=fb_exchange_token`) | `meta.service.ts` (`exchangeForLongLivedToken`) | Persist usable user token on connect | https://developers.facebook.com/docs/facebook-login/guides/access-tokens/get-long-lived |
| Debug token / WABA discovery | `GET /{ver}/debug_token?input_token=` · app token `appId\|appSecret` · scopes above | `meta.service.ts` (`listAccessibleWabaIds`) | Prefer granular `target_ids` as WABA IDs before Business Manager walk | https://developers.facebook.com/docs/graph-api/reference/debug_token |
| List Businesses | `GET /me/businesses?fields=id,name` · user token | `meta.service.ts` | Fallback WABA discovery | https://developers.facebook.com/docs/marketing-api/business-manager/guides/get-started |
| Owned WABAs | `GET /{business-id}/owned_whatsapp_business_accounts?fields=id` | `meta.service.ts` | Fallback WABA discovery | https://developers.facebook.com/docs/whatsapp/business-management-api/get-started |
| Client WABAs | `GET /{business-id}/client_whatsapp_business_accounts?fields=id` | `meta.service.ts` | Partner/client shared WABAs | https://developers.facebook.com/docs/whatsapp/embedded-signup/manage-accounts |
| List phone numbers | `GET /{waba-id}/phone_numbers?fields=id,display_phone_number,verified_name` | `meta.service.ts` | Connect picker + identity sync | https://developers.facebook.com/docs/whatsapp/business-management-api/manage-phone-numbers |
| Send message (all types) | `POST /{phone-number-id}/messages` · messaging scope | `meta.service.ts` (`sendMessage`); callers: `messages/send.service.ts`, campaigns, templates send-test, commerce, calling permission request | Outbound text/template/media/interactive/location/contacts/reaction | https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages |
| Mark read | `POST /{phone-number-id}/messages` (`status: read`) | `meta.service.ts`; `inbox/routes.ts` | Blue ticks / read receipt | https://developers.facebook.com/docs/whatsapp/cloud-api/guides/mark-message-as-read |
| Typing indicator | `POST /{phone-number-id}/messages` (`typing_indicator`) | `meta.service.ts`; `automation/engine.ts` | Best-effort typing UX | https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/typing-indicators |
| Upload outbound media | `POST /{phone-number-id}/media` (multipart) | `meta.service.ts` (`uploadMedia`); `messages/send.service.ts` | Prefer media `id` over public link | https://developers.facebook.com/docs/whatsapp/cloud-api/reference/media |
| Media metadata | `GET /{media-id}` | `meta.service.ts` (`getMediaMetadata`) | Resolve download URL + mime | https://developers.facebook.com/docs/whatsapp/cloud-api/reference/media |
| Download media | `GET` Meta-returned media URL (Bearer) | `meta.service.ts` (`downloadMedia`); `media/download.service.ts` | Inbound media fetch for Inbox | https://developers.facebook.com/docs/whatsapp/cloud-api/reference/media#download-media |
| List templates | `GET /{waba-id}/message_templates` (fields + paging) | `meta.service.ts`; `templates/routes.ts`, `templates/cache.ts`, campaigns | Template library UI + send validation | https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates |
| Get template by name | `GET /{waba-id}/message_templates?name=` | `meta.service.ts`; templates + messages + campaigns | Single template fetch | https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates |
| Create template | `POST /{waba-id}/message_templates` | `meta.service.ts`; `templates/routes.ts` | Custom MARKETING/UTILITY/AUTHENTICATION | https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates |
| Clone from Meta library | `POST /{waba-id}/message_templates` (`library_template_name`, …) | `meta.service.ts` (`createMessageTemplateFromLibrary`); `templates/routes.ts` | SAMYOJ-11 Graph template clone | https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates/template-library |
| Browse template library | `GET /message_template_library?...` | `meta.service.ts`; `templates/routes.ts` | Search Meta’s library before clone | https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates/template-library |
| Delete template | `DELETE /{waba-id}/message_templates?name=` | `meta.service.ts`; `templates/routes.ts` | Remove template by name | https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates |
| Resumable template header upload | `POST /{app-id}/uploads` then `POST /{session-id}` | `meta.service.ts` (`uploadTemplateMedia`); `templates/routes.ts` | Header media handle `h` for template create | https://developers.facebook.com/docs/graph-api/guides/upload |
| Register app webhook | `POST /{app-id}/subscriptions` (object `whatsapp_business_account`, `fields=META_WEBHOOK_FIELDS`, verify_token, callback_url) | `meta.service.ts` (`registerAppWebhook`); `/setup-webhook` + Connect save | Point Meta callbacks at Samyoj | https://developers.facebook.com/docs/graph-api/webhooks/getting-started |
| Read app subscriptions | `GET /{app-id}/subscriptions` · app token | `meta.service.ts` (`getAppWebhookSubscriptions`) | Avoid clobbering durable prod URL with ngrok | https://developers.facebook.com/docs/graph-api/reference/application/subscriptions |
| Subscribe WABA to app | `POST /{waba-id}/subscribed_apps` | `meta.service.ts` (`ensureWabaSubscribed`) | Required for Cloud API send + webhook delivery | https://developers.facebook.com/docs/whatsapp/embedded-signup/webhooks |
| WABA callback override | `POST /{waba-id}/subscribed_apps` JSON `override_callback_uri` + `verify_token` | `meta.service.ts` (`postWabaCallbackOverride`) | Pin durable HTTPS so local ngrok cannot steal prod inbound | https://developers.facebook.com/docs/whatsapp/embedded-signup/webhooks |
| Webhook subscription status | `GET /{waba-id}/subscribed_apps` | `meta.service.ts` (`getWebhookStatus`); `whatsapp/routes.ts` `/webhook-status` | UI/debug whether our `appId` is subscribed | https://developers.facebook.com/docs/graph-api/reference/whats-app-business-account/subscribed_apps |
| Inbound webhook HTTP | Meta → `GET/POST …/api/whatsapp/webhook` (not Graph out) · HMAC with app secret | `whatsapp/routes.ts`, signature gate, dispatcher/processor | Receive messages/calls/template status/etc. | https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/components |
| List Flows | `GET /{waba-id}/flows?fields=…` | `meta.service.ts`; `wa-forms/routes.ts` | List WhatsApp Flows / forms | https://developers.facebook.com/docs/whatsapp/flows/reference/flowsapi |
| Get Flow | `GET /{flow-id}?fields=…` | `meta.service.ts`; `flows-assets/routes.ts` | Inspect published flow | https://developers.facebook.com/docs/whatsapp/flows/reference/flowsapi |
| Create Flow | `POST /{waba-id}/flows` (`name`, `categories`, `flow_json`) | `meta.service.ts`; `flows-assets/routes.ts` | Create draft Flow | https://developers.facebook.com/docs/whatsapp/flows/reference/flowsapi |
| Update Flow JSON | `POST /{flow-id}` (`flow_json`) | `meta.service.ts`; `flows-assets/routes.ts` | Patch flow definition | https://developers.facebook.com/docs/whatsapp/flows/reference/flowsapi |
| Publish Flow | `POST /{flow-id}/publish` | `meta.service.ts`; `flows-assets/routes.ts` | Publish for NFM / interactive | https://developers.facebook.com/docs/whatsapp/flows/reference/flowsapi |
| Flow encryption public key | `POST /{waba-id}/flows/public_key` (`business_public_key`) | `meta.service.ts`; `flows-assets/keys.ts` | Encrypt Flow endpoint payloads | https://developers.facebook.com/docs/whatsapp/flows/guides/implementingyourflowendpoint#upload-public-key |
| Product catalogs on WABA | `GET /{waba-id}/product_catalogs?fields=id,name` | `catalog/service.ts` via `graphGetPublic` | Commerce catalog picker | https://developers.facebook.com/docs/whatsapp/business-management-api/commerce-settings |
| Catalog products sync | `GET /{catalog-id}/products?fields=…` (+ paging) | `catalog/service.ts` | Sync products into Samyoj DB | https://developers.facebook.com/docs/marketing-api/reference/product-catalog/products |
| Conversation analytics (legacy shape) | `GET /{waba-id}?fields=conversation_analytics.start(…).end(…).granularity(DAILY).dimensions(["CONVERSATION_CATEGORY"])` | `meta.service.ts`; polled by `billing/usage.service.ts` `pollConversationAnalytics` | Fill `ConversationCharge` — **doc 17: legacy vs live PMP** | https://developers.facebook.com/docs/whatsapp/business-management-api/analytics |
| Phone quality rating | `GET /{phone-number-id}?fields=quality_rating,quality_score` | `meta.service.ts`; `pollQualityRatings` in `usage.service.ts` | Store `qualityRating` on number | https://developers.facebook.com/docs/whatsapp/cloud-api/reference/phone-numbers |
| Enable calling | `POST /{phone-number-id}/settings` (`calling.status=ENABLED`, icon, callback_permission) | `meta-calling.service.ts` (`enableCalling`); `calling/routes.ts` | Turn on Cloud API voice | https://developers.facebook.com/docs/whatsapp/cloud-api/calling |
| Get calling settings | `GET /{phone-number-id}/settings` | `meta-calling.service.ts`; `calling/routes.ts` | Detect `calling.status === ENABLED` | https://developers.facebook.com/docs/whatsapp/cloud-api/calling |
| Disable calling | `POST /{phone-number-id}/settings` (`calling.status=DISABLED`) | `calling/routes.ts` (inline fetch, not helper) | Turn off voice on Meta | https://developers.facebook.com/docs/whatsapp/cloud-api/calling |
| Call actions (SDP) | `POST /{phone-number-id}/calls` (`action`: connect / pre_accept / accept / reject / terminate + optional `session`) | `meta-calling.service.ts`; agent/outbound call services | WebRTC signaling with Meta | https://developers.facebook.com/docs/whatsapp/cloud-api/calling/user-initiated-calls |
| User call permissions | `GET /{phone-number-id}/call_permissions?user_wa_id=` | `meta-calling.service.ts` (code cites business-messaging calling docs) | Gate business-initiated calls | https://developers.facebook.com/documentation/business-messaging/whatsapp/calling/user-call-permissions |
| Call permission request message | `POST /{phone-number-id}/messages` interactive `call_permission_request` | `meta-calling.service.ts` (`sendCallPermissionRequest`) | Official permission UX (not fake reply buttons) | https://developers.facebook.com/documentation/business-messaging/whatsapp/calling/user-call-permissions |
| Webhook field `calls` | subscribed field (inbound) | `META_WEBHOOK_FIELDS` + calling inbound path | Ring / call status events | https://developers.facebook.com/docs/whatsapp/cloud-api/calling |

---

## Doc 17 — billing/policy surface (not extra Graph calls)

From `docs/billing/17-META-WHATSAPP-BILLING-AND-POLICY.md` (exists; read for commercial constraints):

- **Live Meta bill (2025+):** per-message pricing on **delivered templates**; service messages billed from **1 Oct 2026**.
- **CURRENT CODE gap:** `pollConversationAnalytics` + `ConversationCharge` still use **conversation_analytics** shape — not live `pricing_analytics` / invoice.
- **Partner TARGET:** Tech Provider (Meta bills customer WABA; Samyoj bills SaaS). Same OAuth scopes need Advanced Access.
- **Calling commercial:** Meta bills business-initiated minutes + permission-request messages separately from Samyoj Calling feature flag.
- **India:** WABA INR migration deadline **31 Dec 2026** documented there.

---

## Hinglish summary — “abhi Samyoj Meta ka kya use karti hai”

Samyoj abhi **WhatsApp Cloud API + Graph** pehi depend karti hai — Instagram/Messenger Ads Marketing API product surface nahi.

1. **Connect:** Facebook OAuth (`whatsapp_business_management` + `whatsapp_business_messaging`) → long-lived token → WABA + phone number save (encrypted).
2. **Outbound:** Inbox / campaigns / automations / commerce sab `POST /{phone-number-id}/messages` (text, template, media, interactive, …); media pehle upload `/{phone-number-id}/media`.
3. **Inbound:** App + WABA webhook subscribe; fields me messages, calls, template updates, quality, prefs; public HTTPS (`META_WEBHOOK_URL` / ngrok locally).
4. **Templates:** list/create/delete + Meta template library clone + resumable header upload; status webhooks se sync.
5. **Calling:** settings enable/disable, SDP call actions, call_permissions, official `call_permission_request` interactive; Sarvam STT/TTS alag (Meta nahi).
6. **Flows / catalogs:** Flows CRUD + public key; WABA product catalogs sync.
7. **Usage poll:** conversation analytics + quality rating — **doc 17 ke hisaab se analytics shape legacy**; live Meta bill alag (PMP).

Default Graph version code me **`v21.0`**; `.env` se override ho sakta hai (example me v25.0 comment).

---

## Quiz (self-check)

1. Code default `META_API_VERSION` kya hai — `v21.0` ya `.env.example` ka `v25.0`?
2. OAuth scope string exact do names likho.
3. `META_WEBHOOK_FIELDS` me se teen fields naam batao jo templates se related hain.
4. Outbound text ka Graph path kya hai?
5. Calling enable kaunsa path use karta hai — `/calls` ya `/settings`?
6. Business-initiated call se pehle Samyoj kaunsa Graph read karti hai?
7. Template clone Meta library se kaunsa POST body field use karta hai (`library_template_name`)?
8. Durable prod webhook steal na ho iske liye WABA pe kaunsa override field set hota hai?
9. Doc 17 ke mutabiq `conversation_analytics` poll aaj live Meta invoice hai ya legacy gap?
10. Samyoj TARGET partner model Tech Provider hai ya Solution Partner (doc 17)?

**Answers (fold):** (1) `v21.0` in `config/index.ts`. (2) `whatsapp_business_management`, `whatsapp_business_messaging`. (3) e.g. `message_template_status_update`, `message_template_quality_update`, `message_template_components_update` / `template_category_update`. (4) `POST /{phone-number-id}/messages`. (5) `POST /{phone-number-id}/settings`. (6) `GET /{phone-number-id}/call_permissions`. (7) yes `library_template_name`. (8) `override_callback_uri`. (9) legacy gap. (10) Tech Provider.

---

## Evidence anchors (paths only)

- OAuth + Graph client: `/workspaces/Samyoj/server/src/modules/whatsapp/meta.service.ts`
- Calling Graph: `/workspaces/Samyoj/server/src/modules/calling/meta-calling.service.ts`
- Webhook routes: `/workspaces/Samyoj/server/src/modules/whatsapp/routes.ts`
- Templates module: `/workspaces/Samyoj/server/src/modules/templates/routes.ts`
- Config default version: `/workspaces/Samyoj/server/src/config/index.ts` (`apiVersion: … || 'v21.0'`)
- Billing policy: `/workspaces/Samyoj/docs/billing/17-META-WHATSAPP-BILLING-AND-POLICY.md`
