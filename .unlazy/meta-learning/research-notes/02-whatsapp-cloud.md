# L2 — WhatsApp Cloud API (messaging + webhooks)

**Leaf:** L2 · **Audience:** Sonu / Samyoj product literacy · **As of:** 2026-08-25  
**Scope:** Send messages, media, webhooks, `phone_number_id`, WABA `subscribed_apps`, mark-as-read, interactive messages, Flows/NFM overview, error codes (esp. **131047** / CSW).  
**Out of scope here:** Deep template categories/quality (→ L3), TARGET SaaS pricing (→ L4), Tech Provider / Embedded Signup deep dive (→ L5), Calling API (→ L9), Catalog commerce deep dive (→ L13).

---

## 0) 30-second map (Hinglish)

- Cloud API = Graph pe HTTP: **outbound** `POST /{phone_number_id}/messages`, **inbound + status** = **webhooks**.
- `phone_number_id` number nahi hai — Meta ka **numeric ID** for that business line. Display phone alag (`display_phone_number`).
- User ne message (ya call) kiya → **24h Customer Service Window (CSW)** open → free-form “service” messages OK.
- CSW band → free-form fail → classic error **`131047`** → sirf **approved template**.
- API `202`/accept ≠ delivered. Delivery/read/fail **`messages` webhook** statuses se aate hain.
- SaaS (Samyoj) ke liye: har customer WABA pe app **subscribe** karo (`/{waba-id}/subscribed_apps`), warna Connect ke baad Inbox silent.

---

## 1) Core send path

### Endpoint

```http
POST https://graph.facebook.com/{API_VERSION}/{WHATSAPP_BUSINESS_PHONE_NUMBER_ID}/messages
Authorization: Bearer {ACCESS_TOKEN}
Content-Type: application/json
```

Common body shape:

```json
{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "+16505551234",
  "type": "text",
  "text": { "preview_url": true, "body": "Hello" }
}
```

- `type` jo bhi ho (`text`, `image`, `interactive`, `template`, …), usi naam ki nested object bhi body mein chahiye.
- Success response ≈ “accepted” + `wamid` — **delivery guarantee nahi**. Status webhooks dekho (`sent` / `delivered` / `read` / `failed`).
- Phone format: prefer **`+` + country code**. Plus omit karoge to business number ka country code prepend ho sakta hai → wrong delivery (India `91` businesses pe classic trap).

**Official:**  
- https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages/  
- https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages  
- https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/send-messages  
- https://developers.facebook.com/docs/whatsapp/cloud-api/messages/text-messages/

### Service messages vs templates (CSW)

| Mode | When | Needs approval? |
|------|------|-----------------|
| **Service (free-form)** | Inside **24h CSW** (user messaged **or called** business) | No |
| **Template** | Outside CSW, or scale outbound | Yes (name + language approved) |

- CSW timer: user message/call → 24h start; again message/call → **reset**.
- Window band → free-form → **131047**; fix = template (ya wait for new user inbound).
- Known Meta note: rare cases mein user message aaye lekin CSW reply allow na ho — product pe defensive UX rakho.

**Official:**  
- https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages/  
- https://developers.facebook.com/docs/whatsapp/conversation-types/  
- https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview  

### Why Samyoj care

- Inbox free-form send **must** gate on last inbound timestamp (UTC).
- Campaign / reconnect / “nudge” outside window = **templates only**.
- Accept response store `wamid`; map later status webhooks to UI ticks / fail reasons.

---

## 2) `phone_number_id` (aur related IDs)

| ID | Kya hai | Use |
|----|---------|-----|
| **`phone_number_id`** | Cloud API business phone’s Graph ID | URL path for `/messages`, `/media`, `/register` |
| **`display_phone_number`** | Human-readable business number | UI, support, webhook `metadata` |
| **`waba_id` / entry.id** | WhatsApp Business Account | Templates, `subscribed_apps`, analytics |
| **`wa_id`** | User’s WhatsApp ID (webhook contacts) | May differ from `input` phone string |
| **`wamid`** | Message ID | Mark read, status correlation, replies |

