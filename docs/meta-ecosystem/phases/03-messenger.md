# Phase 3 — Messenger inbox

**Ships:** Page DMs in their own inbox. Same Page token as phase 1.  
**Menu:** `Facebook → Inbox` beside Leads.

## Do

- Subscribe the Page to `messages` (in addition to `leadgen`).
- Map PSID → `ContactPlatformIdentity`. Open a conversation on `channelId`, not `whatsappNumberId`.
- Send and receive **text** inside 24 hours ([Messenger standard messaging](https://developers.facebook.com/documentation/business-messaging/messenger-platform/policy)).
- Reuse assign, notes, Open / Pending / Closed, human handoff.
- Reuse the Inbox 3-pane layout as a **separate route** (`/facebook/inbox`), not a filter on `/inbox`.

## Don't

- Do not mix these threads into WhatsApp Inbox.
- Do not show the WhatsApp template picker. Outside 24h the composer is locked: “Wait for the customer to message again.”
- Do not blast campaigns.
- Do not use Recurring Notifications (deprecated 10 Feb 2026 in our plan; do not re-enable).
- Do not link the WABA to the Page via API. That stays a Business Manager click.

## How it works

```text
Customer messages the Page
  → object=page field=messages
  → Channel by page id → org
  → Facebook Inbox row
Agent replies within 24h → POST Page messages API (new function, not meta.service WhatsApp send)
```

## UI

Clone Inbox: list, thread, details. Differences only:

| Element | Change |
|---------|--------|
| List header chips | Keep All / Unread / Open. **Remove** Active/Inactive WhatsApp window chips. One line: “24h reply window”. |
| Window pill | Same component. Closed copy is Messenger-specific. |
| Composer | Text + the existing attach limits you have verified for Messenger. No template button. |
| Sidebar | Facebook group, blue mark, child **Inbox** |
| Empty | “No Messenger chats yet.” Link: Settings → Facebook Page if no Page. |

## Test

- [ ] Message the Page from a test user. It appears only under Facebook → Inbox.
- [ ] WhatsApp Inbox list is unchanged.
- [ ] Reply inside 24h delivers.
- [ ] After the window, send is rejected in UI and API.
- [ ] Same PSID twice updates one thread.
- [ ] A lead from phase 1 does not become a Messenger thread unless they also message the Page.

## Competitors

Respond.io merges this into the WhatsApp thread; their users asked to stop (Jan 2026). Wati keeps a separate Instagram tab for the same reason. We follow the separate list.
