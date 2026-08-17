# Platform admin console (SAMYOJ-57)

**Status (2026-08-17):** First release is **in code** for internal test-deploy. Customer production is still **no**.  
**Date:** research 2026-08-16; shipped 2026-08-17.  
**Jira:** [SAMYOJ-57](https://teamwebstarts.atlassian.net/browse/SAMYOJ-57) — comment on this ticket; do not file a sibling.  
**Relates:** [SAMYOJ-56](https://teamwebstarts.atlassian.net/browse/SAMYOJ-56) STT/TTS ledger honesty still open, [SAMYOJ-35](https://teamwebstarts.atlassian.net/browse/SAMYOJ-35) billing TARGET not shipped, [SAMYOJ-3](https://teamwebstarts.atlassian.net/browse/SAMYOJ-3) customer cookies (do not mix).  
**Older stub:** `docs/product/CALLS_AI_USAGE_ADMIN_2026-08-16.md` §4.

This is **not** the customer Dashboard (`/`). It is a **Samyoj operator** product: how *our paying/trial orgs* use Samyoj, where they get stuck, what Meta errors they hit, how much AI they burn, and whether they paid. End WhatsApp customers of those orgs stay out of this console.

## Shipped vs remaining (2026-08-17)

| Shipped (test-deploy) | Still remaining |
|-----------------------|-----------------|
| Additive migration `20260817003000_platform_schema_auth` (apply with `npm run db:migrate-startup-safe`, never raw `prisma migrate deploy` on a path that would hit `20260808120000`). Outreach `LOGGED` status is `20260817120000`. | [SAMYOJ-35](https://teamwebstarts.atlassian.net/browse/SAMYOJ-35) TARGET Razorpay Subscriptions / GST / dunning. Admin shows **current** plan, expiry, `PaymentOrder`, extend/comp only. |
| `/api/platform/*`: cookie session, CSRF, TOTP when `PLATFORM_MFA_REQUIRED` is true (production default; skippable in development), RBAC (`SUPER_ADMIN` / `SUPPORT` / `ANALYST`). Org JWT cannot call these routes. Pending TOTP secret is reused until enroll or explicit reset. | [SAMYOJ-56](https://teamwebstarts.atlassian.net/browse/SAMYOJ-56) STT/TTS coverage is still under-logged. Admin rolls up `AiUsageLog` honestly — do not claim listening/speaking units are complete. |
| Tenant `GET /api/ops/recent-errors` **removed** (404). Meta errors live under platform only, including Graph delivery-status failures. | Impersonation / “view as org” — **not built**, not this release. |
| `admin/` Vite app on `:3001` (`PLATFORM_ADMIN_URL`). `bash start.sh` launches it. | WhatsApp outreach to the business number — **not built**. Email templates only. |
| Overview, accounts (AI % of cap + numbers), AI caps/flags (ANALYST read-only), current billing, Meta error aggregates, operators/sessions (`current` = this session), audit, email outreach with 7/14/30-day aging | Send kill switch — **not built**. |
| CLI `cd server && npm run platform:bootstrap-operator` (password via `PLATFORM_OPERATOR_PASSWORD` only; `--password` is rejected). First operator is `SUPER_ADMIN`. Locked after any operator exists. | Real mailbox still needs `SMTP_HOST`. Unset SMTP stores **LOGGED**, never SENT. |
| SMTP honesty, session `current` = this session id, ANALYST read-only flags, webhook delivery-status MetaErrorStat, AI coverageNote on the account AI tab | Privacy-policy sentence for account telemetry — docs only until counsel ships copy. |

**Do not expand this ticket into** impersonation, WhatsApp outreach, or TARGET subscriptions.

### Bootstrap an operator and open admin

1. `bash start.sh` (API `:8000`, customer UI `:3000`, admin `:3001`).
2. Create the first operator (once):

```bash
cd server
PLATFORM_OPERATOR_PASSWORD='ChooseAStrongPass1' npm run platform:bootstrap-operator -- --email you@samyoj.com
```

Password rules: 8+ characters, upper + lower + number, not a common password. Do not pass `--password` on the command line.

3. Open `http://localhost:3001`. Sign in with that email/password. Local/dev defaults `PLATFORM_MFA_REQUIRED=false`, so password login is enough (no authenticator). Production (or the flag set true) still requires TOTP enrollment on first login, then a 6-digit code later.
4. Optional: `cd server && npm run platform:backfill-telemetry` to snapshot existing orgs.

---

## 1. One sentence

A separate, dark-ops console where Samyoj staff see **org-level** health (login → Connect WhatsApp → first contact → first send → AI → paid), can email or WhatsApp **the business owner**, can cap AI tokens and flip feature flags, and can cluster **Meta Cloud API error codes** — without opening Inbox threads or storing customer chat.

---

## 2. What already exists (do not reinvent)

| Layer | Today | Use for admin? |
|-------|--------|----------------|
| Jira | SAMYOJ-57 In Progress; first-release comment 2026-08-17 | Parent ticket. Do not file a sibling. |
| Customer UI | Dashboard, Reports, Billing, Inbox, Calls, Campaigns, AI Bot, Settings | **Never** mount admin here. |
| Auth | JWT in `sessionStorage` (SAMYOJ-49). `User.role` `ADMIN`/`AGENT` is the **org founder**, set on register (`auth/routes.ts`). `OrgRole` OWNER/ADMIN/SUPERVISOR/AGENT. | **Cannot** reuse `User.role = ADMIN` as platform staff. |
| Membership | `OrganizationUser.lastActiveAt` on login + availability ping | Last-seen for *agents inside an org*. |
| Analytics API | `/api/analytics/overview` number-scoped, `authenticate + requireOrg` | Org Reports only. Admin needs **cross-org roll-up**, new routes. |
| AI ledger | `AiUsageLog` + `recordAiUsage`. Named actions exist (`ai-usage-actions.ts`) but STT/TTS still under-logged (SAMYOJ-56). `monthlyTokenLimit` in `Organization.settings.ai`. | Roll up per org. Admin **writes** the limit. |
| Billing CURRENT | `Organization.plan`, `planExpiresAt`, `subscriptionStatus`. Razorpay **Orders** one-shot. | Show as-is. Do **not** implement TARGET Subscriptions here (SAMYOJ-35). |
| Meta usage poll | `pollConversationAnalytics` → `ConversationCharge`. `pollQualityRatings` → `WhatsappNumber.qualityRating`. | Surface GREEN/YELLOW/RED + category counts. Cost is **Meta’s**, never fold into SaaS. |
| Feature flags | `OrgFeatureFlag` + `KNOWN_FEATURE_FLAGS` (content_studio, calling, commerce, public_api, …) | Admin can enable/disable per org. |
| Audit | `AuditLog` (org, sparse), `TeamAuditLog` (team actions) | Incomplete. New `PlatformAuditLog` for operator writes. |
| Stub ops | `GET /api/ops/recent-errors` | **Removed (2026-08-17).** Org JWTs get 404. Replacement is `/api/platform/errors` (operators only). |
| PII | `redactText` on ops error file | Keep redaction. Platform APIs must not return `wa_id`, `wamid`, tokens, or message bodies. |

**Shipped 2026-08-17:** separate `admin/` SPA, `PlatformOperator` + session/audit/telemetry tables, allowlisted `ProductEvent` stream. Research rows below are the original 2026-08-16 inventory.

---

## 3. Two products, two logins

```
Customer Samyoj          Platform Samyoj
app.samyoj.com           admin.samyoj.com   (local: :3000 / :3001)
Org JWT (sessionStorage) HttpOnly platform cookie + CSRF + TOTP
Org Dashboard            Operator console
Sees own Inbox           Never sees Inbox threads
Pays SaaS + Meta         Sees who paid / who stalled
```

**UI rule:** customer chrome (sidebar Inbox/Campaigns) never appears on admin. Admin chrome never appears for orgs. Different origin preferred so a stolen org JWT cannot call `/api/platform/*`.

**Auth rule:** platform operators are **not** `OrganizationUser` rows. Login is email + password; Google SSO was not in this release. MFA (TOTP) is required when `PLATFORM_MFA_REQUIRED` is true (production default; off by default in `NODE_ENV=development`). Session is an HttpOnly `SameSite=Strict` cookie while the customer app stays on SAMYOJ-49 `sessionStorage`.

---

## 4. Privacy — hard rules (WhatsApp TOS + DPDP + existing ticket)

User asked to track “without them seeing a creepy analytics page” and “without their personal stuff.” That is **operator-only UI**, not invisible illegal surveillance.

| Allowed (org / operator of Samyoj) | Forbidden |
|------------------------------------|-----------|
| Org company name, billing email, plan | WhatsApp **end-customer** names, phones, message bodies, transcripts, call recordings |
| Which Samyoj **screens/APIs** the org used (Inbox opened, campaign sent) | Meta access tokens, App Secret, `.env` |
| Counts: contacts, conversations, campaigns, calls, AI tokens | Reading a specific chat “to see how they talk” |
| Meta **error code** + count (131047 × 12) | Full Graph JSON with `wa_id` / `wamid` |
| Quality rating GREEN/YELLOW/RED | Building a marketing profile of WhatsApp users (Business Solution Terms / AI Providers) |
| Email the **registered user** | Email/WhatsApp their *customers* from this console |

Disclose in Samyoj privacy policy: we process **account telemetry** (logins, feature use, error codes, token counts) to run and support the service. Do not hide it from counsel. Do hide it from the **customer Dashboard** (no “Samyoj is watching you” widget).

India **DPDP Act 2023**: Samyoj is Data Fiduciary for *our* user accounts; Data Processor for *their* WhatsApp contacts. Admin telemetry is our fiduciary purpose (support, abuse, billing). Do not train models on customer chats. Do not ship Mixpanel with message text.

---

## 5. Activation funnel (the “secret club” — org stages)

Compute from existing tables. No extra PII.

| Stage | Signal (already in Postgres) | Outreach |
|-------|------------------------------|----------|
| **S0 Registered** | `User` + `Organization` exist | Welcome / setup mail |
| **S1 Logged in, no WhatsApp** | No `WhatsappNumber` with `isActive=true` | Mail: Connect WhatsApp. This is the **term/outreach queue**. |
| **S2 Connected, empty book** | Active number, `Contact` count = 0 | Mail: add first contact / CSV |
| **S3 Contacts, never sent** | Contacts > 0, no OUTBOUND `Message` | Mail: send a template / Inbox |
| **S4 Sent, no inbound** | Outbound > 0, inbound = 0 | Infra vs product: may be SAMYOJ-2 webhook, not laziness |
| **S5 Live inbox** | Inbound > 0 | Healthy. Watch quality + AI. |
| **S6 AI unused** | Live inbox, `AiUsageLog` empty 14d | Mail: turn on AI Bot |
| **S7 Paid / trial / expired** | `plan` + `planExpiresAt` + `PaymentOrder` | Billing queue |
| **S8 Quality risk** | `qualityRating` YELLOW/RED | Ops + mail: WhatsApp Manager, not “upgrade Samyoj” |

Show a **Kanban or table** of orgs by stage. Clicking a row opens the org file (section 8). Never deep-link into their Inbox.

---

## 6. What to track (product telemetry)

Emit **coarse events** from the API (not every Express hit). Group by product area.

| Area | Events (name only) |
|------|---------------------|
| Auth | `login_ok`, `login_fail`, `register`, `invite_accept` |
| Connect | `whatsapp_oauth_start`, `whatsapp_connected`, `whatsapp_disconnect` |
| Inbox | `inbox_open`, `message_out`, `message_in` (counts, not bodies) |
| Contacts | `contact_created`, `csv_imported` |
| Campaigns | `campaign_draft`, `campaign_sent`, `campaign_failed` |
| Automations | `flow_published`, `automation_ran`, `automation_error` |
| Calls | `call_started`, `call_ended`, `call_failed` |
| AI | `ai_chat`, `ai_call`, `stt`, `tts`, `embed` (via `AiUsageLog`) |
| Billing | `checkout_start`, `payment_ok`, `payment_fail` |
| Templates | `template_sync`, `template_rejected` |

Storage: `ProductEvent(organizationId, userId?, area, name, at, meta Json?)` where `meta` is **enums/counts only** (`{ templateStatus: "REJECTED" }`), never phones.

Daily roll-up `OrgHealthSnapshot` (stage, lastLoginAt, counts, aiTokensMonth, quality, plan) so the home list is cheap.

**Customer-facing Reports** stay number-scoped and honest. Admin sees the same numbers **plus** cross-org comparison. Do not show admin charts inside Settings.

---

## 7. Meta Cloud API — what we actually have vs what Graph offers

### 7.1 Already in Samyoj

- Send path maps **131047** CSW (`META_CSW_ERROR_CODE`).
- Graph errors parsed in `meta.service.ts` / `meta-calling.service.ts`.
- Quality polled onto `WhatsappNumber.qualityRating`.
- Conversation analytics polled into `ConversationCharge` (category, count, cost).
- Webhook durability `ProviderWebhookEvent` (claim/complete).
- Public webhook health: counters only (no URL, no lastError) — correct for the internet.

### 7.2 Official Graph we should **read** (not invent)

- Phone: `GET /{phone-number-id}?fields=quality_rating,…` ([phone numbers](https://developers.facebook.com/docs/whatsapp/cloud-api/phone-numbers/)).
- WABA: `conversation_analytics` + `analytics` (sent/delivered) — [BM API analytics](https://developers.facebook.com/docs/whatsapp/business-management-api/analytics/). Granularity HALF_HOUR / DAILY / MONTHLY. Breakdowns: category, direction, country, phone. **Cost** may be hidden if billed via a Solution Partner.
- Error catalog: [Error codes](https://developers.facebook.com/documentation/business-messaging/whatsapp/support/error-codes) — especially `130429` throughput, `131026` undeliverable, `131047` re-engage, `131048` spam/quality, `131049` marketing cap, `131056` pair rate.
- Pricing stays a **second ledger** ([pricing](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing)). Admin may show “Meta category volume” never “included in ₹ plan”.

### 7.3 New table: Meta error aggregates

On failed send / webhook status error:

`MetaErrorStat(organizationId, whatsappNumberId, code, count, lastAt, sampleTitle)`  

Admin **Errors** page: top codes this week, orgs hitting 131048, link to official meaning. Sample title = Meta’s short message, **redacted**, no recipient id.

Do not store full webhook payloads in admin (they contain `wa_id`).

---

## 8. Screens (operator UI)

Visual language: dense, calm, **not** the mint customer Dashboard. Same Plus Jakarta / Inter tokens, more table, less illustration. Meaningful over pretty: every widget is a **queue or a number that implies an action**.

### 8.1 Home

- Funnel counts S0–S8 (click → filtered list).
- “Needs a human today”: no WhatsApp 48h, payment failed, quality RED, AI 429, 131048 spike.
- Meta error heatmap (code × count).
- AI tokens this month vs cap (platform sum + top orgs).

### 8.2 Accounts

Searchable table: company, owner email, stage, last login, plan, quality, AI % of cap, numbers connected. Row → Account file.

### 8.3 Account file (one org)

Tabs:

1. **Overview** — stage timeline, last login, seats (`OrganizationUser` count).
2. **Product** — feature adoption bars (Inbox / Campaigns / Calls / AI / Automations / Templates). “Never used Calls.”
3. **WhatsApp** — numbers (display only, **masked** middle digits), `isActive`, quality, messaging limit if we store it, last inbound/outbound **counts**.
4. **AI** — `AiUsageLog` roll-up by action (chat_bot, calling_llm, stt, tts, …). Editor: `monthlyTokenLimit`, optional hard-disable AI (`settings.ai.enabled`). Relates SAMYOJ-56 completeness.
5. **Billing** — CURRENT `plan`, expiry, last `PaymentOrder`. TARGET later: Razorpay Subscription id, GST invoices, dunning (SAMYOJ-35). Toggle: extend trial / mark complimentary — **audit log required**.
6. **Errors** — Meta codes + ops errors for this org only (after we scope them).
7. **Outreach** — log of emails/WhatsApp **to the owner**.

**Never:** conversation list, message preview, contact CSV download of *their* customers.

### 8.4 Outreach queue (“term panel”)

Name in UI: **Outreach**, not “secret club”.

Queues:

- Logged in, WhatsApp not connected (7 / 14 / 30 days).
- Connected, 0 contacts.
- Trial ending / payment failed.
- Quality YELLOW/RED.

Actions: send **email** to `User.email` (nodemailer already in stack; SMTP may be missing in dev). After Connect: optional **template to their business number** only if they opted into *Samyoj product* mail — never blast their contact book.

Templates are ours (onboarding), not Meta marketing to their leads.

### 8.5 AI control (platform)

- Global Sarvam/Azure stay in `.env`.
- Per-org: token cap, disable chat AI, disable calling AI (`aiAutoAnswer` already exists for calling — admin can flip it).
- Do not paste customer prompts into this screen.

### 8.6 Billing control

Phase 1: view + expire/extend + record “comped until”.  
Phase 2 (SAMYOJ-35): Subscriptions, GST, dunning. Admin becomes the place to pause for non-pay.

Two ledgers always: Samyoj ₹ vs Meta WABA.

### 8.7 Operators

List of platform staff. Add/revoke. Every write in `PlatformAuditLog`.

---

## 9. Backend & database (how it plugs into today)

### 9.1 New API

`/api/platform/*` — `authenticatePlatform` only. No `requireOrg`. No `X-WhatsApp-Number-Id`.

Suggested routes:

- `GET /api/platform/overview`
- `GET /api/platform/orgs?stage=&q=`
- `GET /api/platform/orgs/:id`
- `GET /api/platform/orgs/:id/ai`
- `PATCH /api/platform/orgs/:id/ai` `{ monthlyTokenLimit, chatEnabled, callingEnabled }`
- `PATCH /api/platform/orgs/:id/flags`
- `PATCH /api/platform/orgs/:id/billing` `{ planExpiresAt, note }`
- `GET /api/platform/errors`
- `POST /api/platform/orgs/:id/outreach` `{ channel: "email", templateId }`
- `POST /api/platform/auth/login`

Delete or lock `GET /api/ops/recent-errors` until it is org-scoped **or** platform-only.

### 9.2 New tables (sketch)

```
PlatformOperator  id, email, passwordHash, mfa, disabledAt
PlatformSession   operatorId, tokenHash, expiresAt
ProductEvent      organizationId, userId?, area, name, at, meta Json?
OrgHealthSnapshot organizationId, stage, lastLoginAt, counts Json, capturedAt
MetaErrorStat     organizationId, whatsappNumberId?, code, count, lastAt, sampleTitle
PlatformAuditLog  operatorId, action, organizationId?, before Json, after Json, at
OutreachLog       organizationId, channel, template, at, operatorId
```

Do **not** copy `Message` / `Contact` into admin tables.

### 9.3 Client

New Vite app `admin/` **or** `client/src/pages/platform/*` behind a host check. Prefer **separate app** so customer bundle never contains operator routes.

Reuse: `AppButton`, density tokens, Inter/Jakarta. Do not reuse Inbox components.

### 9.4 Jobs

- Nightly snapshot of stages.
- Existing quality + conversation analytics polls stay.
- Aggregate Meta error codes from send failures (new hook in `messages/send.service.ts`).

---

## 10. Competitor / operator patterns (what to copy)

| Source | Copy | Do not copy |
|--------|------|-------------|
| **360dialog Partner Hub** | Per-client channel status, usage vs Meta invoice, voice KPIs, Partner API | Invoicing Meta ourselves unless we become Solution Partner |
| **Wati** | Role-gated analytics vs credits; number switcher | Silent Meta credit markup |
| **Interakt / AiSensy / Gallabox** | India SMB onboarding nag (connect WA) | Forever-free confusion |
| **Gupshup / Bird / Twilio** | Pass-through Meta, usage dashboards | Mixing CPaaS + SaaS price |
| **Stripe Dashboard / Chargebee** | Customer file + payments + dunning | Card data in our DB |
| **Intercom / Zendesk admin** | Teammate vs end-user distinction | Reading every ticket as “analytics” |
| **Mixpanel / Amplitude / PostHog** | Event names, funnels, activation | Session replay of Inbox |
| **Gainsight / Vitally / health-score blogs** | Weighted health, playbooks on stage | Fake “Health score” on **customer** Dashboard (already removed SAMYOJ-51) |
| **Meta WhatsApp Manager** | Quality, limits, template quality | Sending operators into WAM for secrets; we deep-link, we don’t clone App Secret UI |
| **Respond.io / Trengo / Freshchat** | Inbox product analytics for **the customer**; we only roll up | Per-agent spy on chat text |

Activation research (PQL / health scores): login frequency + core action (here: **Connect + first outbound**) beats vanity DAU. First-week Connect is the drop-off we can actually email.

---

## 11. Suggested extras (worth adding)

1. **Impersonation** — “View as org” read-only, 15 min, audit log, banner. High risk; Phase 2 only.  
2. **Kill switch** — disable sending for an org (abuse / 131048).  
3. **Template reject reasons** — Graph template status roll-up.  
4. **Webhook freshness** — last inbound at per number (helps SAMYOJ-2 without public URL leak).  
5. **Seat vs plan** — `OrganizationUser` count vs TARGET seat caps.  
6. **Duplicate Meta phone** — 409 cross-org (SAMYOJ-49) visible to support.  
7. **Status page snippet** — platform-wide `totalReceived` / Graph 5xx. Not customer-identifying.

---

## 12. Build order

| Phase | Status | Notes |
|-------|--------|-------|
| **A** | **Shipped** | `PlatformOperator` + `admin` app + funnel stages + cookie/CSRF/TOTP/RBAC |
| **B** | **Shipped** (honest gap) | Account file, quality, counts, AI roll-up + token cap. STT/TTS units still SAMYOJ-56. |
| **C** | **Shipped API/UI** | Email templates to org OWNER only. Real send needs `SMTP_HOST`. |
| **D** | **Shipped** | `ProductEvent` + `MetaErrorStat` + Errors home |
| **E** | **Partial** | Current billing view + extend/comp. TARGET subscriptions = SAMYOJ-35. |
| **F** | **Not this release** | Impersonation / kill switch |

Customer production still **no** until SAMYOJ-3. Admin is on the same test-deploy (`bash start.sh` → `:3001`).

---

## 13. Done when (implementation)

- Separate host or app; org JWT cannot call platform APIs. **Done** (`admin/` + origin-gated `/api/platform`).  
- Funnel stages from real tables. **Done** (REGISTERED → LIVE + independent flags).  
- No message bodies / customer phones in admin DB or UI. **Done** as a contract (tests + redaction).  
- AI cap editable per org; usage visible. **Done** (SAMYOJ-56 STT/TTS still incomplete).  
- Meta error codes clustered. **Done**.  
- Outreach to **owner email**. **Done** as templates; unset SMTP stores LOGGED (never SENT). A real mailbox still needs `SMTP_HOST`.  
- `/api/ops/recent-errors` no longer leaks other tenants. **Done** (route removed).  
- Privacy policy sentence exists. **Not shipped** (counsel copy).  
- Do **not** mark SAMYOJ-57 customer-production Done. Test-deploy first release is in code; 35 / 56 ledger / impersonation / WhatsApp outreach remain. SMTP honesty (no fake SENT) is in code.

---

## 14. Sources (50+)

Official Meta / WhatsApp first, then BSP hubs, SaaS ops, privacy, then our repo.

### Meta / WhatsApp (1–23)

1. [Cloud API error codes](https://developers.facebook.com/documentation/business-messaging/whatsapp/support/error-codes)  
2. [BM API analytics / conversation_analytics](https://developers.facebook.com/docs/whatsapp/business-management-api/analytics/)  
3. [Analytics (business-messaging)](https://developers.facebook.com/documentation/business-messaging/whatsapp/analytics/)  
4. [WABA analytics Graph reference](https://developers.facebook.com/docs/graph-api/reference/waba-analytics/)  
5. [Visualize WhatsApp metrics](https://developers.facebook.com/blog/post/2022/12/19/visualize-whatsapp-metrics/)  
6. [Phone numbers / quality_rating](https://developers.facebook.com/docs/whatsapp/cloud-api/phone-numbers/)  
7. [Phone numbers reference](https://developers.facebook.com/docs/whatsapp/cloud-api/reference/phone-numbers/)  
8. [Messaging limits](https://developers.facebook.com/docs/whatsapp/messaging-limits/)  
9. [Upcoming messaging limits](https://developers.facebook.com/documentation/business-messaging/whatsapp/upcoming-messaging-limits-changes/)  
10. [Pricing (PMP)](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing)  
11. [Calling API pricing](https://developers.facebook.com/docs/whatsapp/cloud-api/calling/pricing/)  
12. [Webhooks](https://developers.facebook.com/docs/whatsapp/cloud-api/guides/set-up-webhooks/)  
13. [Send messages / CSW](https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages/)  
14. [Tech Provider vs Solution Partner](https://developers.facebook.com/docs/whatsapp/solution-providers/)  
15. [Embedded Signup](https://developers.facebook.com/docs/whatsapp/embedded-signup/)  
16. [Platform changelog](https://developers.facebook.com/docs/whatsapp/business-platform/changelog/)  
17. [WhatsApp Business Terms](https://www.whatsapp.com/legal/business-terms/)  
18. [Business Solution Terms](https://www.whatsapp.com/legal/business-solution-terms/)  
19. [Service Provider terms](https://www.whatsapp.com/legal/business-terms-for-service-providers/)  
20. [Business Policy](https://www.whatsapp.com/legal/business-policy)  
21. [Messaging guidelines](https://www.whatsapp.com/legal/messaging-guidelines)  
22. [Throughput (related to 130429)](https://developers.facebook.com/documentation/business-messaging/whatsapp/support/error-codes)  
23. [Get started / webhooks sample](https://developers.facebook.com/documentation/business-messaging/whatsapp/get-started)

### BSP / inbox competitors (24–38)

24. [360dialog Partner Hub usage](https://docs.360dialog.com/partner/partner-hub/checking-usage-and-statistics)  
25. [360dialog Partner API](https://docs.360dialog.com/partner/partner-api/overview)  
26. [360dialog error list](https://docs.360dialog.com/docs/support/api-error-message-list)  
27. [Wati Team Inbox analytics](https://support.wati.io/en/articles/11463148-how-to-use-team-inbox-analytics-in-wati)  
28. [Wati credit usage](https://support.wati.io/en/articles/11463000-how-to-check-credit-usage-history)  
29. Interakt public pricing / inbox (India)  
30. AiSensy public pricing  
31. Gallabox public pricing  
32. DoubleTick / Helpwise packaging  
33. Respond.io WhatsApp (no Meta markup claim)  
34. Trengo / Tidio conversation pricing (anti-pattern for us)  
35. Freshchat / Zendesk WhatsApp add-ons  
36. Gupshup / Bird CPaaS dashboards  
37. Twilio WhatsApp pricing (pass-through)  
38. Yellow.ai / LeadSquared (enterprise AI + CRM)

### SaaS operator / CS / analytics (39–50)

39. Stripe Dashboard (customer file + payments)  
40. Razorpay Subscriptions docs (TARGET, not CURRENT)  
41. Chargebee dunning (UX reference)  
42. Mixpanel / Amplitude funnels  
43. PostHog product analytics (self-host option)  
44. Intercom Fin / teammate vs user  
45. Gainsight / Vitally-style health scores  
46. [Basedash: health score signals](https://www.basedash.com/blog/how-to-build-a-customer-health-score-signals-weighting-and-sql)  
47. [Querri: health without Gainsight](https://querri.com/blog/customer-health-score-without-gainsight/)  
48. HubSpot / Salesforce Digital Engagement (credits extra)  
49. Meta WhatsApp Manager (quality UI we deep-link)  
50. Conferbot / industry error-code explainers (not a substitute for #1)

### Privacy / India (51–55)

51. [DPDP for SaaS](https://myitmanager.in/dpdp-act-saas-companies-india/)  
52. [DPDP SaaS (KSANDK)](https://ksandk.com/data-protection-and-data-privacy/dpdp-compliance-saas/)  
53. DPDP Rules 2025 implementation notes  
54. WhatsApp AI Providers / no profile-building (Solution Terms, #18)  
55. PCI: we never store cards (Razorpay hosted)

### Samyoj repo (56–65)

56. `docs/product/CALLS_AI_USAGE_ADMIN_2026-08-16.md` §3–4  
57. `docs/memory/PRODUCT_TASKS_2026-08-16.md` §11–12  
58. `docs/billing/README.md` + `12-COMPETITOR-RESEARCH.md` + `15-SOURCES.md` + `17-META-WHATSAPP-BILLING-AND-POLICY.md`  
59. `docs/audit/BILLING_SYSTEM_REVIEW.md`  
60. `server/prisma/schema.prisma` Organization, User, AiUsageLog, AuditLog  
61. `server/src/modules/ai/org-ai.service.ts`, `ai-usage-actions.ts`  
62. `server/src/modules/analytics/routes.ts`  
63. `server/src/modules/billing/usage.service.ts`  
64. `server/src/modules/ops/error-log.ts` (tenant `/api/ops` route **removed** 2026-08-17)  
65. `server/src/middleware/auth.ts`, `modules/auth/routes.ts` (User.role ADMIN = founder)

---

## 15. Open questions (ask before Phase A)

1. Host: `admin.samyoj.com` vs path on the same app?  
2. Who are the first operators (emails)?  
3. Outreach: email only in v1, or also WhatsApp to the **connected business number**?  
4. Impersonation: never / Phase F?  
5. Should customer Settings show “usage shared with Samyoj for support”? (Recommended: one line in privacy, not a dashboard widget.)