Hinglish pitfalls:

- Display phone ko URL mein mat daalna — **`phone_number_id`** chahiye.
- Multi-number org: webhook `metadata.phone_number_id` se **route** karo; “latest number” pick mat karo.
- Same display phone reconnect pe Meta `phone_number_id` change ho sakta hai — product DB workspace vs Meta id mapping alag rakhna (Samyoj already soft-workspace model).

**Official:**  
- https://developers.facebook.com/docs/whatsapp/cloud-api/phone-numbers  
- https://developers.facebook.com/documentation/business-messaging/whatsapp/business-phone-numbers/phone-numbers  
- https://developers.facebook.com/documentation/business-messaging/whatsapp/business-phone-numbers/registration  

---

## 3) Media

### Upload / fetch / delete / download

| Call | Purpose |
|------|---------|
| `POST /{PHONE_NUMBER_ID}/media` (multipart) | Upload → `{ "id": "<MEDIA_ID>" }` |
| `GET /{MEDIA_ID}` | Resolve short-lived download URL |
| `DELETE /{MEDIA_ID}` | Delete asset |
| `GET {MEDIA_URL}` + Bearer | Binary download |

Rules of thumb (Meta docs):

- Uploaded media encrypted; **persist ~30 days** unless deleted earlier.
- **Media IDs from API expire after 30 days**; **media IDs in inbound webhooks expire after 7 days**.
- Resolved **media URLs expire after 5 minutes** — re-`GET` ID for a fresh URL.
- Send media either by uploaded **`id`** or public HTTPS **`link`**. Link assets may be **cached ~10 minutes** by Cloud API (same URL reused); bust cache with query string if you must re-fetch.
- Inbound >100MB → webhook error **131052**. Outbound bad MIME / unsupported → **131053**.

Rough size caps (confirm always against current Media doc): image ~5MB; audio/video ~16MB; document up to ~100MB; stickers WebP tiny (static/animated limits).

**Official:**  
- https://developers.facebook.com/docs/whatsapp/cloud-api/reference/media/  
- https://developers.facebook.com/documentation/business-messaging/whatsapp/business-phone-numbers/media  

### Hinglish bullets

- Inbox media receive: webhook → media id → GET URL → download with token — **5 min URL clock** yaad rakhna.
- Outbound: pehle upload + `id` bhejna zyada reliable; raw link ok for public CDN.
- MIME mismatch classic fail — file extension aur real MIME match karo (`file -I` style checks).

---

## 4) Webhooks (inbound + status)

### Role

Platform heavily webhook-driven:

- User → business content **sirf webhook** se aata hai.
- Outbound delivery/read/fail **status** bhi webhook.
- Async errors often webhook pe (`entry.changes.value.errors` / message errors) — sync Graph error + webhook **dono** monitor karo.

### Setup sketch

1. App Dashboard → WhatsApp → Configuration → callback URL + verify token.
2. Subscribe field **`messages`** (aur needed others: `account_update`, `calls`, Flows-related, etc.).
3. **GET challenge:** Meta sends `hub.mode`, `hub.verify_token`, `hub.challenge` — echo challenge if token matches.
4. **POST events:** return **200 quickly**; heavy work async. Verify **`X-Hub-Signature-256`** (`sha256=` + HMAC-SHA256 of **raw body** with App Secret).
5. For **each customer WABA** (esp. Tech Provider / Embedded Signup): `POST /{WABA_ID}/subscribed_apps` — dashboard field subscribe alone is not enough for client WABAs.

### Payload cues

```json
{
  "object": "whatsapp_business_account",
  "entry": [{
    "id": "<WABA_ID>",
    "changes": [{
      "field": "messages",
      "value": {
        "messaging_product": "whatsapp",
        "metadata": {
          "display_phone_number": "15550783881",
          "phone_number_id": "106540352242922"
        },
        "contacts": [{ "profile": { "name": "…" }, "wa_id": "…" }],
        "messages": [{ "from": "…", "id": "wamid.…", "timestamp": "…", "type": "text", "text": { "body": "…" } }]
      }
    }]
  }]
}
```

