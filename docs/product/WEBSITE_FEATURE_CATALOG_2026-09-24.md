# Samyoj feature catalog (website copy)

**Date:** 24 Sep 2026  
**Use:** marketing site, product pages, “what we offer” lists.  
**Honesty rule:** only the rows marked **In the product** may be sold as available today. Rows marked **Planned** are research and roadmap, not a promise. **Internal testing** means the code runs on a test deploy (`bash start.sh`). It is **not** customer production.

Customer production is still **no**: a new WhatsApp reply has not been proven on the customer host, restore has not been drilled on that host, Razorpay Subscriptions (TARGET) are not shipped, live call transfer is a stub, and Facebook / Instagram / Ads live events are blocked until Meta App Review and a published app.

Sources: product navigation, `docs/memory/STATUS_AND_FUTURE.md`, `docs/meta-ecosystem/STATUS_SIMPLE.md`, phase specs 0–7.

---

## 1. WhatsApp Business (Cloud API)

These are the WhatsApp surfaces in the app today.

| Feature | What it is | Website status |
|---|---|---|
| Connect WhatsApp | Facebook login, pick the business number. No App ID or App Secret in the customer UI. | In the product |
| Number workspace | Contacts, inbox, campaigns, and consent stay on that WhatsApp number. Disconnect is soft; history stays. | In the product |
| Shared inbox | Team inbox for customer chats, assignment, notes, canned replies, search, unread/open/pending. | In the product |
| 24-hour service window | Free-form replies only inside Meta’s customer-care window. Outside it, an approved template is required. | In the product |
| Media messages | Image, document, audio, and video in the thread, within Meta limits. | In the product |
| Message templates | Create, submit to Meta, track approval, send from inbox and campaigns. Library of starter templates the business submits on its own number. | In the product |
| Interactive messages | Buttons, lists, and call-permission cards where the Cloud API allows them. | In the product |
| Broadcast campaigns | Approved-template sends to opted-in contacts, schedule, repeat, retry failed, and a follow-up if they do not reply. Fail-closed if consent is missing. | In the product |
| Click-to-WhatsApp context | When Meta sends an ad click into a WhatsApp chat, the thread can show that it came from an ad. | In the product (code). A real ad click on this host is still unproven. |
| WhatsApp calling | In-app call list, recents, AI voice on calls (Sarvam speech), post-call summary in the thread. | In the product (internal test) |
| Live agent transfer on a call | Hand the live WebRTC call to another human. | Planned only. The control is a stub. Do not advertise. |
| Commerce orders | Order thread and status messages. | Built, **hidden** from the main sidebar. Do not lead the website with it. |

## 2. CRM (shared across channels)

| Feature | What it is | Website status |
|---|---|---|
| Contacts | Name, phone, tags, custom fields, import. WhatsApp contacts are unique per organization and number. | In the product |
| Consent | Opt-in source and time required before campaign send. Opt-out blocks broadcasts. | In the product |
| Pipeline / leads | Lead stages from new through won/lost. Meta Instant Form leads are a separate source when the Page webhook works. | In the product for manual and WhatsApp-linked leads. Meta form ingest is code-ready, live delivery blocked. |
| Automations | Welcome, away, business-hours, and keyword rules, plus a visual flow (message, buttons, delay, handoff). Test-send and jump-to-step from the inbox. | In the product (Phase B). The later journey phase (Phase C) is not built. |
| WhatsApp Forms | Meta Flow forms you design and send inside a chat. | In the product. This is not a website form builder, and it is not Instagram or Facebook posts. |
| AI chat bot | Separate bot for WhatsApp chat: personality, knowledge, on/off per conversation. | In the product |
| AI calling bot | Separate bot for phone calls. Not the same row as the chat bot. | In the product |
| Tickets | Support tickets from the workspace. | In the product |
| Team | Owners, admins, agents. Invite and roles. | In the product |
| Account security | Change password, turn on an authenticator, and sign out other sessions from Settings → Security. | In the product |
| Dashboard | Connection status, message counts, campaigns, quick actions. | In the product |
| Analytics | Two columns: Meta’s last-7-day ad numbers, and your Instant Form pipeline (qualified, won, amount). Missing amount shows “—”, not ₹0. | In the product (code). Left column stays empty until Ads read is live. Do not call this ROI. |
| Settings → Channels | One settings screen for the WhatsApp number, Facebook Page, and Instagram account. Disconnect is soft. Inboxes stay separate. | In the product |
| Billing & usage | Plan cards (Kickstart through Enterprise), usage meters, and one-time AI top-ups when Razorpay is configured. A monthly/quarterly/yearly toggle is on the page. Recurring subscription checkout, dunning, and GST tax invoices are not live. | In the product as **manual billing**. Do not say “subscribe yearly” or “GST invoice on autopilot.” |
| Reports / ROI | A single “rupees earned from ads” number. | **Not built.** Do not put ROI on the website. |
| Content Studio | A drafting screen exists in the codebase. | Hidden from the sidebar. Do not list it on the website, and do not call it a social publisher. |

