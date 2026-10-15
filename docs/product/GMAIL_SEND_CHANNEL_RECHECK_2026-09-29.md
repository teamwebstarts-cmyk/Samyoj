# Gmail send channel — official documentation recheck

**Date:** 2026-09-29  
**Status:** Historical research baseline; implementation follow-on shipped 2026-09-30
**Scope:** Google OAuth, Gmail API send-only access, limits, Workspace controls, sender requirements, and the Samyoj build plan.

This recheck is the companion to:

- `docs/product/GMAIL_SEND_CHANNEL_SPEC_2026-09-27.md` — full integration specification
- `docs/product/GMAIL_EMAIL_UI_BRIEF_2026-09-29.md` — UI-only screen brief

> Implementation update (2026-09-30): the follow-on Gmail attachments and template-library slice is now implemented in code. See `docs/product/GMAIL_ATTACHMENTS_LIBRARY_IMPLEMENTATION_2026-09-29.md`. The phase guidance below remains the original pre-build safety baseline; customer rollout is still blocked on Google verification and real-mail release gates.
>
> **15 Oct 2026:** the action list for platform access is `docs/product/GMAIL_PLATFORM_ACCESS_2026-10-15.md`. Use that for the exact Google Cloud steps. The Help Center FAQ now lists sensitive-scope verification as about **10 business days**, not the older 3–5 day line in section 2.3.

The official Google pages below were read on 2026-09-29. This document records what is safe to build, what must not be requested, and which earlier assumptions were corrected.

---

## 1. Final verdict

The send-only product is technically valid if Samyoj:

1. Requests only `https://www.googleapis.com/auth/gmail.send` for Gmail data.
2. Uses the official Gmail API `users.messages.send`.
3. Sends an RFC 2822 MIME message encoded as base64url in the `raw` field.
4. Keeps Gmail connection separate from “Login with Google”.
5. Never requests inbox/read/settings scopes.
6. Uses a server-side OAuth flow with offline access and an encrypted refresh token.
7. Treats a successful Gmail API response as **Accepted by Gmail**, not Delivered or Read.
8. Uses consent, suppression, throttling, and sender-reputation controls before any multi-recipient feature.

The current idea does **not** inherently conflict with Google policy. The risky parts are broad scopes, misleading delivery claims, storing or using mailbox content outside the visible feature, and turning one mailbox into an unrestricted bulk-mail tool.

---

## 2. Official facts verified

### 2.1 Scope classification

| Scope | Classification | Decision |
|---|---|---|
| `https://www.googleapis.com/auth/gmail.send` | **Sensitive** | Allowed and required for send-only v1 |
| `openid` | Identity scope | Allowed for identifying the connecting Google account |
| `email` | Identity scope | Allowed if we use the OIDC email claim to display the mailbox |
| `gmail.readonly` | **Restricted** | Never request |
| `gmail.modify` | **Restricted** | Never request |
| `gmail.compose` | **Restricted** | Never request |
| `gmail.metadata` | **Restricted** | Never request |
| `mail.google.com/` | **Restricted** | Never request |
| `gmail.settings.basic` | Restricted | Do not request; no send-as alias management in v1 |

`users.messages.send` explicitly accepts `gmail.send` as one of its authorization scopes. It does not require full mailbox access.

**Recommended connect scope list:**

```text
openid
email
https://www.googleapis.com/auth/gmail.send
```

`email` is for identity, not inbox access. Do not add `profile` unless the product actually needs the profile data.

### 2.2 Official send method

Use:

```http
POST https://gmail.googleapis.com/gmail/v1/users/me/messages/send
Authorization: Bearer ACCESS_TOKEN
Content-Type: application/json

{"raw":"BASE64URL_ENCODED_RFC2822_MESSAGE"}
```

Google's sending guide requires an RFC 2822/MIME message in `raw`, encoded with base64url. A successful response returns a Gmail message resource and ID.

Do not use:

- Samyoj SMTP for tenant mail
- Gmail SMTP with a password or app password
- Browser `mailto:`
- Gmail IMAP
- A service account or domain-wide delegation for v1
- `drafts.send` when direct `messages.send` is enough

### 2.3 OAuth verification and publishing

Google's official position is:

- A public app using a sensitive scope must complete the relevant OAuth verification before production use.
- While the external app is in **Testing**, only explicitly listed test users can authorize it, with a hard cap of 100 test users.
- A published but unverified external app can show warning UI and is still subject to a 100-user restriction for sensitive/restricted-scope use.
- An app used only inside the developer's own Workspace organization can be configured as Internal, but that is not the Samyoj multi-tenant customer model.
- Production and testing should use separate Google Cloud projects.
- Production OAuth clients must not contain development-only redirect URIs or origins.
- Verification preparation requires a real public home page, verified owned domains, privacy policy, support/developer contact details, accurate branding, declared scopes, per-scope justification, and an English unlisted demo video showing the consent and feature flow.