Statuses similarly under `value.statuses` (sent/delivered/read/failed) — often with pricing/conversation metadata on newer payloads.

**Official:**  
- https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/components/  
- https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/payload-examples/  
- https://developers.facebook.com/docs/graph-api/webhooks/getting-started/  
- https://developers.facebook.com/docs/whatsapp/embedded-signup/webhooks/  
- https://developers.facebook.com/documentation/business-messaging/whatsapp/about-the-platform  

### Samyoj / local-dev Hinglish

- Inbound ke liye **public HTTPS** (ngrok) zaroori; outbound localhost pe bhi chal sakta hai.
- Tunnel URL change → webhook URL update + API restart; phir phone se **naya** reply.
- Signature verify skip = security + spoof risk; raw body parse pe dhyan (JSON re-stringify hash tod deta hai).

---

## 5) WABA subscribe (`subscribed_apps`)

```http
POST   /{Version}/{WABA-ID}/subscribed_apps   # subscribe this app
GET    /{Version}/{WABA-ID}/subscribed_apps   # list
DELETE /{Version}/{WABA-ID}/subscribed_apps   # unsubscribe
```

- Har WABA ke liye **individually** subscribe — multi-tenant SaaS mein Connect/OAuth success ke baad ye step miss = “messages send ho rahe, receive nahi”.
- Default: events app ke dashboard callback pe; overrides possible (partner webhook override docs).
- Rate limits apply to WABA management endpoints (see About Platform rate-limit tables).

**Official:**  
- https://developers.facebook.com/documentation/business-messaging/whatsapp/reference/whatsapp-business-account/subscribed-apps-api  
- https://developers.facebook.com/docs/whatsapp/embedded-signup/webhooks/  

---

## 6) Mark as read (+ typing)

Same Messages endpoint, different body:

```json
{
  "messaging_product": "whatsapp",
  "status": "read",
  "message_id": "wamid.…"
}
```

- Use inbound webhook `messages[].id`.
- Mark within **30 days**; marking one message also marks **earlier** messages in the conversation as read.
- Invalid `wamid` → **131009**.
- Success: `{ "success": true }` (blue ticks on user side).
- Typing indicator APIs exist alongside read receipts when reply lag expected (see service messages doc “Typing indicators”).

**Official:**  
- https://developers.facebook.com/docs/whatsapp/cloud-api/guides/mark-message-as-read/  
- https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/mark-message-as-read  

---

## 7) Interactive messages (overview)

`type: "interactive"` with `interactive.type` one of (reference enum includes):  
`button` | `list` | `cta_url` / CTA URL button messages | `product` | `product_list` | `catalog_message` | `flow` | `call_permission_request` | location-request style messages | etc.

### Reply buttons

- Up to **3** predefined reply buttons.
- User tap → inbound webhook `interactive.type = button_reply` with button `id` / title.

### Lists

- Button opens modal list; row `id` comes back as `list_reply` in webhook.
- Practical caps (list doc): on the order of **sections/rows** limits (e.g. up to 10 rows per common patterns — always re-check current Interactive List doc).

### CTA URL

- Single button mapped to URL — clean UX vs dumping long links in body.

### Commerce / catalog

- Product & product_list need catalog linkage (deeper in L13).

All of these are **service** messages → still need **open CSW** (unless sent as template interactive variants).

**Official:**  
- https://developers.facebook.com/docs/whatsapp/cloud-api/messages/interactive-list-messages/  
- https://developers.facebook.com/docs/whatsapp/cloud-api/messages/interactive-reply-buttons-messages/  
- https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages/  
- https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages  

---

## 8) Flows / NFM (overview only — deep dive L13)

