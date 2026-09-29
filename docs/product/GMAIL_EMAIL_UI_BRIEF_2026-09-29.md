# Email (Gmail) — UI brief

**Use this file to generate screens.**  
**Status:** Product UI only · feature not built · 2026-09-29  
**Engineering detail (do not put in UI):** `docs/product/GMAIL_SEND_CHANNEL_SPEC_2026-09-27.md`

This document is only what the user sees, what they fill in, and which options exist. It is not an inbox. **Initial release is one-to-one sending; multi-send screens are Phase 2 and must not be treated as an unrestricted bulk-mail feature.**

---

## 1. One-line product

The business connects **one Gmail or Google Workspace mailbox**. They send email **from that mailbox** to contacts who already have an email and email permission. Samyoj shows a **sent log**. Replies, opens, and “delivered” are not shown.

**Chrome title:** Email  
**Subtitle:** Send from your connected Gmail. Not an inbox.

---

## 2. Where it sits

```text
Sidebar
  Email
    Compose
    Sent
    Templates

Settings → Channels
  WhatsApp | Facebook Page | Instagram | Gmail

Contacts
  Email field (already exists)
  Email permission (new)
  Action: Send email
```

Do not place this inside WhatsApp Campaigns, WhatsApp Templates, or Login with Google.

---

## 3. What the user provides (new inputs)

| Screen | Field | Required | Notes |
|--------|--------|----------|--------|
| Connect Gmail | Google account (OAuth) | Yes | User clicks **Connect Gmail**, then Allow on Google. Samyoj never asks for a password. |
| Contact | Email | Yes to send | Already on the contact form. Empty email = cannot send. |
| Contact | Email permission | Yes to send | New toggle: **Can email this contact**. Off by default. Separate from WhatsApp opt-in. |
| Compose / Send | Subject | Yes | Plain text. Templates may insert `{{name}}` `{{email}}` `{{phone}}`. |
| Compose / Send | Message | Yes | Plain text body. |
| Compose / Send | HTML message | No | Optional richer body. If empty, only plain text is sent. |
| Template | Template name | Yes | Internal label, e.g. “Order follow-up”. |
| Template | Subject | Yes | Same variables as compose. |
| Template | Text body | Yes | |
| Template | HTML body | No | |
| New send (many) — Phase 2 | Audience | Yes | Only after consent, opt-out, unsubscribe, throttle, and sender-policy gates are approved. |
| New send (many) — Phase 2 | Template or blank compose | One of them | Apply a saved template, or write subject + message once for the run. |

**System fills (user cannot edit):**

- **From** — the connected mailbox address, read-only.
- **To** — the contact’s saved email, read-only on one-person send.
- Sent time, status, Gmail message id (shown after send).

**User does not provide:** App passwords, SMTP host, Meta template id, WhatsApp opt-in as email permission, Cc, Bcc, attachments (v1 has none).

---

## 4. Screens and options

### 4.1 Settings → Channels → Gmail

**Not connected**

- Title: Gmail
- Copy: Send email as your Gmail or Google Workspace mailbox. Samyoj does not read your inbox.
- Primary button: **Connect Gmail** (OWNER / ADMIN only)
- Helper: If your company Google admin blocks apps, ask them to allow Samyoj.
- Staff who are not admin: button hidden; copy “Ask an admin to connect Gmail.”

**Connected**

- Mailbox: `support@company.com` (or whatever Google returned)
- Status chip: **Connected**
- Buttons: **Disconnect**
- Short limits note (always visible, not a live counter):  
  “Google limits this mailbox — about 500 emails a day on free Gmail, about 2,000 a day on paid Workspace. If sending stops, wait up to 24 hours.”

**Disconnected after Google revoked access**

- Chip: **Reconnect required**
- Copy: Google no longer allows sending from this mailbox.
- Button: **Connect Gmail** again

There is **one mailbox per organization**. No mailbox switcher in v1.

---

### 4.2 Email → Compose (one person, also opened from a contact)

Opened from **Contacts → Send email**, or from **Email → Compose** after picking one contact.

| Control | Behavior |
|---------|----------|
| From | Read-only connected mailbox |
| To | Read-only contact name + email |
| Subject | Text input |
| Message | Text area |
| Use template | Optional dropdown of this org’s email templates. Choosing one fills subject + message; user can still edit. |
| Send | Primary. Disabled until subject and message are non-empty, mailbox is connected, contact has email, and email permission is on. |
| Cancel | Closes without sending |

**If mailbox is not connected:** empty state with **Connect Gmail** (admins) instead of the form.

**If contact has no email:** **Send email** is hidden on that contact. On Compose, that contact does not appear in search.

**If email exists but permission is off:** show the contact as not eligible, with link **Turn on email permission** (opens the contact). Do not send.

**After a successful click:** toast “Accepted by Gmail” and a link to **Sent**. Do not say Delivered or Read.

---

### 4.3 Email → New send (many contacts) — Phase 2 only

This screen is not part of the initial one-to-one release. It may be designed now, but it must remain unavailable until email consent, suppression, unsubscribe, throttling, and sender-reputation controls are implemented.

Same fields as Compose, plus an audience list.

