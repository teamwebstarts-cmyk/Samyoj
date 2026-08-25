# L13 — WhatsApp Commerce / Catalog / Flows / NFM / India payments

**Leaf:** L13 · **Owns:** `13-commerce-flows.md`  
**Audience:** Sonu (founder literacy) · **As of:** 2026-08-25  
**Method:** Official Meta docs (WebSearch/WebFetch) + Samyoj repo map (`FEATURE_MATRIX`, `catalog/`, `commerce/`, `flows-assets/`, `messages/interactive.ts`)  
**Not in scope:** Implementing payments, inventing INR fee tables, mixing Samyoj SaaS Razorpay into Meta WABA payments

---

## 0. Naming trap (padho pehle)

| Name | Kya hai | Samyoj me |
|------|---------|-----------|
| **Meta Catalog** | Meta Commerce Manager product inventory linked to WABA | `/api/catalog` sync + `CatalogProduct` |
| **WhatsApp Commerce** | In-chat browse → cart → order → (optional) pay | `/api/commerce` + `CommercePage` |
| **Meta Flows** | Structured form/screens *inside* WhatsApp (Flow JSON) | `/api/flows-assets` + `MetaFlowBuilder` |
| **NFM** | *Native Flow Message* reply — webhook shape when user completes a Flow / address message | `nfm_reply` in inbox parser + `flows-assets/nfm-handler.ts` |
| **Samyoj Flow** (`/api/flows`) | Internal chat-tree automation (triggers, nodes, wait) | `FlowBuilderPage` — **not** Meta Flows |
| **Samyoj SaaS billing Razorpay** | Platform plan payment | **Different ledger** from WhatsApp Payments API India |

Hinglish: *“Flow” bolna se pehle decide karo — Meta form wala Flow, ya Samyoj automation wala Flow.*

---

## 1. Catalog + Commerce overview (Meta)

### 1.1 Catalog kya hai

A **catalog** = structured inventory on Meta (name, price, images, availability, retailer_id) connected to a **WABA**. It powers:

1. **Upload** — Commerce Manager UI or Commerce API  
2. **Commerce settings** — per phone number: cart on/off, catalog icon visible  
3. **Share products** — message types (below)  
4. **Customer responses** — webhooks with product inquiries + **orders** (cart submit)

Official:

- https://developers.facebook.com/documentation/business-messaging/whatsapp/catalogs/catalogs-overview/  
- (legacy mirror) https://developers.facebook.com/docs/whatsapp/cloud-api/guides/sell-products-and-services/

### 1.2 Product sharing formats

| Format | Interactive / message idea | Typical limit |
|--------|----------------------------|---------------|
| Catalog message | `catalog_message` — “View catalog” | Full catalog |
| Single product | `product` | 1 SKU |
| Multi-product (MPM) | `product_list` | ≤30 products, ≤10 sections |
| Product carousel | carousel of product cards | ≤10 cards (docs) |
| Catalog link | `wa.me` catalog URL in text | — |
| Checkout button template | India-oriented checkout templates | India beta / support gate |

Official share guide:

- https://developers.facebook.com/documentation/business-messaging/whatsapp/catalogs/share-products  
- https://developers.facebook.com/docs/whatsapp/cloud-api/guides/sell-products-and-services/share-products/  
- Older commerce guide: https://developers.facebook.com/docs/whatsapp/guides/commerce-guides/share-products-with-customers/

### 1.3 Cart behaviour (high level)

- Cart is **per chat thread / device**; business does **not** send carts to users.  
- Customer adds items → sends order → webhook to business.  
- Cart has no expiry until sent; after send, start a new cart.  
- Up to **99 units** per single catalog item; no hard “distinct SKU count” limit in overview docs.  
- Cloud API product messages currently **do not** show the shopping-cart header icon that the WhatsApp Business app may show.

### 1.4 Commerce settings API

Per `BUSINESS_PHONE_NUMBER_ID`:

- `is_cart_enabled` (default often **true**)  
- `is_catalog_visible` (default often **false** — storefront icon)

```
POST /<PHONE_NUMBER_ID>/whatsapp_commerce_settings?is_cart_enabled=true
POST /<PHONE_NUMBER_ID>/whatsapp_commerce_settings?is_catalog_visible=true
GET  /<PHONE_NUMBER_ID>/whatsapp_commerce_settings
```

