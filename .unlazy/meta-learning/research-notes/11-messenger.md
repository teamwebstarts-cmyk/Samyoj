# L11 — Messenger Platform / Page messaging (FB automation)

**Status: FUTURE SCOPE for Samyoj.**  
Samyoj today ships **WhatsApp Cloud API** (WABA + `phone_number_id` + templates + CSW). It does **not** ship Facebook Page / Messenger inbox automation. This note is literacy + planning only — do not treat as a build ticket.

Research date: 2026-08-25 · Sources: Meta Developer docs (WebSearch)

---

## 1. Kya hai Messenger Platform?

Messenger Platform = Meta ka API surface jisse **Facebook Page** (aur linked Instagram Professional account) par customers se 1:1 messages send/receive kar sakte ho.

High-level flow:

1. Person Page ko message bhejta hai (Messenger app / m.me / ad / plugin).
2. Meta **webhook** se tumhare server ko event deta hai (`object: page`).
3. Tum Graph pe `POST /{PAGE_ID}/messages` se reply karte ho — usually **24h standard messaging window** ke andar.
4. Recipient identity = **PSID** (Page-scoped ID), WhatsApp ka `wa_id` / phone jaisa nahi.

Official overview:  
https://developers.facebook.com/docs/messenger-platform/overview/

---

## 2. Samyoj vs Messenger — abhi vs future

| Area | Samyoj **abhi** (WhatsApp) | Messenger **future** |
|------|---------------------------|----------------------|
| Channel asset | WABA + phone number | Facebook **Page** |
| Recipient ID | phone / `wa_id` | **PSID** |
| Outbound path | `POST /{PHONE_NUMBER_ID}/messages` | `POST /{PAGE_ID}/messages` |
| Inbound | Meta WhatsApp webhooks | Meta Webhooks on **page** object |
| Outside window | **Approved templates** (UTILITY / MARKETING / AUTH) | Message **tags**, One-time Notification, Sponsored Messages (not WA templates) |
| Connect UX | Embedded Signup / OAuth for WABA | Facebook Login for Business → Page token |
| Isolation key | `whatsappNumberId` | Likely `pageId` (+ org) — design TBD |

**Hinglish:** WhatsApp pe “number connect” hai; Messenger pe “Page connect” hoga. Same Meta App ho sakta hai, lekin permissions, tokens, webhook fields, aur policy alag.

---

## 3. Permissions (official)

Overview lists these via **Facebook Login for Business** for Messenger conversations:

| Permission | Role |
|------------|------|
| `pages_show_list` | User ki Pages list (Page ID lene ke liye) |
| `pages_manage_metadata` | Page metadata + webhook subscribe (`subscribed_apps`) |
| `pages_messaging` | Send/receive Page conversations (core) |
| `pages_read_engagement` | Conversations API / engagement reads |
| `business_management` | Dependency for `pages_messaging`, `pages_show_list`, (and IG messaging) |

Sources:  
- https://developers.facebook.com/docs/messenger-platform/overview/  
- https://developers.facebook.com/docs/permissions/ (search `pages_messaging`)

**Page tasks (token grantor):** jo person Page access token maangta hai, uske paas Page pe **`MESSAGING`** aur **`MODERATE`** tasks hone chahiye (overview + Conversations API).

**Allowed usage of `pages_messaging` (permissions ref):** user-initiated interactive experiences, support messages, booking/purchase confirms, inbound/outbound calling between business and customers — App Review screencast mein yeh dikhana padta hai.

**Human Agent feature (alag App Review):** 24h ke baad human reply (7 din) ke liye `HUMAN_AGENT` tag — Business Verification + App Review.  
https://developers.facebook.com/docs/features-reference/human-agent/

**Access levels:**  
- **Standard Access** = sirf app/Page roles wale users  
- **Advanced Access** = real customers (App Review + usually Business Verification)  
https://developers.facebook.com/docs/graph-api/overview/access-levels/

Own Page only → App Review optional. Multi-tenant SaaS (Samyoj-style) → Advanced Access + BV almost mandatory.

---

## 4. Tokens & subscribe pattern

