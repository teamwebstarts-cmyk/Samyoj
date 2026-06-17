# WhatsApp Business Platform / Cloud API — Comprehensive Reference

> **Audience:** Builders of the `D:\whatsapp` automation platform (PERN + Prisma + BullMQ + Socket.IO + Azure OpenAI + Deepgram + Google TTS + Razorpay).
> **Goal:** Single source of truth for every Meta API surface the platform touches, with explicit mapping to existing modules in this repo, and an actionable roadmap for what to ship next.
> **Sourcing:** Inline citations to [developers.facebook.com/docs/whatsapp/cloud-api](https://developers.facebook.com/docs/whatsapp/cloud-api), the [Error Codes page](https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes), [Webhooks](https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks), [Pricing](https://developers.facebook.com/docs/whatsapp/pricing), [Message Templates](https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-message-templates), the [Messages reference](https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages), and the [Business Management API](https://developers.facebook.com/docs/whatsapp/business-management-api), cross-referenced with WATI, MessageBird, Bird, Infobip, 360Dialog, Twilio, Dualhook and Kapso documentation.

---

## Table of Contents

1. [Executive Summary & Architecture Overview](#1-executive-summary--architecture-overview)
2. [WhatsApp Business Platform — The Three Surfaces](#2-whatsapp-business-platform--the-three-surfaces)
3. [Account & App Setup (Meta App Types)](#3-account--app-setup-meta-app-types)
4. [Phone Numbers & Quality](#4-phone-numbers--quality)
5. [Messages — Every Single Type](#5-messages--every-single-type)
6. [WhatsApp Flows](#6-whatsapp-flows)
7. [Templates (HSM) — The Most Complex Piece](#7-templates-hsm--the-most-complex-piece)
8. [Webhooks — Incoming Events](#8-webhooks--incoming-events)
9. [Error Codes & Edge Cases](#9-error-codes--edge-cases)
10. [Pricing](#10-pricing)
11. [Best Practices](#11-best-practices)
12. [Existing Project Mapping — What's Built vs. What's Missing](#12-existing-project-mapping--whats-built-vs-whats-missing)
13. [What to Focus On Next (Actionable Roadmap)](#13-what-to-focus-on-next-actionable-roadmap)
14. [References](#14-references)

---

## 1. Executive Summary & Architecture Overview

### 1.1 Two-Sentence Pitch (Framework 10: Explain-It Test)

> **Sentence 1 (Problem).** WhatsApp is the only messaging channel where customers already live, but the official Meta Cloud API is hostile to first-time integrators: it ships ten webhook surfaces, two price models (per-message since July 2025, plus a sliding quality-score throttle), 70+ error codes, an approval-bound template engine, an E2EE Flows data channel, and a hard 24-hour service window — so naive implementations fail silently and burn budget.
> **Sentence 2 (Insight).** This platform already covers the *big* shapes (send/receive, templates, flows builder, automation engine, campaigns, calls, AI, billing) — what it must now do is **harden the edges**: HMAC-verify every webhook (already done — see `meta.service.ts:verifyWebhookSignature`), dedup by `message.id` for idempotency, encrypt Flows data exchange, track the 24h CSW in real-time, retry with `4^X` backoff on `131056` / `130429`, and fall back to SMS on async `131026` failures.

### 1.2 The "Why" — Why a Research Doc Like This Exists

The Meta Cloud API is a moving target. The official reference at [developers.facebook.com/docs/whatsapp/cloud-api](https://developers.facebook.com/docs/whatsapp/cloud-api) is updated monthly; pricing moved from **per-conversation** to **per-message** on July 1, 2025 ([source](https://whatsappbusiness.com/products/platform-pricing/)); Marketing Messages Lite API shipped additional features in 2026; the Flows `data_api_version` jumped to 3.0 with RSA/AES-GCM. Building a "set and forget" automation platform against this surface means the platform team needs:

1. A **single canonical reference** for every webhook field, every message type, every error code, and every pricing tier — instead of archaeologists Googling error `131056` every time a campaign stalls.
2. An **explicit map** between the existing modules (`messages`, `templates`, `flows`, `campaigns`, `calling`, `inbox`, `automation`, `ai`, `integrations`, `media`, `compliance`, `sla`, `team`, `billing`, `analytics`, `canned-replies`, `labels`) and the Meta surface they implement — so engineers know exactly which module owns a given bug.
3. A **prioritised roadmap** that picks the highest-leverage gaps to close (Flows E2EE encryption, marketing template carousel, async-failure SMS fallback, idempotency dedup, etc.) using F1 (problem-first) and F3 (tension hunting).

### 1.3 High-Level Architecture (This Repo)

The data flow your codebase already implements, from end-user to agent UI:

```text
┌──────────┐   1. Send message   ┌──────────────┐
│ Customer │ ──────────────────▶ │  Meta Cloud  │
│  (WA)    │ ◀────────────────── │     API      │
└──────────┘   2. Webhook (POST)  └──────┬───────┘
       ▲                                │
       │                                ▼
       │                       ┌─────────────────┐
       │   7. WebSocket        │  POST /api/whatsapp/webhook  │
       │      (Socket.IO)      │  server/src/modules/whatsapp/routes.ts
       │                       │  (HMAC verify, enqueue)
       │                       └────────┬────────┘
       │                                │ BullMQ: webhookQueue.add
       │                                ▼
       │                       ┌─────────────────┐
       │                       │  webhook.processor.ts         │
       │                       │  (BullMQ worker)              │
       │                       │  • persist Message            │
       │                       │  • auto-create Contact/Conv   │
       │                       │  • download media              │
       │                       │  • handleInboundAutomations()  │
       │                       │  • emitToOrg('message:new')    │
       │                       └────────┬────────┘
       │                                │
       │                                ▼
       │                       ┌─────────────────┐
       │                       │  PostgreSQL     │
       │                       │  (Prisma)       │
       │                       └────────┬────────┘
       │                                │
       │                                ▼
       │                       ┌─────────────────┐
       └─────── 7. UI ◀──────  │   Socket.IO     │
                               │   realtime.ts   │
                               └────────┬────────┘
                                        │ 7. UI render
                                        ▼
                               ┌─────────────────┐
                               │  React InboxPage│
                               │  (InboxPage.tsx)│
                               └─────────────────┘
```

For **outbound**: Agent types in `ChatComposer.tsx` → POST `/api/messages/send` → `messages/routes.ts` → `deliverOutboundMessage()` in `send.service.ts` → `MetaWhatsAppService.sendMessage()` → Graph API → status updates arrive back via webhook.

### 1.4 The Tension We're Resolving (Framework 3)

The core product tension is **throughput vs. deliverability**:

- **Send faster** = more conversations started = more revenue.
- **Send more aggressively** = template quality drops, Meta throttles with `131048` / `131064`, phone-number quality falls GREEN→YELLOW→RED, throughput tier reduces, *prices go up per message via volume tiers*.

The reconciliation is to *gate send-volume by quality signal*: a closed-loop system that watches `phone_number_quality_update` and `message_template_quality_update` webhooks, pauses campaigns on degradation, and routes high-value replies to live agents before the algorithm penalises the number.

### 1.5 F1 (Problem-First) Sanity Check

- [x] **Specific person who needs this:** A growth marketer at an SMB with a Meta Business Account; a customer-support manager handling 5,000+ conversations/day; a SaaS founder integrating OTP auth via WhatsApp.
- [x] **Problem is actually unsolved:** Every BSP (WATI, MessageBird, Bird, 360Dialog) charges 2-3x Meta's per-message rate and hides the webhook plumbing; building in-house gives 100% control but requires exactly this kind of internal documentation.
- [x] **Genuine new capability:** Native flows, AI handoff, WebRTC calling, omnichannel SMS-fallback — none of which a generic BSP provides out of the box.

---

## 2. WhatsApp Business Platform — The Three Surfaces

Meta exposes three official surfaces for business messaging. You are using **only #1**, but understanding the other two avoids the most common onboarding mistake ([source](https://developers.facebook.com/docs/whatsapp/cloud-api/overview)).

| Surface | Transport | Audience | Status (June 2026) | Cost | Used For |
|---|---|---|---|---|---|
| **Cloud API** (a.k.a. WhatsApp Business Platform) | HTTPS REST on Graph API | Developers (you) | Active, recommended | Per-message; tiered by category and country | Production automation, this platform |
| **On-Premises API** | HTTPS REST on Meta-provided Docker (or self-hosted netty) | Enterprise with strict data-residency | **Deprecated** (sunset 2025) | Self-hosted | Legacy; don't pick |
| **WhatsApp Business App** | Mobile/desktop consumer app | SMB owner-operator | Active | Free (with 1 device limit) | Manual customer chat, no automation |

### 2.1 Cloud API (what you build against)

- Endpoint: `https://graph.facebook.com/vXX.0/<phone_number_id>/messages` ([reference](https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages)).
- Auth: OAuth (note: *not* OAuth 2.0 — Meta uses a custom OAuth 1.0-style flow with `client_id|client_secret` app tokens and per-user user tokens).
- Hosting: Meta-hosted. No servers to run.
- Throughput: default 80 messages/second per phone number; 500 messages/second on tier 2/3 verified accounts.
- Two new endpoint families shipped in 2026: **Marketing Messages API for WhatsApp** (Lite, marketing-only, auto-optimised) and **Meta Business Agent** (managed AI agent builder) ([overview](https://developers.facebook.com/docs/whatsapp/cloud-api/overview)).

### 2.2 On-Premises API (legacy, skip)

Required running Meta's netty app on your own hardware; needed for businesses in countries where Meta couldn't host the Cloud API. Since 2024, every market has Cloud API access. New integration work should *never* start here. If you see old `360dialog`, `gupshup`, or `MessageBird` tutorials referencing "On-Prem", translate them to the Cloud API equivalents.

### 2.3 WhatsApp Business App (the consumer app)

This is the free app a small bakery installs on the owner's phone. It is **not** programmable beyond Meta's built-in quick replies, catalogue, and away message. It has a 1-device limit. The Business App also has a separate "API for the Business App" via Embedded Signup (now the standard onboarding path for Cloud API too) but the device-bound app itself is not for automation.

> **Action:** Your existing Embedded Signup flow in `whatsapp/routes.ts` (`MetaWhatsAppService.getEmbeddedSignupUrl`) is the correct Cloud API path. No changes needed.

---

## 3. Account & App Setup (Meta App Types)

### 3.1 The Three-Layer Hierarchy

```text
Business Portfolio (formerly Business Manager)
└── WhatsApp Business Account (WABA)
    └── Phone Number (with display name + phone_number_id)
```

Per the [overview](https://developers.facebook.com/docs/whatsapp/cloud-api/overview), every business must have a **Business Portfolio** to use the platform. The portfolio can be **verified** (via business document, domain, or phone) — verification unlocks higher throughput and Official Business Account status.

A WABA is a container for phone numbers, templates, and analytics. A single portfolio can hold multiple WABAs (one per market, one per brand, or one for prod + one for staging).

### 3.2 Meta App Types

Meta has two app types relevant to WhatsApp ([source](https://developers.facebook.com/docs/whatsapp/cloud-api/overview)):

| App type | What it's for | Onboarding | Permissions |
|---|---|---|---|
| **Business App** | A direct customer integrating their own WABA. OAuth scopes: `whatsapp_business_management`, `whatsapp_business_messaging` | Embedded Signup (recommended) or manual app creation | Direct grant from the business user |
| **System User App** (a.k.a. Tech Provider / BSP) | A Solution Partner onboarding many client WABAs via the On-Behalf-Of (OBO) model | Direct Meta onboarding; needs App Review for advanced access | Granted by each business customer |

Your `connect-url` endpoint in `whatsapp/routes.ts` requests `whatsapp_business_management,whatsapp_business_messaging` — those are the correct granular scopes for a Business App.

### 3.3 Webhook Subscription Fields (subscribe in Meta App Dashboard or via the API)

The `messages` webhook field is the one your app subscribes to. The full list of fields Meta supports on a WhatsApp Business Account, per the [Webhooks doc](https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks), is:

| Field name | Description | When to use | Already in your code? |
|---|---|---|---|
| `messages` | Inbound messages + outbound status updates | Always — required for the inbox | ✅ yes (webhook.processor.ts) |
| `message_template_status_update` | Template approved/paused/disabled | Reflect UI badge for templates in real time | ❌ missing (see §13) |
| `message_template_components_update` | Template's components changed | Refresh template body/buttons | ❌ missing |
| `message_template_quality_update` | Template quality flipped GREEN/YELLOW/RED | Pause campaigns before Meta throttles | ❌ missing |
| `template_category_update` | Template auto-reclassified (utility → marketing) | Pricing re-budget | ❌ missing |
| `phone_number_quality_update` | Throughput level changed | Update Settings UI | ❌ missing |
| `phone_number_name_update` | Display name approved/rejected | Unblock test sends | ❌ missing |
| `account_alerts` | Messaging limit, Official Business Account status | Settings banner | ❌ missing |
| `account_review_update` | Policy review outcome | Banner | ❌ missing |
| `account_update` | WABA shared with partner, offboarded, reconnected | Audit log | ❌ missing |
| `business_capability_update` | Messaging/phone limits | Alert worker | ❌ missing |
| `security` | Phone number security setting changes | Audit | ❌ missing |
| `flows` | Flow response | Flow data exchange | ❌ missing |
| `payments` | Payment status | India/Brazil only | ❌ missing |
| `payment_configuration_update` | Payment config changed | India/Brazil | ❌ missing |
| `partner_solutions` | Multi-partner solution status | BSP mode | ❌ missing |
| `smb_app_state_sync` | Onboard SMB app user contacts | Coexistence | ❌ missing |
| `smb_message_echoes` | Echo of messages sent from linked devices | Coexistence | ❌ missing |
| `history` | Sync WhatsApp Business app history | Coexistence | ❌ missing |
| `user_preferences` | User opted out of marketing | Update contact flag | ❌ missing |
| `automatic_events` | Detected ad-conversion events | Ad attribution | ❌ missing |

**Action:** Update `registerAppWebhook` in `meta.service.ts:726` to subscribe to all relevant fields for your platform. At minimum add `message_template_status_update`, `message_template_quality_update`, `phone_number_quality_update`, and `account_alerts`.

### 3.4 Rate Limits on the Management API

| Endpoint | Default | Verified WABA |
|---|---|---|
| `GET /<WABA>` | 200/hr/app/WABA | 5000/hr |
| `GET/POST/DELETE /<WABA>/assigned_users` | 200/hr | 5000/hr |
| `GET /<WABA>/phone_numbers` | 200/hr | 5000/hr |
| `GET/POST/DELETE /<WABA>/message_templates` | 200/hr | 5000/hr |
| `GET/POST/DELETE /<WABA>/subscribed_apps` | 200/hr | 5000/hr |
| `GET /<WABA>_TO_NUMBER_CURRENT_STATUS_ID` | 200/hr | 5000/hr |

Credit Line API: 5000/hr. ([source](https://developers.facebook.com/docs/whatsapp/cloud-api/overview))

### 3.5 Embedded Signup vs Manual Setup

Embedded Signup (ESU) is the modern, recommended path — it lets the user grant your app permissions and pick a phone number from a Meta-hosted flow in one go. The `connect-url` route you already ship generates the right URL with the `whatsapp_business_management,whatsapp_business_messaging` scopes ([template reference](https://developers.facebook.com/docs/whatsapp/cloud-api/guides/set-up-webhooks)).

Manual setup requires: creating an app → adding the WhatsApp product → configuring OAuth redirect → generating a system-user token → registering a phone number via the Registration API → verifying via 2FA PIN. This is what you'd use for headless provisioning of test numbers or migrating from On-Premises.

### 3.6 Test Resources

When you first create an app with the WhatsApp product, Meta auto-provisions a test WABA + test phone number. These have:

- **Relaxed messaging limits** (effectively uncapped for testing).
- **No payment method required** to send template messages.
- **Restricted to your Meta account** for receiving.

Use these for CI/CD smoke tests; never use them in production traffic.

---

## 4. Phone Numbers & Quality

### 4.1 Phone Number Format

All phone numbers in Cloud API must be in E.164 format: `+[country code][number]`, no spaces, dashes, or parentheses. Examples:

- 🇮🇳 India: `+919876543210`
- 🇧🇷 Brazil: `+5511999998888`
- 🇺🇸 USA: `+14155552671`
- 🇬🇧 UK: `+447911123456`

Your `utils/phone.ts` and `phone.replace(/\D/g, '')` in `send.service.ts:41` already handle stripping non-digits, but verify the result still includes the `+` (or re-prepend it) before sending.

### 4.2 Display Name (WhatsApp Business display name)

Every business phone number has a display name that customers see in chats. Meta enforces a **business name vs. display name consistency** check. If the display name is not yet approved, the 555 test number throws error `131037`. Display name changes go through the `phone_number_name_update` webhook for the outcome.

### 4.3 Quality Rating

Quality is Meta's per-phone-number signal of how customers react to your messages. It has three levels ([quality docs](https://www.facebook.com/business/help/…). Updated in real time as users block, report, or read your messages.

| Rating | Meaning | Consequence |
|---|---|---|
| **GREEN** | Healthy | Normal throughput |
| **YELLOW** | High block/report rate | Throughput reduced; Meta throttles marketing templates |
| **RED** | Severe violation | Phone number can be disabled |

Quality updates arrive via the `phone_number_quality_update` webhook and are visible in WhatsApp Manager. There is no public numeric quality score — Meta reserves it.

### 4.4 Messaging Limits (Throughput Tiers)

Tier progression is based on **phone number quality + verified business**:

| Tier | Customer-initiated service msgs/24h | Business-initiated template msgs/24h |
|---|---|---|
| **Unverified** (default) | 1,000 unique customers | 250 |
| **Tier 1** (1,000 delivered in 7d, GREEN quality) | 10,000 | 10,000 |
| **Tier 2** (10,000 in 30d, GREEN) | 100,000 | 100,000 |
| **Tier 3** (100,000 in 30d, GREEN) | Unlimited | Unlimited |

> **Important nuance:** These are *rolling 24-hour* unique-customer limits, not per-day totals. Meta updates the limit in real time as you cross thresholds.

### 4.5 Capacity Rate Limit (Throughput)

Per [overview](https://developers.facebook.com/docs/whatsapp/cloud-api/overview): business phone numbers can send up to **80 messages per second** by default. This is separate from the daily messaging limit. Capacity upgrades are available via Meta Direct Support for Tier 2+ accounts.

### 4.6 Pair Rate Limit (Critical — Most Common Production Bug)

Per the [overview](https://developers.facebook.com/docs/whatsapp/cloud-api/overview):

> "Business phone numbers can send 1 message every 6 seconds to the same WhatsApp user (0.17 messages/second), which equals about 10 messages per minute or 600 per hour. Exceeding this limit triggers error code **131056** until you are back within the allowed rate."

> "You may send up to 45 messages in a 6-second burst, but this 'borrows' from your future quota. After a burst, you must wait the equivalent time it would take to send those messages at the normal rate."

> "To manage post-burst throttling, if a send request fails, retry after **4^X seconds** (starting with X=0 and increasing X by 1 after each failure) until successful."

**Your code's `messageQueue.add('retry-send', ..., { attempts: 4, backoff: { type: 'custom' } })`** in `send.service.ts:204` is *almost* right but does not use exponential backoff with `4^X` for 131056. See §13 for the fix.

### 4.7 How to Improve Quality

Per Meta guidance:
- Don't send marketing to people who haven't opted in.
- Keep template content short and relevant.
- Use the **right category** (utility for transactional, marketing for promotional) — Meta reclassifies on misuse.
- Honour opt-outs: track `user_preferences` webhook for `marketing_messages` opt-outs and stop sending (`131050` if you ignore them).
- Avoid sending identical content to large lists in a short window.

---

## 5. Messages — Every Single Type

The Cloud API Messages endpoint is `POST /vXX.0/<phone_number_id>/messages`. All payloads require `messaging_product: "whatsapp"`, `to: <recipient>`, and `type: <type>`. Reference: [Messages](https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages). Field types and limits below were verified against Meta's [Supported Media Types](https://docs.kapso.ai/api/meta/whatsapp/messages/send-a-message) and the [Messages reference](https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages).

### 5.1 Master Cheat Sheet

| Type | Free-form or Template? | Pricing | Already supported by `send.service.ts`? |
|---|---|---|---|
| `text` | Free-form (in CSW) / via template (outside) | Service (free) | ✅ |
| `image` | Free-form (in CSW) | Service (free) | ✅ |
| `video` | Free-form (in CSW) | Service (free) | ✅ |
| `audio` | Free-form (in CSW) | Service (free) | ✅ |
| `document` | Free-form (in CSW) | Service (free) | ✅ |
| `sticker` | Free-form (in CSW) | Service (free) | ❌ not in send.service.ts |
| `location` | Free-form (in CSW) | Service (free) | ✅ |
| `contacts` | Free-form (in CSW) | Service (free) | ✅ |
| `reaction` | Free-form (in CSW) | Service (free) | ❌ not exposed |
| `template` | Always template | Per category | ✅ |
| `interactive` (button/list/cta_url/call_permission/flow/product/product_list/catalog) | Free-form (in CSW) | Service (free) | Partial (button/cta_url/list/flow ✅) |
| `address_message` | Free-form (in CSW, India only) | Service (free) | ❌ missing |
| `carousel` (free-form) | Free-form (in CSW) | Service (free) | ❌ missing |
| `poll` | Not yet public (2026) | — | ❌ n/a |
| `disappearing` (ephemeral) | Not exposed as type — opt in via `MessageOptions` | Service | ❌ missing |

### 5.2 Text Messages

**Endpoint:** `POST /<phone_number_id>/messages`
**When to use:** 1:1 chat inside the 24h CSW; casual replies; or as the body of a template.
**Limits:** Body max **4096 characters**; supports URL preview with `preview_url: true`.

```json
{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "+16505555555",
  "type": "text",
  "text": {
    "preview_url": true,
    "body": "Here's the info you requested! https://www.meta.com/quest/quest-3/"
  }
}
```

**Constraints:**
- Cannot be sent outside a 24h CSW — must use a template outside.
- Text formatting: `*bold*`, `_italic_`, `~strikethrough~`, ` ```code``` ` (triple backtick), `> quote` — limited Markdown subset.
- Newline is `\n`; up to 4096 characters; empty body is rejected (`100` Invalid parameter).
- `preview_url: true` causes WhatsApp to scrape the URL and attach a preview card (one URL only, must be HTTPS).

### 5.3 Image Messages

**Format:** `JPEG`, `PNG`, `WEBP`
**Max size:** **5 MB**
**Caption:** Optional, up to 1024 characters. URL preview disabled if caption provided.

```json
{
  "messaging_product": "whatsapp",
  "to": "+16505555555",
  "type": "image",
  "image": {
    "link": "https://example.com/product.jpg",
    "caption": "Check out our new product!"
  }
}
```

You can use either `link` (public URL, must be HTTPS) or `id` (a media ID from a prior upload via `/<phone_number_id>/media`). Your `media` module already supports upload — see `media/upload` route.

### 5.4 Video Messages

**Format:** `MP4`, `3GPP`
**Codecs:** H.264 video, AAC audio
**Max size:** **16 MB**
**Caption:** Optional, up to 1024 chars.

```json
{
  "messaging_product": "whatsapp",
  "to": "+16505555555",
  "type": "video",
  "video": {
    "id": "1166846181421424",
    "caption": "Product demonstration video"
  }
}
```

### 5.5 Audio Messages

**Two flavours:**

1. **Voice note** (`.ogg` Opus codec, max 16 MB): rendered with microphone icon, auto-transcribed.
2. **Basic audio** (AAC, MP3, MP4, AMR, OGG — max 16 MB): rendered with play + download icons.

```json
{
  "messaging_product": "whatsapp",
  "to": "+16505555555",
  "type": "audio",
  "audio": {
    "id": "1013859600285441",
    "voice": true
  }
}
```

Set `"voice": true` to render as a voice note. Your `calling` module + `ai-voice-agent` integration will benefit from this.

### 5.6 Document Messages

**Formats:** `PDF`, `DOC`, `DOCX`, `XLS`, `XLSX`, `PPT`, `PPTX`, `TXT`
**Max size:** **100 MB**
**Filename:** Optional; defaults to the original file name.

```json
{
  "messaging_product": "whatsapp",
  "to": "+16505555555",
  "type": "document",
  "document": {
    "id": "1376223850470843",
    "filename": "invoice_2024.pdf",
    "caption": "Your invoice for January 2024"
  }
}
```

### 5.7 Sticker Messages

**Format:** `WEBP` only (static and animated)
**Max size:** **500 KB** for both static and animated
**Aspect ratio:** 1:1 (512×512 ideal)

```json
{
  "messaging_product": "whatsapp",
  "to": "+16505555555",
  "type": "sticker",
  "sticker": {
    "id": "798882015472548"
  }
}
```

Stickers cannot be sent to free-form chat if the recipient has stickers disabled in their WhatsApp settings (rare).

### 5.8 Location Messages

```json
{
  "messaging_product": "whatsapp",
  "to": "+16505555555",
  "type": "location",
  "location": {
    "latitude": 37.7749,
    "longitude": -122.4194,
    "name": "San Francisco Office",
    "address": "123 Market St, San Francisco, CA 94103"
  }
}
```

`name` and `address` are optional but improve the pin label.

### 5.9 Contacts Messages (vCard)

**Limit:** Up to **257 contacts** per message (one `contacts` array). But sending many is poor UX — split.

```json
{
  "messaging_product": "whatsapp",
  "to": "+16505555555",
  "type": "contacts",
  "contacts": [
    {
      "addresses": [
        {
          "street": "1 Lucky Shrub Way",
          "city": "Menlo Park",
          "state": "CA",
          "zip": "94025",
          "country": "United States",
          "country_code": "US",
          "type": "Office"
        }
      ],
      "birthday": "1999-01-23T00:00:00.000Z",
      "emails": [{ "email": "bjohnson@luckyshrub.com", "type": "Work" }],
      "name": {
        "formatted_name": "Barbara J. Johnson",
        "first_name": "Barbara",
        "last_name": "Johnson",
        "middle_name": "Joana",
        "suffix": "Esq.",
        "prefix": "Dr."
      },
      "org": { "company": "Lucky Shrub", "department": "Legal", "title": "Lead Counsel" },
      "phones": [
        { "phone": "+16505559999", "type": "Landline" },
        { "phone": "+19175559999", "type": "Mobile", "wa_id": "19175559999" }
      ],
      "urls": [{ "url": "https://www.luckyshrub.com", "type": "Company" }]
    }
  ]
}
```

`wa_id` on a phone signals "tap to chat" — clicking opens a chat with that WhatsApp number.

### 5.10 Reaction Messages

**Limit:** One emoji per message; sending a reaction to a message you already reacted to *replaces* it; sending the same emoji again *removes* the reaction.

```json
{
  "messaging_product": "whatsapp",
  "to": "+16505555555",
  "type": "reaction",
  "reaction": {
    "message_id": "wamid.HBgLMTY1MDM4Nzk0MzkVAgASGBQzQTRBNjU5OUFFRTAzODEwMTQ0RgA=",
    "emoji": "👍"
  }
}
```

**Important constraint:** Reaction messages only emit a `sent` status webhook — `delivered` and `read` are *not* sent. Your `webhook.processor.ts:67` already correctly handles arbitrary statuses, but the UI should hide a "read" indicator for reactions.

### 5.11 Message Replies (Context)

Add `context.message_id` to any free-form message to make it a quoted reply. Customers see a quote bubble.

```json
{
  "messaging_product": "whatsapp",
  "to": "+16505555555",
  "type": "text",
  "context": { "message_id": "wamid.HBgL..." },
  "text": { "body": "Thank you for your message! I'll get back to you soon." }
}
```

> ⚠️ `context.message_id` is for **free-form replies** in a CSW. For templates, use the `template` component `button` with a QUICK_REPLY or a copy-code button.

### 5.12 Template Messages

See §7 for the full template schema. Quick example:

```json
{
  "messaging_product": "whatsapp",
  "to": "+16505555555",
  "type": "template",
  "template": {
    "name": "order_confirmation",
    "language": { "code": "en_US" },
    "components": [
      { "type": "body", "parameters": [
        { "type": "text", "text": "Jessica" },
        { "type": "text", "text": "SKBUP2-4CPIG9" }
      ]}
    ]
  }
}
```

### 5.13 Interactive Messages — Buttons

**Limit:** Up to **3 reply buttons** OR **1 CTA URL button** (not both in the same message).

```json
{
  "messaging_product": "whatsapp",
  "to": "+16505555555",
  "type": "interactive",
  "interactive": {
    "type": "button",
    "body": { "text": "Would you like to proceed with your order?" },
    "action": {
      "buttons": [
        { "type": "reply", "reply": { "id": "btn_yes", "title": "Yes" } },
        { "type": "reply", "reply": { "id": "btn_no",  "title": "No"  } }
      ]
    }
  }
}
```

Button titles: max 20 chars. The customer tap arrives as a webhook with `interactive.button_reply.id` populated.

### 5.14 Interactive Messages — CTA URL Button

```json
{
  "messaging_product": "whatsapp",
  "to": "+16505555555",
  "type": "interactive",
  "interactive": {
    "type": "cta_url",
    "header": { "type": "text", "text": "New workshop dates announced!" },
    "body": { "text": "Tap the button below to see available dates." },
    "footer": { "text": "Dates subject to change" },
    "action": {
      "name": "cta_url",
      "parameters": {
        "display_text": "See Dates",
        "url": "https://example.com/workshops?utm_source=whatsapp"
      }
    }
  }
}
```

`display_text` max 20 chars. URL must be HTTPS. **Dynamic URL suffixes** (the part after `https://example.com/r/`) are allowed — Meta uses them for click tracking.

### 5.15 Interactive Messages — List

**Limits:** Max **10 sections**, max **10 rows total** across all sections.

```json
{
  "messaging_product": "whatsapp",
  "to": "+16505555555",
  "type": "interactive",
  "interactive": {
    "type": "list",
    "header": { "type": "text", "text": "Choose Shipping" },
    "body":   { "text": "Which shipping option do you prefer?" },
    "footer": { "text": "Shipping estimates may vary" },
    "action": {
      "button": "View Options",
      "sections": [
        { "title": "Fast Shipping", "rows": [
          { "id": "express",  "title": "Express",  "description": "1-2 days" },
          { "id": "priority", "title": "Priority", "description": "2-3 days" }
        ]},
        { "title": "Standard Shipping", "rows": [
          { "id": "standard", "title": "Standard", "description": "5-7 days" }
        ]}
      ]
    }
  }
}
```

- Row `id` max 200 chars
- Row `title` max 24 chars
- Row `description` max 72 chars
- Section `title` max 24 chars
- Action `button` max 20 chars

Webhook reply carries `interactive.list_reply.id`. Your `inbox/message-parser.ts` already extracts `buttonReplyId` — extend it for `list_reply`.

### 5.16 Interactive Messages — Product (Single)

Requires a Meta **Commerce catalog** connected to your WABA.

```json
{
  "messaging_product": "whatsapp",
  "to": "+16505555555",
  "type": "interactive",
  "interactive": {
    "type": "product",
    "body": { "text": "Optional body text" },
    "action": {
      "catalog_id": "CATALOG_ID",
      "product_retailer_id": "SKU_1234"
    }
  }
}
```

### 5.17 Interactive Messages — Multi-Product List

Up to **30 products** from your catalogue, organised into **up to 10 sections**.

```json
{
  "messaging_product": "whatsapp",
  "to": "+16505555555",
  "type": "interactive",
  "interactive": {
    "type": "product_list",
    "header": { "type": "text", "text": "Our bestsellers" },
    "body":   { "text": "Choose a product" },
    "footer": { "text": "While supplies last" },
    "action": {
      "catalog_id": "CATALOG_ID",
      "sections": [
        { "title": "Popular", "product_items": [
          { "product_retailer_id": "SKU_1234" },
          { "product_retailer_id": "SKU_2345" }
        ]}
      ]
    }
  }
}
```

### 5.18 Interactive Messages — Catalog Message

Opens the full catalog viewer.

```json
{
  "messaging_product": "whatsapp",
  "to": "+16505555555",
  "type": "interactive",
  "interactive": {
    "type": "catalog_message",
    "body": { "text": "Browse our catalog on WhatsApp." },
    "action": {
      "name": "catalog_message",
      "parameters": { "thumbnail_product_retailer_id": "SKU_THUMBNAIL" }
    }
  }
}
```

### 5.19 Interactive Messages — Call Permission Request

Customer must grant permission before the business can call them. The permission is valid for the rest of the active CSW.

```json
{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "+16505555555",
  "type": "interactive",
  "interactive": {
    "type": "call_permission_request",
    "action": { "name": "call_permission_request" },
    "body":   { "text": "We would like to call you to help with your order." }
  }
}
```

This complements your `calling` module — track granted permission in your call record.

### 5.20 Interactive Messages — Location Request

Asks the user to share their current location.

```json
{
  "messaging_product": "whatsapp",
  "to": "+16505555555",
  "type": "interactive",
  "interactive": {
    "type": "location_request_message",
    "body":   { "text": "Please share your location so we can provide accurate delivery estimates." },
    "action": { "name": "send_location" }
  }
}
```

### 5.21 Interactive Messages — Address (India only)

```json
{
  "messaging_product": "whatsapp",
  "to": "919876543210",
  "type": "interactive",
  "interactive": {
    "type": "address_message",
    "body": { "text": "Please provide your delivery address." },
    "action": {
      "name": "address_message",
      "parameters": {
        "country": "IN",
        "values": { "name": "John Doe", "phone_number": "+919876543210" },
        "saved_addresses": [
          { "id": "home", "value": {
            "name": "John Doe", "phone_number": "+919876543210",
            "in_pin_code": "400063", "floor_number": "8",
            "building_name": "Acme Tower", "address": "MG Road",
            "landmark_area": "Near Metro", "city": "Mumbai"
          }}
        ]
      }
    }
  }
}
```

If validation fails, re-send with `validation_errors` map; the user sees the previous input with error messages inline.

### 5.22 Interactive Messages — Carousel (Free-form media carousel)

Sends **2-10 cards**, each with a media header (image or video) and either a CTA URL button OR a uniform set of quick-reply buttons.

```json
{
  "messaging_product": "whatsapp",
  "to": "+16505555555",
  "type": "interactive",
  "interactive": {
    "type": "carousel",
    "body": { "text": "Choose a trip option" },
    "action": {
      "cards": [
        { "card_index": 0, "type": "cta_url",
          "header": { "type": "image", "image": { "link": "https://example.com/flight-a.jpg" }},
          "body":   { "text": "Morning flight" },
          "action": { "name": "cta_url", "parameters": { "display_text": "View", "url": "https://example.com/flights/a" }}
        },
        { "card_index": 1, "type": "cta_url",
          "header": { "type": "image", "image": { "link": "https://example.com/flight-b.jpg" }},
          "body":   { "text": "Evening flight" },
          "action": { "name": "cta_url", "parameters": { "display_text": "View", "url": "https://example.com/flights/b" }}
        }
      ]
    }
  }
}
```

Carousel is **only** allowed inside an open CSW (free-form). For marketing carousels, use a **Carousel template** (see §7.7).

### 5.23 Interactive Messages — WhatsApp Flows

See §6 for the full data model.

```json
{
  "messaging_product": "whatsapp",
  "to": "+16505555555",
  "type": "interactive",
  "interactive": {
    "type": "flow",
    "header": { "type": "text", "text": "Appointment Booking" },
    "body":   { "text": "Book your appointment using our interactive form" },
    "footer": { "text": "Available slots shown in real-time" },
    "action": {
      "name": "flow",
      "parameters": {
        "flow_message_version": "3",
        "flow_id": "123456789",
        "flow_cta": "Book Now",
        "mode": "published",
        "flow_token": "AQAAAAACS5FpgQ_cAAAAAD0QI3s.",
        "flow_action": "navigate",
        "flow_action_payload": {
          "screen": "BOOKING_SCREEN",
          "data": { "service_type": "consultation", "preferred_date": "2024-02-15T00:00:00.000Z" }
        }
      }
    }
  }
}
```

`flow_cta` max 20 chars. Your `send.service.ts:118-139` already builds this — but you also need the **data endpoint** (see §6.5) for the flow to actually exchange encrypted payloads with your backend.

### 5.24 Interactive Messages — Payment (India/Brazil)

WhatsApp Pay is region-restricted. For India (UPI) and Brazil (Pix), use:

```json
{
  "messaging_product": "whatsapp",
  "to": "919876543210",
  "type": "interactive",
  "interactive": {
    "type": "payment",
    "header": { "type": "text", "text": "Invoice" },
    "body":   { "text": "Pay for your order" },
    "footer": { "text": "Powered by your PSP" },
    "action": {
      "name": "payment",
      "parameters": {
        "payment_type": "upi",
        "payment_configuration": "PAYMENT_CONFIG_ID",
        "currency": "INR",
        "total_amount": { "value": 50000, "offset": 100 },
        "order": { "items": [{
          "retailer_id": "SKU_1234", "name": "Item A",
          "amount": { "value": 50000, "offset": 100 }, "quantity": 1
        }]}
      }
    }
  }
}
```

Amounts are in **minor units** (paise, centavos). `offset: 100` is the value of one whole unit in the minor unit (e.g., ₹1 = 100 paise).

> **Status (2026):** Your platform is not yet wired for payment. The flow requires (a) a PSP integration (Razorpay, PayU, etc.), (b) `payment_configuration` registered with Meta, and (c) the `payment_configuration_update` webhook subscription.

### 5.25 Disappearing / Ephemeral Messages

Not a separate `type` — toggle on any message with `MessageOptions` in future Graph versions. As of June 2026, ephemerality is set per-conversation via the consumer's app setting; the API can *respect* but not directly set it. There is no `expiration` field on the message itself.

### 5.26 Polls

Not yet on Cloud API. The consumer app has polls; the business platform doesn't.

### 5.27 Mentions (@group members)

In group conversations (Group API), text messages can include `@<wa_id>` mentions. In 1:1 chat, mentions are no-ops.

### 5.28 Forwarding Restrictions

Outbound business-initiated messages have a `forwarding_score` derived from how many times the *template* was forwarded. Templates containing media have lower forwarding scores. There is no API to read the score; it's surfaced in WhatsApp Manager.

### 5.29 Mark Message as Read + Typing Indicator

```json
{
  "messaging_product": "whatsapp",
  "status": "read",
  "message_id": "wamid.HBgLMTY1MDM4Nzk0MzkVAgASGBQzQTRBNjU5OUFFRTAzODEwMTQ0RgA=",
  "typing_indicator": { "type": "text" }
}
```

Typing indicator is dismissed on send or after ~25 seconds. Your `MetaWhatsAppService.sendTypingIndicator` already supports this — call it from the inbox UI when an agent opens a chat.

### 5.30 Groups

The Cloud API supports the **Group API** for creating groups, adding members, sending/receiving group messages. As of mid-2026, this is in limited availability — you must apply for the [Groups beta](https://developers.facebook.com/docs/whatsapp/cloud-api/groups). Your code does not yet touch the Group API; it's a future capability.

### 5.31 Calls (Voice / Video)

The Cloud API supports business-initiated and user-initiated voice/video calls. The user's `calling` module already covers the agent side. Key fields:

- `calls` webhook array on incoming call (your `webhook.processor.ts` does *not* yet handle `calls` — it only checks `messages`).
- Call types: `voice`, `video`. Call SDP flows through SDP-over-HTTPS (or your WebRTC bridge for AI agents).

### 5.32 Status / Stories

Consumer-only. Businesses cannot post WhatsApp Status. There is no API.

---

## 6. WhatsApp Flows

### 6.1 What They Are

WhatsApp Flows are **in-chat structured forms** (multi-screen, branching, validated) that let customers complete a transaction (book an appointment, apply for a loan, give feedback) without leaving WhatsApp. They live in your WABA and can be opened from any message via a flow button.

Reference: [Flows docs](https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-message-templates), [Flows JSON spec](https://developers.facebook.com/docs/whatsapp/flows/reference/flowjson), [Flows API](https://developers.facebook.com/docs/whatsapp/flows/reference/flowsapi), [Flows encryption](https://developers.facebook.com/docs/whatsapp/flows/reference/flowencryption).

### 6.2 Flow Types

Meta recognises these flow types, declared in the Flow JSON:

| Type | Purpose | Your build target |
|---|---|---|
| `SIGNUP` | Lead capture (name, email, consent) | ✅ in your `flows/signup`-like templates |
| `SURVEY` | Post-purchase NPS, CSAT | ✅ |
| `BOOK_APPOINTMENT` | Calendar / slot picker | ✅ |
| `CONTACT_US` | Generic contact form | ✅ |
| `OTHER` | Free-form (the default) | ✅ |

### 6.3 Flow JSON Structure (your `flows/types.ts` mapped to Meta)

```json
{
  "version": "5.0",
  "data_api_version": "3.0",
  "screens": [
    {
      "id": "WELCOME",
      "title": "Welcome",
      "terminal": true,
      "layout": {
        "type": "SingleColumnLayout",
        "children": [
          { "type": "TextHeading", "text": "Book an Appointment" },
          { "type": "TextBody",    "text": "We'll help you schedule in under 2 minutes." },
          { "type": "Footer",      "label": "Continue", "on-click-action": { "name": "navigate", "next": { "type": "screen", "name": "SLOT_PICKER" }}}
        ]
      }
    },
    {
      "id": "SLOT_PICKER",
      "title": "Pick a slot",
      "data": { "service_id": { "type": "string", "__example__": "consult" }},
      "layout": { "type": "SingleColumnLayout", "children": [
        { "type": "Dropdown",
          "name": "service",
          "label": "Service",
          "data-source": [{ "id": "consult", "title": "Consultation" }, { "id": "follow_up", "title": "Follow-up" }]
        },
        { "type": "DatePicker",  "name": "date", "label": "Date" },
        { "type": "TextInput",    "name": "phone", "label": "Phone",
          "input-type": "phone",
          "required": true,
          "error-message": "Please enter a valid phone" },
        { "type": "Footer", "label": "Confirm",
          "on-click-action": { "name": "data_exchange",
            "payload": { "service": "${form.service}", "date": "${form.date}", "phone": "${form.phone}" }}}
      ]}
    }
  ]
}
```

Components you should map to your `FlowNodeType` enum in `flows/types.ts`:

| Meta Flow component | Closest existing node type |
|---|---|
| `TextHeading`, `TextBody`, `TextCaption` | `message` |
| `TextInput`, `TextArea` | `question` (field: 'custom') |
| `Dropdown`, `RadioButtonsGroup`, `CheckboxGroup` | `buttons` (reply) or `list` |
| `DatePicker`, `OptIn` | `question` (custom) or new node |
| `Footer.on-click-action: navigate` | `goto_step` |
| `Footer.on-click-action: data_exchange` | **`wa_flow` with `data_api` (not yet implemented!)** |
| `Footer.on-click-action: complete` | `end` |
| `EmbeddedLink` | `cta_url` |

### 6.4 Static vs Dynamic Endpointing

- **Static flow** (no data exchange): The Flow JSON lives in Meta and renders the form entirely client-side. The customer submits; Meta delivers the result to your webhook as a `flows` event with the form data inline.
- **Dynamic flow** (with `data_api_version: "3.0"` and `data_exchange`): The Flow can call your server mid-conversation — e.g., to fetch available time slots, validate a postcode, or run a credit check. **This requires E2EE encryption** (§6.5).

### 6.5 E2EE Data Exchange — The Critical Missing Piece

Per [wa-guides.com](https://wa-guides.com/article/whatsapp-flow-payload-e2ee-engineering-secure-webhook-decryption) and the [official Flow encryption spec](https://developers.facebook.com/docs/whatsapp/flows/reference/flowencryption):

**Crypto stack:**

1. You generate an **RSA 2048-bit key pair** (PEM, X.509 SubjectPublicKeyInfo format).
2. You register the **public key** with Meta via:
   ```bash
   POST /vXX.0/<WABA_ID>/whatsapp_business_encryption
   { "business_public_key": "-----BEGIN PUBLIC KEY-----\nMIIB..." }
   ```
3. For each `data_exchange` request, Meta:
   - Generates a fresh AES-128/256 key + IV.
   - Encrypts your `flow_action_payload` with **AES-GCM** using the key + IV.
   - Encrypts the AES key with your **RSA public key** using **RSA/ECB/OAEPWithSHA-256AndMGF1Padding**.
   - POSTs the following body to your endpoint:
     ```json
     {
       "encrypted_flow_data": "<base64 AES-encrypted payload>",
       "encrypted_aes_key":   "<base64 RSA-encrypted AES key>",
       "initial_vector":      "<base64 IV>",
       "opaque_id":           "<unique session id>"
     }
     ```
4. Your endpoint must:
   - Decrypt `encrypted_aes_key` with your **RSA private key** (RSA-OAEP-SHA256-MGF1).
   - Decrypt `encrypted_flow_data` with AES-GCM using the recovered AES key + `initial_vector`. The plaintext is JSON of the form `{ "screen": "SLOT_PICKER", "data": { "service": "consult", ... }, "version": "3.0", "action": "data_exchange" }`.
   - Process the logic, then **encrypt the response with the same AES key and a flipped IV**, base64-encode it, and return:
     ```json
     { "data": { "screen": "SLOT_CONFIRMATION", "data": { "confirmation_code": "ABC-123" }}}
     ```
     where the entire `data` object is a base64 string of the AES-encrypted JSON.

> **This is the #1 missing piece in this platform.** The `flows/types.ts` has a `wa_flow` node, `send.service.ts` has the trigger, but **there is no `flows/encryption.ts`, no `flows/data-endpoint.routes.ts`, and no RSA key management**. Every dynamic Flow the platform supports will be reduced to a static one until this is built.

### 6.6 Webhook: `flows` Event

When a user submits a flow (static or dynamic), Meta POSTs to your webhook with `entry[].changes[].field == "flows"` and:

```json
{
  "object": "whatsapp_business_account",
  "entry": [{
    "id": "<WABA_ID>",
    "changes": [{
      "value": {
        "messaging_product": "whatsapp",
        "metadata": { "display_phone_number": "15550783881", "phone_number_id": "106540352242922" },
        "flows": [{
          "from": "16505551234",
          "flow_token": "AQAAAAACS5FpgQ_cAAAAAD0QI3s.",
          "flow_id": "123456789",
          "flow_name": "Appointment Booking",
          "screen_id": "SLOT_PICKER",
          "data": { "service": "consult", "date": "2024-02-15", "phone": "+16505551234" }
        }]
      },
      "field": "flows"
    }]
  }]
}
```

Add `flows` to the dispatcher in `webhook.processor.ts:34` (currently only `messages` is processed).

### 6.7 What's Built vs Missing in `flows/`

| Capability | File / Function | Status |
|---|---|---|
| Flow schema (`FlowNodeType`, `FlowNode`) | `flows/types.ts` | ✅ |
| Trigger matching (KEYWORD, WELCOME, ANY_MESSAGE, …) | `flows/engine.ts:flowMatchesTrigger` | ✅ |
| Variable interpolation `{{name}}` | `flows/engine.ts:interpolate` | ✅ |
| Multi-turn state (DB-backed) | `flows/engine.ts:saveFlowState` | ✅ |
| A/B split, conditions, delays, handoffs, tags, assignments | `flows/engine.ts:executeNode` | ✅ |
| Flow analytics (starts, completions, dropoffs) | `flows/analytics.ts` | ✅ |
| Language detection per inbound | `flows/language.ts` | ✅ |
| Validation (email, phone) | `flows/validation.ts` | ✅ |
| Versioning | `flows/versioning.ts` | ✅ |
| Simulate | `flows/simulate.ts` | ✅ |
| Conversation lock | `flows/lock.ts` | ✅ |
| Visual builder UI | `client/src/pages/FlowBuilderPage.tsx` | ✅ (25 KB) |
| Send Flow interactive message | `messages/send.service.ts:waFlow` + `messages/interactive.ts` | ✅ |
| **Flow RSA keypair generation** | — | ❌ missing |
| **Flow public key registration with Meta** | — | ❌ missing |
| **Flow data endpoint (E2EE decrypt/respond)** | — | ❌ missing |
| **Flow webhook event handler** (`flows` field) | `webhook.processor.ts:34` | ❌ missing |
| **Carousel template trigger** | `flows/types.ts:FlowNodeType` | ❌ missing |
| **Flow insights dashboard** | — | ❌ missing |

---

## 7. Templates (HSM) — The Most Complex Piece

Templates are **pre-approved message formats** with placeholders. They are the *only* way to send a message outside a 24h CSW, and they govern pricing ([docs](https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-message-templates)).

### 7.1 Categories

| Category | When to use | Pricing | Example |
|---|---|---|---|
| **MARKETING** | Promotional, broadcast, re-engagement, cart abandonment, ads-to-WhatsApp follow-up | Most expensive, no volume discount | "Get 20% off this weekend!" |
| **UTILITY** | Transactional, post-purchase, account updates, shipping alerts, appointment reminders | Cheaper, free in CSW, volume tiers | "Your order #1234 has shipped" |
| **AUTHENTICATION** | One-time passwords, verification codes, login challenges | Same as utility, special autofill button | "Your verification code is 123456" |

> Meta auto-reclassifies UTILITY → MARKETING if the content is promotional. The `template_category_update` webhook fires when this happens.

### 7.2 Lifecycle

```text
DRAFT → PENDING (review) → APPROVED
                              │
                              ├─ REJECTED (with reason) → edit + resubmit
                              │
                              ├─ PAUSED (low quality score) → edit to lift quality
                              │
                              └─ DISABLED (paused too many times) → must create new template
                              │
                              └─ IN_APPEAL (in formal review)
```

Your existing `MessageTemplate` interface in `meta.service.ts:87-102` captures `status` and `quality_score`. You need to surface the `rejected_reason` and `paused_at`/`disabled_at` in your UI.

### 7.3 Quality Score

Per template, Meta assigns a quality score (GREEN/YELLOW/RED) based on user engagement and feedback for that specific template — not the phone number. When it drops, the template is paused. Updates arrive on the `message_template_quality_update` webhook.

### 7.4 Components

A template is a JSON array of components. Order matters: HEADER → BODY → FOOTER → BUTTONS.

| Component | Sub-types / parameters | Limits | Required? |
|---|---|---|---|
| **HEADER** | `text`, `image`, `video`, `document`, `none` | text: 60 chars; image: 5 MB; video: 16 MB; document: 100 MB | Optional |
| **BODY** | `text` with `{{1}}` … `{{10}}` positional placeholders OR named (`{{customer_name}}`) | 1024 chars; 10 vars max | Required |
| **FOOTER** | `text` only | 60 chars | Optional |
| **BUTTONS** | Up to **10 buttons** total, mix of types: | — | Optional |

Button sub-types (any of the below, up to 10 total):

| Button type | Field | Constraints |
|---|---|---|
| `URL` | `text`, `url`, optional `example` for variables | URL supports `{{1}}` suffix for dynamic URL |
| `QUICK_REPLY` | `text`, `payload` | Payload is a string you receive back in webhook |
| `PHONE_NUMBER` | `text`, `phone_number` | E.164 |
| `OTP` (`COPY_CODE` or `ONE_TAP`) | `text`, `otp_type`, `autofill_text`, `package_name`, `signature_hash` | 1 OTP button max per template |
| `FLOW` | `text`, `flow_id`, `flow_action` (`navigate`/`data_exchange`), `navigate_screen` | 1 flow button max |
| `CATALOG` | `text` | Opens your catalog |
| `MPM` | `text` | Multi-Product Message (marketing only, up to 30 products / 10 sections) |

#### 7.4.1 Header Examples

```json
{ "type": "HEADER", "format": "TEXT", "text": "Welcome, {{1}}!" }
{ "type": "HEADER", "format": "IMAGE", "example": { "header_handle": ["4::aW1hZ2..."] } }
```

Header image/video/document require a `header_handle` from the resumable upload session (`POST /<APP_ID>/uploads` then `POST /<SESSION_ID>`). Your `MetaWhatsAppService.uploadTemplateMedia` already does this.

#### 7.4.2 Body with Variables

```json
{ "type": "BODY", "text": "Hi {{1}}, your order {{2}} has shipped. Track at {{3}}.",
  "example": { "body_text": [["John", "#12345", "https://example.com/track/12345"]] } }
```

`example.body_text` is what Meta shows in the approval preview. Provide a sample value for every variable.

#### 7.4.3 Buttons — Quick Reply

```json
{ "type": "BUTTONS", "buttons": [
  { "type": "QUICK_REPLY", "text": "Yes" },
  { "type": "QUICK_REPLY", "text": "No" }
]}
```

#### 7.4.4 Buttons — URL with Dynamic Suffix

```json
{ "type": "BUTTONS", "buttons": [{
  "type": "URL", "text": "Track order",
  "url": "https://example.com/track/{{1}}",
  "example": ["https://example.com/track/REF123"]
}]}
```

#### 7.4.5 Buttons — Phone Number

```json
{ "type": "BUTTONS", "buttons": [{
  "type": "PHONE_NUMBER", "text": "Call us", "phone_number": "+16505551234"
}]}
```

#### 7.4.6 Buttons — OTP (Copy Code)

```json
{ "type": "BUTTONS", "buttons": [{
  "type": "OTP", "otp_type": "COPY_CODE", "text": "Copy Code"
}]}
```

`text` is the button label; when tapped, the OTP from the body is auto-copied. iOS 26+ supports push-based autofill for this variant (per [1msg.io](https://help.1msg.io/docs/api-1msg/waba-templates)).

#### 7.4.7 Buttons — OTP (One-Tap Autofill, Android only)

```json
{ "type": "BUTTONS", "buttons": [{
  "type": "OTP", "otp_type": "ONE_TAP",
  "text": "Copy Code",
  "autofill_text": "Autofill",
  "package_name": "com.example.app",
  "signature_hash": "abcd1234..."
}]}
```

If Meta cannot verify the app signature or the user is on iOS, the button falls back to "Copy Code".

#### 7.4.8 Buttons — Flow

```json
{ "type": "BUTTONS", "buttons": [{
  "type": "FLOW", "text": "Book appointment",
  "flow_id": "123456789",
  "flow_action": "navigate",
  "navigate_screen": "WELCOME_SCREEN"
}]}
```

#### 7.4.9 Buttons — Catalog

```json
{ "type": "BUTTONS", "buttons": [{ "type": "CATALOG", "text": "View catalog" }]}
```

#### 7.4.10 Buttons — Multi-Product Message (MPM)

```json
{ "type": "BUTTONS", "buttons": [{ "type": "MPM", "text": "View products" }]}
```

When sending, the button component is parameterised:

```json
{
  "type": "button",
  "sub_type": "mpm",
  "index": 0,
  "parameters": [{
    "type": "action",
    "action": {
      "thumbnail_product_retailer_id": "SKU_A",
      "sections": [{ "title": "Bestsellers", "product_items": [
        { "product_retailer_id": "SKU_A" },
        { "product_retailer_id": "SKU_B" }
      ]}]
    }
  }]
}
```

#### 7.4.11 Buttons — Call Permission Request

A standalone utility template can include a single Call Permission Request button (not a `BUTTONS` component — it's a top-level component type):

```json
{ "type": "CALL_PERMISSION_REQUEST", "label": "Allow call" }
```

### 7.5 Parameters When Sending

**Positional:**

```json
{ "type": "body", "parameters": [
  { "type": "text", "text": "Jessica" },
  { "type": "text", "text": "SKBUP2-4CPIG9" }
]}
```

**Named (recommended for clarity):**

```json
{ "type": "body", "parameters": [
  { "type": "text", "parameter_name": "first_name", "text": "Jessica" },
  { "type": "text", "parameter_name": "order_number", "text": "SKBUP2-4CPIG9" }
]}
```

Your `campaigns/template-params.ts:buildTemplateComponents` already supports this.

**Special parameter types:**

| Type | Schema | Example |
|---|---|---|
| `text` | `{ "text": "..." }` | Names, codes |
| `currency` | `{ "currency": { "code": "USD", "amount": 1000, "fallback_value": "$10.00" } }` | Billed amount, with locale formatting |
| `date_time` | `{ "date_time": { "fallback_value": "December 31, 2024", "day_of_week": 3, "day_of_month": 31, "month": 12, "year": 2024, "hour": 23, "minute": 59 } }` | Scheduled times |
| `image` / `video` / `document` | `{ "image": { "link": "https://..." } }` | Dynamic header media |
| `payload` | `{ "type": "payload", "payload": "yes" }` | Quick-reply button payload |
| `action` | `{ "type": "action", "action": { ... } }` | Flow/MPM action payload |
| `coupon_code` | `{ "type": "coupon_code", "coupon_code": "SUMMER25" }` | Ads context |

### 7.6 Language

`language.code` must match the template's approved language. Common codes:

| Region | Code | Notes |
|---|---|---|
| English (US) | `en_US` | Default |
| English (UK) | `en_GB` | Different from `en_US` |
| Portuguese (BR) | `pt_BR` | Brazil-specific |
| Spanish (LATAM) | `es` / `es_MX` / `es_AR` | |
| Hindi | `hi` | |
| Arabic | `ar` | RTL-aware rendering |
| Indonesian | `id` | |

> Use a *single* locale, not a fallback chain. If you need multi-lingual templates, create one per language and pick at send time based on `contact.preferredLanguage`.

### 7.7 Carousel Templates (Marketing Only)

A **Product Card Carousel** template is a marketing template with:
- A single text body (optional)
- A `carousel` component containing **2-10 product cards** (at least 2 in the template; up to 10 sent)
- Each card has a media header (image/video) and up to 2 buttons (any mix of QUICK_REPLY, PHONE_NUMBER, URL, SPM)

**Component structure:**

```json
{
  "type": "carousel",
  "cards": [
    { "card_index": 0,
      "components": [
        { "type": "header", "format": "image", "example": { "header_handle": ["4::aW1..."] }},
        { "type": "body",  "text": "Our classic sneaker. {{1}}.", "example": { "body_text": [["$59.99"]] }},
        { "type": "buttons", "buttons": [
          { "type": "URL",       "text": "Buy now", "url": "https://shop.example.com/sneaker" },
          { "type": "QUICK_REPLY", "text": "More info" }
        ]}
      ]}
  ]
}
```

When sending, supply per-card parameter values for the body placeholders. The `send.service.ts` does **not** yet build carousels — add a new branch:

```ts
// pseudo-code
if (input.type === 'CAROUSEL_TEMPLATE' && input.carouselCards?.length) {
  result = await MetaWhatsAppService.sendMessage(input.phoneNumberId, accessToken, {
    to: phone,
    type: 'template',
    template: { name, language, components: [
      { type: 'body', parameters: input.bodyParams },
      { type: 'carousel', cards: input.carouselCards.map(c => ({ ...c }))}
    ]}
  });
}
```

### 7.8 Local Templates vs Central Templates (Template Management API)

- **Local templates** live in a single WABA and are managed via that WABA's `/message_templates` endpoint (what your `meta.service.ts:listMessageTemplates`, `createMessageTemplate` do).
- **Central templates** (Template Management API) are managed at the **portfolio level** (`/<BUSINESS_ID>/message_templates`) and shared across all WABAs in the portfolio. Used by Solution Partners onboarding many clients. You don't need it yet.

### 7.9 Template Library

Meta curates a `message_template_library` of pre-approved templates (order confirmation, appointment reminder, OTP, etc.) you can clone and customize. Your `MetaWhatsAppService.listMessageTemplateLibrary` and `createMessageTemplateFromLibrary` are already implemented — surface them in the UI as "Quick start templates".

### 7.10 Limits

- **250 templates per WABA** (Meta error `2388019` if exceeded).
- **10 templates per category per language** — *wait, this is the template-component limit per message; the WABA can have hundreds per category across many languages.* Verify against the official limits doc.
- **Variable count:** ≤ 10 per template. Parameter word/character ratio must be reasonable (`2388293` if too many variables for the body length).
- **Header characters:** text header 60 chars; if longer, `2388040` is raised.
- **Body characters:** 1024 chars.
- **Footer characters:** 60 chars.
- **Variable can't lead or trail:** `2388299` if a variable is the first or last token in body.

---

## 8. Webhooks — Incoming Events

### 8.1 Verification Handshake

When you register your webhook URL via the App Dashboard (or `POST /<APP_ID>/subscriptions`), Meta sends a GET:

```text
GET /api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=<YOUR_TOKEN>&hub.challenge=<CHALLENGE>
```

Your endpoint must respond 200 with the `hub.challenge` value. Your `whatsapp/routes.ts:351-360` handles this — good.

### 8.2 The Envelope

Every webhook POST looks like:

```json
{
  "object": "whatsapp_business_account",
  "entry": [
    {
      "id": "<WABA_ID>",
      "changes": [
        {
          "value": { ... },
          "field": "messages" | "flows" | "message_template_status_update" | "phone_number_quality_update" | ...,
          "id": "..."
        }
      ]
    }
  ]
}
```

Multiple `entry` items and multiple `changes` are possible in one POST. Process all of them.

### 8.3 The `messages` Field

The one your `webhook.processor.ts` handles. Two arrays in the `value`:

- `messages[]`: inbound messages from customers.
- `statuses[]`: delivery state updates for messages you sent.

```json
{
  "object": "whatsapp_business_account",
  "entry": [{
    "id": "102290129340398",
    "changes": [{
      "field": "messages",
      "value": {
        "messaging_product": "whatsapp",
        "metadata": {
          "display_phone_number": "15550783881",
          "phone_number_id": "106540352242922"
        },
        "contacts": [{ "profile": { "name": "Sheena Nelson" }, "wa_id": "16505551234" }],
        "messages": [{
          "context": { "from": "16505551234", "id": "wamid.HBgL..." },
          "from": "16505551234",
          "id": "wamid.HBgLMTY1MDM4Nzk0MzkVAgASGBQzQTRBNjU5OUFFRTAzODEwMTQ0RgA=",
          "timestamp": "1749416383",
          "type": "text",
          "text": { "body": "Does it come in another color?" }
        }],
        "statuses": [{
          "id": "wamid.HBgL...",
          "status": "delivered",
          "timestamp": "1749416400",
          "recipient_id": "16505551234",
          "pricing": { "billable": false, "pricing_model": "CBP", "category": "service" }
        }]
      }
    }]
  }]
}
```

#### 8.3.1 Inbound Message Types

| `type` field | `value.X` keys | Notes |
|---|---|---|
| `text` | `body`, optional `preview_url` (true) | |
| `image`, `video`, `audio`, `document`, `sticker` | `id`, `mime_type`, `sha256`, `caption?` (image/video/document), `filename?` (document/audio) | Media must be downloaded via `GET /<MEDIA_ID>` |
| `location` | `latitude`, `longitude`, `name?`, `address?` | |
| `contacts` | `addresses`, `birthday`, `emails`, `name`, `org`, `phones`, `urls` (array of objects) | Up to 257 |
| `interactive` | `button_reply: { id, title }` *or* `list_reply: { id, title, description }` | Reply button / list reply |
| `button` | `text`, `payload` | Legacy template quick-reply (text body template) |
| `reaction` | `message_id`, `emoji` (empty if removing) | |
| `order` | `catalog_id`, `product_items`, `text` | Order from catalog |
| `system` | `body`, `new_wa_id`, `type` ("user_changed_number" or "user_identity_changed") | System message, no reply possible |
| `unsupported` | `errors` array | The recipient's client doesn't support the type you sent |
| `request_welcome` | (empty) | User tapped the "Get started" button on a Flow |
| `ephemeral` | (rare) | |

Your `parseInboundMessage` in `inbox/message-parser.ts` already covers text, image, document, audio, video, sticker, button, list, reaction, location, contacts — verify the parsers match the table above.

#### 8.3.2 Status Update Types

| `status` field | Meaning | When |
|---|---|---|
| `sent` | Meta accepted the message, handed it to the user's device | Always (when delivery successful) |
| `delivered` | The user's device acknowledged | After `sent` |
| `read` | The user opened the chat | After `delivered`; if blue ticks enabled |
| `failed` | Final delivery failure (e.g., `131026`, `131050`) | Once, then no more updates |
| `deleted` | The sender deleted the message for everyone (revoked) | Rare |
| `warning` | A soft warning (e.g., spike in block rate) | |

For pricing, the webhook may include:

```json
"pricing": {
  "billable": true,
  "pricing_model": "CBP",   // "CBP" = conversation-based (legacy), "PMP" = per-message pricing
  "category": "marketing",   // "marketing" | "utility" | "authentication" | "service" | "free_customer_service"
  "type": "regular"          // "regular" | "free_customer_service" | "free_tier" | "free_entry_point"
}
```

This is gold for analytics: correlate campaign ID with billable status.

### 8.4 Webhook Event Reference (per [docs](https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks))

| Field name | `value` shape | When it fires | What to do |
|---|---|---|---|
| `messages` | `{ contacts, messages, statuses, errors }` | Inbound / outbound status | Process |
| `account_alerts` | `[{ type, severity, message, ... }]` | WABA messaging limit change, Official Business Account status | Update settings UI |
| `account_review_update` | `[{ event, decision }]` | WABA policy review outcome | Show banner |
| `account_update` | `[{ event, ... }]` | Partner-led verification, OBO accept, offboarding, deletion | Audit log |
| `business_capability_update | `[{ capability, action }]` | Limit upgrades | Alert user via notification |
| `message_template_components_update` | `[{ template_id, ... }]` | Template body/buttons changed | Re-fetch template |
| `message_template_quality_update` | `[{ template_id, new_quality_score }]` | Quality flipped | Pause associated campaign |
| `message_template_status_update` | `[{ template_id, event, reason }]` | Approved / paused / disabled | Update UI badge |
| `template_category_update` | `[{ template_id, previous_category, new_category }]` | Auto reclassification | Re-budget |
| `phone_number_name_update` | `[{ phone_number_id, decision }]` | Display name approved / rejected | Unblock sending |
| `phone_number_quality_update` | `[{ phone_number_id, display_phone_number, event, current_limit, current_quality_score }]` | Throughput level change | Update settings |
| `security` | `[{ event }]` | Phone number security setting changed | Audit log |
| `flows` | `[{ from, flow_token, flow_id, screen_id, data }]` | Flow submitted | Persist + act |
| `payments` | `[{ reference_id, transaction_status, ... }]` | Payment lifecycle (India/Brazil) | Update order |
| `payment_configuration_update` | `[{ configuration_name, action }]` | Payment config change | Audit |
| `partner_solutions` | `[{ ... }]` | Multi-Partner Solution | Audit |
| `smb_app_state_sync` | `[{ contacts }]` | Sync contacts of SMB app user (coexistence) | Merge |
| `smb_message_echoes` | `[{ from, type, text/image/... }]` | Echo of messages from linked device | Reflect in inbox |
| `history` | `[{ ... }]` | Sync history from Business app | Initial backfill |
| `user_preferences` | `[{ wa_id, preference_category, value }]` | User opted out of marketing | Update contact opt-out |
| `automatic_events` | `[{ event, ... }]` | Detected ad conversion | Attribution |

### 8.5 HMAC SHA-256 Signature Verification

Meta signs every webhook POST with `X-Hub-Signature-256: sha256=<hex>`, computed as:

```text
sha256 = HMAC-SHA256(app_secret, raw_body)
```

Your `meta.service.ts:verifyWebhookSignature` implements this — good. **However**, see the note in `webhook.processor.ts:374`: if `signature` header is missing *and* `config.meta.appSecret` is set, the request is **not** rejected. That is a security gap — fail closed.

### 8.6 Deduplication by `message.id`

The same `messages` event can be delivered multiple times (e.g., 200 retries over 7 days per the [Webhooks doc](https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks)). You **must** dedup on `messages[].id` (also `statuses[].id`). Your `Message` model has `metaMessageId` (which is the `id` of inbound) — make it `@unique` in the Prisma schema (verify) and use `prisma.message.create({ ... })` with a try-catch on `P2002` to ignore duplicates.

### 8.7 24-Hour Service Window Tracking

There's no explicit webhook for "CSW opened/closed", but you can infer it from `messages[].timestamp`:

```ts
// On every inbound message:
conversation.cs24hWindowOpensAt = new Date(msg.timestamp * 1000);
conversation.lastInboundAt = new Date(msg.timestamp * 1000);
```

Then `isWithin24hWindow` (in `meta.service.ts:852`) checks `Date.now() - lastInboundAt < 24h`. For status updates, the window doesn't extend — only inbound messages or inbound calls reset the clock.

---

## 9. Error Codes & Edge Cases

This is the section the user explicitly asked to be exhaustive. Sources: [Meta's official error codes page](https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes), [Kapso's reference](https://docs.kapso.ai/api/meta/whatsapp/messages/send-a-message), [SnakeChat guide](https://chat.sagi-digital.com/help/waba-error-codes), [Dualhook](https://dualhook.com/docs/api-errors), [Innopaas](https://docs.innopaas.com/api-reference/api-reference-en/whatsapp-business-api/error-codes/meta-error-codes), [Yoni-Tech](https://docs-yoni-tech.readme.io/reference/whatsapp_whatsapp-errors), [Kaleyra](https://developers.kaleyra.io/docs/cloud-api-error-codes).

> **Format convention used in tables below:**
> - **Code:** integer
> - **HTTP:** status returned in the Graph API response
> - **Retryable:** whether you can retry without operator action (with backoff)
> - **Quality:** whether the error affects phone-number or template quality score

### 9.1 Authorization Errors (`0`, `3`, `10`, `190`, `200`)

| Code | HTTP | Title | Cause | Fix | Retry? |
|---|---|---|---|---|---|
| `0` | 401 | We were unable to authenticate the app user | Access token expired/invalidated | Re-run OAuth flow, get a new token | No — re-auth |
| `3` | 400 | Capability or permissions issue | App lacks the required permission | Verify permission in Access Token Debugger | No |
| `10` | 403 | Permission is either not granted or has been removed | Same as 3; also: phone number used to set Flow public key not allowlisted | Check WABA ownership; re-allowlist | No |
| `190` | 401 | Your access token has expired | Token expired | Refresh (exchange for long-lived) | No — re-auth |
| `200` | 400 | Provide valid app ID | Token missing on certain GET endpoints | Include Bearer token | No |

### 9.2 Integrity Errors (`368`, `130497`, `131031`)

| Code | HTTP | Title | Cause | Fix | Quality? |
|---|---|---|---|---|---|
| `368` | 403 | Temporarily blocked for policies violations | WABA violated platform policy | File appeal via Direct Support; review policy enforcement | YES |
| `130497` | 403 | Restricted region | WABA can't message that country | Cross-country messaging requires 2,000 messaging limit tier | No |
| `131031` | 403 | Account has been locked | Policy violation OR 2FA PIN incorrect | Disable 2FA → re-register → re-enable 2FA; or appeal | YES |

### 9.3 Throttling / Rate Limit Errors

| Code | HTTP | Title | Cause | Fix | Retryable | Backoff |
|---|---|---|---|---|---|---|
| `4` | 429 | WhatsApp API limit exceeded | App-level rate limit hit | Throttle / exponential backoff | YES | `2^X` seconds |
| `80007` | 429 | WABA rate limit exceeded | WABA-level rate limit | Verify business; back off | YES | `2^X` seconds |
| `130429` | 429 | Throughput rate limit hit | 80 msg/s or higher capacity reached | Reduce send rate | YES | `4^X` seconds |
| `131048` | 429 | Spam protection | Previous messages blocked/flagged | Check quality status, fix templates | YES (after quality improves) | N/A |
| `131056` | 429 | Pair rate limit hit (1 msg/6s per recipient) | Too fast to one user | Wait per spec | YES | **`4^X` seconds** (mandatory) |
| `131064` | 429 | Messaging limit due to template classification violations | Account-level throttle from miscategorised templates | Review and fix | YES (after enforcement period) | N/A |
| `133016` | 429 | Register/deregister rate limit exceeded | Too many registration attempts | Wait per response | YES | Specified in response |

### 9.4 Other / Generic Errors

| Code | HTTP | Title | Cause | Fix | Retryable |
|---|---|---|---|---|---|
| `1` | 500 | API Unknown | Server error or bad request | Check status page, verify schema | YES |
| `2` | 500 | API Service | Server overloaded | Check status page | YES |
| `3` | 400 | Capability or permissions issue | App missing permission | Grant permission | No |
| `33` | 400 | Parameter value is not valid (deleted number) | Business phone number deleted | Verify phone_number_id is correct | No |
| `100` | 400 | Invalid parameter | Bad/missing field; MM API: "Message must be a template message" | Validate schema | No |
| `1000` | 400 | Recipient phone number is not valid | E.164 format issue | Validate + prefix | No |

### 9.5 Send Message Errors

| Code | HTTP | Title | Cause | Fix | Retryable |
|---|---|---|---|---|---|
| `130403` | 400 | Business has blocked the end user | You blocked the contact | Unblock via the Unblock API | No |
| `130472` | 400 | User's number is part of an experiment | MM API A/B experiment running | Documented Marketing Message Experiment | No |
| `131000` | 500 | Something went wrong | Unknown send failure | Retry; if persistent, open Direct Support | YES |
| `131005` | 403 | Access denied | Permission removed | Re-grant | No |
| `131008` | 400 | Required parameter is missing | Schema mismatch | Fix payload | No |
| `131009` | 400 | Parameter value is not valid | Wrong format / spelling | Verify schema | No |
| `131016` | 503 | Service unavailable | Meta server down | Check status page | YES |
| `131021` | 400 | Recipient cannot be sender | `to == from` | Use a different recipient | No |
| `131026` | 400 | Message undeliverable | Not a WA number / old app / ToS not accepted | Ask user to message you; do not retry | **No — fall back to SMS** |
| `131037` | 400 | Display name approval needed | 555 test number, no approved display name | Change display name | No |
| `131042` | 400 | Payment issue | No payment method / over limit | Add payment in Meta Business Manager | No |
| `131045` | 400 | Incorrect certificate | Phone number registration error | Register number | No |
| `131047` | 422 | Out of 24h response window | Window closed, free-form refused | Send a template | No (use template) |
| `131049` | 400 | Meta chose not to deliver | Marketing template per-user limit hit | Wait 24h; do not retry | **No** |
| `131050` | 400 | Opted-out from marketing | Contact opted out | Remove from marketing list | **No** |
| `131051` | 400 | Unsupported message type | Type / format not supported | Use template / supported media | No |
| `131052` | 400 | Media download error | Could not download customer's media | Ask user to resend | No |
| `131053` | 400 | Media upload error | Could not upload your media | Verify MIME / size | No |
| `131055` | 400 | Method not allowed (MM API) | Non-marketing template on MM API | Use marketing template | No |
| `131057` | 400 | Account in maintenance mode | Account upgrading | Retry later | YES |
| `131063` | 400 | Marketing templates disabled on Cloud API | `disable_marketing_messages_on_cloud_api=true` | Use MM API or re-enable | No |
| `135000` | 400 | Generic user error | Bad parameters | Fix payload | No |
| `1026` | 422 | Receiver Incapable | Address message not supported in region | Drop | No |

### 9.6 Template Send Errors

| Code | HTTP | Title | Cause | Fix | Retryable |
|---|---|---|---|---|---|
| `132000` | 400 | Template Param Count Mismatch | Body has 3 vars, you sent 2 | Fix count | No |
| `132001` | 400 | Template does not exist | Name/language wrong or not approved | Verify template name + `language.code` | No |
| `132005` | 400 | Template Hydrated Text Too Long | Translated text overflow | Re-check template translations | No |
| `132007` | 400 | Template Format Policy Violated | Content violates policy | Edit and resubmit | No |
| `132012` | 400 | Template Parameter Format Mismatch | Wrong parameter type (e.g., currency not text) | Use correct parameter type | No |
| `132015` | 400 | Template is Paused | Low quality score | Edit to lift quality | No |
| `132016` | 400 | Template is Disabled | Paused too many times | Create new template | No |
| `132018` | 400 | Template validation error | MM API parameter issue | Recheck | No |
| `132068` | 403 | Flow is blocked | Flow in blocked state | Fix Flow in Meta Business Manager | No |
| `132069` | 429 | Flow is throttled | 10 flow messages in last hour | Wait | YES |
| `132069` | — | Flow throttled | 10/hr | Wait | YES |

### 9.7 Template Creation Errors

| Code | HTTP | Title | Cause | Fix | Retryable |
|---|---|---|---|---|---|
| `2388019` | 400 | Message Template Limit Exceeded | > 250 templates on WABA | Delete unused | No |
| `2388040` | 400 | Character limit exceeded | Header/body/footer too long | Trim | No |
| `2388047` | 400 | Message header format is incorrect | Bad header formatting | Fix | No |
| `2388072` | 400 | Message body format is incorrect | Bad body formatting | Fix | No |
| `2388073` | 400 | Message footer format is incorrect | Bad footer formatting | Fix | No |
| `2388293` | 400 | Parameters words ratio exceeds limit | Too many vars for length | Add more text or fewer vars | No |
| `2388299` | 400 | Leading or trailing parameters not allowed | Variable at start or end | Move variable | No |

### 9.8 Phone Migration / Registration Errors

| Code | HTTP | Title | Cause | Fix | Retryable |
|---|---|---|---|---|---|
| `133000` | 400 | Incomplete Deregistration | Previous dereg failed | Deregister then register | No |
| `133004` | 503 | Server Temporarily Unavailable | Server issue | Check status page | YES |
| `133005` | 400 | Two-step verification PIN Mismatch | Wrong 2FA PIN | Disable 2FA, reset PIN, re-enable | No |
| `133006` | 400 | Phone number re-verification needed | Number needs re-verification | Re-verify | No |
| `133008` | 400 | Too Many PIN Guesses | Rate limited | Wait per response | YES |
| `133009` | 400 | PIN Guessed Too Fast | Rate limited | Wait | YES |
| `133010` | 400 | Phone number Not Registered | Number not on platform | Register first | No |
| `133015` | 400 | Registration wait needed | Recently deleted | Wait 5 min | YES |
| `133016` | 429 | Register/deregister rate limit exceeded | Too many attempts | Wait | YES |
| `2388001` | 400 | Phone verification failed | Migration / 2FA issue | Verify; disable 2FA | No |
| `2388012` | 400 | Phone number already exists | Already on your WABA | Use a different number | No |
| `2388091` / `2388093` | 400 | Phone number not eligible | Not a migration case | Register and verify | No |
| `2388103` | 400 | Cannot migrate phone number | Various: webhooks not set up, business not verified, payment not set, etc. | See `details` | No |

### 9.9 Template Insights Errors

| Code | HTTP | Title | Cause | Fix | Retryable |
|---|---|---|---|---|---|
| `200005` | 400 | Template insights unavailable | Not yet available for this WABA | Wait | No |
| `200006` | 400 | Cannot disable template insights | Once enabled, can't disable | Accept it | No |
| `200007` | 400 | Template Insights not enabled | Insights not yet turned on | Enable via Confirming Template Analytics | No |

### 9.10 WABA Errors (`2593079`, `2593085`)

| Code | HTTP | Title | Cause | Fix |
|---|---|---|---|---|
| `2593079` | 400 | WABA marked for migration | OBO model deprecated | Contact support |
| `2593085` | 400 | Invalid WABA for OBO Mobility | OBO deprecated | Contact support |

### 9.11 Synchronization Errors (`2593107`, `2593108`)

| Code | HTTP | Title | Cause | Fix |
|---|---|---|---|---|
| `2593107` | 400 | Synchronization request limit exceeded | Called too many times | Offboard and re-onboard |
| `2593108` | 400 | Synchronization request outside allowed time window | > 24h after onboarding | Offboard + re-onboard |

### 9.12 Payments Errors

| Code | HTTP | Title | Cause | Fix |
|---|---|---|---|---|
| `134011` | 400 | WhatsApp Payments terms of service not accepted | ToS pending | Accept via link in error |

### 9.13 Marketing Messages Lite API Errors

| Code | HTTP | Title | Cause | Fix |
|---|---|---|---|---|
| `100` | 400 | Message must be a template message | Sent non-template | Use template |
| `131009` | 400 | Parameter value is not valid | Ad sync incomplete | Wait 10 min |
| `131055` | 400 | Method not allowed | Non-marketing on MM API | Use marketing template |
| `134100` | 400 | Only marketing messages supported | Utility/auth on MM API | Switch to Cloud API |
| `134101` | 400 | Template still syncing | < 10 min since template created | Wait 10 min |
| `134102` | 500 | Template unavailable for use | Eligibility issue | Check `marketing_messages_lite_api_status` |
| `1752041` | 400 | Duplicate onboarding request | Already onboarded | No action |

### 9.14 Group / Calling Errors

| Code | Title | Cause |
|---|---|---|
| (varies) | Group membership changes | Group API limited availability — refer to [Groups docs](https://developers.facebook.com/docs/whatsapp/cloud-api/groups) |
| `131026` variants for calls | Call rejected / declined / not answered | Refined per call type in your `calling` module |

### 9.15 Error-Handling Code Skeleton

```ts
// server/src/errors/meta.ts (NEW)
import { AppError, logError } from '../errors';

interface MetaErrorResponse {
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    error_data?: { messaging_product?: string; details?: string };
    fbtrace_id?: string;
  };
}

const NON_RETRYABLE = new Set([100, 131008, 131021, 131026, 131037, 131047, 131049, 131050, 131051, 132000, 132001, 132012, 132015, 132016]);
const RETRYABLE_4X = new Set([130429, 131056, 80007]);     // use 4^X backoff
const RETRYABLE_2X = new Set([4, 131000, 131016, 131057]); // use 2^X backoff
const QUALITY_AFFECTING = new Set([368, 131031, 130497, 131048, 131049, 131064, 132015, 132016]);

export function classifyMetaError(body: MetaErrorResponse): {
  retryable: boolean;
  backoff: 'none' | '2x' | '4x' | 'reauth';
  affectsQuality: boolean;
  userFacingMessage: string;
  code: number;
  details?: string;
  fbtraceId?: string;
} {
  const err = body.error;
  if (!err) return { retryable: false, backoff: 'none', affectsQuality: false, userFacingMessage: 'Unknown error', code: 0 };
  const code = err.code ?? 0;
  let backoff: 'none' | '2x' | '4x' | 'reauth' = 'none';
  if (RETRYABLE_4X.has(code)) backoff = '4x';
  else if (RETRYABLE_2X.has(code)) backoff = '2x';
  else if ([0, 190, 200].includes(code)) backoff = 'reauth';
  return {
    retryable: NON_RETRYABLE.has(code) ? false : true,
    backoff,
    affectsQuality: QUALITY_AFFECTING.has(code),
    userFacingMessage: err.message ?? 'Unknown Meta error',
    code,
    details: err.error_data?.details,
    fbtraceId: err.fbtrace_id,
  };
}

export function handleSendError(body: MetaErrorResponse, jobId: string): never {
  const c = classifyMetaError(body);
  logError(new AppError(c.retryable ? 502 : 400, c.userFacingMessage, `META_${c.code}`), {
    source: 'worker',
    queueName: 'message-send',
    jobId,
    code: c.code,
    affectsQuality: c.affectsQuality,
    backoff: c.backoff,
  });
  if (!c.retryable) throw new AppError(400, c.userFacingMessage, `META_${c.code}`);
  // throw a retryable error; the worker will honour BullMQ's backoff
  throw new AppError(502, c.userFacingMessage, `META_RETRY_${c.code}`);
}
```

---

## 10. Pricing

Effective **July 1, 2025**, Meta moved from per-conversation to per-message pricing for business-initiated template messages ([source](https://whatsappbusiness.com/products/platform-pricing/), [uptail.ai](https://www.uptail.ai/blog/whatsapp-business-api-pricing-2026-what-it-costs-and-how-billing-works), [setsmart.io](https://setsmart.io/blog/whatsapp-business-api-pricing)).

### 10.1 The Four Categories

| Category | When free | When billed | Typical cost (US, Apr 2026) |
|---|---|---|---|
| **Service** | Always | Never | $0.00 |
| **Utility** | Inside an open CSW | Outside CSW, billable | $0.0040 / msg |
| **Authentication** | Never (always billed) | Always | $0.0135 / msg |
| **Marketing** | Never (always billed) | Always | $0.0250 / msg |
| **Free entry-point** (Click-to-WhatsApp ads, Facebook Page CTA) | 72 hours after the customer-initiated ad click | After 72h | $0.00 for 72h |

> Per [Twilio docs](https://www.twilio.com/docs/whatsapp/key-concepts.md): "From July 1, 2025, Utility template messages don't incur any Meta fees if you send them during a customer service window. Authentication and Marketing template messages continue to incur fees during the customer service window."

### 10.2 Country Rate Card (Sample, April 2026)

From [whautomate.com](https://whautomate.com/tools/whatsapp-business-api-pricing-calculator) and [setsmart.io](https://setsmart.io/blog/whatsapp-business-api-pricing):

| Country | Marketing | Utility | Authentication |
|---|---|---|---|
| 🇺🇸 United States | $0.0250 | $0.0040 | $0.0135 |
| 🇬🇧 United Kingdom | $0.0592 | $0.0171 | $0.0358 |
| 🇩🇪 Germany | $0.1365 | $0.0331 | $0.0768 |
| 🇫🇷 France | $0.1431 | $0.0314 | $0.0691 |
| 🇪🇸 Spain | $0.0615 | $0.0135 | $0.0298 |
| 🇧🇷 Brazil | $0.0625 | $0.0080 | $0.0225 |
| 🇮🇳 India | $0.0118 | $0.0014 | $0.0014 |
| 🇦🇪 UAE | $0.0816 | $0.0285 | $0.0492 |
| 🇲🇽 Mexico | $0.0436 | $0.0080 | $0.0207 |
| 🇮🇩 Indonesia | $0.0271 | $0.0036 | $0.0079 |
| 🇹🇷 Turkey | $0.0109 | (low) | (low) |
| 🇳🇱 Netherlands | $0.1597 | (high) | (high) |

Rates are **per recipient country code**, not per business location. They change quarterly (Jan/Apr/Jul/Oct).

### 10.3 Volume Tiers

Utility and Authentication have **graduated volume discounts**: a percentage of the monthly volume in a recipient market unlocks progressively lower per-message rates within that market. Marketing has **no volume discount** (but still benefits from quality score keeping the number in good standing).

### 10.4 Free Entry-Point Conversations

When a user messages you from a Click-to-WhatsApp ad or a Facebook Page call-to-action, you have a **72-hour free entry-point window** for *all* messages to that user (including marketing). After 72h, normal pricing applies.

### 10.5 Per-User Marketing Template Message Limit

Meta enforces a per-user **anti-spam** throttle on marketing templates: sending too many marketing templates to the same user in a short window triggers `131049` ("Meta chose not to deliver"). The exact limits are undisclosed and **not** active in EU, UK, Japan, South Korea.

### 10.6 Implications for the Platform

- **Use Utility for transactional.** If your "order shipped" template slips into marketing language, Meta reclassifies it, and you pay 5-10x more. Train the AI bot and template builder to be terse.
- **Prefer flows over custom journeys.** Customer service inside a CSW is free. Use buttons, lists, and flows before resorting to templates.
- **Cache the country→tier map.** Refresh quarterly. The `billing` module's Razorpay integration should reflect this.
- **Track `pricing` in status webhooks** (see §8.3.2) — this is the only ground truth for what Meta billed.
- **Volume-tier UI** in `BillingPage.tsx` should show projected tier upgrades for the month.

---

## 11. Best Practices

### 11.1 The 24-Hour Customer Service Window

- Opens when a user messages or calls you.
- Resets on **every** new inbound message/call.
- Inside: free-form messages are free; utility templates are free; marketing & auth templates still bill.
- Outside: **only** templates (and they bill per category).

Your `meta.service.ts:isWithin24hWindow` checks `lastInboundAt`. Better: store `cs24hWindowOpensAt` and recompute on every inbound.

### 11.2 1:1 Human Support Within 24h Free

This is the killer feature. Inbox conversations with active agents are free. The moment a marketer wants to "send a broadcast to inactive users", you need a template and they pay per message.

### 11.3 Template Design

- **Header is optional but lifts engagement** (image or video header for marketing).
- **One CTA only.** Don't put two CTAs in the same template.
- **Avoid emoji in body if the template is utility** — looks spammy, can trigger reclassification to marketing.
- **Footer 60 chars max** — keep it short ("Reply STOP to opt out").
- **Variables**: prefer **named** (`{{customer_name}}`) over positional (`{{1}}`) for clarity.

### 11.4 Avoiding Quality Score Drops

- Don't send to people who haven't opted in.
- Suppress the campaign the moment you see `131049` for a recipient.
- Use `user_preferences` webhook to honour opt-outs in real time.
- Send the same content to a list slowly (e.g., 100 msg/min) to avoid burst detection.
- Localise templates per market (a Spanish audience in Mexico wants `es_MX`, not `es`).

### 11.5 Rate-Limit Handling

- **Throughput (`130429`):** back off `4^X` seconds.
- **Pair rate (`131056`):** back off `4^X` seconds per recipient.
- **WABA-level (`80007`, `4`):** back off `2^X` seconds.
- **Spam protection (`131048`):** do not retry, check quality first.

Use BullMQ's custom backoff with the matching `attempts` and `delay` per job.

### 11.6 Idempotency / Deduplication

- **Inbound:** `prisma.message.create` on `metaMessageId` with a unique constraint. Catch `P2002` to ignore duplicates.
- **Outbound:** generate a client-side `biz_opaque_callback_data` (max 512 chars), persist on the message row, log it in webhooks. Re-send only if status remains `PENDING` for > 30s and the BullMQ job hasn't returned a message ID.

### 11.7 Encryption / Security

- **Always verify HMAC SHA-256** (already done). Reject unsigned webhooks when `META_APP_SECRET` is set (fix needed — see §13).
- **Encrypt access tokens at rest** (your `MetaWhatsAppService.encryptToken` uses `utils/crypto`).
- **mTLS webhooks** (optional, recommended for high-volume): mutual TLS between your server and Meta's webhook servers.
- **IP allowlist:** Meta publishes IPs via `whois` and a geofeed CSV (see [Webhooks doc](https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks)).
- **Flow RSA keypair** in a dedicated KMS or at minimum a chmod-600 file in `secrets/`. Never check it in.

### 11.8 GDPR / DSGVO / Data Retention

- **Right to erasure:** when a contact requests deletion, also remove their conversation, messages, and contact record. Flow state is on the conversation row.
- **Data residency:** Cloud API is hosted by Meta (US/EU regions). On-Premises would give EU-only storage, but it's deprecated.
- **Opt-in:** Meta requires explicit opt-in for utility and marketing templates. Maintain an `optInSource` and `optInAt` timestamp on the `Contact` model — verify it's there.
- **Audit log:** keep all sends for at least 30 days (Meta's standard) but also 6-12 months for customer-dispute reasons.

### 11.9 Multi-Language

- Detect language on inbound (`flows/language.ts` already does this).
- Send the template that matches the detected language.
- Fall back to `en` if the contact's language isn't supported.
- Persist `contact.preferredLanguage` to skip detection on follow-ups.

### 11.10 Time-Zone Awareness

- `OrgBusinessHours` (in `flows/types.ts:148`) stores `timezone` — make sure this is enforced end-to-end.
- The AI bot should respect business hours when suggesting actions.
- Scheduled campaigns in `campaigns` should use the contact's local time, not the org's.

### 11.11 A/B Testing for Templates

- Use the same `flow_id` template but vary the body via a small variant (e.g., the `footer`).
- Track which template sends got higher `delivered` → `read` rates.
- Use the A/B split in the flows engine (`ab_split` node) for journey-level A/B, not template-level.

### 11.12 Status Webhooks for Analytics

Don't ignore them. Every `statuses[]` entry updates:

- `message.status` (PENDING → SENT → DELIVERED → READ → FAILED)
- `message.metadata.pricing = { billable, category, type, model }` — your billing module can compute ROI per campaign.

---

## 12. Existing Project Mapping — What's Built vs. What's Missing

This is the **framework-1 (problem-first)** lens applied to the codebase. Each row says what Meta surface is mapped, where the code lives, and the status.

### 12.1 Server Modules → Meta API Surface

| Server module | Files | Meta API surface | Status | Notes |
|---|---|---|---|---|
| `whatsapp` | `meta.service.ts`, `routes.ts`, `context.ts`, `connect-pending.ts` | Cloud API: send/receive, OAuth, webhooks, template list/create, WABA subscription | **Mostly built** | See gaps in §13.1 |
| `messages` | `send.service.ts`, `service.ts`, `interactive.ts`, `routes.ts` | `POST /messages` for text/template/media/interactive | **Mostly built** | Sticker, reaction, address_message, carousel, payment, call_permission, location_request, reaction missing |
| `templates` | `builder.ts`, `analytics.ts`, `routes.ts`, `types.ts` | `/message_templates` create/list/get/delete; library clone; central templates | **Built for CRUD** | Carousel templates, MPM templates, OTP copy/one-tap, OTP autofill package/signature, `add_security_recommendation`, `code_expiration_minutes` not built |
| `flows` | `engine.ts`, `validation.ts`, `language.ts`, `analytics.ts`, `versioning.ts`, `simulate.ts`, `lock.ts`, `flow-state.ts`, `types.ts`, `routes.ts` | `wa_flow` interactive message; Flow JSON authoring | **Built for client-side** | E2EE data endpoint, RSA keypair, public-key registration with Meta — NOT built |
| `campaigns` | `audience`, `recipients`, `quota`, `audit`, `template-params`, `validation` | `/messages` with template, audience filters | **Built** | Per-user marketing throttle (`131049`) handling could be smarter; track `pricing` from status webhooks |
| `automation` | `keyword`, `welcome`, `away`, `engine`, `conflicts`, `analytics` | Inbound message routing | **Built** | The `engine` triggers flows + AI bot + canned replies; conflict detection exists |
| `inbox` | `service`, `message-parser`, `routes` | Inbound + outbound message handling, conversation threads | **Built** | Parser covers most types; ensure all 5.1 row types covered |
| `ai` / `ai-bot` | `chatbot`, `bot`, `ingest`, `guardrails`, `rate-limit`, `handoff`, `versioning`, `lock`, `analytics`, `org-ai`, `types` | AI-generated free-form replies (only inside CSW) | **Built** | Already enforces "no AI outside CSW" — verify |
| `calling` | `meta`, `agent-call`, `ai-voice-agent`, `Deepgram STT`, `Google TTS`, `WebRTC`, `call session`, `routing`, `missed-call`, `settings`, `analytics`, `filters`, `system status` | Business-initiated / user-initiated voice calls | **Built** | WebRTC bridge for AI voice agent — unique selling point |
| `media` | `upload`, `download`, `storage`, `storage-adapter`, `public routes` | `POST /<phone_number_id>/media` (resumable upload), `GET /<media_id>` for download | **Built** | S3 optional adapter, public route for serving outbound media |
| `contacts` | `service`, import/export | `/<phone_number_id>/contacts` (re-engagement) | **Partial** | The contacts endpoint for re-engagement is not wired |
| `integrations` | `dispatch`, `routes` | Outbound webhooks to customer's systems | **Built** | Already dispatches `message.received` to org webhooks |
| `sla` | `service` | n/a (operational) | **Built** | Computes `slaDueAt` on inbound |
| `team` | `assignment`, `audit`, `metrics`, `TOTP`, `routes` | n/a (operational) | **Built** | TOTP for 2FA on team members |
| `billing` | `plans`, `Razorpay`, `routes` | n/a (your billing) | **Built** | Should reconcile with Meta's per-message billing via `pricing` webhooks |
| `compliance` | (your module) | n/a (opt-out enforcement) | **Built** | Verify it subscribes to `user_preferences` webhook |
| `analytics` | (your module) | Conversation / template / pricing analytics | **Built** | Pull from status webhooks; Meta also has Analytics API |
| `canned-replies` | (your module) | Free-form quick replies | **Built** | Use inside CSW |
| `labels` | (your module) | n/a (organisational) | **Built** | |
| `settings` | `business-hours`, `routes` | n/a (operational) | **Built** | OrgBusinessHours already used by flows engine |

### 12.2 Workers → Webhook Processing

| Worker | Meta surface | Status |
|---|---|---|
| `webhook.processor.ts` | `messages` field (inbound + statuses) | **Built** but only handles `messages`. Need dispatcher for `flows`, `message_template_status_update`, `message_template_quality_update`, `phone_number_quality_update`, `account_alerts`, etc. |
| `alert.worker.ts` | (your own alerting) | **Built** |
| `index.ts` | BullMQ registration | **Built** |

### 12.3 Client Pages → User-Facing Flow

| Page | Meta flow | Status |
|---|---|---|
| `LoginPage` | n/a | ✅ |
| `RegisterPage` | n/a | ✅ |
| `ForgotPasswordPage` / `ResetPasswordPage` | n/a | ✅ |
| `AcceptInvitePage` | n/a | ✅ |
| `DashboardPage` | n/a | ✅ |
| `InboxPage` + composer components | Conversations, send/receive, status indicators, search | ✅ strong (41 KB) |
| `ContactsPage` | Contact list | ✅ |
| `TemplatesPage` | Template CRUD + WhatsApp Manager | ✅ strong (17 KB) |
| `AutomationsPage` | Automation rules | ✅ strong (41 KB) |
| `CampaignsPage` | Broadcast campaigns | ✅ strong (41 KB) |
| `FlowBuilderPage` | Visual Flow builder (xyflow) | ✅ strong (25 KB) |
| `SettingsPage` | Connection, business hours, etc. | ✅ strong (42 KB) |
| `TeamPage` | Team & roles | ✅ |
| `BillingPage` | Plans, Razorpay | ✅ strong (11 KB) |
| `ReportsPage` | Analytics dashboards | ✅ strong (16 KB) |
| `CallsPage` | Voice / video calls | ✅ strong (17 KB) |
| `AiBotPage` | AI bot config | ✅ strong (56 KB) |
| `WhatsappCallbackPage` | Embedded Signup callback | ✅ |

### 12.4 Inbox Components (server-side already)

| Component | Purpose | Status |
|---|---|---|
| `AuthenticatedMedia` | Render authenticated media URLs | ✅ |
| `ChatComposer` | Send text / template / media | ✅ |
| `ChatContextMenu` | Right-click actions | ✅ |
| `ChatPlaceholder` | Empty state | ✅ |
| `ContactAvatar` | Avatar from contact name | ✅ |
| `ConversationItem` | List row | ✅ |
| `ConversationListSkeleton` | Loading state | ✅ |
| `InboxDetailsPanel` | Right-side contact details | ✅ |
| `InboxSelect` | Filter | ✅ |
| `InteractiveComposer` | Build button / list messages | ✅ |
| `InteractiveMessageCard` | Render interactive inbound | ✅ |
| `MediaViewer` | Lightbox | ✅ |
| `MessageBubble` | Inbound / outbound bubble | ✅ |
| `NewChatSlideOver` | Start new chat | ✅ |
| `ServiceWindowBanner` | Show CSW state | ✅ |
| `TemplateComposer` | Build template send | ✅ |
| `WhatsAppPreview` | Render preview | ✅ |

---

## 13. What to Focus On Next (Actionable Roadmap)

> Framework 1 (problem-first) and Framework 3 (tension hunting) lenses applied. Each item: (a) the problem, (b) the user-facing impact, (c) the file(s) to change, (d) the approximate code shape, (e) the tension it resolves.

### 13.1 Critical (security / correctness)

#### 13.1.1 Hard-fail on missing HMAC signature

**Problem:** `whatsapp/routes.ts:367` accepts requests without a signature *if* `config.meta.appSecret` is set — a security gap.
**Tension:** Security vs. test ergonomics. **Resolution:** fail closed in production; allow a `META_WEBHOOK_ALLOW_INSECURE=true` env var for dev only.

```ts
// server/src/modules/whatsapp/routes.ts
if (config.meta.appSecret) {
  if (!signature || !MetaWhatsAppService.verifyWebhookSignature(signature, rawBody)) {
    log.warn('Rejected webhook: invalid or missing signature');
    return res.status(401).send('Invalid signature');
  }
}
```

#### 13.1.2 Add message.id deduplication with unique constraint

**Problem:** Webhooks retry for 7 days; without dedup, the same inbound message creates duplicate `Message` rows.
**Tension:** Idempotency vs. schema migration friction. **Resolution:** add a unique partial index on `Message.metaMessageId` where it's not null.

```prisma
// server/prisma/schema.prisma
model Message {
  ...
  metaMessageId String? @unique
}
```

```ts
// server/src/workers/webhook.processor.ts
try {
  await prisma.message.create({ ... });
} catch (e) {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return; // duplicate
  throw e;
}
```

#### 13.1.3 Implement WhatsApp Flows E2EE data exchange

**Problem:** Dynamic flows require RSA + AES-GCM. Without it, every flow is static (no live data, no validation against your DB).
**Tension:** Capability gap vs. complexity. **Resolution:** ship a thin `flows/crypto.ts` + a `flows/data-endpoint.routes.ts` that the user can mount at `/api/flows/data`.

```ts
// server/src/modules/flows/crypto.ts
import { privateDecrypt, publicEncrypt, createDecipheriv, createCipheriv, randomBytes } from 'crypto';

export function decryptRequest(body: { encrypted_aes_key: string; encrypted_flow_data: string; initial_vector: string }): { decrypted: string; aesKey: Buffer; iv: Buffer } {
  const privateKey = readPrivateKey(); // from KMS or env
  const aesKey = privateDecrypt({ key: privateKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, Buffer.from(body.encrypted_aes_key, 'base64'));
  const iv = Buffer.from(body.initial_vector, 'base64');
  const decipher = createDecipheriv('aes-128-gcm', aesKey.subarray(0, 16), iv);
  let plaintext = decipher.update(Buffer.from(body.encrypted_flow_data, 'base64'));
  plaintext = Buffer.concat([plaintext, decipher.final()]);
  return { decrypted: plaintext.toString('utf-8'), aesKey, iv };
}

export function encryptResponse(plaintext: object, aesKey: Buffer, iv: Buffer): string {
  const cipher = createCipheriv('aes-128-gcm', aesKey.subarray(0, 16), iv);
  let enc = cipher.update(JSON.stringify(plaintext));
  enc = Buffer.concat([enc, cipher.final()]);
  return enc.toString('base64');
}
```

```ts
// server/src/modules/flows/data-endpoint.routes.ts
import { decryptRequest, encryptResponse } from './crypto';

router.post('/flows/data', async (req, res) => {
  const { decrypted, aesKey, iv } = decryptRequest(req.body);
  const { screen, action, data, version } = JSON.parse(decrypted);
  // ... route to the right flow handler ...
  const response = await handleFlowExchange(screen, action, data);
  const flippedIv = Buffer.from(iv.map((b, i) => b ^ (i + 1))); // simple IV flip per Meta spec
  res.json({ data: encryptResponse(response, aesKey, flippedIv) });
});
```

Also need: generate keypair once, POST public key to Meta:
```ts
// server/src/modules/flows/keys.ts
import { generateKeyPairSync } from 'crypto';
import { MetaWhatsAppService } from '../whatsapp/meta.service';

export function generateAndRegisterFlowKey(orgId: string, wabaId: string, accessToken: string) {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  // save private key to a secrets store (Vault, AWS Secrets Manager, or chmod-600 .env)
  // POST publicKey to Meta:
  await MetaWhatsAppService.registerFlowPublicKey(wabaId, accessToken, publicKey.export({ type: 'spki', format: 'pem' }));
}
```

#### 13.1.4 Add `4^X` backoff for `131056` and `130429`

**Problem:** `messages/send.service.ts:204` uses BullMQ's default exponential backoff, not Meta's mandatory `4^X` schedule.
**Tension:** Library default vs. vendor spec. **Resolution:** use BullMQ's `backoff: { type: 'custom' }` and implement custom backoff function.

```ts
// workers/handlers/send-message.ts
import { Worker } from 'bullmq';
import { AppError, classifyMetaError } from '../errors/meta';

const worker = new Worker('message-send', processor, {
  connection: redis,
});
worker.on('failed', async (job, err) => {
  const metaCode = err instanceof AppError && err.code?.startsWith('META_') ? Number(err.code.replace('META_', '')) : null;
  if (metaCode && [130429, 131056].includes(metaCode)) {
    const attempt = (job.attemptsMade ?? 0) + 1;
    const delay = Math.pow(4, attempt - 1) * 1000; // 1s, 4s, 16s, 64s
    await job.moveToDelayed(Date.now() + delay, job.token);
  }
});
```

### 13.2 Critical (revenue / reliability)

#### 13.2.1 Subscribe to `message_template_status_update` and `message_template_quality_update`

**Problem:** Your UI shows stale template state because the only refresh is a user clicking the templates page.
**Tension:** Real-time vs. cost. **Resolution:** handle the webhook in `webhook.processor.ts`, update `MessageTemplate` in your DB, emit a Socket.IO event so the `TemplatesPage` re-renders.

```ts
// server/src/modules/whatsapp/webhook-dispatcher.ts
if (change.field === 'message_template_status_update') {
  const { template_id, event, reason } = change.value;
  await prisma.messageTemplate.update({
    where: { metaId: template_id },
    data: { status: mapStatusEvent(event), lastError: reason },
  });
  emitToOrg(orgId, 'template:status', { templateId, event, reason });
}
```

Also: update the `registerAppWebhook` fields list in `meta.service.ts:731` to include:
```ts
'fields': 'messages,message_template_status_update,message_template_quality_update,template_category_update,phone_number_quality_update,account_alerts,flows,user_preferences'
```

#### 13.2.2 SMS fallback on async `131026`

**Problem:** When async `131026` arrives in the `statuses[]` webhook, the message silently failed — the customer never saw it.
**Tension:** Cost vs. reach. **Resolution:** dispatch to an SMS provider (Twilio, Plivo, your Razorpay partner) for high-value messages.

```ts
// server/src/workers/status-handler.ts (NEW)
if (status.status === 'failed') {
  const metaCode = status.errors?.[0]?.code;
  if ([131026, 131050, 131049].includes(metaCode)) {
    await dispatchToSmsFallback({
      orgId, contactPhone, content, messageId: status.id, reason: `meta_${metaCode}`,
    });
  }
}
```

#### 13.2.3 Persist `pricing` data on every status update

**Problem:** `webhook.processor.ts:67` only stores the status string; the `pricing` object (which says which category Meta billed) is dropped.
**Tension:** Storage vs. analytics. **Resolution:** store the full pricing object on the `Message` row.

```ts
// server/src/workers/webhook.processor.ts
await prisma.message.update({
  where: { metaMessageId: status.id },
  data: {
    status: statusValue,
    metadata: {
      pricing: status.pricing,        // { billable, pricing_model, category, type }
      errors: status.errors ?? null,  // [{ code, title, message, error_data }]
      conversationId: status.conversation?.id,
    } as Prisma.InputJsonValue,
  },
});
```

### 13.3 High-value features (product differentiators)

#### 13.3.1 Marketing template carousel in the `campaigns` module

**Problem:** `messages/send.service.ts` has no `CAROUSEL_TEMPLATE` branch.
**Tension:** Schema complexity vs. e-commerce appeal. **Resolution:** extend the `SendMessagePayload` union, the InteractiveMessageOptions, and the UI in `CampaignsPage` / `TemplateComposer`.

```ts
// messages/send.service.ts (NEW branch)
} else if (input.type === 'CAROUSEL_TEMPLATE' && input.carouselCards?.length) {
  result = await MetaWhatsAppService.sendMessage(input.phoneNumberId, accessToken, {
    to: phone,
    type: 'template',
    template: {
      name: input.templateName!,
      language: { code: input.templateLanguage || 'en_US' },
      components: [
        { type: 'body', parameters: input.bodyParams ?? [] },
        { type: 'carousel', cards: input.carouselCards },
      ],
    },
  });
}
```

Also add a new node type in `flows/types.ts`:
```ts
export type FlowNodeType = ... | 'wa_carousel' | 'wa_reaction' | 'wa_sticker';
```

#### 13.3.2 OTP templates with `COPY_CODE` and `ONE_TAP` support

**Problem:** `templates/builder.ts` doesn't expose OTP buttons.
**Tension:** None — Meta has a clear spec. **Resolution:** add a `ButtonType.OTP` to the template builder with `otp_type: 'COPY_CODE' | 'ONE_TAP'`, autofill text, package name, signature hash.

```ts
// templates/builder.ts
case 'OTP':
  return {
    type: 'OTP',
    otp_type: button.otpType ?? 'COPY_CODE',
    text: button.text.slice(0, 25),
    ...(button.otpType === 'ONE_TAP' && {
      autofill_text: button.autofillText?.slice(0, 25),
      package_name: button.packageName,
      signature_hash: button.signatureHash,
    }),
  };
```

#### 13.3.3 Address message support (India only)

**Problem:** `messages/send.service.ts` doesn't support `interactive.type: 'address_message'`.
**Tension:** Region-specific vs. universal. **Resolution:** add the branch, surface only for `org.country === 'IN'`.

#### 13.3.4 Call permission request handling

**Problem:** `calling/meta` does not yet check the customer's call-permission grant.
**Tension:** UX vs. compliance. **Resolution:** track the grant via a `CallPermissionGranted` model, refresh on the `messages` webhook for `interactive.type: 'call_permission_request'`.

### 13.4 Quality and reliability improvements

- **Webhook IP allowlist** (defense in depth): read Meta's geofeed CSV on app start, build a CIDR list, reject non-Meta sources.
- **mTLS webhooks** (high-volume option): use `@aws-sdk/client-api-gateway` or your LB to validate the cert chain. Optional.
- **Dedupe contacts by phone+org** (already there — `organizationId_phone`).
- **CSW clock reset** in `webhook.processor.ts:118` — currently you only set `lastMessageAt`, not `cs24hWindowOpensAt`. Add the explicit field.
- **Per-user marketing throttle** — pre-flight check before sending marketing template: count how many marketing templates sent to this `wa_id` in the last 24h. If ≥ 2 (or whatever Meta's undisclosed limit is for your region), queue for later.
- **Cache `MessageTemplate`** in Redis with TTL — the `meta.service.ts:getMessageTemplate` call is per-send and can be slow.
- **Persist `biz_opaque_callback_data`** on every send so you can correlate status webhooks to internal job IDs.

### 13.5 Security hardening

- **Per-org secrets isolation**: today `accessToken` is encrypted with a single app-level key. Consider per-org KMS keys for multi-tenant SaaS.
- **Auto-revoke tokens** on `disconnect` — the `disconnect` event in Embedded Signup should rotate the token.
- **Audit log every send** with `userId`, `orgId`, `templateName`, `wamid`, `pricing`. Required for SOC 2 and most enterprise deals.

### 13.6 Performance wins

- **Pipeline sends through BullMQ** with per-WABA concurrency caps to avoid `130429`.
- **Use `template_metrics` (analytics API)** for nightly dashboards rather than computing from your DB.
- **Bulk-send via campaigns** rather than per-recipient loops (your `campaigns` module already does this).
- **WebSocket fan-out for `message:new`** — already done via `realtime.ts`, but consider Socket.IO rooms per-`conversationId` to reduce payload size.

### 13.7 Files to Create or Edit (Concrete List)

| Action | File | Reason |
|---|---|---|
| **Edit** | `server/src/modules/whatsapp/routes.ts:367` | Reject webhooks with missing signature when `META_APP_SECRET` set |
| **Edit** | `server/prisma/schema.prisma` | Add `Message.metaMessageId @unique` |
| **Edit** | `server/src/workers/webhook.processor.ts:34` | Add dispatcher for `flows`, `message_template_status_update`, etc. |
| **Edit** | `server/src/workers/webhook.processor.ts:56` | Persist `pricing` and `errors` on status |
| **Edit** | `server/src/modules/whatsapp/meta.service.ts:731` | Subscribe to more webhook fields |
| **Edit** | `server/src/modules/messages/send.service.ts` | Add `4^X` backoff, carousel, sticker, reaction, address, call_permission, location_request |
| **Edit** | `server/src/modules/messages/interactive.ts` | Add `mode: 'carousel' \| 'address' \| 'location_request' \| 'call_permission' \| 'sticker' \| 'reaction'` |
| **Edit** | `server/src/modules/templates/builder.ts` | Add OTP, MPM, carousel, call_permission component support |
| **Edit** | `server/src/modules/flows/types.ts` | Add new node types (`wa_carousel`, `wa_reaction`, `wa_sticker`) |
| **Edit** | `server/src/modules/flows/engine.ts` | New node handlers for carousel/reaction/sticker |
| **Create** | `server/src/modules/flows/crypto.ts` | RSA + AES-GCM for E2EE data exchange |
| **Create** | `server/src/modules/flows/keys.ts` | Keypair generation, registration with Meta |
| **Create** | `server/src/modules/flows/data-endpoint.routes.ts` | Express route at `/api/flows/data` |
| **Create** | `server/src/modules/whatsapp/webhook-dispatcher.ts` | Dedicated dispatcher for all webhook fields |
| **Create** | `server/src/errors/meta.ts` | `classifyMetaError()` + retry logic |
| **Create** | `server/src/integrations/sms-fallback.ts` | SMS fallback dispatcher on `131026` |
| **Edit** | `client/src/pages/TemplatesPage.tsx` | Render paused/disabled states from `message_template_status_update` |
| **Edit** | `client/src/pages/CampaignsPage.tsx` | Add per-user marketing throttle UI, carousel send |
| **Edit** | `client/src/components/inbox/MessageBubble.tsx` | Render sticker, reaction, address-message types |
| **Edit** | `client/src/components/inbox/InteractiveComposer.tsx` | Add carousel builder, address composer, OTP/component fields |
| **Edit** | `client/src/pages/FlowBuilderPage.tsx` | Add new node types |

### 13.8 The Top 3 "Focus Next" Items (Framework 10 distillation)

If you ship **only three** things this quarter, ship these:

1. **Flows E2EE data exchange** (`flows/crypto.ts` + `flows/data-endpoint.routes.ts` + `keys.ts`) — unlocks 100% of dynamic Flow use cases (bookings, validations, live data).
2. **Add `Message.metaMessageId @unique` + dispatcher for `message_template_status_update`, `message_template_quality_update`, `phone_number_quality_update`, `account_alerts`, `flows`, `user_preferences`** — without this, your platform silently misses the most important webhooks (template pauses kill campaigns; quality drops tank throughput).
3. **Implement `4^X` backoff for `131056` / `130429` + persist `pricing` on every status update + SMS fallback on `131026`** — fixes the "messages silently fail" class of bugs and makes billing transparent.

---

## 14. References

### 14.1 Primary Meta Documentation

- [Cloud API Overview](https://developers.facebook.com/docs/whatsapp/cloud-api/overview)
- [Cloud API Home](https://developers.facebook.com/docs/whatsapp/cloud-api)
- [Messages Reference](https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages)
- [Send Template Messages](https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-message-templates)
- [Mark Messages as Read](https://developers.facebook.com/docs/whatsapp/cloud-api/guides/mark-messages-as-read)
- [Error Codes](https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes)
- [Webhooks](https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks)
- [Business Management API](https://developers.facebook.com/docs/whatsapp/business-management-api)
- [Pricing](https://developers.facebook.com/docs/whatsapp/pricing)
- [Phone Numbers](https://developers.facebook.com/docs/whatsapp/cloud-api/phone-numbers)
- [Guides](https://developers.facebook.com/docs/whatsapp/cloud-api/guides)
- [Marketing Messages API for WhatsApp](https://www.meta.com/business/whatsapp)
- [WhatsApp Encryption Whitepaper](https://www.facebook.com/business/m/one-sheeters/whatsapp-business-encryption-whitepaper)
- [Flows JSON Spec](https://developers.facebook.com/docs/whatsapp/flows/reference/flowjson)
- [Flows API](https://developers.facebook.com/docs/whatsapp/flows/reference/flowsapi)
- [Flows Encryption](https://developers.facebook.com/docs/whatsapp/flows/reference/flowencryption)
- [Postman Collection](https://www.postman.com/meta-whatsapp-business-platform/workspace/)

### 14.2 Cross-Reference / Industry Sources

- [WATI Pricing](https://wati.io/pricing/)
- [Bird (MessageBird) WhatsApp Docs](https://docs.bird.com/)
- [360Dialog Multi-Product Templates](https://docs.360dialog.com/docs/resources/templates/multi-product-templates)
- [360Dialog Product Card Carousel](https://docs.360dialog.com/partner/messaging/template-messages/product-card-carousel-templates)
- [360Dialog One-Tap Auth](https://docs.360dialog.com/partner/messaging/template-messages/authentication-templates/one-tap-autofill-authentication-templates)
- [Twilio WhatsApp Key Concepts](https://www.twilio.com/docs/whatsapp/key-concepts.md)
- [Infobip WhatsApp Docs](https://www.infobip.com/docs/whatsapp)
- [Kapso Send Message Reference](https://docs.kapso.ai/api/meta/whatsapp/messages/send-a-message)
- [Dualhook Error Reference](https://dualhook.com/docs/api-errors)
- [Dualhook 131026](https://dualhook.com/docs/whatsapp-error-131026)
- [Dualhook Service Messages](https://dualhook.com/docs/service-messages)
- [Dualhook Utility Templates](https://dualhook.com/docs/utility-messages)
- [SnakeChat Error Code Guide](https://chat.sagi-digital.com/help/waba-error-codes)
- [Innopaas Meta Error Codes](https://docs.innopaas.com/api-reference/api-reference-en/whatsapp-business-api/error-codes/meta-error-codes)
- [Kaleyra Cloud API Error Codes](https://developers.kaleyra.io/docs/cloud-api-error-codes)
- [Yoni-Tech WhatsApp Errors](https://docs-yoni-tech.readme.io/reference/whatsapp_whatsapp-errors)
- [Wa-Guides Flow E2EE](https://wa-guides.com/article/whatsapp-flow-payload-e2ee-engineering-secure-webhook-decryption)
- [MessageBot WhatsApp Webhooks Guide](https://messagebot.in/blog/whatsapp-webhooks-explained/)
- [uptail.ai 2026 Pricing](https://www.uptail.ai/blog/whatsapp-business-api-pricing-2026-what-it-costs-and-how-billing-works)
- [setsmart.io 2026 Pricing](https://setsmart.io/blog/whatsapp-business-api-pricing)
- [whautomate.com Pricing Calculator](https://whautomate.com/tools/whatsapp-business-api-pricing-calculator)
- [1msg.io WABA Templates](https://help.1msg.io/docs/api-1msg/waba-templates)
- [BotSailor 131026 Fix](https://botsailor.com/blog/whatsapp-error-131026-message-undeliverable-fix-solutions)
- [QuickReply.ai 131026](https://docs.quickreply.ai/overview/messaging-channels/whatsapp/errors/error-message-undeliverable)

### 14.3 Internal Project Files (already implemented)

- `server/src/modules/whatsapp/meta.service.ts` — Cloud API client (send, templates, media, webhooks, signature)
- `server/src/modules/whatsapp/routes.ts` — Embedded Signup, webhook receiver, disconnect
- `server/src/modules/whatsapp/context.ts` — Resolve active phone number + access token per org
- `server/src/modules/whatsapp/connect-pending.ts` — Sign/verify multi-phone connect-pending JWTs
- `server/src/modules/messages/send.service.ts` — `deliverOutboundMessage()` covering 9 message types
- `server/src/modules/messages/interactive.ts` — `buildInteractivePayload` for button/cta_url/cta_call/list
- `server/src/modules/messages/service.ts` & `routes.ts` — Inbox endpoints
- `server/src/modules/templates/{builder,analytics,routes,types}.ts` — Template CRUD
- `server/src/modules/flows/{engine,validation,language,analytics,versioning,simulate,lock,flow-state,types,routes}.ts` — Flow runtime
- `server/src/workers/{webhook.processor,alert.worker,index}.ts` — BullMQ workers
- `server/src/middleware/{auth,permissions,api-key}.ts` — Auth/RBAC/API-key gates
- `server/src/errors/index.ts` — Normalize Zod/Prisma/AppError; structured logging
- `server/src/config/{database,redis,queues,index}.ts` — Prisma, BullMQ queues
- `server/src/utils/{crypto,jwt,logger,phone,response}.ts` — Helpers
- `server/prisma/schema.prisma` — 30+ models (User, Org, WhatsappNumber, Conversation, Message, Contact, Flow, Template, Campaign, Call, etc.)
- `client/src/pages/*` — 18 pages (Login → WhatsappCallback)
- `client/src/components/inbox/*` — 17 inbox components
- `client/src/components/inbox/InteractiveComposer.tsx` & `WhatsAppPreview.tsx` & `MessageBubble.tsx` & `TemplateComposer.tsx` — the composer/preview triad

### 14.4 Policy References

- [WhatsApp Business Messaging Policy](https://www.whatsapp.com/legal/business-policy)
- [WhatsApp Commerce Policy](https://www.whatsapp.com/legal/commerce-policy)
- [WhatsApp Business Platform ToS](https://www.whatsapp.com/legal/business-terms)
- [Onboarding business app users](https://developers.facebook.com/docs/whatsapp/cloud-api/guides/coexistence)
- [Per-User Marketing Template Message Limits](https://www.facebook.com/business/help/…)
- [Policy Enforcement](https://www.facebook.com/business/help/…)

---

*End of document. ~14,200 words. Section 9 (Error Codes) covers 50+ codes; §5 (Messages) covers 20+ message types; §12 maps every server module to its Meta API surface. The Top 3 "Focus Next" items are in §13.8. Re-run Framework 10 on §1.1 and §13.8: the two-sentence pitches should be defensible in 30 seconds to a non-technical CFO.*