## 3. Facebook

| Feature | What it is | Website status |
|---|---|---|
| Connect a Facebook Page | OAuth, pick the Page. Tokens stay on the server. | In the product. Live grant of Page permissions is still a Meta app issue (Invalid Scopes until use cases are approved). |
| Messenger inbox | Page messages in their own inbox, not mixed into WhatsApp. Text replies inside the 24-hour window. | In the product (code). Real Page messages are not proven while the app is unpublished and scopes are rejected. |
| Lead Ads | Instant Form submission becomes a lead in the pipeline, with Meta lead id. No fake phone number. | In the product (code). Live form delivery needs Page webhook + `leads_retrieval`. |
| Ads performance (read) | Last 7 days from Meta: spend, impressions, clicks, leads, cost per lead. Label: 7-day click / 1-day view. Link out to Ads Manager. | In the product (code). Tiles appear only after a real ad account is shared and `ads_read` works. No ₹0 chart when there is no account. |
| Create, pause, or edit ads | Full Ads Manager inside Samyoj. | **Not offered.** Customers use Meta Ads Manager. Do not request or advertise `ads_management`. |

## 4. Instagram

| Feature | What it is | Website status |
|---|---|---|
| Page-linked Instagram | Professional account connected through the Facebook Page, not a separate Instagram-only login. | In the product (code). Needs a linked professional account and Instagram permissions on the Meta app. |
| Instagram inbox | Direct messages, 24-hour window, no WhatsApp templates on Instagram. | In the product (code). Real DMs are blocked until the Meta app is published and webhooks deliver. |
| Comments | Comment list, hide, one private reply within 7 days. A 24-hour chat starts only after the person replies in DMs. | In the product (code). Same live-delivery block. |
| Comment keyword automation | Keyword rule that runs only on Instagram, not on WhatsApp. | In the product (code). |
| Posts, Reels, stories | Publishing or a content calendar. | **Not in plan for this release.** Do not list them. |

## 5. Ads (how to talk about it)

Samyoj does **not** replace Ads Manager.

Say this:

- See last-7-day ad results next to the Page you connected.
- Open Ads Manager to create or change campaigns.
- Meta’s ad bill stays on the customer’s WhatsApp Business account. It is not folded into the Samyoj software price.

Do not say:

- “We run your ads.”
- “Guaranteed ROI.”
- “₹0 spend” when no ad account is connected.

**Still not a website promise:**

- Recurring subscriptions, dunning, and GST tax invoices (SAMYOJ-35).
- Live call transfer.
- Posts, Reels, and an in-app Ads Manager.
- A single ROI number. Click-to-WhatsApp chats do not count as pipeline unless a lead exists.

## 6. Platform (operator, not the customer site)

Platform Admin (`admin/`, port 3001) is for Samyoj operators: organizations, template catalog publishing, audit. It is not a customer feature. Impersonation and WhatsApp outreach from admin are not in the first release. Do not market the admin console as a customer product.

## 7. Safe website sentences

Use:

- “WhatsApp inbox, templates, campaigns, and consent in one workspace.”
- “AI for chat and a separate AI for calls.”
- “Facebook Messenger, Instagram DMs, and comment replies in their own inboxes.”
- “Read your Meta ad results. Create ads in Ads Manager.”

Do not use until the live tests in the checklist pass:

- “Customers’ replies already land in production.”
- “Instagram and Facebook are live for every business.”
- “Subscriptions and GST invoices are automated.”
- “Transfer a live call to an agent.”
- “See exact revenue from each ad.”
