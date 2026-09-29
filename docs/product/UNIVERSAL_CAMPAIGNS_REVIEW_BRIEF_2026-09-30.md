# Universal Campaigns: Short Review

**Date:** 30 September 2026  
**Read this first.** The longer evidence log remains in [UNIVERSAL_CAMPAIGNS_REVIEW_2026-09-30.md](./UNIVERSAL_CAMPAIGNS_REVIEW_2026-09-30.md).

## Honest verdict

Campaigns can become a universal product, but not a universal “send to everyone” button.

The safe meaning of universal is:

- one campaign workflow;
- explicit channel and sender;
- reusable Contacts audiences;
- channel-specific consent and eligibility;
- channel-specific sender adapters;
- truthful provider statuses.

Contacts should own people, identities, tags, consent, suppression, and audiences. Campaigns should execute a frozen audience send. Automations should remain event-based journeys. Inbox should remain one-to-one/human support.

## What is already right

The existing WhatsApp Campaigns implementation already has the right safety foundation:

- approved-template validation;
- WhatsApp-number isolation;
- auditable opt-in and opt-out checks;
- audience preview and exclusions;
- scheduled sends and repeats;
- queue batching and bounded retries;
- idempotency and stale-job protection;
- delivery/read webhook status;
- failed vs ambiguous send handling;
- retarget cohorts.

Campaigns was moved in the sidebar under **Contacts**, but its current send engine is still WhatsApp-only. That is intentionally honest.

## Channel reality

### WhatsApp — supported first

Can do:

- approved templates to opted-in contacts;
- scheduled/repeated campaigns;
- free-form replies during the 24-hour customer-service window;
- delivery/read reporting from webhooks.

Cannot do:

- free-form bulk messages outside the window;
- send to pasted numbers that are not consented Contacts;
- guarantee delivery just because the API accepted a request.

Rule: keep the current WhatsApp adapter and its fail-closed consent. Do not generalize it by merely adding a `channel` field.

Official sources: [opt-in](https://developers.facebook.com/docs/whatsapp/overview/getting-opt-in/), [Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api/overview/), [service messages](https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages/).

### Facebook Messenger — triggered messaging, not broadcast

Can do:

- reply to a person who messaged the Page within the standard window;
- limited utility/account/event messages where Meta allows them;
- one private reply to an eligible comment/visitor post;
- One-Time Notification only after the person requested it and the Page is eligible;
- human-agent support.

Cannot promise:

- “message all Page followers”;
- DM uploaded phone/email lists;
- DM people only because they saw an ad or belong to a Custom Audience;
- recurring promotional broadcasts as a normal API feature.

Recommendation: start with Inbox replies and comment-triggered private replies. Keep Ads audiences separate from messaging recipients.

Sources: [Send API](https://developers.facebook.com/docs/messenger-platform/send-messages/), [policy](https://developers.facebook.com/docs/messenger-platform/policy/), [private replies](https://developers.facebook.com/docs/messenger-platform/discovery/private-replies/).

### Instagram — conversation and comment triggers

Can do:

- reply after a user messages the Professional account;
- private reply to an eligible comment on owned content within Meta’s time limit;
- human-agent support;
- narrowly scoped message triggers backed by webhook evidence.

Cannot promise:

- “message all followers”;
- group messaging;
- DM an uploaded contact list;
- DM someone only because they follow, viewed an ad, or commented historically outside the allowed context.

Recommendation: keep the first Instagram outreach surface inside Inbox/Comments. Do not call it broadcast until Meta proves a specific approved capability for the connected account.

Sources: [Instagram Messaging](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/messaging-api/), [overview](https://developers.facebook.com/docs/instagram-messaging/overview/), [private replies](https://developers.facebook.com/docs/instagram-platform/private-replies).

### Email/Gmail — possible, but not ready as Campaigns

Can do:

- individual fan-out from a connected mailbox;
- templates and personalization;
- queued sends with provider acceptance/failure tracking.

Must be added before marketing campaigns:

- normalized email identity and dedupe;
- list/subscription purpose;
- suppression, bounce, complaint, and unsubscribe handling;
- visible unsubscribe and RFC 8058 one-click headers where applicable;
- sender authentication and preflight;
- mailbox quota/throttling and stop-on-limit behavior;
- status wording that says `ACCEPTED`, not `DELIVERED`.

Current Gmail work is a send foundation, not a complete Campaign adapter. Reconcile the Prisma schema, generated client, routes, tests, and runtime before exposing Email Campaigns.

Sources: [Gmail sending](https://developers.google.com/workspace/gmail/api/guides/sending), [Workspace limits](https://support.google.com/a/answer/166852), [sender guidelines](https://support.google.com/a/answer/81126), [RFC 8058](https://www.rfc-editor.org/rfc/rfc8058.html).

## Recommended product design

The campaign wizard should eventually be:

```text
Channel
→ Sender
→ Audience
→ Message
→ Eligibility preview
→ Schedule
→ Review and send
```

Every preview should show:

```text
matched
- missing channel identity
- no consent / suppressed
- outside provider window
- invalid or unreachable identity
= eligible
```

Every run should store a frozen recipient snapshot and the eligibility/consent evidence used for that run.

Use separate content types:

- WhatsApp: approved template and components;
- Email: subject, plain text, HTML, subscription and unsubscribe data;
- Messenger: PSID plus window/notification/private-reply context;
- Instagram: IGSID plus qualifying interaction/private-reply context.

Do not reuse WhatsApp templates, phone consent, delivery statuses, or quotas for other channels.

## What we should not build

- follower-wide Facebook/Instagram DMs;
- Meta DMs to uploaded phone/email lists;
- silent cross-channel fallback;
- a nullable-field patch to the current WhatsApp schema;
- automatic retry of ambiguous provider calls;
- campaign logic inside Automations;
- Gmail “delivered/read” claims from a successful API response;
- a full CDP, anonymous identity graph, predictive audience system, or reverse-ETL platform.

## Suggested order

1. Keep the sidebar move and legacy `/campaigns` routes.
2. Put a channel-adapter boundary around the existing WhatsApp engine.
3. Finish Email consent, suppression, unsubscribe, quota, schema, and runtime proof.
4. Add Messenger triggered outreach, not follower broadcast.
5. Add Instagram Inbox/Comment-triggered outreach, not follower broadcast.
6. Only expose a channel in Campaigns after its account, permissions, eligibility, sender, and status evidence are proven.

## Decisions needed before implementation

1. Should `/campaigns` remain visually marked as a WhatsApp surface until Email/Meta adapters exist, or should the topbar become channel-neutral now?
2. Should Email initially support only selected opted-in Contacts, or full subscription lists?
3. Should Messenger/Instagram outreach live in Inbox/Comments first, or appear in Campaigns as a restricted “triggered outreach” type?

