# Universal Campaigns Review

**Review date:** 30 September 2026  
**Scope:** Campaigns navigation, current WhatsApp implementation, and a safe path toward WhatsApp, Facebook Messenger, Instagram Messaging, and Email.  
**Decision boundary:** This review does not claim that Facebook or Instagram support arbitrary follower broadcasts. It also does not turn the current WhatsApp schema into a universal schema by adding nullable fields.

**Short version:** Read [UNIVERSAL_CAMPAIGNS_REVIEW_BRIEF_2026-09-30.md](./UNIVERSAL_CAMPAIGNS_REVIEW_BRIEF_2026-09-30.md) first. This file is the detailed evidence log.

## Executive decision

Campaigns should become a Contacts-owned outbound product, but “universal” must mean a shared campaign workflow with channel-specific eligibility and send adapters. It must not mean that every channel can message every person in the Contacts table.

Recommended product language:

- **Contacts** owns people, channel identities, consent, suppression, tags, and reusable audiences.
- **Campaigns** executes a bounded outbound send to a frozen audience snapshot.
- **Automations** reacts to events and runs journeys; it is not another campaign composer.
- **Inbox** handles one-to-one conversations and human follow-up.
- **Ads** acquires or retargets audiences; an ad audience is not automatically a messaging audience.

The first navigation change is safe and small: move the Campaigns item from the WhatsApp sidebar group into Contacts while preserving the existing `/campaigns` routes and `/api/campaigns` API. The current page remains WhatsApp-only until the channel adapters below are implemented and verified.

## Evidence boundaries

- **Current code:** statements about the checked-out Samyoj implementation and its working-tree state, backed by local file paths.
- **Provider capability:** statements from dated official Meta, Google, RFC, and compliance sources linked below.
- **Recommendation:** proposed product or architecture direction, explicitly labeled as such.
- **Unknowns and external gates:** permissions, App Review, live webhooks, provider quotas, deliverability, and account-specific behavior that code review cannot prove.

## 1. Current implementation: Campaigns is WhatsApp-only

### Client and navigation

The current product surface is spread across:

- [client/src/config/navigation.ts](../../client/src/config/navigation.ts): Campaigns is currently a child of the WhatsApp platform group; mobile also exposes `/campaigns` when WhatsApp is connected.
- [client/src/pages/CampaignsPage.tsx](../../client/src/pages/CampaignsPage.tsx): list, detail, cohorts, retry, pause/resume, reschedule, duplicate, and campaign actions. It imports WhatsApp number state, WhatsApp empty states, phone validation, and `WhatsAppTemplatePreview`.
- [client/src/pages/CampaignWizardPage.tsx](../../client/src/pages/CampaignWizardPage.tsx): the wizard loads approved WhatsApp templates and connected WhatsApp numbers, blocks when no active number exists, and builds a phone/template payload.
- [client/src/components/campaigns/wizard/campaignWizardModel.ts](../../client/src/components/campaigns/wizard/campaignWizardModel.ts): the form contains `whatsappNumberId`, phone lines, Meta template parameters, and WhatsApp-specific audience behavior.
- [client/src/utils/workspaceChannels.ts](../../client/src/utils/workspaceChannels.ts): `/campaigns` is currently treated as a WhatsApp surface, so topbar connection state follows the active WhatsApp number.
- [client/src/components/dashboard/UpcomingCampaignsCard.tsx](../../client/src/components/dashboard/UpcomingCampaignsCard.tsx) and [client/src/components/dashboard/DashboardQuickActions.tsx](../../client/src/components/dashboard/DashboardQuickActions.tsx): dashboard links and “New campaign” actions still target the legacy route.

### API and server flow

