# Gmail send channel — research & integration specification

**Status:** Historical research baseline; implementation follow-on shipped 2026-09-30
**Date:** 2026-09-27 · **Recheck:** `docs/product/GMAIL_SEND_CHANNEL_RECHECK_2026-09-29.md`  
**Audience:** Product, engineering, Google OAuth App Review, legal/compliance, QA  
**Ask:** Add **Google Gmail** as a fourth channel that **only sends** mail. User connects a mailbox, picks contacts that already have an email saved, and sends a message (or a Samyoj email template). Not a Gmail inbox.

> Implementation update (2026-09-30): the requested Compose-only attachment and 12-template-library follow-on is implemented in `docs/product/GMAIL_ATTACHMENTS_LIBRARY_IMPLEMENTATION_2026-09-29.md`. This research specification remains the policy/source baseline; Google verification and real-mail checks still gate customer rollout.

---

## 0. Verdict (read this first)

| Question | Answer |
|----------|--------|
| Can Samyoj send as the customer's Gmail / Google Workspace mailbox? | **Yes.** Official method: Gmail API `users.messages.send` with OAuth scope `gmail.send`. |
| Can we do it without reading the customer's inbox? | **Yes — and we must.** `gmail.send` is **sensitive**, not **restricted**. Inbox read (`gmail.readonly` / `gmail.modify` / `mail.google.com`) is **restricted** and triggers a heavier Google security assessment. |
| Can WhatsApp templates be reused as email? | **No.** Meta templates are WABA-approved JSON. Email is RFC 2822 MIME (subject + text/HTML). Separate template object. |
| Can WhatsApp campaign consent (`optedIn`) be reused for email? | **No.** That flag is WhatsApp messaging consent. Email needs its own opt-in. |
| Can we show replies, opens, or “delivered to inbox”? | **Not with send-only.** `gmail.send` cannot list messages. A 200 from Google means **Gmail accepted the MIME**, not that the recipient opened it. Bounces land in the connected mailbox, which we will not read in v1. |
| Should we send customer mail through existing Samyoj SMTP? | **No.** `server/src/services/email.service.ts` is **Samyoj-from** (password reset, verify, invites, platform outreach). Using it for customer CRM would send from Samyoj's address, mix ledgers, and lie about “their Gmail”. |
| Mix `gmail.send` into Google **login**? | **No.** Login today is `openid email profile` (`server/src/modules/auth/oauth.routes.ts`). Adding send to login would force every sign-in through a sensitive scope. |
| Customer production / production-ready pipeline? | **Irrelevant until coded.** This spec is research. `gmail.send` is Sensitive; production external use requires Google's verification path. Google currently says sensitive verification typically takes **3–5 business days**, but review is not guaranteed and can take longer if corrections are requested. |

**Recommended v1:** fourth channel **Email (Gmail)** — connect mailbox → one-to-one compose/send to contacts with `Contact.email` → optional Samyoj-owned email templates → sent log in our DB. **No inbox. No Meta template clone. No SMTP-from-Samyoj for this feature.** Multi-send is a gated Phase 2 feature, not an unrestricted v1 campaign tool.

---

## 1. Product summary (what the user asked)

Samyoj already has three live messaging surfaces:

| Channel | Today | Direction |
|---------|--------|-----------|
| WhatsApp | Inbox, campaigns, templates, calls | Send + receive (inbound needs public HTTPS webhook) |
| Facebook | Messenger inbox, Ads read | Send + receive (24h window) |
| Instagram | DMs + comments | Send + receive / one private reply |

**Email v1** is **outbound only**:

1. Admin connects **one Google mailbox** (personal Gmail or Google Workspace).
2. User picks **contacts that have `email` saved**.
3. User writes a subject + body **or** applies a **Samyoj email template**.
4. Samyoj sends **as that mailbox** via Gmail API.
5. Samyoj stores a **sent log** (to, subject, Gmail message id, accepted/failed).

**Explicitly out of v1:**