1. User Login for Business → User token with pages permissions.  
2. Exchange → **Page access token** for chosen Page.  
3. App Dashboard: Webhooks product → callback URL + verify token → subscribe fields.  
4. Install app on Page + `POST /{PAGE_ID}/subscribed_apps?subscribed_fields=...` with Page token.

Subscribe example (official):

```bash
curl -i -X POST \
  "https://graph.facebook.com/<PAGE_ID>/subscribed_apps?subscribed_fields=messages&access_token=<PAGE_ACCESS_TOKEN>"
```

Docs:  
- https://developers.facebook.com/docs/messenger-platform/webhooks/  
- https://developers.facebook.com/docs/graph-api/reference/page/subscribed_apps/  
- https://developers.facebook.com/docs/pages-api/webhooks-for-pages/

Get started (send reply):  
https://developers.facebook.com/docs/messenger-platform/get-started

---

## 5. Webhooks (Messenger / Page)

Same Meta Webhooks product pattern as WhatsApp (GET verify + POST events + `X-Hub-Signature-256`), lekin:

- Payload top-level: `"object": "page"`
- Events under `entry[].messaging[]`
- Sender = PSID; recipient = PAGE_ID
- Endpoint must return **200 within ~5 seconds**
- Retries; prolonged failure → Webhooks Disabled + Page unsubscribed (re-subscribe needed)

### Important fields (Messenger)

| Field | Use |
|-------|-----|
| `messages` | Inbound customer messages (core) |
| `messaging_postbacks` | Buttons / Get Started / persistent menu |
| `message_echoes` | Outbound echo (Messenger-only separate field) |
| `message_deliveries` | Delivery receipts (Messenger) |
| `message_reads` | Read receipts (Messenger; IG uses `messaging_seen`) |
| `messaging_optins` | Plugins / checkbox opt-in |
| `messaging_referrals` | m.me / ads / entry links |
| `messaging_handovers` / `standby` | Conversation Routing / multi-app |
| `messaging_policy_enforcement` | Policy warnings/actions |

Full table: https://developers.facebook.com/docs/messenger-platform/webhooks/  
Events reference: https://developers.facebook.com/documentation/business-messaging/messenger-platform/webhooks/webhook-events

**SaaS tip:** Start with `messages` + `messaging_postbacks`; add deliveries/reads/echoes when Inbox needs parity with WhatsApp status ticks.

---

## 6. Send API & 24h policy (parallels with WhatsApp CSW)

### Messenger — Standard messaging window

- User message (or web plugin start) → business ke paas **24 hours** free-form / promotional-allowed replies.  
- `messaging_type: RESPONSE` must be inside that window.  
- Window close → error e.g. **1545041** (“Messaging window closed”).  
- Outside window options:
  - **Message tags** (`messaging_type: MESSAGE_TAG` + `tag`)
  - **One-time Notification** (user opt-in token; **not** available on Instagram Messaging)
  - **Sponsored Messages** (ads product — separate ledger; do not fold into Samyoj SaaS plan price)

Official:  
- https://developers.facebook.com/docs/messenger-platform/send-messages/  
- https://developers.facebook.com/docs/messenger-platform/policy/policy-overview/  
- https://developers.facebook.com/documentation/business-messaging/messenger-platform/policy  
- Graph Page Messages: https://developers.facebook.com/docs/graph-api/reference/page/messages/

### Message tags (high level)

Examples from Page Messages reference: `ACCOUNT_UPDATE`, `CONFIRMED_EVENT_UPDATE`, `POST_PURCHASE_UPDATE`, `CUSTOMER_FEEDBACK`, `HUMAN_AGENT` (7-day human support).

**Changelog watch:** Meta docs note that effective **April 27, 2026**, API requests using tags `CONFIRMED_EVENT_UPDATE`, `ACCOUNT_UPDATE`, and `POST_PURCHASE_UPDATE` will receive **error 100** — migrate toward Utility Templates / Marketing Messages API paths as docs direct. Re-read changelog before any build:  
https://developers.facebook.com/documentation/business-messaging/messenger-platform/changelog  
https://developers.facebook.com/docs/messenger-platform/send-messages/

### WhatsApp parallel (CSW)