- [server/src/modules/campaigns/routes.ts](../../server/src/modules/campaigns/routes.ts) mounts the campaign API and applies `resolveActiveWhatsappNumber` to both read and mutation guards.
- Every campaign request is organization-scoped and active-number-scoped. A missing active number produces an empty campaign scope; multiple active numbers require an explicit active-number context.
- [server/src/modules/campaigns/types.ts](../../server/src/modules/campaigns/types.ts) defines `MANUAL`, `TAGS`, `CONTACTS`, and `ALL_OPTED_IN`, but the recipient contract is still a phone line and the message contract is a Meta template.
- [server/src/modules/campaigns/service.ts](../../server/src/modules/campaigns/service.ts) resolves audiences, validates the active number and approved template, reserves quota, persists recipient rows, schedules runs, and queues broadcast batches.
- [server/src/workers/index.ts](../../server/src/workers/index.ts) runs the `broadcast-queue`. Its job payload requires `whatsappNumberDbId`, Meta `phoneNumberId`, WABA identity, template data, and `runVersion`. A context mismatch is treated as a stale job.
- [server/src/modules/whatsapp/provider-status.ts](../../server/src/modules/whatsapp/provider-status.ts) applies Meta webhook status changes to campaign recipients.
- [server/src/modules/analytics/routes.ts](../../server/src/modules/analytics/routes.ts) reports broadcast/template metrics that are currently WhatsApp-shaped.

### Schema

The current models in [server/prisma/schema.prisma](../../server/prisma/schema.prisma) are not channel-neutral:

- `Campaign.whatsappNumberId` is the sender/account boundary.
- `CampaignRecipient.phone` is the recipient identity.
- `CampaignRecipient.metaMessageId` is the provider message identity.
- Status and timestamps are designed around Meta `SENT`, `DELIVERED`, `READ`, and `FAILED` webhooks.
- Quota reservations are named and priced around campaign sends, but the actual policy is WhatsApp-specific.
- Repeats, retarget cohorts, and run generations are useful reusable concepts, but their current implementation queries WhatsApp conversations and phone identities.

### WhatsApp-specific assumption inventory

These assumptions are load-bearing and must not be generalized by renaming the UI:

- the selected sender is an active `WhatsappNumber`;
- an organization/number header selects the workspace;
- recipients are phone identities, normalized with phone rules;
- audience contacts are scoped to the selected WhatsApp number;
- campaigns send approved Meta WABA templates;
- template language, components, media, coupon, and URL suffixes follow Meta shapes;
- consent is WhatsApp opt-in plus source, timestamp, and opt-out state;
- free-form follow-up depends on the WhatsApp customer-service window;
- quota and budget rules model Meta messaging limits and categories;
- status updates arrive through WhatsApp webhooks;
- delivery/read timestamps are Meta-specific evidence;
- worker safety compares WABA, phone-number, campaign, and run-version context;
- retries must distinguish provider failure from ambiguous provider boundary;
- retarget cohorts query WhatsApp conversations and inbound phone-linked messages;
- successful sends write WhatsApp Inbox/template-message side effects.

### Consent and safety

[server/src/modules/campaigns/recipients.ts](../../server/src/modules/campaigns/recipients.ts) requires:

```text
optedIn
+ consentSource
+ consentAt
+ no optOutAt
```

Manual phone input is not an escape hatch: the server matches it back to an organization/number-scoped Contact and applies the same consent check. The worker re-checks consent before the provider call and stores a consent snapshot.

This is the right safety pattern, but the fields and identity must become channel-specific. A WhatsApp opt-in cannot be silently treated as email, Messenger, or Instagram consent.

### Existing strengths worth preserving

The current Campaigns implementation already has valuable primitives:

- audience preview and exclusion counts;
- frozen recipient rows per run generation;
- idempotency keys and provider-boundary checks;
- scheduled sends and wall-clock repeat handling;
- bounded queue retries;
- pause/cancel behavior that avoids blindly retrying ambiguous provider calls;
- delivery/read status updates;
- retarget cohorts (`read`, `delivered_unread`, `replied`, `window`, `failed`, `no_reply`);
- fail-closed consent.

These are campaign-core concepts. The sender, recipient identity, content, consent, quota, status, and provider logic are not shared yet.

## 2. Official capability review