Official: https://developers.facebook.com/documentation/business-messaging/whatsapp/catalogs/set-commerce-settings  
Mirror: https://developers.facebook.com/docs/whatsapp/cloud-api/guides/sell-products-and-services/set-commerce-settings/

### 1.5 Policies / India compliance (commerce)

- Follow WhatsApp **Commerce and Business Policies**; catalog items auto-reviewed; users can report products.  
- **India:** businesses selling online must comply with local online-selling laws; Meta surfaces **Business Compliance** info for +91 users.  
- Help Center (India selling laws): https://www.facebook.com/business/help/1104628230079278  
- Graph reference: https://developers.facebook.com/docs/graph-api/reference/whats-app-business-account-to-number-current-status/business_compliance_info/

Without compliance details filled for India, SPM/MPM may be blocked (partner docs + Meta help; treat as ops prerequisite, not Samyoj invention).

---

## 2. Meta Flows + NFM

### 2.1 WhatsApp Flows (Meta)

**Flows** = multi-screen, structured in-chat experiences (forms, booking, lead gen, surveys) defined by **Flow JSON**, managed via **Flows API**, opened from an interactive message (`type: flow`) or a template with FLOW button.

Typical send parameters (Cloud API interactive):

- `flow_message_version`: `"3"`  
- `flow_id` **or** `flow_name`  
- `flow_cta` (button label, short)  
- `flow_token` (your session id)  
- `flow_action`: `navigate` | `data_exchange`  
- `mode`: `published` | `draft`

Official hub:

- https://developers.facebook.com/docs/whatsapp/flows/  
- https://developers.facebook.com/documentation/business-messaging/whatsapp/flows  
- Sending: https://developers.facebook.com/documentation/business-messaging/whatsapp/flows/guides/sendingaflow  
- Flows API: https://developers.facebook.com/documentation/business-messaging/whatsapp/flows/guides/flowsapi  
- Endpoint / data exchange (encrypted): see Flows guides under same docs tree  

Categories (API): e.g. `SIGN_UP`, `SIGN_IN`, `APPOINTMENT_BOOKING`, `LEAD_GENERATION`, `CONTACT_US`, `CUSTOMER_SUPPORT`, `SURVEY`, `OTHER`.

### 2.2 NFM = how replies arrive

When the user finishes a Flow (or some native surfaces like **address messages**), WhatsApp delivers an interactive message:

```json
"interactive": {
  "type": "nfm_reply",
  "nfm_reply": {
    "name": "flow",
    "body": "Sent",
    "response_json": "{\"flow_token\":\"...\",\"field1\":\"...\"}"
  }
}
```

- `nfm_reply` = **Native Flow Message** reply envelope  
- `response_json` = stringified JSON (parse it)  
- Same `messages` webhook channel as normal inbound  

Official:

- Flows webhooks: https://developers.facebook.com/documentation/business-messaging/whatsapp/flows/guides/flowswebhooks  
- Address messages also use `nfm_reply`: https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/address-messages  

Dynamic Flows with a server endpoint use **encrypted data exchange** (AES) — Samyoj implements this under `/api/flows-assets/data`.

---

## 3. Payments API — India (overview only)

**Important:** This is **WhatsApp Cloud API Payments for merchants collecting money from customers in chat** — **not** Samyoj SaaS plan billing.

Official overview:

- https://developers.facebook.com/docs/whatsapp/cloud-api/payments-api/payments-in/  
- Markdown copy: https://developers.facebook.com/documentation/business-messaging/whatsapp/payments/payments-in/overview.md  

### 3.1 Core idea

1. Customer browses catalog / places order (commerce messaging).  
2. Business sends **`order_details`** interactive invoice (`review_and_pay`).  
3. Payment happens via UPI apps / (deep mode) cards, netbanking, wallets.  
4. Status via **payment gateway webhooks** and/or WhatsApp payment webhooks (mode-dependent).  
5. Business can send **`order_status`** / **`payment_status`** interactive updates.

### 3.2 Two integration models (documented)