| Concept | Messenger | WhatsApp Cloud API |
|---------|-----------|--------------------|
| User opens window | Message / plugin | User message or call |
| Duration | 24h standard window | 24h **customer service window** |
| Inside window | Free-form (+ promo OK) | Free-form **service** messages (no template approval) |
| Outside window | Tags / OTN / Sponsored | **Pre-approved templates** only |
| Reset | New user message | New user message/call resets CSW |
| Billing note | Messenger send fees ≠ WA Cloud pricing | Meta WA fees on WABA (separate from Samyoj SaaS) |

WhatsApp CSW:  
https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages/  
https://developers.facebook.com/docs/whatsapp/conversation-types/

**Hinglish parallel:** Dono pe “customer pehle bole → 24h free-form”. WhatsApp ke baad templates; Messenger ke baad tags / OTN / ads. **Ek hi “template” system nahi copy-paste karna.**

---

## 7. Conversations API (history / Inbox backfill)

`GET /{PAGE_ID}/conversations?platform=messenger` (+ optional `user_id` = PSID).  
Needs Page token + `pages_manage_metadata`, `pages_read_engagement`, `pages_messaging`.  
Advanced Access required for conversations with people who have **no** role on app/Page.

https://developers.facebook.com/docs/messenger-platform/conversations/

---

## 8. Multi-app Inbox (bot ↔ human)

**Handover Protocol** deprecated → **Conversation Routing** (backwards compatible with most handover APIs).

https://developers.facebook.com/docs/messenger-platform/conversation-routing/  
Deprecated handover (context only): https://developers.facebook.com/docs/messenger-platform/handover-protocol/

Future Samyoj “AI bot + live agent” on FB would subscribe `messaging_handovers` / `standby` and pass thread control — same product idea as WhatsApp Inbox assign, different Meta API.

---

## 9. What a Tech Provider–style SaaS usually integrates first

For FB Page automation (when product asks):

1. Facebook Login for Business + Page picker  
2. Store long-lived Page token per org+page  
3. Webhook verify + `messages` / `messaging_postbacks`  
4. Send `RESPONSE` inside 24h  
5. Conversations API for history sync  
6. Later: Human Agent tag, OTN, Conversation Routing, IG Messaging (see `10-instagram.md`)

**Do not mix:** Marketing / Ads Manager billing into Samyoj plan price (see `12-ads-adjacency.md`). Click-to-Messenger ads can *open* conversations; ads spend stays on Meta Ads ledger.

---

## 10. App Review checklist (future)

- Business Verification for Advanced Access  
- Screencast: Login → grant permissions → inbound message → app sends reply visible in Messenger client  
- Call out `business_management` dependency in submission  
- Human Agent = separate feature review if needed  
- Live mode required for non-role users  

Permissions / review notes: https://developers.facebook.com/docs/permissions/

---

## 11. Official URL bank (bookmark)

| Topic | URL |
|-------|-----|
| Overview | https://developers.facebook.com/docs/messenger-platform/overview/ |
| Get started | https://developers.facebook.com/docs/messenger-platform/get-started |
| Send messages / 24h / tags / OTN | https://developers.facebook.com/docs/messenger-platform/send-messages/ |
| Policy overview | https://developers.facebook.com/docs/messenger-platform/policy/policy-overview/ |
| Policy (biz messaging path) | https://developers.facebook.com/documentation/business-messaging/messenger-platform/policy |
| Webhooks | https://developers.facebook.com/docs/messenger-platform/webhooks/ |
| Webhook events | https://developers.facebook.com/documentation/business-messaging/messenger-platform/webhooks/webhook-events |
| Conversations API | https://developers.facebook.com/docs/messenger-platform/conversations/ |
| Page `/messages` | https://developers.facebook.com/docs/graph-api/reference/page/messages/ |
| Page `subscribed_apps` | https://developers.facebook.com/docs/graph-api/reference/page/subscribed_apps/ |
| Pages webhooks | https://developers.facebook.com/docs/pages-api/webhooks-for-pages/ |
| Permissions reference | https://developers.facebook.com/docs/permissions/ |
| Access levels | https://developers.facebook.com/docs/graph-api/overview/access-levels/ |
| Human Agent | https://developers.facebook.com/docs/features-reference/human-agent/ |
| Conversation Routing | https://developers.facebook.com/docs/messenger-platform/conversation-routing/ |
| Changelog | https://developers.facebook.com/documentation/business-messaging/messenger-platform/changelog |
| WA CSW (parallel) | https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages/ |