**WhatsApp Flows** = multi-screen structured forms inside WhatsApp (leads, bookings, feedback, etc.).

Send paths (high level):

- Interactive Flow message inside CSW (`interactive.type = "flow"`), or
- Flow inside a **template**, or
- Draft vs published flow by name/id (Message API examples).

**NFM = Native Flow Message reply shape** on inbound webhooks when user completes a Flow:

- `interactive.type`: **`nfm_reply`**
- `nfm_reply.name`: typically **`flow`**
- `nfm_reply.body`: often **`Sent`**
- `nfm_reply.response_json`: stringified JSON (flow_token + field values; structure from Flow JSON Complete action or endpoint final payload)

Subscribe webhooks for **`messages`** and (per Flows docs) **`flows`** where required. Dynamic Flows need a **Flow endpoint** with encrypted data exchange + same style **`X-Hub-Signature-256`** validation.

Flow-specific errors to recognize later: e.g. **132068** blocked Flow, **132069** throttled Flow.

**Official:**  
- https://developers.facebook.com/docs/whatsapp/flows/overview  
- https://developers.facebook.com/docs/whatsapp/flows/reference/flowswebhooks/  
- https://developers.facebook.com/docs/whatsapp/flows/guides/implementingyourflowendpoint/  
- https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages/  

---

## 9) Error codes overview (Cloud API)

### How Meta wants you to handle errors

- Branch on **`code`** + **`error_data.details`** (not title strings — titles deprecated).
- Errors can be **sync** (HTTP Graph response) and/or **async** (webhook) — monitor both.
- `error_subcode` deprecated for newer versions — don’t build logic on it.

**Official master list:**  
- https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes/  
- https://developers.facebook.com/documentation/business-messaging/whatsapp/support/error-codes  

### Spotlight: **131047** + CSW

| | |
|--|--|
| **Code** | `131047` |
| **Meaning** | More than 24 hours since recipient last replied to this sender number (CSW closed). |
| **Fix** | Send an **approved template**; or wait for user to message again. |
| **Do not** | Retry the same free-form forever — identical fail until window reopens. |

Related mental model:

- Free-form only in CSW; templates outside.
- User **call** also opens/resets CSW (service messages doc).
- Legacy mental equivalent of old “470 re-engagement” era — current Cloud code is **131047**.

### Other high-frequency codes (cheat sheet)

| Code | Plain meaning | Typical fix |
|------|---------------|-------------|
| **100** | Invalid parameter | Fix payload shape / fields |
| **190** | Token invalid/expired | Refresh System User / business token |
| **368** | Temporarily blocked for policy | Stop; review policy / Direct Support |
| **131000** | Something went wrong (generic) | Retry with backoff; check status page |
| **131005** | Permission missing/removed | Debug token permissions |
| **131008** | Missing required parameter | Check endpoint reference |
| **131009** | Invalid parameter value | Bad `wamid`, bad phone id, etc. |
| **131021** | Sender == recipient | Don’t message yourself |
| **131026** | Undeliverable (not WA / ToS / old client) | User-side checks |
| **131042** | Payment / billing setup | Attach payment method / credit line |
| **131045** | Registration error | `POST /{phone_number_id}/register` |
| **131047** | CSW closed | Template |
| **131048** / spammy patterns | Spam rate / engagement | Slow down, improve quality |
| **131049** | Held for ecosystem engagement (often marketing limits) | Respect per-user marketing limits |
| **131050** | User stopped marketing | Do not retry marketing; `user_preferences` webhook |
| **131051** | Unsupported message type | Use supported `type` |
| **131052** | Can’t download user media | Ask user resend smaller/other channel |
| **131053** | Can’t upload media (MIME/type) | Fix media |
| **131056** | Pair rate limit (same user too fast) | Backoff (~1 msg / 6s steady-state guidance) |
| **132001** | Template missing/unapproved/wrong lang | Fix template name/locale/status |
| **132015 / 132016** | Template paused / permanently disabled (quality) | Edit or create new template |