| | **UPI Intent** | **Payment Gateway Deep Integration** |
|--|----------------|--------------------------------------|
| Gateways | Any PG that can generate UPI Intent | Currently documented: **Razorpay, PayU, Billdesk, Zaakpay** |
| Native “other methods” (cards etc.) | ❌ (links as alternative) | ✅ |
| Native UPI Intent | ✅ | ✅ |
| Payment status via WhatsApp webhooks | ❌ | ✅ |
| Refunds via WhatsApp APIs | ❌ | ✅ |

Related:

- UPI Intent: https://developers.facebook.com/docs/whatsapp/cloud-api/payments-api/payments-in/upi-intent/  
- Deep PG: https://developers.facebook.com/documentation/business-messaging/whatsapp/payments/payments-in/pg  
- Checkout button templates (India; coupons / realtime inventory beta — contact Meta): https://developers.facebook.com/docs/whatsapp/cloud-api/payments-api/payments-in/checkout-button-templates/  
- Support case type: **“WaBiz: Business Payments API”** via https://business.facebook.com/direct-support/  
- India payments office hours (Meta calendar linked from payments overview)

### 3.3 Payment configuration

Merchants configure **payment configurations** on the WABA (VPA / MCC / purpose code for UPI Intent; gateway account link for deep mode). Webhook field exists: `payment_configuration_update` (see Cloud API webhooks guide).

**Do not confuse** with Samyoj `Razorpay` for SaaS plans — same brand name can appear, different product surface.

---

## 4. End-to-end mental model (India D2C)

```text
Commerce Manager catalog ──link──► WABA + phone
        │
        ▼
Commerce settings (cart + catalog visible) + India compliance info
        │
        ▼
Send catalog / SPM / MPM / carousel  (Cloud API messages)
        │
        ▼
Customer browses + submits cart  ──webhook──► business Order
        │
        ▼
[Optional] Meta Flow for address / preferences ──nfm_reply──► business
        │
        ▼
Send order_details (invoice) + linked payment_configuration
        │
        ▼
UPI Intent or PG deep integration ──pay──► gateway + webhooks
        │
        ▼
order_status / payment_status messages back to chat
```

Flows can also sit **before** catalog (lead form) or **instead of** full catalog (appointment-only businesses).

---

## 5. What Samyoj already touches vs future

Evidence: `docs/audit/FEATURE_MATRIX.md` § commerce / forms + code under `server/src/modules/{catalog,commerce,flows-assets,messages}` and client `CommercePage` / `MetaFlowBuilder`.

### 5.1 Already in code (partial product)

| Area | Samyoj status | Where |
|------|---------------|--------|
| List Meta catalogs for WABA | Done (API) | `GET /api/catalog/catalogs` → Graph `/{wabaId}/product_catalogs` |
| Sync products into DB | Done (API) | `POST /api/catalog/sync` → `CatalogProduct` upsert |
| List synced products | Done (API) | `GET /api/catalog/products` |
| Inbound cart → Order row | Done | `createOrderFromInbound` from `webhook.processor` + message-parser `order` |
| Orders UI | Done | `CommercePage`, order cards/panels |
| Order status → Meta `order_status` | Done | `PATCH /api/commerce/orders/:id/status` + `buildOrderStatusPayload` |
| Payment status field → Meta `payment_status` | Done (manual notify) | `PATCH .../payment-status` + `buildPaymentStatusPayload` |
| Interactive builders: product / product_list / catalog_message | Done (payload helpers) | `messages/interactive.ts`; sendable via inbox/send paths |
| Meta Flow assets CRUD + publish | Done | `/api/flows-assets` |
| Encrypted Flows data endpoint | Done | `/api/flows-assets/data` |
| NFM reply handling + signed flow_token | Done | `nfm-handler.ts`, `nfm-token.ts`; also inbox parser |
| Meta Flow simple builder UI | Present | `MetaFlowBuilder.tsx` |
| Conversation automation waiting on form | Present | `/api/flows` engine + `inbound-wait` (NFM continues form wait) |
| Feature flag `commerce` | Exists | Org flags (enforcement history uneven — see billing audits) |

### 5.2 Gaps / future (do not claim shipped)