The following is a product capability decision, not a promise that every permission is currently enabled in the Samyoj Meta app. Meta and Google can change limits, access levels, and policy; production capability still requires live account, permission, review, and webhook proof.

### Channel matrix

| Channel | What can be sent safely | What cannot be promised | Eligibility boundary | Evidence/status |
|---|---|---|---|---|
| WhatsApp | Approved template sends at scale; free-form service replies during an open customer-service window; scheduled/repeat campaigns when each recipient remains consented and eligible | Free-form bulk sends outside the window; sending to a phone list without auditable opt-in; guaranteed delivery | Contact must be tied to the selected WhatsApp number and have auditable consent. Free-form messaging needs the active service window; outside it, use an approved template | Existing adapter is operational in code; live provider proof remains an external gate |
| Facebook Messenger/Page | One-to-one replies inside the standard window; narrow utility/account/event cases where Meta permits them; one-time notification only with the required user request and Page permission; comment/visitor-post private replies; human-agent support | “Message all Page followers”; uploading phones/emails and DMing them; treating ad views or Custom Audiences as DM permission; recurring promotional broadcasts as a default product | Page-scoped recipient identity, prior interaction/eligible entry point, policy/tag/permission-specific eligibility | Requires Page permissions, access level/App Review, Page webhook subscription, and live validation |
| Instagram Messaging | One-to-one replies after the user messages the Professional account; comment/private replies within the allowed period; human-agent support; tightly scoped triggers from owned content | “Message all followers”; group messaging; DMing an uploaded contact list; sending because someone only viewed an ad or follows the account; arbitrary recurring broadcast | Instagram-scoped recipient identity and a qualifying interaction; request-folder and inactivity rules apply | Requires the chosen Instagram API path, permissions, access level/App Review, webhooks, and live validation |
| Email/Gmail | Individual fan-out from a connected mailbox, with a proper subscription/consent model, suppression, unsubscribe, throttling, and sender authentication | Treating Gmail API acceptance as delivery; unlimited bulk mail from a personal/Workspace mailbox; marketing send without unsubscribe/suppression controls | Normalized email identity, purpose-specific consent or lawful basis, active suppression check, sender/domain limits | Current working tree contains Gmail send foundation, but not a complete Campaign adapter; build/schema/runtime proof is still required |

### WhatsApp

Meta’s official guidance says businesses must obtain opt-in before messaging. Opt-in should make the business and expected message categories clear, and opt-out requests must be honored. Templates are the mechanism for messages outside the customer-service window; free-form service messages require an open 24-hour window.

Sources:

