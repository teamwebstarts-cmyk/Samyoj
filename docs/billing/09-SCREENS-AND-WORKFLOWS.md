# 09 — Screens and workflows (TARGET)

Every commercial surface. CURRENT CODE noted where it already exists.

## 1. Screens

| Screen | Role | Purpose | Meta disclosure |
| --- | --- | --- | --- |
| **Marketing site / Pricing** | Public | Launch CTA, Starter/Growth/Pro/Enterprise, cadence toggle, Most Popular = Growth, GST exclusive | Footnote: Meta fees extra |
| **Signup** | Anyone | Creates org on **Launch trial**, not paid starter | — |
| **Billing** `/billing` | OWNER/ADMIN | Plan, cadence, usage estimate, invoices, payment method, cancel | Quality + Meta estimate + link WhatsApp Manager; **not** App ID/Secret |
| **Checkout** Razorpay modal | OWNER/ADMIN | Mandate | Amount incl or excl GST — match [05](05-PAYMENTS-RAZORPAY.md) |
| **Invoices** | OWNER/ADMIN | PDF list | SaaS only |
| **Team** | ADMIN | Seats used/limit | Unlock Growth at cap |
| **WhatsApp Connect** | ADMIN | OAuth / Embedded Signup | Third-party; add **Meta** card; 1/2/5 slots |
| **Inbox** | Agents | Send/receive | Composer 24h lock is **Meta CSW**, not plan. Quality banner. |
| **Campaigns** | ADMIN | Broadcasts | Opt-in + estimate ≠ Meta invoice |
| **Automations** | ADMIN | Workflow cap | Unlock Growth |
| **AI** | Entitled | Copilot/bots | Ancillary AI; not Meta Business Agent |
| **Calling** | Entitled | Place/receive | Meta minutes extra; user-initiated free |
| **Content Studio** | Entitled | Generation caps | — |
| **Settings** | ADMIN | GSTIN, billing email | — |

CURRENT: Billing page + Checkout exist. No invoices, no trial, no cadence, Connect does not check slots, QualityRatingBanner → `/billing` only.

## 2. Journeys

### 2.1 Start free trial

Landing → Start free trial → signup → Launch 14d → empty Inbox → Connect WhatsApp (1 slot) → optional Meta card warning → send test.

### 2.2 Unlock Growth

Hit AI / 2nd number / 6th workflow / 4th seat → modal **Unlock Growth** (quarterly default) → Checkout → entitlements immediate.

### 2.3 Campaign send

Select template (marketing) → audience → **cost estimate + “Meta bills delivered templates”** → opt-in confirm → send. Quality RED: extra confirm or block.

### 2.4 Failed renewal

Banner on all ADMIN pages → Update payment → Razorpay → `charged` → banner clear.

### 2.5 Connect extra number

Growth/Pro only. Starter: paywall. Meta may allow 20 numbers; we still gate.

## 3. Copy snippets (required)

Connect: “Samyoj is not WhatsApp. Template and (from 1 Oct 2026) service messages are charged by Meta to your WhatsApp Business Account. Add a payment method in WhatsApp Manager.”

Pricing: “₹2,499/mo + GST. Meta WhatsApp fees extra.”

Quality banner: “Meta quality rating — open WhatsApp Manager. Upgrading Samyoj does not change this rating.”

## 4. What never appears in UI

Meta App ID, App Secret, `.env`, “Advanced override,” “We pay Meta for you,” WhatsApp trademark as our product name.