| Area | Status |
|------|--------|
| Full **Payments API India** (UPI Intent / PG deep link, payment_configuration lifecycle) | **Future** — helpers for `order_details` exist (`buildOrderDetailsPayload`) but **no route ships invoice+PG config** as a complete India payments product |
| Checkout button templates + coupon/realtime pricing beta | **Future** / Meta enablement |
| First-class Catalog Manager UI (create products in Meta from Samyoj) | Thin — sync/list, not full Commerce Manager replacement |
| Commerce settings (`is_cart_enabled` / `is_catalog_visible`) admin in Samyoj | Not a dedicated product surface found |
| India **business_compliance_info** wizard | Not a dedicated Samyoj module found |
| Auto-capture payment webhooks from Razorpay/PayU **for WhatsApp orders** | Not the same as SaaS `/api/billing/webhook` |
| Rename UX forever clear for Flow vs Meta Flow | Ongoing literacy debt (docs historically called Palerma Flow vs Meta Flow) |

### 5.3 Two Razorpays (Hinglish)

- **Samyoj plan Razorpay** = customer pays *Samyoj* for software.  
- **WhatsApp Payments deep integration Razorpay** = customer pays *merchant* inside WhatsApp for goods.  
*Kabhi mix mat karna pricing slide pe.*

---

## 6. Sonu ko kya samajhna hai (Hinglish bullets)

- Catalog Meta pe rehta hai; Samyoj sync karke Inbox/Commerce me dikhata hai — source of truth usually Commerce Manager.  
- Customer cart bhejta hai → Samyoj Order ban sakta hai; **paisa collect** alag step hai (`order_details` + Payments API).  
- Meta Flows = form-in-chat; NFM = us form ka jawab webhook pe.  
- Samyoj Flow Builder = automation tree; Forms/Meta Flow builder = alag cheez (`flows-assets`).  
- India me sell karna hai to **compliance info + commerce policies** pehle; warna SPM/MPM fail.  
- UPI Intent vs Deep PG: Deep = Razorpay/PayU/Billdesk/Zaakpay + richer WhatsApp-native status/refunds.  
- Checkout button templates India-focused; kuch features beta + Meta support email.  
- Ban/policy: galat products catalog me = Meta reject; spam marketing alag topic (`06-policy-bans`).  
- SaaS bill aur Meta message fees aur WhatsApp commerce payment — **teen alag duniya**.

---

## 7. Quiz (self-check)

**Q1.** Catalog Meta pe upload hota hai ya Samyoj Postgres pe first?  
**A1.** Meta (Commerce Manager / Commerce API) pe; Samyoj optionally **sync** karta hai local `CatalogProduct` rows ke liye.

**Q2.** `product_list` aur `catalog_message` me fark?  
**A2.** `product_list` = curated ≤30 SKUs in sections; `catalog_message` = full catalog browse CTA.

**Q3.** NFM ka full form? Kab aata hai?  
**A3.** Native Flow Message reply — user Meta Flow (ya address message etc.) complete kare to `interactive.type = nfm_reply`.

**Q4.** Samyoj `/api/flows` vs `/api/flows-assets`?  
**A4.** `/api/flows` = chat automation; `/api/flows-assets` = Meta WhatsApp Flows assets + publish + data endpoint + NFM.

**Q5.** India Payments API ke do models?  
**A5.** UPI Intent (any Intent-capable PG) vs Payment Gateway Deep Integration (Razorpay, PayU, Billdesk, Zaakpay per Meta docs).

**Q6.** `order_details` kya karta hai?  
**A6.** Interactive invoice / review-and-pay message so customer can pay in WhatsApp (region + config dependent).

**Q7.** Samyoj already auto-creates orders from inbound cart?  
**A7.** Haan — webhook path `createOrderFromInbound` (FEATURE_MATRIX: Order from inbound DONE).

**Q8.** Does Samyoj already run full India UPI deep payments end-to-end?  
**A8.** Nahi claim karo — order_status/payment_status notify + payload helpers exist; full payment_configuration + PG deep product = future.

**Q9.** Cart business bhej sakta hai customer ko?  
**A9.** Nahi — cart customer-side; business receives order webhook after submit.

**Q10.** `is_catalog_visible` default typically?  
**A10.** Docs: often **false** (storefront icon hidden) until you enable it.