Pair-rate (About Platform): about **1 message / 6 seconds** to the **same** user steady-state; burst then must “pay back” wait; exceed → **131056**.

---

## 10) Test / sandbox vs production

| Topic | Test resources | Production |
|-------|----------------|------------|
| Provisioning | Get Started auto-creates **test WABA + test phone** | Add real number → verify → **`/register`** |
| Payment method | Test templates often **without** payment method on file | Real WABA needs billing / payment setup (**131042** if broken) |
| Messaging limits | **Relaxed** limits for testing | Portfolio messaging limits + quality + throughput tiers |
| Recipients | Typically capped test numbers / allowlisted testers in app roles | Real opted-in customers |
| Webhooks | Same mechanism; use tunnel URL in dev | Stable HTTPS callback; per-WABA `subscribed_apps` |
| Display name / OBA | Test UX looser | Display name review, quality rating, OBA rules |
| 555 / ES test numbers | Special Embedded Signup test numbers need approved display name (**131037**) | Real numbers via proper registration |
| App mode | Dev mode + testers | Live + App Review permissions as needed (→ L7) |

**Official:**  
- https://developers.facebook.com/documentation/business-messaging/whatsapp/about-the-platform  
- https://developers.facebook.com/docs/whatsapp/cloud-api/phone-numbers  
- https://developers.facebook.com/documentation/business-messaging/whatsapp/get-started  
- https://developers.facebook.com/documentation/business-messaging/whatsapp/business-phone-numbers/registration  

### Hinglish

- Test number pe “kaam kar gaya” ≠ production ready.
- Production pe pehle: register, billing, webhook subscribe, quality green-ish, templates approved.
- Dev tunnel URL production pe mat chhodna.

---

## 11) Delivery / TTL / ordering (ops footnotes)

- Default message TTL ~**30 days** (auth templates often **~10 minutes**) — no `delivered` by then ⇒ treat as dropped.
- Multiple sends: **order not guaranteed**; for strict sequences wait for `delivered` status before next.
- Throughput default up to **~80 msg/s** per number (upgrades exist) — separate from messaging limits (unique users outside CSW / 24h).

**Official:** service messages guide + About Platform (linked above).

---

## 12) Why it matters for Samyoj (checklist)

- [ ] Persist Meta `phone_number_id` + DB workspace id; route webhooks by metadata.
- [ ] On Connect: ensure **`subscribed_apps`** for that WABA.
- [ ] CSW tracker from last inbound (and call events if Calling enabled).
- [ ] Free-form vs template send paths split in product.
- [ ] Handle **131047** with template CTA, not infinite retry.
- [ ] Media pipeline respects 7-day / 5-minute expiry rules.
- [ ] Mark-read for agent UX; don’t block critical path on it.
- [ ] Never expose App Secret / tokens in client; signature verify on server.
- [ ] Separate Meta message fees (WABA billing) from Samyoj SaaS price (L4).

---

## 13) Common pitfalls / ban-adjacent risks

- Messaging users without clear **opt-in** (policy).
- Blasting marketing outside healthy engagement → **131049** / quality drops / template pause.
- Ignoring async `failed` webhooks → silent customer pain.
- Wrong phone formatting without `+` country code.
- Assuming Graph accept = user saw message.
- Missing WABA subscribe after Embedded Signup.
- Using temporary User tokens in production workers.

Policy deep dive → L6; template quality → L3.

---

## 14) Quiz / self-check

**Q1.** Free-form text send URL mein kaunsa ID lagta hai — display phone ya `phone_number_id`?  
**A:** `phone_number_id`.

**Q2.** User ne 30 hours pehle last message kiya. Free-form bheja. Expected Cloud error?  
**A:** **131047** → template bhejo.

**Q3.** CSW kaun open/reset karta hai?  
**A:** User **message** ya **call** to the business (per service messages doc).

**Q4.** `POST /messages` 200/accept mila. Kya message delivered hai?  
**A:** Nahi — `statuses` webhook (`delivered` / `failed`) dekho.