Google's current sensitive-scope page says the sensitive verification process **typically takes 3–5 business days**. That is not a guarantee; review questions, brand issues, policy corrections, or resubmission can extend the schedule. We must not document “weeks-to-months” as a Google requirement.

### 2.4 Refresh-token behavior

For server-side sending, request:

```text
access_type=offline
```

Google returns a refresh token so the server can obtain access tokens later. `prompt=consent` may be needed when a new refresh token must be issued after a previous grant.

Important testing limitation:

- External + Testing projects issue refresh tokens that expire after **7 days** when non-basic scopes such as `gmail.send` are requested.
- In production, tokens can still stop working if revoked, unused for six months, invalidated by account/security changes, an administrator blocks the app, or Google returns `invalid_grant`.
- The server must treat an invalid refresh token as **Reconnect required**, not silently report success.

### 2.5 Workspace administrator controls

Verification does not override a customer's Google Workspace administrator. Admins can block or limit third-party OAuth apps and can specifically restrict high-risk Gmail actions, including sending mail.

Therefore “Verified by Google” does not guarantee that every Workspace tenant can connect. The product must show:

> Your Google Workspace administrator may need to allow Samyoj in Admin Console → Security → API controls → App access control.

### 2.6 Limits

Official Gmail API quotas:

- `messages.send`: 100 quota units
- Per user per project: 6,000 quota units/minute
- Per project: 1,200,000 quota units/minute
- Therefore the theoretical API ceiling is about 60 `messages.send` calls/minute per mailbox, before mailbox limits and reputation controls.
- Gmail API: maximum 500 recipients per email message.
- Time-based quota errors should use truncated exponential backoff.
- Standard Gmail API use currently has no additional charge; Google says quota overage charging is planned later in 2026 with notice.

Official consumer Gmail guidance:

- More than 500 emails/day or more than 500 recipients in one email can trigger a sending limit.
- Sending can be blocked for 1–24 hours.

Official Google Workspace guidance:

- 2,000 messages/day for a standard paid account
- 500 messages/day for a trial account
- 1,500/day for Gmail mail merge; Samyoj will not use mail merge in v1
- 500 recipients per message when sent through the Gmail API
- Limits are rolling 24-hour limits and can change without notice
- Exceeding a limit can block new sending for up to 24 hours

These are Google limits, not a promise from Samyoj. The UI must not display a fake remaining quota because Google does not expose a reliable remaining-send field for this product.

### 2.7 Sender reputation and authentication

Google's sender guidance requires or recommends:

- Senders should authenticate domains with SPF or DKIM.
- Bulk senders to Gmail (5,000+ messages/day) must use SPF, DKIM, and DMARC.
- Marketing/promotional bulk mail must support one-click unsubscribe and honor requests promptly.
- Senders should keep spam rates below 0.1% and must avoid reaching 0.3% or higher.
- Missing authentication, poor alignment, high spam complaints, invalid recipients, and excessive volume can cause spam placement, temporary failures, or rejection.

Samyoj cannot configure a customer's DNS. For a Workspace custom domain, the UI should recommend that the customer configure SPF/DKIM/DMARC in Google Workspace/domain DNS. This improves delivery but does not guarantee inbox placement.

---

## 3. What the current plan got right

- Send-only, not an inbox.
- `gmail.send` instead of full Gmail access.
- Official `users.messages.send`.
- Separate Gmail connection from Google login.
- Refresh token stored server-side and encrypted.
- No WhatsApp template reuse.
- No reuse of WhatsApp opt-in as email consent.
- No SMTP-from-Samyoj for customer mail.
- Honest status: **Accepted by Gmail**, not Delivered/Read.
- No open tracking or reply reading.
- Separate organization mailbox and email-send records.
- Idempotency and backoff are required.

---

## 4. Corrections and decisions locked by this recheck

### Correction 1 — Verification timing

Old wording suggested Google verification is a “weeks-to-months” gate. Replace it with:

> `gmail.send` is a sensitive scope. Production external use requires Google's verification path. Google currently says sensitive verification typically takes 3–5 business days, but approval time is not guaranteed and can increase if Google requests corrections.

### Correction 2 — Testing tokens

The plan previously described refresh-token storage but did not call out the 7-day Testing-mode expiry. Add a visible engineering/test note:

> Do not use an external Testing project as a long-lived customer environment. Test connections may return `invalid_grant` after 7 days. Use a separate production project and complete verification before customer rollout.

### Correction 3 — Verified does not mean Workspace-approved

A verified Samyoj OAuth app can still be blocked by a customer's Workspace administrator. Connection errors must distinguish:

- Google consent/user denial
- `admin_policy_enforced`
- app verification/testing restriction
- invalid/revoked refresh token
- Gmail API quota/mailbox sending limit

### Correction 4 — Multi-send is not safe as an unguarded v1

One-to-one sending is the recommended first release. Multi-send must be a gated Phase 2 feature, not an unrestricted “campaign” tool. It requires:

- Separate email consent fields and an auditable consent source/time
- Suppression/opt-out handling before every send
- Duplicate-email de-duplication
- Per-mailbox throttle and queue backoff
- A working unsubscribe mechanism for marketing/promotional use
- Sender-authentication guidance
- Clear volume limits and no purchased-list positioning
- Stop-on-limit behavior and per-recipient logs

### Correction 5 — Sent-log data handling

The sent log may store the user-authored subject/body only to provide the visible Sent feature and support delivery troubleshooting. It must not:

- Read or import inbox messages
- Analyze mailbox content for unrelated features
- Use Gmail-derived data for ads or retargeting
- Sell or share Google user data
- Expose one organization's email data to another organization

Privacy policy and in-product disclosure must state what is stored, why it is stored, retention/deletion behavior, and who can access it.

### Correction 6 — “One mailbox per organization” is a product constraint

This is not a Google requirement. It is the recommended Samyoj v1 simplification. Do not imply that Google only permits one mailbox.

---

## 5. Safe build plan

### Phase 0 — Google Cloud and policy gate

No customer UI yet.

1. Create separate Google Cloud projects for testing and production.
2. Enable Gmail API in both as needed.
3. Configure the OAuth consent/branding screen.
4. Use an owned HTTPS domain, public home page, privacy policy, terms/support contact, and exact redirect URI.
5. Add only:
   - `openid`
   - `email`
   - `gmail.send`
6. Add internal test users to the Testing project.
7. Prepare the English verification demo:
   - Settings → Connect Gmail
   - Google consent showing send permission
   - return with mailbox address
   - select an eligible contact
   - send
   - show Sent log with **Accepted by Gmail**
   - show that no inbox is read
8. Submit brand/sensitive-scope verification before external customer rollout.

### Phase 1 — Connect and one-to-one send

Build only:

- OWNER/ADMIN-only Connect Gmail
- Separate OAuth callback and state validation
- Offline refresh token
- AES-GCM encryption at rest
- One active mailbox per organization
- Disconnect/reconnect
- Contact email field and separate email permission
- One-contact compose
- Plain text plus optional HTML MIME
- No Cc/Bcc, attachments, scheduling, or aliases
- Sent log with `ACCEPTED` / `FAILED`
- `Accepted by Gmail` copy
- Backoff for transient 429/5xx errors
- Idempotency key to prevent double-send
- Reconnect state for 401/`invalid_grant`

Phase 1 must not request any read, compose, metadata, settings, or full-mailbox scope.

### Phase 2 — Templates and controlled multi-send

Only after Phase 1 and the compliance gates are approved:

- Org-scoped Samyoj email templates
- Audience limited to valid email + explicit email consent + not opted out
- One recipient per MIME/job
- De-duplicate normalized addresses
- Per-mailbox queue/throttle
- One-click unsubscribe/suppression endpoint for promotional sends
- Stop when Google returns daily-limit or abuse signals
- Detailed accepted/failed/skipped reasons
- Sender-authentication and domain guidance

Do not put this into the WhatsApp campaign wizard. Do not call it a WhatsApp campaign.

### Phase 3 — Optional later work

Requires a new review before any scope or product expansion:

- Replies or inbox: would need restricted read scopes and a separate product/security review
- Send-as aliases: would require Gmail settings scope and verification behavior
- Outlook/Yahoo: separate provider integrations
- Attachments: the scoped Compose-only implementation is now shipped; future expansion still requires a new message-size/security/UX review
- Open/click tracking: separate privacy and consent decision
- Domain-wide delegation: enterprise-only, high-risk, not v1

---

## 6. Exact failure handling