---

## 12. Sonu ko Hinglish mein — “FB automation future”

- **Abhi Samyoj Messenger nahi karti** — sirf WhatsApp. Yeh note future roadmap literacy hai.  
- Messenger = **Page** + **PSID** + **Page access token**; WhatsApp = **WABA** + phone.  
- Permissions: `pages_messaging` + metadata/show_list/read_engagement + `business_management` dependency.  
- Webhook pattern familiar lagega (verify token, challenge, signature) — fields aur `object: page` alag.  
- **24h window** WhatsApp CSW jaisi feel — bahar templates nahi, **tags / OTN / Sponsored**.  
- Multi-tenant SaaS = App Review + Business Verification + Advanced Access.  
- Ads click → conversation open kar sakta hai; **ads paisa Meta Ads pe**, Samyoj plan mein mat mix karo.  
- Build se pehle April 2026 message-tag deprecations changelog padho.

---

## 13. Quiz (self-check)

**Q1.** Samyoj today ships Messenger Page automation — true or false?  
**A1.** False — FUTURE SCOPE; current product is WhatsApp Cloud API.

**Q2.** Messenger pe customer ki identity kis ID se aati hai?  
**A2.** **PSID** (Page-scoped ID), not phone number.

**Q3.** Core send/receive permission kaunsi hai?  
**A3.** `pages_messaging` (with dependencies like `pages_manage_metadata` / `pages_show_list` / `business_management` per overview).

**Q4.** Page webhook subscribe karne ke liye roughly kaunsa Graph edge?  
**A4.** `POST /{PAGE_ID}/subscribed_apps` with Page access token + `subscribed_fields`.

**Q5.** Standard messaging window kitni der?  
**A5.** **24 hours** after the person’s message (or plugin start).

**Q6.** Window ke baad WhatsApp pe kya? Messenger pe kya?  
**A6.** WhatsApp → approved **templates**. Messenger → **message tags** / One-time Notification / Sponsored Messages (not the same system).

**Q7.** `HUMAN_AGENT` tag kya allow karta hai?  
**A7.** Human agent replies outside the 24h window for up to **7 days** after the user’s last message (App Review + business verification).

**Q8.** One-time Notifications Instagram pe available hain?  
**A8.** **No** — docs say OTN is not available for Instagram Messaging API.

**Q9.** Webhook payload ka `object` field Messenger events ke liye kya hota hai?  
**A9.** `"page"`.

**Q10.** Multi-tenant SaaS ko real customers ke liye kya chahiye?  
**A10.** **Advanced Access** (App Review) + typically **Business Verification**; Standard Access only covers role users.

**Q11.** Handover Protocol ka modern replacement?  
**A11.** **Conversation Routing** (Handover mostly deprecated / migrated).

**Q12.** Error 1545041 ka matlab?  
**A12.** Messaging window closed — use eligible tag or OTN (per send-messages docs).

**Q13.** Should Samyoj fold Sponsored Message / Ads spend into SaaS plan price?  
**A13.** **No** — separate Meta Ads ledger (same two-ledger discipline as WA Cloud fees vs SaaS).

**Q14.** `message_echoes` vs Instagram?  
**A14.** Separate `message_echoes` field is Messenger-oriented; IG echoes come via the `messages` subscription (per webhooks table).

**Q15.** Token grantor pe kaunse Page tasks?  
**A15.** **MESSAGING** and **MODERATE** (per Messenger overview / Conversations API).

---

## 14. Open questions before any build (do not invent answers)

- Single Meta App for WA + Messenger + IG, or separate apps?  
- Token storage / rotation model per Page (mirror WhatsApp number isolation).  
- Shared Inbox UX: one thread model across WA + FB + IG or separate inboxes?  
- Which tags still valid after April 2026 deprecations at build time?  
- India SMB demand: Page bots vs WhatsApp-first — product priority TBD.

---

*End of L11. Feeds master guide section: future FB / Messenger scope.*