| Control | Behavior |
|---------|----------|
| Audience | List of eligible contacts only (email + permission). Search by name, phone, or email. Checkboxes. Select all on this filtered list. |
| Count | “12 contacts selected” |
| Duplicate emails | If two contacts share one email, show a note and send **once** to that address. |
| Send | Starts a run. Each person is one email. |
| Progress | Accepted / Failed / Waiting. User can leave the page; **Sent** keeps the rows. |

Stop the run in the UI when Google says the daily limit is hit. Copy the Google error in plain language plus “Wait up to 24 hours.”

No schedule picker, no Cc/Bcc, no attachment, no “send as WhatsApp campaign.”

---

### 4.4 Email → Templates

List + editor. These are **Samyoj email templates**, not WhatsApp templates.

**List**

- Name, subject preview, updated time
- **New template**, row **Edit**, row **Delete** (confirm)

**Editor**

- Name, Subject, Text body, optional HTML body
- Variable chips the user can insert: `{{name}}` `{{email}}` `{{phone}}`
- Preview panel: sample contact “Asha / asha@example.com / +91…” with variables filled
- **Save**

Empty list: “No email templates yet” + **New template**.

---

### 4.5 Email → Sent

Table of emails this org sent through Samyoj.

| Column | Values |
|--------|--------|
| When | Date and time |
| To | Name if we have the contact, otherwise the address |
| Subject | |
| Status | **Accepted by Gmail** or **Failed** |
| Detail | On failure: short reason (invalid address, mailbox limit, reconnect required). On success: no open/read column. |

Filters: All / Accepted / Failed. Search by name, email, or subject.

Empty: “No emails sent yet” + **Compose**.

Row click opens a read-only detail: From, To, Subject, message text, status, time. No reply box.

---

### 4.6 Contact form (only the email additions)

Existing contact fields stay. Add:

| Field | UI |
|-------|-----|
| Email | Text input, optional for saving the contact, required before send |
| Can email this contact | Toggle, default off |
| When they opted in | Read-only timestamp after the toggle is turned on (set by the system) |

Turning the toggle **off** blocks future sends. It does not delete past **Sent** rows.

WhatsApp “opted in” stays on the WhatsApp section and does not control this toggle.

---

### 4.7 Dashboard / nav (light)

If Gmail is connected, the workspace is not a blank “connect something” wall just because WhatsApp is off.

- Top bar on Email routes: **Live** when the mailbox is connected, **Not connected** when it is not.
- Dashboard quick action: **Email** → Compose, only when the mailbox is connected.

---

## 5. User flows (generate these paths)

### Flow A — First connect

1. Settings → Channels → Gmail  
2. **Connect Gmail**  
3. Google screen: allow “Send email on your behalf”  
4. Return to Settings; mailbox address visible; chip **Connected**

### Flow B — Allow a contact, then send one email

1. Contacts → open contact → save **Email** → turn on **Can email this contact**  
2. **Send email**  
3. Optional: pick a template  
4. Edit subject and message → **Send**  
5. Toast **Accepted by Gmail** → Sent row with that status

### Flow C — Template, then many people — Phase 2 only

1. Email → Templates → **New template** → save  
2. Email → **New send** → apply template → tick eligible contacts → **Send**  
3. Progress, then rows on **Sent**

### Flow D — Cannot send

Show a blocked state, not a silent failure:

| Situation | What the screen says |
|-----------|----------------------|
| No mailbox | Connect Gmail first |
| No email on contact | Add an email on the contact |
| Permission off | Turn on email permission |
| Google daily limit | Sending paused. Wait up to 24 hours. |
| Google access revoked | Reconnect Gmail |
| Not an admin | Ask an admin to connect Gmail |

---

## 6. Feature list

**Include**

- Connect / disconnect one Gmail or Workspace mailbox  
- Show the mailbox address  
- Contact email + separate email permission  
- One-person compose from a contact  
- Email templates with `{{name}}` `{{email}}` `{{phone}}`  
- Sent list and read-only detail  
- Status words: **Accepted by Gmail**, **Failed**, **Connected**, **Reconnect required**

**Phase 2, only after compliance and sending-safety gates:**  

- Audience selection for many contacts
- De-duplication by email address
- Per-recipient progress and skip reasons
- Unsubscribe/suppression handling
- Throttled queue with stop-on-limit behavior

**Do not draw**

- Inbox, threads, reply, forward  
- Opened / clicked / delivered / read ticks  
- Cc, Bcc, attachments, schedule send  
- WhatsApp template picker or campaign wizard  
- Multiple mailboxes  
- SMTP settings, app password, “From” address the user types  
- A remaining-sends counter (Google does not give one)

---

## 7. Copy to reuse on the screens

- “Send from your connected Gmail. Not an inbox.”  
- “Samyoj does not read your Gmail.”  
- “Accepted by Gmail” (never “Delivered” or “Read”)  
- “Can email this contact”  
- “Google limits this mailbox — about 500 a day on free Gmail, about 2,000 a day on paid Workspace.”

---

## 8. Suggested screen inventory for a UI pass

1. Settings / Channels / Gmail — disconnected  
2. Settings / Channels / Gmail — connected  
3. Settings / Channels / Gmail — reconnect required  
4. Contact drawer — email + permission + **Send email**  
5. Compose modal — one recipient  
6. Compose — blocked (no permission / no mailbox)  
7. New send — audience + template (Phase 2)  
8. New send — progress (Phase 2)  
9. Templates — empty and filled list  
10. Template editor + preview  
11. Sent — empty, filled, failed row  
12. Sent detail — read only