**Q5.** Tech Provider ne Embedded Signup complete kiya, lekin Inbox inbound 0. Pehla suspect?  
**A:** `POST /{waba-id}/subscribed_apps` miss / wrong callback / tunnel.

**Q6.** Inbound image: media URL turant download na kiya. Risk?  
**A:** URL ~**5 min** expire; media id webhook se ~**7 days**.

**Q7.** Mark-as-read ke liye body mein kya key fields?  
**A:** `messaging_product`, `status: "read"`, `message_id: wamid`.

**Q8.** Flow complete hone par inbound interactive type often kya hota hai?  
**A:** `nfm_reply` with `response_json`.

**Q9.** Test WABA vs live — payment method?  
**A:** Test often without payment method; production needs billing (else **131042** class failures).

**Q10.** Same user ko bahut tez messages → kaunsa rate error?  
**A:** **131056** (pair rate).

**Q11.** Webhook authenticity header?  
**A:** `X-Hub-Signature-256` (HMAC SHA-256 of raw body + App Secret).

**Q12.** List row select hone par webhook interactive type?  
**A:** `list_reply` (with row `id`).

---

## 15) Sources (official URLs)

1. https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages/  
2. https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/send-messages  
3. https://developers.facebook.com/docs/whatsapp/conversation-types/  
4. https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages  
5. https://developers.facebook.com/documentation/business-messaging/whatsapp/reference/whatsapp-business-phone-number/message-api  
6. https://developers.facebook.com/docs/whatsapp/cloud-api/messages/text-messages/  
7. https://developers.facebook.com/docs/whatsapp/cloud-api/reference/media/  
8. https://developers.facebook.com/documentation/business-messaging/whatsapp/business-phone-numbers/media  
9. https://developers.facebook.com/docs/whatsapp/cloud-api/guides/mark-message-as-read/  
10. https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/mark-message-as-read  
11. https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/components/  
12. https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/payload-examples/  
13. https://developers.facebook.com/docs/graph-api/webhooks/getting-started/  
14. https://developers.facebook.com/docs/whatsapp/embedded-signup/webhooks/  
15. https://developers.facebook.com/documentation/business-messaging/whatsapp/reference/whatsapp-business-account/subscribed-apps-api  
16. https://developers.facebook.com/docs/whatsapp/cloud-api/phone-numbers  
17. https://developers.facebook.com/documentation/business-messaging/whatsapp/business-phone-numbers/phone-numbers  
18. https://developers.facebook.com/documentation/business-messaging/whatsapp/business-phone-numbers/registration  
19. https://developers.facebook.com/docs/whatsapp/cloud-api/reference/registration/  
20. https://developers.facebook.com/documentation/business-messaging/whatsapp/about-the-platform  
21. https://developers.facebook.com/documentation/business-messaging/whatsapp/get-started  
22. https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes/  
23. https://developers.facebook.com/documentation/business-messaging/whatsapp/support/error-codes  
24. https://developers.facebook.com/docs/whatsapp/cloud-api/messages/interactive-list-messages/  
25. https://developers.facebook.com/docs/whatsapp/cloud-api/messages/interactive-reply-buttons-messages/  
26. https://developers.facebook.com/docs/whatsapp/flows/overview  
27. https://developers.facebook.com/docs/whatsapp/flows/reference/flowswebhooks/  
28. https://developers.facebook.com/docs/whatsapp/flows/guides/implementingyourflowendpoint/  
29. https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview  
30. https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/marketing-templates/per-user-limits  
31. https://developers.facebook.com/docs/graph-api/guides/error-handling  

---

## 16) Handoff

- Next leaf overlap: **L3** templates/CSW deep, **L7** App Review/Live, **L13** Flows/commerce depth, **L14** Samyoj code surface map.  
- Do not invent prices or App IDs from this note — always re-open linked Meta docs for the live Graph version (`v25`/`v26`/…).