- Gmail inbox / thread UI / reply handling
- Reading bounce or out-of-office mail
- Open/click tracking pixels (DPDP + extra infra)
- Outlook / Yahoo / generic IMAP
- Sending from a custom `From:` that is not a verified send-as on that Google account
- Cold-email “unlimited” blasting, mailbox rotation, warmup products
- Reusing WhatsApp Campaigns / Meta template approval
- Using platform SMTP as if it were the customer's Gmail

---

## 2. Where it lives in Samyoj (UI mental model)

```text
Channels
  WhatsApp ▾     Inbox / Calls / Campaigns / Templates
  Facebook ▾     Messenger / Ads
  Instagram ▾    Inbox / Comments
  Email ▾        Compose / Sent          ← THIS FEATURE
                   (optional later: Templates)

Settings → Channels
  WhatsApp | Facebook Page | Instagram | Gmail mailbox
```

**Do not** put Gmail under:

- **WhatsApp → Campaigns** (phone + Meta template + WABA billing)
- **AI Studio → Content Studio** as the executor (Studio can *draft* copy; Email channel *sends*)
- **Settings → Data & export** (API keys / webhooks — not a mailbox)
- **Login with Google** (identity ≠ send-as)

**Do** put Connect Gmail on **Settings → Channels** next to Facebook/Instagram panels (`SettingsPage.tsx` `TAB_DEFS` hint today is `"WhatsApp, Facebook, Instagram"` — extend that copy when shipping).

**Page chrome:** `pageMeta` title **Email**, subtitle **Send from your connected Gmail. Not an inbox.** Topbar Live badge follows mailbox connected (same pattern as Facebook Page, not WhatsApp number).

**Dashboard:** if Email is connected and WhatsApp is not, treat Email as `anyChannel` for the workspace wall (same three-channel work). Quick action: **Email** when mailbox is on.

---

## 3. What exists today (reuse map)