- [Get opt-in for WhatsApp](https://developers.facebook.com/docs/whatsapp/overview/getting-opt-in/)
- [WhatsApp Cloud API overview](https://developers.facebook.com/docs/whatsapp/cloud-api/overview/)
- [Service messages](https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages/)
- [WhatsApp pricing and conversation categories](https://developers.facebook.com/docs/whatsapp/pricing/)
- [WhatsApp Business Messaging Policy](https://business.whatsapp.com/policy)

The existing implementation correctly reflects much of this: approved-template validation, number isolation, consent filtering, quota, retries, and webhook statuses. The universal product must preserve those rules rather than hiding them behind a generic “send” button.

### Facebook Messenger

The standard messaging window is generally 24 hours after a person interacts with the Page or an eligible entry point. Private replies are a trigger capability: one message to a commenter or visitor-post author within the allowed period, not a general follower broadcast. One-Time Notifications are a single follow-up after explicit user request and Page-level eligibility; they are not recurring campaigns. Human Agent is a support exception, not an automated promotion channel.

Customer-list Custom Audiences are for ad targeting. They do not grant Send API permission to direct-message those people.

Sources:

- [Messenger Send API](https://developers.facebook.com/docs/messenger-platform/send-messages/)
- [Messenger and Instagram messaging policy](https://developers.facebook.com/docs/messenger-platform/policy/)
- [Messenger private replies](https://developers.facebook.com/docs/messenger-platform/discovery/private-replies/)
- [Messenger FAQ and One-Time Notifications](https://developers.facebook.com/docs/messenger-platform/faq/)
- [Page Messages reference](https://developers.facebook.com/docs/graph-api/reference/page/messages/)
- [Custom Audiences](https://developers.facebook.com/docs/marketing-api/audiences/guides/custom-audiences/)

### Instagram Messaging

Instagram Messaging is a conversation and trigger surface, not a follower broadcast surface. A qualifying user message opens the normal response window. Private replies can target a commenter on an owned post, reel, ad post, or live content within the documented time boundary; only one private reply is allowed, and follow-up depends on the person replying. Group messaging is unsupported.

The implementation choice must also be explicit: Instagram Login permissions and the Messenger Platform/Page-linked path have different setup and access requirements. A multi-business SaaS needs the appropriate Advanced Access/App Review path before treating this as a customer-facing capability.

Sources:

- [Instagram Messaging API with Instagram Login](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/messaging-api/)
- [Instagram Messaging overview](https://developers.facebook.com/docs/instagram-messaging/overview/)
- [Instagram private replies](https://developers.facebook.com/docs/instagram-platform/private-replies)
- [Messenger Platform Instagram private replies](https://developers.facebook.com/docs/messenger-platform/instagram/features/private-replies/)
- [Instagram webhooks](https://developers.facebook.com/docs/instagram-platform/webhooks/)

### Email/Gmail

Gmail’s API sends an RFC 2822/MIME message to the Gmail account’s recipients. A successful `messages.send` response is provider acceptance with a Gmail message ID; it is not proof that the recipient accepted, received, opened, or read the message.

Google Workspace limits are account-dependent and can change. Current guidance includes daily sending and recipient limits, 429 behavior, authentication requirements, spam-rate controls, and one-click unsubscribe requirements for high-volume marketing/subscription mail. RFC 8058 requires `List-Unsubscribe` and `List-Unsubscribe-Post` headers, with a valid DKIM signature covering the headers.

Sources:

- [Gmail API sending](https://developers.google.com/workspace/gmail/api/guides/sending)
- [Gmail API quotas](https://developers.google.com/workspace/gmail/api/reference/quota)
- [Google Workspace Gmail sending limits](https://support.google.com/a/answer/166852)
- [Gmail email sender guidelines](https://support.google.com/a/answer/81126)
- [Gmail sender FAQ](https://support.google.com/a/answer/14229414)
- [Email subscription guidelines](https://support.google.com/a/answer/15263077)
- [RFC 8058 one-click unsubscribe](https://www.rfc-editor.org/rfc/rfc8058.html)
- [CAN-SPAM compliance guide](https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business)
- [UK PECR electronic mail guidance](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guide-to-pecr/electronic-mail-marketing/)

The current working tree has an email backend foundation under [server/src/modules/gmail](../../server/src/modules/gmail), `GmailMailbox`, `EmailTemplate`, and `EmailSend` models, and an embedded `gmail-send` worker. It is not yet a Campaign adapter: there is no campaign/run/schedule model, no normalized-email campaign dedupe, no complete suppression/unsubscribe endpoint, and no delivery/read evidence. The current `Gmail` fields used by routes also need schema/generated-client/build reconciliation before being treated as shippable.

## 3. Universal campaign recommendation: what “universal” should mean

Universal should share the lifecycle, not erase channel policy:

```text
Contacts
  identities + consent + suppression + tags + saved audiences
       |
       v
Campaign
  channel + sender + purpose + content + audience + schedule
       |
       v
CampaignRun
  frozen recipients + eligibility snapshot + quota + idempotency
       |
       v
ChannelAdapter
  WhatsApp | Email | Messenger | Instagram
       |
       v
CampaignDelivery
  provider id + provider status + timestamps + error + evidence
```

### Proposed concepts

#### Campaign

Common fields:

- organization;
- channel (`WHATSAPP`, `EMAIL`, `MESSENGER`, `INSTAGRAM`);
- purpose/category;
- sender account reference;
- audience source and include/exclude rules;
- schedule, timezone, repeat policy;
- lifecycle status and audit fields.

#### Sender account

Never infer the sender from the latest connected account:

- WhatsApp → `whatsappNumberId`;
- Email → `gmailMailboxId`;
- Facebook → Page/channel identity;
- Instagram → connected Professional account identity.

If an organization has multiple accounts for the selected channel, require explicit selection.

#### Audience

Contacts should be the system of record, with reusable:

- selected-contact audiences;
- static saved segments;
- dynamic segments;
- tags;
- previous-run cohorts;
- channel-identity coverage filters.

At preview time, show:

```text
matched
- missing channel identity
- no consent / suppressed
- outside provider window
- invalid or unreachable identity
= eligible to send
```

The actual run must freeze recipient rows. A dynamic segment may change later, but an in-progress run must remain explainable.

#### Channel-specific content

- WhatsApp: approved template name, language, components, category, and parameter mapping.
- Email: subject, plain text, sanitized HTML, template, subscription identity, unsubscribe metadata.
- Messenger: message type, window/tag/one-time-notification/private-reply context, and recipient PSID.
- Instagram: message type, IGSID, 24-hour or private-reply context, and owned-content reference where required.

Do not reuse WhatsApp template records as Email, Messenger, or Instagram content records.

#### Consent and suppression

Keep a channel/category-aware consent ledger. A generic boolean such as `subscribed` is insufficient:

- WhatsApp needs business/category opt-in, source, timestamp, and opt-out behavior.
- Email needs subscription identity, consent/lawful-basis evidence, suppression, bounce/complaint handling, and one-click unsubscribe for applicable mail.
- Messenger/Instagram need interaction/window/trigger eligibility. A phone or email opt-in does not create a Meta-scoped messaging permission.

#### Status and evidence

Use a common lifecycle but preserve provider truth:

- `QUEUED`, `SENDING`, `ACCEPTED`, `FAILED`, `AMBIGUOUS` can be common operational states.
- WhatsApp may add `DELIVERED` and `READ` from webhooks.
- Gmail can report provider acceptance and failure, not delivery/read, unless a separately verified provider signal exists.
- Messenger/Instagram need provider IDs and webhook/error evidence; acceptance must not be labeled delivery.

## 4. Recommended phases

### Phase 0: navigation and product language

Move Campaigns from the WhatsApp platform group into Contacts in [client/src/config/navigation.ts](../../client/src/config/navigation.ts). Preserve:

- `/campaigns`;
- `/campaigns/new`;
- `/campaigns/:id/edit`;
- dashboard/contact links;
- `/api/campaigns`;
- existing bookmarks and query parameters.

Do not change the send engine in this phase. The page should remain honest about its current WhatsApp requirement until Phase 1.

The mobile bottom navigation can remain a separate responsive decision; it should not imply that Campaigns is available for a Meta-only or Email-only workspace until channel capability exists.

### Phase 1: preserve WhatsApp as the first adapter

Extract a channel adapter boundary around the existing implementation without changing its safety rules:

- account validation;
- consent eligibility;
- template validation;
- quota/throttling;
- recipient materialization;
- provider send;
- delivery webhooks;
- retry and ambiguous-state handling.

Do not migrate existing campaign rows by guessing a channel. Existing rows are WhatsApp campaigns because their schema and send history say so.

### Phase 2: Email campaign readiness

Before exposing “Email campaign”:

- reconcile Prisma schema, migration, generated client, and route fields;
- create campaign/run/delivery ownership rather than treating `EmailSend` rows as a campaign;
- normalize and dedupe email identities;
- add list/subscription identity and suppression;
- add visible unsubscribe and RFC 8058 headers where applicable;
- add sender/domain authentication guidance and preflight;
- add mailbox/account quota tracking, bounded throttling, and stop-on-limit behavior;
- label Gmail acceptance as `ACCEPTED`, not `DELIVERED`;
- add integration tests with provider mocks and a negative test proving unsubscribed contacts are excluded.

### Phase 3: Messenger triggered messaging

Start with capabilities that map to verified events:

- inbound message reply;
- comment/visitor-post private reply;
- explicit One-Time Notification flow only if the Page is approved and the user requested it;
- human-agent escalation in Inbox.

Do not build “blast followers”. Keep Ads Custom Audiences and messaging recipients separate.

### Phase 4: Instagram triggered messaging

Start with:

- inbound Instagram conversation reply;
- comment/private-reply flow for owned posts/reels/ads/live where the webhook and time boundary are verified;
- human-agent escalation.

Do not represent followers, commenters, or ad viewers as freely messageable campaign contacts. Store the scoped identity and qualifying interaction evidence.

## 5. Non-goals

Do not build these as part of universal Campaigns:

- follower-wide Facebook or Instagram DMs;
- uploaded phone/email lists sent directly to Meta DMs;
- silent cross-channel fallback;
- a nullable-field patch to the current `Campaign` model;
- a shared WhatsApp template catalog reused as Email or Instagram content;
- automatic retry of `AMBIGUOUS` provider calls;
- campaign branching, tickets, SLA workflows, or event journeys inside Campaigns;
- predictive audiences, anonymous identity graphs, warehouse reverse-ETL, or multi-touch attribution;
- treating an ad impression, follower relationship, or phone/email consent as a Meta DM permission;
- claiming Gmail acceptance is delivery or read.

## 6. Risks and external gates

- Meta permissions and App Review may reject or limit customer-owned Pages/Instagram accounts even when local test accounts work.
- Meta policy and API behavior changes; capability claims need a dated source and live smoke test.
- Instagram has multiple integration paths with different permissions and recipient semantics.
- Current Campaigns data is number-scoped; a migration that guesses identities can cross tenants or connected accounts.
- Gmail send foundation is not the same as deliverability. Domain authentication, suppression, complaints, bounce handling, and unsubscribe are product responsibilities.
- A campaign can be accepted by a provider and still fail later; statuses must reflect evidence.
- The working tree currently contains unrelated uncommitted Gmail/Instagram changes. Those changes must be verified independently and must not be accidentally bundled into a Campaigns refactor.

## 7. Review checklist

Before implementing the universal model, approve these defaults:

- Contacts is the audience system of record.
- Campaigns and Automations remain separate.
- Channel and sender are explicit first-class choices.
- WhatsApp remains the first fully supported campaign adapter.
- Email is gated until consent, suppression, unsubscribe, quota, and schema/runtime proof are complete.
- Facebook and Instagram begin as triggered/conversation capabilities, not follower broadcast.
- Every audience preview reports exclusion reasons.
- Every run stores a frozen recipient snapshot and consent/eligibility evidence.
- Provider acceptance, delivery, read, and reply are distinct statuses.
- Legacy `/campaigns` routes remain compatible during the navigation move.

## 8. Open questions for the next review

1. Should the first post-review navigation implementation also update the topbar classification so `/campaigns` is no longer treated as a WhatsApp surface, or should that remain until the first universal adapter exists?
2. For Email, should Samyoj own subscription lists and sending, or should it initially support only transactional/selected-contact sends from the connected Gmail mailbox?
3. For Messenger/Instagram, should the first product surface be a campaign-like “triggered outreach” composer, or should it live inside Comments/Inbox until Meta capability proof is complete?

## Sources consulted

Platform sources are linked in the channel sections above. Product patterns reviewed:

- [HubSpot segments](https://knowledge.hubspot.com/segments/create-active-or-static-lists)
- [Mailchimp segments](https://mailchimp.com/help/create-and-send-to-a-segment/)
- [Brevo segments](https://help.brevo.com/hc/en-us/articles/360021703959-About-segments)
- [Intercom audiences](https://www.intercom.com/help/en/articles/3467924-dynamic-and-fixed-audiences)

These products consistently separate reusable audiences/contacts from outbound execution and from event-driven automation. That is the relevant pattern for Samyoj; it does not imply that their provider permissions or deliverability guarantees transfer to Samyoj.
