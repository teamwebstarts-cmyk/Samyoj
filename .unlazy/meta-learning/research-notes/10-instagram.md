# L10 — Instagram Messaging API (business DMs)

> **FUTURE SCOPE — Samyoj does NOT ship Instagram today.**  
> Ye note sirf Meta literacy + future product planning ke liye hai. WhatsApp Cloud API = current Samyoj surface. Instagram = later omnichannel leaf. **Code mat likho / Connect UI mat banao** jab tak product explicitly nahi maange.

**Leaf id:** L10 · **PLAN:** `.unlazy/meta-learning/PLAN.md`  
**Audience:** Sonu (product + Meta literacy) · **Lang:** Hinglish + English terms  
**Researched:** 2026-08-25 · Prefer official Meta docs over blogs

---

## 1. One-line picture

Instagram Messaging API = Meta ka **business/creator DM automation** layer. Customer pehle message karta hai (DM / story reply / comment private reply / ice breaker / ad Click-to-Direct) → webhook aata hai → app **24-hour window** mein reply karti hai. WhatsApp jaisa **proactive template blast** yahan nahi hai.

Do official paths exist (confusion ka source):

| Path | Kab use | Host / token vibe | Docs |
|------|---------|-------------------|------|
| **Messenger Platform → Instagram Messaging** (Page-linked) | IG Professional linked to a **Facebook Page** | `graph.facebook.com`, Page access token, `/PAGE-ID/messages` | [Overview](https://developers.facebook.com/docs/instagram-messaging/overview/) · [Get started](https://developers.facebook.com/docs/messenger-platform/instagram/get-started/) |
| **Instagram API with Instagram Login** (no Page required) | Professional account **without** Page link | `graph.instagram.com`, Instagram User token, `/IG_ID/messages` | [Messaging API](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/messaging-api/) · [Platform overview](https://developers.facebook.com/documentation/instagram-platform) |

Meta product names mix: “Instagram Messaging”, “Messenger API support for Instagram”, “Instagram Messaging API in Developer Policies”. Same family; setup differs.

**Samyoj implication (future):** SaaS / Tech-Provider style apps usually start with **Page-linked Messenger path** (familiar OAuth + Page tokens). Instagram Login path is the fallback when customer ke paas Page nahi hai.

---

## 2. Eligibility & account model

- **Business** ya **Creator** Instagram Professional account.  
  Source: [Overview](https://developers.facebook.com/docs/instagram-messaging/overview/)
- Conversations: **1 customer per thread** — group messaging unsupported.
- Inbox folders (Primary / General / Requests) Instagram app mein dikhte hain; **API payloads mein folder info nahi** aati. Third-party app se reply → conversation often **General** folder mein chali jati hai.
- Requests folder: inactive **30 days** → Conversations API se return nahi hote.
- **Creator** quirk: pehle Conversations API call karna padta hai, tab webhooks milte hain (Page-linked overview).
- Customer must enable:  
  **Instagram Settings → Messages and story replies → Message controls → Connected Tools → Allow Access to Messages**  
  Source: [Get started](https://developers.facebook.com/docs/messenger-platform/instagram/get-started/)

Hinglish: WhatsApp mein “number connect + webhook” jaisa clear phoneId model hai. IG mein pehle Professional account + (often) Page link + Connected Tools toggle — warna API silent fail feel hota hai.

---

## 3. Permissions (App Review matter)

### 3.1 Page-linked path (Messenger → Instagram)

Common permission set from overview / get-started / Conversations edge:

| Permission | Role |
|------------|------|
| `instagram_basic` | IG account identity / basic context |
| `instagram_manage_messages` | **Core** — send/receive DMs |
| `pages_manage_metadata` | Page webhook subscribe / metadata |
| `pages_show_list` | List Pages during login |
| `business_management` | Often dependency when managing assets for other businesses |

Also: Page token from someone who can perform **MESSAGE** (send) / **MODERATE** (subscribe) tasks on the linked Page.

Sources:

- [Overview — Requirements](https://developers.facebook.com/docs/instagram-messaging/overview/)
- [Get started](https://developers.facebook.com/docs/messenger-platform/instagram/get-started/)
- [Page Conversations reference](https://developers.facebook.com/docs/graph-api/reference/page/conversations/)
- [App Review — Messenger IG](https://developers.facebook.com/docs/messenger-platform/instagram/app-review/)
- [Apps for other businesses](https://developers.facebook.com/docs/messenger-platform/instagram/app-review/apps-for-other-businesses/)
- [Apps for your own business](https://developers.facebook.com/documentation/business-messaging/instagram-messaging/app-review/apps-for-your-own-business) *(mirror path under business-messaging)*

### 3.2 Instagram Login path (no Page)

| Permission | Role |
|------------|------|
| `instagram_business_basic` | Basic IG business access |
| `instagram_business_manage_messages` | Send/receive on Login path |

Sources:

- [Send Messages — Instagram Login](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/messaging-api/)
- [App Review for Instagram API](https://developers.facebook.com/docs/instagram-platform/app-review/)

### 3.3 Human Agent feature (window extension)

- Standard window: **24 hours** after user’s last message.
- Tag `HUMAN_AGENT` (aka Human Agent feature): human agent **7 days** tak reply kar sakta hai — **automation ke liye allowed nahi**.
- App Review se **Human Agent** feature approve karwana padta hai.

Sources:

- [Send messages — tags / window](https://developers.facebook.com/docs/messenger-platform/send-messages/)
- [Instagram Login send + human agent](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/messaging-api/)
- [Apps for other businesses — Human Agent](https://developers.facebook.com/docs/messenger-platform/instagram/app-review/apps-for-other-businesses/)

### 3.4 Access levels (test vs live)

- **Standard Access:** sirf people with a **role on the app** (testers).
- **Advanced Access + App Review:** production customers (other businesses’ data).
- Webhooks: app **published** hona chahiye (review status alag); bina Advanced Access ke webhooks mostly role-holders ke liye.

Sources:

- [Webhooks for Instagram Messaging](https://developers.facebook.com/docs/messenger-platform/instagram/features/webhook/)
- [Access levels](https://developers.facebook.com/docs/graph-api/overview/access-levels)
- [App modes](https://developers.facebook.com/docs/development/build-and-test/app-modes)
- [App roles](https://developers.facebook.com/docs/development/build-and-test/app-roles)

Hinglish: WhatsApp Embedded Signup / WABA alag animal hai. IG mein Facebook Login for Business / Instagram Login + App Review permissions — **BSP “phone number onboard” pattern copy-paste mat karna**.

---

## 4. IDs you will see

| ID | Meaning |
|----|---------|
| **IGID** | Instagram Professional account id (business/creator side) |
| **IGSID** | Instagram-**scoped** id for the **customer** (recipient on send; sender on inbound webhook) |
| **PAGE-ID** | Facebook Page linked to IG (Page-linked path only) |
| **mid** | Message id |

Send (Page-linked): `POST /PAGE-ID/messages` with `recipient.id = IGSID`.  
Send (Login path): `POST /IG_ID/messages` with same recipient shape.

Sources:

- [Send a Message (IG via Messenger)](https://developers.facebook.com/docs/messenger-platform/instagram/features/send-message/)
- [Send Messages (Instagram Login)](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/messaging-api/)

---

## 5. Webhooks

### 5.1 Requirements (Page-linked)

- Permissions: `instagram_basic`, `instagram_manage_messages`, `pages_manage_metadata`
- App Review for Advanced Access when serving non-role users
- App must be **published** to receive webhooks
- Subscribe messaging apps; Page `subscribed_apps` pattern similar to Messenger

Sources:

- [Webhooks for Instagram Messaging](https://developers.facebook.com/docs/messenger-platform/instagram/features/webhook/)
- [Meta Webhooks for Messenger Platform](https://developers.facebook.com/docs/messenger-platform/webhooks/)
- Mirror: [business-messaging IG webhooks](https://developers.facebook.com/documentation/business-messaging/instagram-messaging/webhooks)

**Payload object:** `"object": "instagram"` (WhatsApp Cloud API ka `whatsapp_business_account` object se alag).

### 5.2 Webhook fields (IG Messaging)

| Field | Kab |
|-------|-----|
| `messages` | Inbound text/media/share/story reply·mention/quick reply/unsupported/delete; **also echoes** when business sends (`is_echo`) — IG has **no separate** `message_echoes` field |
| `messaging_postbacks` | Ice Breaker / Generic Template button |
| `messaging_seen` | Read receipts |
| `messaging_referral` | `ig.me` link with ref (existing thread) |
| `message_reactions` | React / unreact |
| `standby` | Multi-app Handover — message aaya but yeh app control mein nahi |

Limitations worth memorizing:

- GIF/sticker messages: often **no webhook**
- Disappearing / view-once media: **not supported** on media webhooks
- Story: **mentions** trigger; tagging on regular posts does **not**
- Share: mostly **URL only**, not full media dump

Separate (not DM Messaging, but adjacent): Instagram Graph webhooks for `comments` / `live_comments` / `mentions` / `story_insights` — used for **Private Replies** entry.  
→ [Webhooks for Instagram (Graph)](https://developers.facebook.com/docs/graph-api/webhooks/getting-started/webhooks-for-instagram/)

### 5.3 Login-path webhook subscriptions (docs list)

`messages`, `messaging_optins`, `messaging_postbacks`, `messaging_reactions`, `messaging_referrals`, `messaging_seen`  
Source: [Send Messages — Instagram Login](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/messaging-api/)

---

## 6. Message types & conversation entry points

**Inbound entry points (people start chat):**

- Organic DM
- Story reply / story mention
- Ice Breakers (max **4** FAQs)
- Generic Template buttons / quick replies
- Instagram Shops product detail
- Ads **Click to Direct (CTD)**
- Private Reply after **comment** on post/reel/ads/live (one message; then user must reply to open 24h window)

**Outbound content (within window):** text, links, images, video, audio, PDF, stickers, reactions, owned Instagram post shares (`MEDIA_SHARE`), generic templates / carousels.

Key feature docs:

- [Private Replies](https://developers.facebook.com/docs/messenger-platform/instagram/features/private-replies/)
- [Ice Breakers](https://developers.facebook.com/docs/messenger-platform/instagram/features/ice-breakers)
- [Ice Breakers — Instagram Login](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/messaging-api/ice-breakers)
- [Generic Template](https://developers.facebook.com/docs/messenger-platform/instagram/features/generic-template/)
- [Conversations API (Messenger / IG)](https://developers.facebook.com/docs/messenger-platform/conversations/)
- [Conversations API — Instagram Login](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/conversations-api/)
- [Business Login for Instagram](https://developers.facebook.com/docs/instagram/business-login-for-instagram)

**Policy / automation:**

- Human escalation path **required** (custom inbox and/or [Handover Protocol](https://developers.facebook.com/docs/messenger-platform/handover-protocol)).
- Bot disclosure where law requires (esp. CA / DE markets) — [Developer Policies § Messenger](https://developers.facebook.com/devpolicy/#messengerplatform)
- [Meta Platform Terms](https://developers.facebook.com/terms/dfc_platform_terms/) — delete when webhook says delete

**Marketing Messages (opt-in promo outside window):** exists on Messenger Platform docs and Instagram product marketing pages — **restricted / partner-gated** historically; **not** WhatsApp-style freeform templates. Treat as advanced / verify live access before product promise.  
→ [Marketing Messages](https://developers.facebook.com/docs/messenger-platform/marketing-messages/) · [Instagram Messaging hub](https://developers.facebook.com/docs/instagram-messaging/)

Many Messenger-only tags (`ACCOUNT_UPDATE`, `CONFIRMED_EVENT_UPDATE`, `CUSTOMER_FEEDBACK`) are documented **not available** for Instagram Messaging — only **`HUMAN_AGENT`** is the practical outside-window tag for support.  
→ [Send messages](https://developers.facebook.com/docs/messenger-platform/send-messages/)

---

## 7. Instagram vs WhatsApp (Samyoj lens)

| Topic | WhatsApp Cloud API (Samyoj **now**) | Instagram Messaging (**future**) |
|-------|--------------------------------------|----------------------------------|
| Identity | Phone number / `phone_number_id` + WABA | IGSID + IG Professional (+ often Page) |
| Webhook object | `whatsapp_business_account` | `instagram` |
| Start conversation | User message **or** approved **template** to opted-in user | Mostly **user-initiated**; private reply / ice breaker / ads CTD as entry |
| Outside 24h | **Templates** (utility/marketing/auth) + paid Meta fees | No WA-style templates; **`HUMAN_AGENT`** (7d, humans); Marketing Messages separate & gated |
| Billing | Meta **per-message** on WABA + Samyoj SaaS separate | DM API sends generally **not** WA fee card; ads/CTD budget alag — **never fold into Samyoj plan price** |
| Onboarding | Embedded Signup / Tech Provider / WABA | Facebook Login for Business **or** Instagram Login; Connected Tools toggle |
| Partner model | Tech Provider / BSP common | App Review “apps for other businesses”; not the same WABA contract |
| Isolation | `whatsappNumberId` workspaces | Future: isolate by IG account / Page — **do not reuse WA number rows** |
| Media / rich | Templates, Flows, catalogs, interactive lists | Ice breakers, generic template, story/comment entry, shops |
| Calling | WhatsApp Calling API (separate leaf L9) | Messenger API Calling marketed on IG hub — **verify product before promising** |

Hinglish takeaway:

1. WhatsApp = **outbound + transactional** powerhouse.  
2. Instagram = **inbound / content → DM** funnel.  
3. Same Meta Graph family, **alag product, alag permissions, alag webhook object** — ek `webhook` handler mein mix karna dangerous hai without explicit channel routing.

Official WhatsApp contrast reading (current Samyoj world):

- [WhatsApp Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api/overview)
- [WhatsApp Webhooks](https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/components)
- [WhatsApp Message Templates](https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates)

---

## 8. Future Samyoj product notes (not a build plan)

**FUTURE SCOPE** checklist jab kabhi IG channel start ho:

1. Separate channel module + webhook verifier (signature + `object: instagram`).
2. OAuth: Page-linked first; document Instagram Login as alternate.
3. Persist `IGID` / Page id / IGSID mapping — never store as “phone”.
4. Enforce 24h window UI + optional Human Agent after App Review.
5. Mandatory human handoff path (policy).
6. Private Replies + Ice Breakers = high-ROI first features (content businesses).
7. Do **not** invent WA-style campaign blast on IG.
8. Keep Meta Ads / Marketing Messages billing out of Samyoj SaaS SKU (same rule as WA Meta fees).

**Not in scope until asked:** coding Connect UI, App Review screencasts, production IG inbox.

---

## 9. Official URL pack (bookmark)

### Core

1. https://developers.facebook.com/docs/instagram-messaging/
2. https://developers.facebook.com/docs/instagram-messaging/overview/
3. https://developers.facebook.com/docs/messenger-platform/instagram/get-started/
4. https://developers.facebook.com/documentation/business-messaging/instagram-messaging/get-started
5. https://developers.facebook.com/documentation/instagram-platform
6. https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/messaging-api/
7. https://developers.facebook.com/docs/instagram-api

### Send / conversations / features

8. https://developers.facebook.com/docs/messenger-platform/instagram/features/send-message/
9. https://developers.facebook.com/docs/messenger-platform/send-messages/
10. https://developers.facebook.com/docs/messenger-platform/conversations/
11. https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/conversations-api/
12. https://developers.facebook.com/docs/graph-api/reference/page/conversations/
13. https://developers.facebook.com/docs/messenger-platform/instagram/features/private-replies/
14. https://developers.facebook.com/docs/messenger-platform/instagram/features/ice-breakers
15. https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/messaging-api/ice-breakers
16. https://developers.facebook.com/docs/messenger-platform/instagram/features/generic-template/
17. https://developers.facebook.com/docs/messenger-platform/handover-protocol
18. https://developers.facebook.com/docs/messenger-platform/marketing-messages/

### Webhooks

19. https://developers.facebook.com/docs/messenger-platform/instagram/features/webhook/
20. https://developers.facebook.com/documentation/business-messaging/instagram-messaging/webhooks
21. https://developers.facebook.com/docs/messenger-platform/webhooks/
22. https://developers.facebook.com/docs/graph-api/webhooks/getting-started/webhooks-for-instagram/

### Login / App Review / policy

23. https://developers.facebook.com/docs/instagram/business-login-for-instagram
24. https://developers.facebook.com/docs/messenger-platform/instagram/app-review/
25. https://developers.facebook.com/docs/messenger-platform/instagram/app-review/apps-for-other-businesses/
26. https://developers.facebook.com/docs/instagram-platform/app-review/
27. https://developers.facebook.com/docs/graph-api/overview/access-levels
28. https://developers.facebook.com/docs/development/build-and-test/app-modes
29. https://developers.facebook.com/docs/development/build-and-test/app-roles
30. https://developers.facebook.com/devpolicy/#messengerplatform
31. https://developers.facebook.com/terms/dfc_platform_terms/
32. https://developers.facebook.com/documentation/business-messaging/messenger-platform/changelog

### Adjacent (do not mix into SaaS pricing)

33. https://www.facebook.com/business/help/198088077975174 (Click to Direct ads)
34. https://www.facebook.com/business/help/1264898753662278 (Instagram Inbox)
35. https://developers.facebook.com/docs/whatsapp/cloud-api/overview
36. https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/components
37. https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates

---

## 10. Quiz / self-check (Hinglish)

Answer without peeking. Phir §3–7 se verify karo.

1. **True/False:** Samyoj aaj Instagram DMs production mein support karta hai.  
2. Page-linked path ka **core** permission kaunsa hai: `instagram_manage_messages` ya `whatsapp_business_messaging`?  
3. Instagram webhook JSON mein `"object"` usually kya hota hai?  
4. 24h ke baad automation se freeform DM bhej sakte ho? Human Agent tag automation ke liye allowed hai kya?  
5. WhatsApp templates aur Instagram ice breakers same cheez hain kya?  
6. Private Reply comment ke baad kitni free outbound messages? User reply se pehle unlimited?  
7. Connected Tools → Allow Access to Messages skip karoge to kya hoga (practical)?  
8. `message_echoes` alag field Instagram Messaging pe hota hai, jaise Messenger pe?  
9. Meta Cloud API message fees Instagram DM pe WA jaisi copy-paste apply karte ho Samyoj plan mein — sahi ya galat?  
10. Do paths (Page-linked vs Instagram Login) ke hosts roughly kaunse hain?

### Answer key

1. **False** — **FUTURE SCOPE** only.  
2. **`instagram_manage_messages`**.  
3. **`instagram`**.  
4. **Nahi** freeform automation outside window; **`HUMAN_AGENT` humans only, ~7 days**, App Review feature.  
5. **Nahi** — ice breakers = FAQ starter chips; WA templates = approved outbound categories.  
6. Private reply = **one** message (7-day comment window / live = during broadcast); conversation continue tab jab user reply kare → 24h window.  
7. API se messages manage reliably nahi — toggle **on** required (get-started).  
8. **Nahi** — echoes `messages` field ke andar `is_echo` se aate hain.  
9. **Galat** — never mix Meta channel fees / ads into Samyoj SaaS plan price.  
10. Page-linked ≈ **`graph.facebook.com`**; Instagram Login ≈ **`graph.instagram.com`**.

---

## 11. Sources used this leaf

Primary: Meta Developer docs listed in §9 (WebSearch + live doc pulls 2026-08-25).  
Secondary blogs were used only to spot comparison questions; **truth = official URLs above**.

**Status:** research leaf complete · **implementation:** none · **FUTURE SCOPE** preserved.