| Layer | Today | Reuse for Gmail send |
|-------|--------|----------------------|
| **Contact.email** | Optional string on `Contact` (`schema.prisma`). Create/update validates `z.string().email()` in `contacts/routes.ts`. Search includes email. | **Recipient source.** Filter `email IS NOT NULL`. Do **not** invent uniqueness on email — unique key is `(organizationId, whatsappNumberId, normalizedPhone)`. Same email can exist on two phone rows. |
| **WhatsApp templates** | Meta Graph templates, WABA approval, `{{1}}` body vars, campaign maps `contact.email` as a **variable value** for WhatsApp body — not as a send address | **Copy mapping idea only** (`contact.email` already exists in `templateForm.ts`). New `EmailTemplate` model. |
| **Campaigns** | `Campaign` + `CampaignRecipient` unique `(campaignId, phone, runGeneration)`. Fail-closed WhatsApp consent | **Do not reuse this table as-is.** Email recipient is an address, not a phone. New `EmailSend` / `EmailCampaign` or a channel-tagged send log. |
| **Channel** | `ChannelPlatform` enum = `WA \| FB \| IG`. Token AES-GCM via `MetaWhatsAppService.encryptToken` | Add `EMAIL` (or `GMAIL`) **or** a dedicated `GmailMailbox` table (cleaner: mailbox is a Google user, not a Meta Page). Prefer **new table** so we do not overload Meta `Channel`. |
| **Google OAuth login** | `GOOGLE_CLIENT_ID` / `SECRET`, scopes `openid email profile`, `access_type: online` | **Separate flow.** Gmail connect: `access_type=offline`, `prompt=consent`, scope `gmail.send` + `email`. Store **refresh token**. |
| **SMTP** | `sendEmail()` nodemailer, `SMTP_HOST`. Honesty: unset SMTP = log, not SENT (platform outreach) | **Forbidden** for tenant CRM send. Keep for Samyoj system mail only. |
| **Workers** | BullMQ inside API (`startWorkers()`). Campaign jobs, webhook, IG scheduler | New `gmail-send` job: one recipient per job, exponential backoff per [Gmail usage limits](https://developers.google.com/workspace/gmail/api/reference/quota). |
| **Number isolation** | Contacts scoped by `whatsappNumberId` | Email send still lists contacts in the **active WhatsApp workspace** if a number exists. **Gap:** Facebook-only org may have **no** `WhatsappNumber` — contacts page today walls on WhatsApp. Email v1 either (a) requires a WA workspace for the contact list, or (b) allows org-level contacts without a number (schema change). **Honest default for v1:** send from contacts that already exist in the current workspace (same as Contacts page). Do not silently invent a second CRM. |
| **Dashboard channels** | `workspaceChannels.ts` WA/FB/IG | Add `email: boolean` when mailbox is active. |

**Do not reuse:** `OAuthAccount` (that's **user login** Google id, not org mailbox). A staff member's Google login ≠ the business Gmail.

---

## 4. Official Google APIs (allowed vs forbidden)

Canonical docs (fetched 2026-09-27):

| Doc | URL | What we copy |
|-----|-----|----------------|
| Send messages | [Create and send email messages](https://developers.google.com/workspace/gmail/api/guides/sending) | MIME RFC 2822 → base64url `raw` → `messages.send` |
| Method | [users.messages.send](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/send) | `POST https://gmail.googleapis.com/gmail/v1/users/me/messages/send` |
| Scopes | [Choose Gmail API scopes](https://developers.google.com/workspace/gmail/api/auth/scopes) (updated **2026-09-10**) | **Only** `https://www.googleapis.com/auth/gmail.send` |
| Quotas | [Usage limits](https://developers.google.com/workspace/gmail/api/reference/quota) (updated **2026-09-10**) | `messages.send` = **100 quota units**; 500 recipients per MIME |
| Workspace sending caps | [Gmail sending limits](https://support.google.com/a/answer/166852) (updated **2026-09-24**) | 2,000 msgs/day paid; 500 trial; Gmail API **500 recipients per message** |
| Consumer Gmail caps | [Limits for sending & getting mail](https://support.google.com/mail/answer/22839) | **500 recipients/day** and/or 500 emails/day language in Help |
| Sensitive verification | [Sensitive scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification) | Video demo, privacy policy, brand |
| Restricted verification | [Restricted scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification) | **Avoid** — we will not request these |

### 4.1 Allowed API (v1)

```http
POST /gmail/v1/users/me/messages/send
Authorization: Bearer {access_token}
Content-Type: application/json

{ "raw": "<base64url RFC 2822 MIME>" }
```

Minimum OAuth scope that works for this method: **`gmail.send`**.

Also allowed (optional, later): `users.settings.sendAs.list` needs **restricted** `gmail.settings.basic` — **do not** add in v1. From header = the authenticated mailbox email from `userinfo`.

### 4.2 Forbidden / do-not-request (v1)

| Scope / API | Why |
|-------------|-----|
| `gmail.readonly`, `gmail.modify`, `gmail.compose`, `gmail.metadata`, `mail.google.com` | **Restricted.** Inbox/read. CASA-class review if storing that data. User asked send-only. |
| `drafts.send` | Needs compose/drafts; extra surface. `messages.send` is enough. |
| Gmail IMAP / App Passwords | Google is deprecating password access; not a product path. |
| SMTP to `smtp.gmail.com` with the user's password | Same. Use OAuth Gmail API. |
| Domain-wide delegation (DWD) service account | Admin grants send for **every** user in a Workspace domain. Powerful, easy to abuse, different legal review. Phase C only if enterprises demand it. |

### 4.3 Anti-patterns

- Inventing a Gmail “webhook for replies” with only `gmail.send`.
- Setting `From:` to a random company address the mailbox cannot send as (Gmail will reject or rewrite).
- BCC blasting 500 contacts in **one** MIME to dodge per-message jobs — burns recipient-per-message cap, looks like spam, one fail kills all.
- Calling `messages.send` in a tight loop without backoff (per-user 6,000 units/min; each send = 100 units → **~60 sends/minute theoretical**, far above reputation-safe rate).

---

## 5. Hard limits (product must display these, not hide them)

### 5.1 Mailbox caps (Google account, not Samyoj)

Limits are **per Google user**, rolling **24 hours**, and **can change without notice** (Workspace Help).

| Account | Practical daily ceiling | Source |
|---------|-------------------------|--------|
| Free `@gmail.com` | Help text: more than **500 emails/day** and/or **500 recipients** in a day trips a send lock (1–24h) | [Gmail Help 22839](https://support.google.com/mail/answer/22839) |
| Google Workspace **trial** | **500** messages/day | [Workspace 166852](https://support.google.com/a/answer/166852) |
| Google Workspace **paid** | **2,000** messages/day; mail merge **1,500**; **500** recipients per message **via Gmail API** | Same |
| Workspace unique recipients/day | **3,000** unique; **2,000** external (500 external on trial) | Same |
| Attachment + body before encoding | **25 MB** (Business / Education); some Enterprise Plus web **50 MB** | Same |

**Samyoj v1 policy (fail-closed, stricter than Google):**

- **One To: recipient per API call.** No Cc/Bcc in v1 (simpler consent + logs).
- **Cap UI:** show remaining estimate is **impossible to compute exactly** (Google does not give a remaining-send Graph field). Copy: “Google limits this mailbox (about 500/day on free Gmail, 2,000/day on paid Workspace). If send fails, wait up to 24 hours.”
- **Throttle:** start **30–60 sends/hour** per mailbox (reputation). Configurable; default conservative.
- **Do not** promise “campaign of 10,000 contacts tonight” on one mailbox.

### 5.2 Gmail API project quotas (Samyoj Cloud project)

From [Usage limits](https://developers.google.com/workspace/gmail/api/reference/quota) (2026-09-10):

| Limit | Value |
|-------|--------|
| Per minute / project | 1,200,000 quota units |
| Per minute / user / project | 6,000 quota units |
| `messages.send` | **100 units** |
| Recipients per MIME | **500** |
| Daily billing threshold | **80,000,000 units/day**; usage under threshold **no extra Google charge today**; exceeding **planned to bill later in 2026** with ≥90 days notice |

**Math:** 6,000 user-units/min ÷ 100 = **60 sends/min/mailbox** API ceiling. Reputation and daily mailbox caps bind first.

**Pricing honesty:** “All standard use of the Gmail API is available at no additional cost” **today**. Do **not** fold hypothetical Google API overage into Samyoj plan price. Two ledgers: Samyoj SaaS vs Google (mailbox + possible future API overage on **our** Cloud billing account).

Projects created **on/after 1 May 2026** use new quotas; older projects that used the API Nov 2025–Apr 2026 keep previous quotas. Confirm in Cloud Console at build time.

### 5.3 What “sent” means

| Event | Can v1 know? |
|-------|----------------|
| HTTP 200 + Gmail `id` | Yes — store as `ACCEPTED` |
| In recipient inbox vs spam | **No** |
| Opened / clicked | **No** (unless later pixel — not v1) |
| Bounce | **No** without reading mailbox |
| Unsubscribe | Only if we add `List-Unsubscribe` header + HTTPS webhook **we** host (recommended for bulk; Phase B) |

UI must say **Accepted by Gmail**, never **Delivered** / **Read**.

---

## 6. OAuth & Google App Review (the real schedule risk)

### 6.1 Two Google products, two consents

| Flow | Scopes | Tokens | Who |
|------|--------|--------|-----|
| Login with Google (exists) | `openid email profile` | Online access; no Gmail | Any user signing in |
| Connect Gmail (new) | `gmail.send` + `email` | **Refresh token** (`access_type=offline`, `prompt=consent`) | OWNER/ADMIN, org-owned mailbox |

Use a **separate OAuth client** (or at least a separate consent screen brand) if Google review gets confused. Redirect URI example: `{API}/api/gmail/callback` — **not** `/api/auth/oauth/google/callback`.

Refresh tokens: encrypt at rest with the same AES-GCM helper as Meta tokens (`MetaWhatsAppService.encryptToken`). `chmod 600` on `.env`. Never show tokens in UI.

### 6.2 Verification

`gmail.send` is **Sensitive** ([scopes table](https://developers.google.com/workspace/gmail/api/auth/scopes)). Public (External) apps need:

- OAuth consent branding, homepage, privacy policy, authorized domains
- Demo video of: Connect Gmail → pick contact with email → send → show sent log (**no inbox**)
- Justification: “Send customer emails the business already opted in for, from their own mailbox”
- Testing external apps: only explicitly listed test users, hard cap 100. Published but unverified external apps can show warning UI and remain subject to a 100-user restriction for sensitive/restricted-scope use. This is **not** customer production.

The restricted-scope/CASA path is not part of this `gmail.send`-only plan. If any restricted scope is added later, re-check Google's current security-assessment requirements before implementation.

**Testing while unverified:** Google Cloud test users (up to 100). Fine for Samyoj internal test-deploy. External Testing refresh tokens for non-basic scopes such as `gmail.send` can expire after **7 days**. **Not** for tenant go-live.

### 6.3 Workspace admin blocks

Customer Workspace admins can block untrusted OAuth apps. Copy: “If Connect fails, ask your Google Workspace admin to allow Samyoj.”

---

## 7. Contacts, templates, campaigns — exact mapping

### 7.1 Recipients

```text
Eligible contact =
  same workspace as Contacts page today
  AND email is a non-empty valid address
  AND emailOptedIn (NEW) === true
  AND emailOptOutAt IS NULL
```

**Do not** use WhatsApp `optedIn` + `consentSource` + `consentAt` as email permission. Those are WhatsApp campaign fail-closed fields (`campaigns/recipients.ts`).

**v1 schema add (minimum):**

- `Contact.emailOptedIn Boolean @default(false)`
- `Contact.emailConsentAt DateTime?`
- `Contact.emailConsentSource String?`
- `Contact.emailOptOutAt DateTime?`

Empty email → contact **hidden** from Email composer audience. User must save email on the contact (already in Contacts form).

**Collision:** two contacts, same email, different phones. v1: send **once per contact row** only if we also de-dupe by normalized email in a campaign (recommended: unique send per `normalize(email)` per campaign run).

### 7.2 Templates (Samyoj email templates — not Meta)

WhatsApp template = Graph `name` + language + status APPROVED.

Email template v1:

| Field | Notes |
|-------|--------|
| `name` | Internal |
| `subject` | With `{{name}}` `{{email}}` `{{phone}}` |
| `textBody` | Required (multipart alternative) |
| `htmlBody` | Optional |
| `organizationId` | Org-scoped, **not** WABA-scoped |

**Cannot** submit these to Meta. **Cannot** use them on WhatsApp. UI: **Email templates**, not mixed into `/templates` WABA list.

Content Studio can **draft** subject/body; “Send via Email” is Phase B.

### 7.3 Send UX

**A. One contact (must ship in v1)**  
Contacts row / contact drawer → **Send email** if `email` present. Modal: from-mailbox (read-only), to, subject, body, Send.

**B. Many contacts (v1 optional but matches “campaign” ask)**  
Channels → Email → **New send**: pick template or compose, audience = contacts with email + email opt-in. Worker: **1 job × 1 To:**. Progress: accepted / failed. Stop on mailbox 429 / daily limit.

**Do not** attach this to WhatsApp campaign wizard (template picker is Meta-only).

---

## 8. Architecture (when implementation is approved)

```text
[Settings] Connect Gmail
    → Google OAuth (gmail.send, offline)
    → store encrypted refresh + mailbox email on GmailMailbox (org)

[Compose]
    → load contacts with email + emailOptedIn
    → render MIME (From = mailbox, To = contact.email, List-Unsubscribe later)
    → enqueue gmail-send job (BullMQ, embedded worker)

[Worker]
    → refresh access token
    → POST users.me.messages.send
    → write EmailSend { gmailId, status ACCEPTED|FAILED, error }
    → backoff on 429 / 403 rate
```

**Suggested table `GmailMailbox`:** `organizationId`, `googleUserId`, `email`, `refreshToken` (encrypted), `isActive`, unique `(organizationId)` for v1 **one mailbox per org** (like one Page). Multi-mailbox = Phase B.

**Suggested table `EmailSend`:** `organizationId`, `mailboxId`, `contactId?`, `toEmail`, `subject`, `gmailMessageId?`, `status`, `error`, `createdById`, `createdAt`. Not a `Conversation` row (Conversation is Meta/WA chat).

**Token refresh:** `POST https://oauth2.googleapis.com/token` with `grant_type=refresh_token`. On `invalid_grant`, mark mailbox disconnected and show Connect again.

**Idempotency:** `EmailSend.clientKey` unique so double-click does not double-send.

---

## 9. Compliance (India + Google sender rules)

This is not legal advice. Product must still fail closed.

| Topic | Constraint |
|-------|------------|
| **DPDP Act 2023** | Email is personal data. Marketing send needs **purpose-specific consent**, not “they have WhatsApp opt-in”. Store source + timestamp. |
| **TRAI DND** | Applies to **SMS/calls**, not email. Do not claim DND covers email. |
| **No India CAN-SPAM twin** | Still require unsubscribe for bulk (Phase B header). One-to-one service replies are lower risk than blasts. |
| **Google sender guidelines** | Custom-domain Workspace should have SPF/DKIM/DMARC on **their** domain. Samyoj cannot set DNS. UI: “For fewer spam folders, authenticate your domain in Google Admin.” |
| **Spam & abuse** | Google can **permanently** restrict a mailbox. Samyoj must not look like a spam gun (throttle, opt-in, no purchased lists). |
| **Meta vs Google fees** | Never mix Gmail into WhatsApp conversation/template pricing. Gmail is the customer's mailbox quota. |

**Unsubscribe v1:** for one-to-one, footer text “Reply stop to this mailbox” is weak (we cannot read replies). Better v1: footer link `https://{app}/u/{token}` that sets `emailOptOutAt` **without** Gmail read. Phase B: RFC 8058 `List-Unsubscribe`.

---

## 10. Competitor / alternative approaches (why first-party Gmail API)

| Approach | Verdict for Samyoj |
|----------|-------------------|
| **Gmail API `gmail.send`** | **Choose this.** Matches send-only, least privilege, no CASA if we stay off restricted scopes. |
| **Nylas / Unipile / similar** | Faster inbox+send, paid vendor, extra DPA. Only if we later want Outlook too. |
| **Samyoj SMTP (current nodemailer)** | Wrong From identity; already used for system mail. |
| **Google Workspace SMTP relay** | Admin DNS + IP; higher volume; **not** “user selected their Gmail”. Different product. |
| **mailto: from browser** | Opens user's local client. Not logged, not automatable. Not an integration. |

---

## 11. Phased plan (implementation — only after approval)

### Phase 0 — Google Cloud + legal (no product UI)

- New OAuth client, consent screen, test users
- Privacy policy paragraph: we send mail you compose; we do not read Gmail
- Demo video script
- Submit **sensitive** verification when leaving test users

**Verify:** test user can finish OAuth; unverified warning expected for non-test accounts.

### Phase 1 — Connect + one-to-one send

- `GmailMailbox` + encrypt refresh token
- Settings → Channels → Connect Gmail / Disconnect
- Contact drawer Send email
- `EmailSend` log page **Channels → Email → Sent**
- Optional org-scoped Samyoj email templates
- Fail if no `email` or no email opt-in
- Copy: Accepted by Gmail, not delivered

**Verify:** send to a real inbox from connected mailbox; log shows Gmail id; disconnect revokes usability; login Google still `openid email profile` only.

### Phase 2 — Controlled multi-send

- Audience picker (email present + opted in), de-dupe by email
- BullMQ `gmail-send`, 1 recipient/job, hourly cap
- Stop on daily-limit errors; surface Google's message
- Add unsubscribe/suppression and sender-policy gates before promotional multi-send

**Verify:** 5 contacts, 5 MIME sends, 5 log rows; sixth without opt-in skipped.

### Phase 3 — Dashboard / nav / three-channel honesty

- `workspaceChannels.email`
- Settings hint includes Email
- Do **not** show WhatsApp PreConnect wall if only Gmail is connected (same as FB/IG fix)

### Deferred / never in this spec

- Inbox, IMAP, Outlook
- Restricted Gmail scopes
- Open tracking
- DWD domain-wide send
- Merging with WhatsApp campaign wizard
- TARGET billing SKU until user asks (do not invent Gmail add-on price)

---

## 12. Cannot / will not work (explicit)

| Want | Why not |
|------|---------|
| “See replies in Samyoj Inbox” | Needs restricted read scopes + a second inbox product |
| “Know if they opened it” | No Gmail API field; pixels are a new privacy product |
| “Use my approved WhatsApp template as email” | Different networks and approval regimes |
| “Blast 20k from one @gmail.com today” | Google 500/day consumer cap; Workspace 2k; reputation |
| “Send as support@brand.com from a random Gmail” | From must be that Google user / verified send-as |
| “Delivery ticks like WhatsApp” | WhatsApp has Graph statuses; Gmail send-only does not |
| “Reuse campaign consent” | WhatsApp ≠ email lawful basis |
| “Connect during Login with Google” | Scope creep; breaks least privilege |

---

## 13. Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Google OAuth verification delay / rejection | High | Stay on `gmail.send` only; accurate demo; test users until approved |
| Tenant uses Samyoj as a spammer; Google bans **their** mailbox | High | Opt-in, throttle, no purchased CSV without consent checkbox |
| Refresh token revoked silently | Medium | Treat 401/`invalid_grant` as disconnected |
| Mixing SMTP and Gmail in one “Email” button | High | Two code paths, two From identities, never share `sendEmail()` |
| Contacts without WhatsApp number (FB-only orgs) | Medium | v1: same Contacts wall as today **or** explicitly expand contacts off-number (separate ticket) |
| Future Gmail API billing over 80M units/day | Low for v1 volume | Monitor Cloud quotas; do not bake into SaaS price |
| DPDP complaint | High | Separate email consent fields; export/delete with contact |

---

## 14. Test plan (when built)

1. Connect Gmail (test user) → mailbox email shown in Settings.
2. Contact without email → Send email hidden/disabled.
3. Contact with email, **no** email opt-in → send 403/fail-closed.
4. Opt in → send → recipient mailbox (not Samyoj SMTP) receives From=connected Gmail.
5. Sent log shows Gmail message id; status **Accepted**, not Delivered.
6. Disconnect → send 401/409.
7. Google login still works without Gmail permission prompt.
8. Attempt `gmail.readonly` in code review: **must be absent**.
9. Burst 70 jobs/minute → worker backs off; no tight loop.
10. WhatsApp campaign still requires phone consent and approved template — unchanged.

---

## 15. Decision needed from you (before any code)

1. Confirm **v1 = one-to-one only** (recommended). Multi-send stays gated Phase 2 until consent, unsubscribe, suppression, throttling, and sender-policy controls are approved.
2. **One mailbox per org** (recommended) vs many?
3. Email opt-in: new fields (recommended) vs a single “marketing consent” for all channels (weaker legally)?
4. FB/IG-only orgs: keep Contacts WhatsApp-walled (email send only when a WA workspace exists) **or** allow contacts without a number?

Until those four are answered, treat this document as the integration plan — **not** a build ticket.

---

## 16. Source list

- [Gmail API sending guide](https://developers.google.com/workspace/gmail/api/guides/sending) — fetched 2026-09-27  
- [users.messages.send](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/send)  
- [Gmail API scopes](https://developers.google.com/workspace/gmail/api/auth/scopes) — updated 2026-09-10  
- [Gmail API usage limits](https://developers.google.com/workspace/gmail/api/reference/quota) — updated 2026-09-10  
- [Workspace sending limits](https://support.google.com/a/answer/166852) — updated 2026-09-24  
- [Consumer Gmail sending limits](https://support.google.com/mail/answer/22839)  
- [Sensitive scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification)  
- Code: `Contact.email` in `server/prisma/schema.prisma`; Google login scopes in `server/src/modules/auth/oauth.routes.ts`; SMTP in `server/src/services/email.service.ts`; WhatsApp campaign consent in `server/src/modules/campaigns/recipients.ts`; Meta channel save in `server/src/modules/facebook/save-page-channel.ts`

The original v1 research was not shipped as written. The implementation follow-on is available for internal testing; customer production of Gmail remains blocked until Google **sensitive** OAuth verification, privacy disclosures, and real-mail testing pass.