| Failure | User-facing result | Server behavior |
|---|---|---|
| User cancels consent | “Gmail was not connected.” | No mailbox saved |
| `admin_policy_enforced` | “Your Workspace admin must allow Samyoj.” | Keep mailbox disconnected |
| App/testing restriction | “This Google app is still in testing.” | Show test-user/admin guidance; do not retry blindly |
| `invalid_grant` / revoked token | “Reconnect Gmail.” | Mark mailbox inactive; wipe unusable refresh token |
| 401 access token | Refresh once, then reconnect if refresh fails | Never loop indefinitely |
| 403 daily/mailbox limit | “Google paused sending. Try again after the limit resets.” | Stop queue for that mailbox |
| 429 / time quota | No false failure while retryable | Exponential backoff with retry cap |
| Invalid recipient | “Invalid email address.” | Mark only that send failed; do not retry forever |
| Gmail accepted request | “Accepted by Gmail” | Store Gmail ID and send record |

Never label a Gmail API 200 as delivered, read, opened, or clicked.

---

## 7. Pre-build acceptance checklist

### Permissions

- [ ] Code contains `gmail.send`, `openid`, and `email` only for the connection flow.
- [ ] Code review confirms absence of `gmail.readonly`, `gmail.modify`, `gmail.compose`, `gmail.metadata`, `gmail.settings.basic`, and `mail.google.com`.
- [ ] Google login flow remains unchanged and does not ask for Gmail access.
- [ ] OAuth state is validated; redirect URI is exact HTTPS in production.
- [ ] Refresh token is encrypted and never returned to the client.

### Product honesty

- [ ] UI says “Send from your connected Gmail. Not an inbox.”
- [ ] UI says “Accepted by Gmail,” not Delivered/Read.
- [ ] No Inbox, replies, bounce reading, or open tracking is implied.
- [ ] Workspace admin blocking is explained.
- [ ] The 7-day Testing token limitation is documented for internal testers.

### Data and isolation

- [ ] Email sends are organization-scoped.
- [ ] Email consent is separate from WhatsApp consent.
- [ ] Contact email/body retention is disclosed in the privacy policy.
- [ ] No Gmail mailbox content is read or imported.
- [ ] No Google user data is used for ads, retargeting, sale, or unrelated analytics.

### Sending safety

- [ ] One-to-one is the initial release.
- [ ] No Cc/Bcc, alias, attachment, or bulk scheduling in Phase 1.
- [ ] Multi-send is blocked until opt-out, consent, throttle, and sender-policy gates are implemented.
- [ ] Retry/backoff and stop-on-limit behavior are tested.
- [ ] Sent records are idempotent.

---

## 8. Official sources checked

- [Choose Gmail API scopes](https://developers.google.com/workspace/gmail/api/auth/scopes) — `gmail.send` Sensitive; read/compose/settings scopes Restricted; updated 2026-09-10.
- [Method: users.messages.send](https://developers.google.com/gmail/api/reference/rest/v1/users.messages/send) — endpoint and accepted authorization scopes.
- [Create and send email messages](https://developers.google.com/workspace/gmail/api/guides/sending) — RFC 2822/MIME and base64url `raw`.
- [Gmail API usage limits](https://developers.google.com/workspace/gmail/api/reference/quota) — quotas, 500-recipient API limit, backoff; updated 2026-09-10.
- [Gmail sending limits in Google Workspace](https://support.google.com/a/answer/166852) — Workspace daily and recipient limits.
- [Limits for sending & getting mail](https://support.google.com/mail/answer/22839) — consumer Gmail limits and 1–24 hour lock.
- [Sensitive scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification) — verification, domains, privacy policy, demo, typical 3–5 business days.
- [OAuth app state overview](https://developers.google.com/identity/protocols/oauth2/production-readiness/overview) — Testing/Published/Verified states, 100-user cap, admin controls.
- [OAuth 2.0 web-server flow](https://developers.google.com/identity/protocols/oauth2/web-server) — authorization code, offline access, refresh token.
- [OAuth 2.0 refresh-token behavior](https://developers.google.com/identity/protocols/oauth2) — Testing-mode 7-day expiry and revocation conditions.
- [OAuth policy compliance](https://developers.google.com/identity/protocols/oauth2/production-readiness/policy-compliance) — separate test/production projects, owned domains, HTTPS.
- [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy) — transparency, minimum permissions, limited use, security.
- [Google Workspace app access control](https://support.google.com/a/answer/7281227) — admin blocking, limiting, and trusting apps.
- [Email sender guidelines](https://support.google.com/mail/answer/81126) — SPF/DKIM/DMARC and spam-rate guidance.
- [Email sender guidelines FAQ](https://support.google.com/mail/answer/14229414) — bulk sender enforcement and one-click unsubscribe.

**Conclusion:** Keep the Gmail feature send-only, least-privilege, one-to-one first. Do not implement or expose any inbox/read scope. Customer rollout remains blocked until the production OAuth project, privacy disclosures, and Google's sensitive-scope verification path are complete.
