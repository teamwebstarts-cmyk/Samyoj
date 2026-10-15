# Gmail platform access — what Samyoj must do before a customer can connect and send

**Date:** 15 Oct 2026  
**Status:** Checklist only. No code changes in this pass.  
**Product:** A Samyoj user (OWNER or ADMIN) connects **their own** Gmail or Google Workspace mailbox. They then send mail **from that mailbox** to contacts who already agreed to email. Samyoj does not send customer mail from its own address.

This is the working list. Older specs stay the policy baseline:

- `docs/product/GMAIL_SEND_CHANNEL_SPEC_2026-09-27.md`
- `docs/product/GMAIL_SEND_CHANNEL_RECHECK_2026-09-29.md`
- `docs/product/GMAIL_ATTACHMENTS_LIBRARY_IMPLEMENTATION_2026-09-29.md`

Checked against the code on 15 Oct 2026 and against Google’s current verification pages:

- [Sensitive scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification)
- [Brand verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/brand-verification)
- [OAuth 2.0 policies](https://developers.google.com/identity/protocols/oauth2/policies)
- [Submitting your app](https://support.google.com/cloud/answer/13461325)
- [Verification FAQ](https://support.google.com/cloud/answer/13463817) — Brand about **2–3 business days**, sensitive scopes about **10 business days**. Those are Google’s stated expectations, not a promise.
- [Minimum scopes / gmail.send](https://support.google.com/cloud/answer/13807380) — `gmail.send` is sensitive. It does **not** need the restricted-scope security assessment. `https://mail.google.com/` does, and must not be requested.

---

## 1. What “whole access” means

A stranger who is not listed as a Google test user can:

1. Open Samyoj → Settings → Channels → Connect Gmail.
2. See Google’s consent screen with the app name **Samyoj** and the permission to send email.
3. Return to the same Settings page, which shows their mailbox address as connected.
4. Open Email → Compose, pick a contact who has an email address and email permission, and send.
5. See that send in the sent list as **Accepted by Gmail**.

That is the whole access for this product. It does not include reading the inbox, seeing replies, opens, bounces, or a “delivered” tick. `gmail.send` cannot do those.

---

## 2. Already in the code — do not rebuild

| Piece | Where |
|---|---|
| Separate connect from Login with Google | Login asks `openid email profile` (`server/src/modules/auth/oauth.routes.ts`). Gmail asks `openid`, `email`, `https://www.googleapis.com/auth/gmail.send` (`server/src/modules/gmail/constants.ts`). |
| Offline refresh token | `access_type=offline` and `prompt=consent` in `buildGmailOAuthUrl`. |
| Encrypted tokens, one active mailbox per organization | `server/src/modules/gmail/routes.ts` callback. A new connect marks the previous mailbox disconnected. |
| Send through Gmail API | `POST https://gmail.googleapis.com/gmail/v1/users/me/messages/send` in `server/src/modules/gmail/provider.ts`. |
| Queue | Worker `gmail-send` in `server/src/workers/index.ts`. |
| Email permission is separate from WhatsApp opt-in | Send rejects a contact missing email, `emailOptedIn`, consent source, time, version, or with `emailOptOutAt`. Compose has **Enable email permission**. |
| Honest success word | `Accepted by Gmail`. |
| Revoked token | `invalid_grant` sets the mailbox to reconnect. |
| Popup return | Connect opens a window and can return to the page the user was on, when that origin is allowed. |

Local tests do not call Google. A real mailbox send has not been recorded.

---

## 3. What is missing today

### 3.1 Platform secrets — empty on this server

Checked 15 Oct 2026. These keys are empty:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GMAIL_REDIRECT_URI`

Without them, Connect Gmail says the Google client still has to be added. `server/.env.example` lists the three keys with empty values.

The same `GOOGLE_CLIENT_ID` is also used for **Continue with Google**. Keep login’s scope list as it is. Do not add `gmail.send` to the login request. The Cloud consent screen still has to **declare** `gmail.send`, because the Gmail connect request uses it.

### 3.2 Google has not approved Samyoj to ask strangers for send access

There is no production Google Cloud OAuth client in this repo, and no completed sensitive-scope verification on record. Until the app is published and that verification is approved:

- An external app in **Testing** only works for people added as test users (Google’s cap is 100).
- Refresh tokens from an external Testing app that uses a sensitive scope expire after about **7 days**. The mailbox then needs reconnect. Do not use Testing as the customer environment.
- A published but unverified app still shows an “unverified app” warning and stays limited for sensitive scopes.

### 3.3 Public pages do not yet tell Google what we do with mailbox data

`client/public/privacy.html` has no Gmail section. The live Meta privacy URL on the Samyoj app is `https://samyoj.com/legal/privacy-policy.html`. Google requires the homepage, privacy policy, and terms to sit on a domain Samyoj owns, and the privacy policy must say what Google user data is accessed, stored, and not used for.

Before submit, that policy needs a Gmail section that matches the code:

- We request send-only access. We do not read the inbox.
- We store the mailbox address and encrypted access and refresh tokens.
- We store the subject, body, recipient, Gmail message id, and send status so the user can see the sent list.
- Attachments are private, allowlisted, and expire (code uses 24 hours).
- We do not use this data for ads, and we do not sell it.
- Disconnect deletes the stored tokens.

The homepage on that same domain must describe Samyoj and link to the privacy policy and terms.

### 3.4 Code gaps

Fixed in code on 15 Oct 2026:

1. **WhatsApp is still required before email can send.** Contacts and sent mail are stored on a WhatsApp number. The Email screen now says that, instead of “before using this feature.” An email-only workspace would be a separate data-model change. Do not remove the gate without that change.
2. **A connect without a refresh token is no longer saved.** The callback stops before it disconnects the previous mailbox, and tells the user to connect again.
3. **Google’s refusal reasons are plain sentences.** `admin_policy_enforced`, `org_internal`, `invalid_scope`, `access_denied`, and `invalid_grant` each have one sentence. Other errors do not echo Google’s raw text.
4. **Each send includes an unsubscribe confirm link.** Opening the link does not opt the contact out. The contact is opted out only after they submit the confirm form. The 50-recipient cap stays. Every recipient still needs email permission. Google’s mailbox caps still apply (about 500/day on free Gmail, about 2,000/day on paid Workspace).

Still open:

5. **Mock preview is labeled Sample.** If the Meta mock switch is on and Gmail is disconnected, Email shows sample rows and a Sample badge. Send stays blocked. The channel tab says Sample data.
6. **No recorded proof send.** Nothing in this environment has returned a Gmail message id. That step is still yours.

### 3.5 A different mail system — do not mix it in

`SMTP_HOST` is also empty. That path (`server/src/services/email.service.ts`) is Samyoj’s own mail: verify account, password reset, team invite. It does not connect a customer’s Gmail and must not be used to send CRM mail. Customer sending stays on the Gmail API.

---

## 4. Exact steps for Samyoj as the platform

Do these in order. Steps 1–8 are Google Cloud and the public site. Step 9 is the server. Step 10 is the proof. Code gaps in section 3.4 can be fixed in parallel, but a stranger still cannot connect until step 8 is approved.

### Step 1 — Two Cloud projects

In [Google Cloud Console](https://console.cloud.google.com/):

1. Create **Samyoj Gmail Testing**. Use it only for the people who will click through the demo.
2. Create **Samyoj Gmail Production**. This is the client whose id and secret go on the customer server.
3. Do not put a laptop ngrok URL, `localhost`, or a Codespace host on the production client.

On **both** projects: APIs & Services → Enable **Gmail API**.

### Step 2 — Own the domain

1. Use a domain Samyoj controls, such as `samyoj.com`.
2. In [Google Search Console](https://search.google.com/search-console), verify that domain with a Google account that is an Owner or Editor of the Cloud project.
3. Authorized domains on the OAuth consent screen must be that top private domain. The homepage, privacy policy, terms, and the OAuth redirect host all have to live under it.

### Step 3 — Public pages

On the verified domain, publish:

1. A homepage that says what Samyoj does, including that a user can connect Gmail and send mail from their own mailbox. Link the privacy policy and terms from that page.
2. A privacy policy on the same domain, with the Gmail section in section 3.3.
3. Terms of service and a support contact that matches the Cloud project’s contact email. The project contact email must be monitored. Google writes to project owners and editors.

`https://samyoj.com/legal/privacy-policy.html` is already the privacy URL on the live Meta app. Update that page, or change the URL only if the new page is the one linked from the homepage and the consent screen.

### Step 4 — Consent screen (production project)

Google Auth platform → Branding / Data access:

| Field | Value |
|---|---|
| App name | Samyoj |
| User support email | A mailbox a person reads |
| Home page | `https://samyoj.com/` (or the real product home on that domain) |
| Privacy policy | The page from step 3 |
| Terms | The page from step 3 |
| Authorized domain | `samyoj.com` |
| Scopes | `openid`, `email` / `.../auth/userinfo.email`, `https://www.googleapis.com/auth/gmail.send` |
| Publishing | External, then **In production** only after brand verification is ready to submit |

Do not add `gmail.readonly`, `gmail.modify`, `gmail.compose`, `gmail.metadata`, `gmail.settings.basic`, or `https://mail.google.com/`.

Suggested scope justification, to paste into the verification form:

> Samyoj lets a business connect its own Gmail or Google Workspace mailbox and send a message the user wrote to a contact who already has an email address and email permission inside Samyoj. The app calls Gmail API `users.messages.send` with scope `https://www.googleapis.com/auth/gmail.send`. A narrower scope cannot send mail. The app does not read, list, or modify mailbox contents. `openid` and `email` are used only to show which mailbox was connected.

### Step 5 — OAuth client

Create an OAuth client of type **Web application** on the production project.

Authorized redirect URI, character for character:

```text
https://<customer-api-host>/api/gmail/oauth/callback
```

That path is what `gmailRedirectUri()` uses when `GMAIL_REDIRECT_URI` is unset (`${config.baseUrl}/api/gmail/oauth/callback`). Set `GMAIL_REDIRECT_URI` to the same string so a host mismatch cannot mint a different callback.

Authorized JavaScript origins: the real app origin only, for example `https://app.samyoj.com`. No wildcard.

Copy the client id and secret into a password store. They do not belong in git.

On the **testing** project, repeat the client with the testing redirect only, and add the human testers under Audience → Test users.

### Step 6 — Brand verification first

Submit brand verification and wait until branding status is **published**. Google will not take the sensitive-scope review before that. Expect about 2–3 business days if the domain, name, and pages match.

### Step 7 — Demo video

Record in English. Upload to YouTube as **Unlisted**. The video has to show:

1. The user starts Connect Gmail inside Samyoj.
2. The Google consent screen shows the app name Samyoj.
3. The browser address bar on that consent screen contains this app’s OAuth client id.
4. The user grants send access and lands back on Samyoj with the mailbox address visible.
5. The user sends one mail to an eligible contact.
6. The sent list shows **Accepted by Gmail**.
7. The product does not open or read an inbox.

A mock-data screen cannot be this video. The testing project and a listed test user are enough to record it.

### Step 8 — Submit sensitive-scope verification

Verification Center → Data access. Paste the justification from step 4 and the YouTube link. Submit.

Google’s FAQ lists about **10 business days** for sensitive scopes. Questions or a mismatch (extra scope, homepage without a privacy link, video missing the client id) restart the clock.

Approval lets any Google user grant `gmail.send`. It does not override a customer’s Workspace admin. If the admin has blocked third-party apps, that customer must allow Samyoj in Admin Console → Security → Access and data control → API controls.

### Step 9 — Put the production client on the server

On the customer host, in `server/.env` only:

```text
GOOGLE_CLIENT_ID=<production client id>
GOOGLE_CLIENT_SECRET=<production client secret>
GMAIL_REDIRECT_URI=https://<customer-api-host>/api/gmail/oauth/callback
```

Restart the API after the change. Do not commit the file.

Confirm the redirect string in Google Cloud, in `.env`, and in the URL the browser opens are the same.

### Step 10 — Proof before calling it ready

With a real test mailbox, not mock preview:

1. Connect returns to Settings and shows that mailbox.
2. Disconnect, then connect again. The new row is connected and the old one is disconnected.
3. Send one mail to a contact with email permission. The sent list says Accepted by Gmail, and the message is in the recipient’s inbox.
4. Revoke Samyoj in the Google Account’s third-party access page, then send again. Samyoj must ask to reconnect. It must not show success.
5. On a Testing project only, confirm the warning and the test-user limit. Do not treat that project as the customer launch.

---

## 5. What the customer does after step 10

Samyoj does not do these for them:

1. OWNER or ADMIN clicks Connect Gmail and accepts Google’s send permission.
2. They pick contacts that have an email address and turn on **Enable email permission**. WhatsApp opt-in is not enough.
3. They send from Email → Compose.
4. If the mailbox is Google Workspace and the admin blocks the app, the admin allows Samyoj in API controls.
5. If they send from a custom domain, they set SPF, DKIM, and DMARC in their own DNS. Samyoj cannot set that. It changes placement, not the right to connect.
6. They stay inside Gmail’s own daily limits. The product must not invent a remaining-quota number.

---

## 6. Do not do these

- Do not request inbox or full-mail scopes to “make replies work”. That changes this product into a restricted-scope review.
- Do not send customer mail through `SMTP_HOST`.
- Do not add `gmail.send` to Login with Google.
- Do not put the production client secret in the client app, in git, or in a screenshot.
- Do not register a changing ngrok URL as the production redirect.
- Do not tell a customer the mail was delivered or read.
- Do not turn Compose into an unattended bulk sender until unsubscribe, volume caps, and the 50-recipient path are an explicit decision.

---

## 7. Implementation list for the next coding pass

When work starts, this is the code and content list. Platform steps 1–8 stay outside the repo.

1. Done 15 Oct 2026: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GMAIL_REDIRECT_URI` are in `server/.env.example`. No real values.
2. Done 15 Oct 2026: `client/public/privacy.html` has the Gmail send section. The live page at `https://samyoj.com/legal/privacy-policy.html` still has to be updated to match before Google verification.
3. Done 15 Oct 2026: no `refresh_token` means the connect is refused and the previous mailbox stays.
4. Done 15 Oct 2026: the WhatsApp gate stays, and the Email error says contacts and sent mail stay on that number.
5. Done 15 Oct 2026: Google refusal codes map to one sentence each.
6. Done 15 Oct 2026: each email includes a confirm-to-unsubscribe link. The 50-recipient cap stays, and every recipient still needs email permission.
7. Done 15 Oct 2026: mock preview shows Sample, and Send stays blocked while it is on.
8. Run step 10 and keep the Gmail message id in the sent row as the proof.