**Q11.** Checkout button templates primarily for which market?  
**A11.** India businesses / India calling-code users (Meta payments-in docs; beta notes for coupons/realtime inventory).

**Q12.** Why India business compliance info matters?  
**A12.** Required for lawful online selling UX on WhatsApp for +91; missing info can block product messaging.

**Bonus:** Name one official URL for Payments API India.  
→ https://developers.facebook.com/docs/whatsapp/cloud-api/payments-api/payments-in/

---

## 8. Official URL checklist (copy into master guide Sources)

### Catalog / Commerce
1. https://developers.facebook.com/documentation/business-messaging/whatsapp/catalogs/catalogs-overview/  
2. https://developers.facebook.com/docs/whatsapp/cloud-api/guides/sell-products-and-services/  
3. https://developers.facebook.com/documentation/business-messaging/whatsapp/catalogs/set-commerce-settings  
4. https://developers.facebook.com/docs/whatsapp/cloud-api/guides/sell-products-and-services/set-commerce-settings/  
5. https://developers.facebook.com/documentation/business-messaging/whatsapp/catalogs/share-products  
6. https://developers.facebook.com/docs/whatsapp/cloud-api/guides/sell-products-and-services/share-products/  
7. https://developers.facebook.com/docs/whatsapp/guides/commerce-guides/share-products-with-customers/  
8. https://www.facebook.com/business/help/1104628230079278  
9. https://developers.facebook.com/docs/graph-api/reference/whats-app-business-account-to-number-current-status/business_compliance_info/  
10. https://business.facebook.com/commerce/ (Commerce Manager)

### Flows / NFM
11. https://developers.facebook.com/docs/whatsapp/flows/  
12. https://developers.facebook.com/documentation/business-messaging/whatsapp/flows  
13. https://developers.facebook.com/documentation/business-messaging/whatsapp/flows/guides/sendingaflow  
14. https://developers.facebook.com/docs/whatsapp/flows/guides/sendingaflow/  
15. https://developers.facebook.com/documentation/business-messaging/whatsapp/flows/guides/flowsapi  
16. https://developers.facebook.com/documentation/business-messaging/whatsapp/flows/guides/flowswebhooks  
17. https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/address-messages  

### Payments India
18. https://developers.facebook.com/docs/whatsapp/cloud-api/payments-api/payments-in/  
19. https://developers.facebook.com/documentation/business-messaging/whatsapp/payments/payments-in/overview.md  
20. https://developers.facebook.com/docs/whatsapp/cloud-api/payments-api/payments-in/upi-intent/  
21. https://developers.facebook.com/documentation/business-messaging/whatsapp/payments/payments-in/pg  
22. https://developers.facebook.com/docs/whatsapp/cloud-api/payments-api/payments-in/checkout-button-templates/  
23. https://business.facebook.com/direct-support/  

### Platform / webhooks adjacency
24. https://developers.facebook.com/docs/whatsapp/cloud-api/guides/set-up-webhooks/  
25. https://developers.facebook.com/documentation/business-messaging/whatsapp/about-the-platform  

### Internal Samyoj pointers (not Meta)
- `docs/audit/FEATURE_MATRIX.md` (Catalog / Commerce / WA Forms)  
- `docs/IDEA_INTERACTIVE_MESSAGES.md` (interactive catalog research; some “not implemented” lines are **stale** vs current modules)  
- `server/src/modules/catalog/`, `commerce/`, `flows-assets/`, `messages/interactive.ts`

---

## 9. Research caveats

- Meta docs move between `/docs/whatsapp/...` and `/documentation/business-messaging/whatsapp/...` — prefer the **documentation/business-messaging** URLs when both exist.  
- Third-party blogs (D2C playbooks) exaggerate “v24 native cart” marketing; treat **Meta docs** as source of truth.  
- `IDEA_INTERACTIVE_MESSAGES.md` Phase-3 “not implemented” catalog text is outdated relative to FEATURE_MATRIX + modules — use code for Samyoj truth.  
- Exact Meta message fees ≠ this leaf (see `04-pricing.md`).  

**Leaf complete when:** Hinglish summary + quiz + official URLs + honest Samyoj already/future split are in this file for master-guide merge.
