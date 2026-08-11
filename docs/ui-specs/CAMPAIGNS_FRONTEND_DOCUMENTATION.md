# Campaigns Frontend Documentation

## 1. Purpose

Campaigns is the workspace for sending approved WhatsApp messages to multiple contacts at once. It brings message selection, audience building, scheduling, sending, and delivery monitoring into one guided experience.

The campaign experience helps a business:

- Create a WhatsApp campaign from an approved template.
- Choose the people who should receive it.
- Review the audience and estimated cost.
- Send immediately or schedule the campaign.
- Monitor delivery progress.
- Review individual recipients and failed messages.
- Pause, resume, retry, duplicate, or export campaign results.

Campaigns uses approved WhatsApp templates so businesses can communicate with customers outside the normal 24-hour reply window.

---

## 2. Main Campaigns screen

### Page identity

The page is introduced with:

- **Campaigns**
- **Plan, send, and monitor campaigns**
- **Create a campaign, schedule it for later, and follow delivery from one place.**

The page is intended to provide one clear starting point for both new and experienced users.

### Summary area

The top of the page gives a quick view of campaign activity:

- **Drafts** — campaigns that have been saved but not sent.
- **Scheduled** — campaigns waiting for their selected send time.
- **Running** — campaigns currently sending.
- **Completed** — campaigns that have finished sending.

### Main actions

- **New campaign**
- **Content Studio**

New campaign begins the guided campaign creation flow. Content Studio provides a related place for preparing campaign content.

### Search

The search field uses the placeholder:

- **Search campaigns or templates**

Users can use it to locate campaigns by campaign name or template name.

### Read-only access

Users without campaign management permission see:

- **You have read-only access to campaigns. Ask an admin to create or send campaigns.**

They can still review campaign information, but campaign-changing actions are unavailable.

---

## 3. Daily campaign limit

The page can show a quota banner explaining how much campaign sending capacity has been used:

- **Daily campaign limit**
- **{sentToday} of {limit} used · {remaining} remaining**
- **Manage campaign limits**

This gives the user a clear warning before they prepare a campaign that may exceed the available daily limit.

---

## 4. Empty and filtered states

### No campaigns

When the workspace has no campaigns, the page explains the basic process:

- **No campaigns yet**
- **Send approved WhatsApp messages to multiple contacts at once.**

The recommended steps are:

1. **Create an approved template**
2. **Choose contacts to receive it**
3. **Send your campaign**

Primary action:

- **Create campaign**

### No search results

When filters or search do not find a campaign:

- **No campaigns match your filters**
- **Try a different search word or status.**

The page keeps the recovery action simple instead of presenting an error state.

---

## 5. Campaign list

### Desktop table

On larger screens, campaigns are presented in a table with:

- **Campaign**
- **Status**
- **Audience**
- **Progress**
- **Actions**

Each row can show:

- Campaign name.
- Selected template name.
- Current status.
- Scheduled date, when applicable.
- Total recipient count.
- Number sent.
- Percentage progress.

### Campaign actions

Depending on the status, the user may see:

- **Edit**
- **Pause**
- **Resume**
- **View results**
- **View campaign**
- **Send now**
- **Edit campaign**
- **Delete campaign**

Actions are status-aware. A campaign that is already complete is treated differently from a campaign that is still running.

### Mobile cards

On smaller screens, each table row becomes a campaign card containing:

- Campaign name.
- Status.
- Template badge.
- Audience badge.
- Scheduled date badge, when applicable.
- Recipient count.
- Sent count out of total.
- Progress percentage.
- Main campaign actions.

Secondary actions such as editing or deleting are available through the card’s overflow actions.

Mobile actions can include:

- **Edit**
- **Pause**
- **Resume**
- **View results**
- **View campaign**
- **Send now**
- **Edit campaign**
- **Delete campaign**

---

## 6. Campaign statuses

Campaigns use clear status labels:

- **Draft**
- **Scheduled**
- **Running**
- **Paused**
- **Completed**
- **Failed**
- **Cancelled**

### Status behavior

#### Draft

The campaign is saved but not yet sent. It can be opened, changed, and completed later.

#### Scheduled

The campaign has a future send time. It can still be reviewed or edited according to the user’s permission.

#### Running

The campaign is currently sending. The primary control is:

- **Pause**

#### Paused

Sending is temporarily stopped. The primary control is:

- **Resume**

#### Completed

Sending has finished. The campaign is primarily used for reviewing results.

#### Failed

The campaign has delivery or sending problems that need attention.

#### Cancelled

The campaign has been stopped and is no longer active.

Running campaigns use an animated status indication, while progress colors help distinguish active, successful, paused, and problem states.

---

## 7. Create and edit experience

Creating and editing a campaign use a large side panel.

### Panel titles

For a new campaign:

- **New campaign**

For an existing editable campaign:

- **Edit campaign**

For a view-only campaign:

- The campaign name, or **Campaign details**

### Panel subtitles

Create and edit:

- **Message, audience, timing, and review**

View-only:

- **Track delivery and manage this campaign**

### Panel pattern

The campaign panel:

- Keeps the campaign context visible while the user works.
- Uses a scrollable body for long forms.
- Keeps the current step visible near the top.
- Uses a footer for navigation and final actions.
- Can be closed without leaving the Campaigns page.

On mobile, the panel fills the available width and becomes a vertically scrollable sheet.

### Footer actions

Depending on the current step and campaign state:

- **Save draft**
- **Save changes**
- **Continue**
- **Back**
- **Send now · {count} included**
- **Schedule campaign · {count} included**
- **Delete campaign**

---

## 8. Campaign creation steps

The creation experience is divided into three understandable steps:

1. **Message**
2. **Audience**
3. **Review and send**

This sequence mirrors the user’s natural decision:

1. What should be sent?
2. Who should receive it?
3. When should it be sent?

The step navigation stays available so users understand where they are in the process.

---

## 9. Message step

The Message step defines the campaign name, approved template, WhatsApp number, and template values.

### Introduction

- **Use an approved template**
- **Choose an approved WhatsApp template for this campaign.**

The user cannot send a campaign without an approved WhatsApp template.

### Campaign name

- **Campaign name**
- Placeholder: **Summer promo blast**

The name is for internal organization and reporting.

### Approved template

- **Approved template**
- Placeholder: **Select approved template**

Template options are shown in a readable format:

- **{template name} ({language})**

Only approved templates appear in this selection.

If no approved templates are available:

- **No approved templates yet**
- **Create a template and wait for approval before sending.**

### WhatsApp number

When more than one WhatsApp number is available, the user can choose the sending number:

- **WhatsApp number**
- Placeholder: **Default number**

If only one number exists, the selector does not add unnecessary complexity to the screen.

### Personalization values

Template variables are presented as individual fields:

- **Message detail 1**
- **Message detail 2**
- Additional message detail fields as required.

Examples:

- **Name or other value**
- **Enter a value**

The user fills in the information that will be inserted into the approved message.

### Header values and media

Templates with header variables can show:

- **Header detail 1**
- Additional header detail fields as required.

For image, video, or document headers:

- **Add a link to the image, video, or document used in the header**
- Placeholder: **https://example.com/image.jpg**

### Message preview

The selected template is shown in:

- **Message preview**

The preview helps the user confirm the final WhatsApp appearance before moving to the audience step.

### Validation messages

The interface guides the user when information is missing:

- **Add a campaign name.**
- **Choose an approved template.**
- **Fill in every template variable before continuing.**
- **Add the required header media URL before continuing.**

---

## 10. Audience step

The Audience step defines who should receive the campaign.

### Introduction

- **Audience**
- **Who should receive this campaign?**

The audience can be built in several ways so the experience works for both quick broadcasts and carefully targeted campaigns.

### Audience choices

Available audience options include:

1. **Phone numbers**
   - **Paste or import a list**
2. **Contact tags**
   - **Choose contacts with these tags**
3. **Select contacts**
   - **Choose specific contacts**
4. A consent-based audience using opted-in contacts.

---

## 11. Audience option: phone numbers

This option is useful when the user already has a list of recipients.

### Controls

- **Add phone numbers**
- **One number per line, or import a CSV file**
- **Phone numbers**
- **One per line · {phone format hint}**

The list can be imported from CSV or JSON.

### Validation summary

The interface shows:

- **{n} valid numbers**
- **{n} invalid**
- **{n} duplicate(s)**

### Cleanup actions

- **Remove invalid rows**
- **Remove duplicates**
- **Deduplicate**

The interface also explains:

- **Duplicate numbers will be counted once.**

### Error details

Invalid entries are shown with their line and reason:

- **{n} invalid line(s) must be fixed before sending**
- **Line {n}: {value} — {error}**

This keeps data cleanup close to the point where the problem is found.

---

## 12. Audience option: contact tags

Tags allow the user to target groups without manually selecting each contact.

### Controls

- **Contact tags**
- **Separate tags with commas. Contacts matching any tag are included.**
- Placeholder: **vip, newsletter, lead**
- **Choose a tag**

Contacts matching any selected tag are included in the campaign audience.

---

## 13. Audience option: selected contacts

The contact picker lets the user choose individual people from the contact list.

### Search and selection controls

- **Search contacts**
- **Show selected**
- **Show all contacts**
- **Clear selection**
- **Select all visible**

### Loading and errors

- **Loading contacts…**
- **Could not load contacts. Refresh this section and try again.**

### Empty states

- **No selected contacts on this page**
- **No contacts found. Try a different search.**

The footer shows the current selection:

- **{n} selected**

This keeps the total visible while the user browses and filters contacts.

---

## 14. Audience option: consent-based contacts

The consent-based audience uses contacts who agreed to receive WhatsApp campaign messages.

### Callout

- **Consent-based audience**
- **Use everyone in your contact list who agreed to receive WhatsApp campaign messages.**

The screen explains that consent is checked when the campaign is saved:

- **Contacts are checked when you save. Current count: {n}.**

This makes consent a visible part of the campaign decision rather than an invisible assumption.

---

## 15. Audience preview and estimated cost

Before the user can send or schedule, the selected audience is checked.

### Preview card

- **Recipients included**

Possible states:

- **Checking your audience…**
- **Audience changed — updating…**
- **Choose an audience to see how many people are included**
- **{n} person is included in this campaign**
- **{n} people are included in this campaign**

### Estimated cost

- **Estimated campaign cost: ₹{amount}**

### Excluded contacts

If some contacts cannot receive the selected message:

- **{n} selected contact(s) can’t receive this message and won’t be included.**

The audience preview helps the user understand the actual send size instead of relying only on the number initially selected.

### Preview requirement

The audience preview must complete successfully before final sending or scheduling. If the audience changes, the previous preview is treated as outdated and must be checked again.

---

## 16. Review and send step

The final step gives the user one place to check the campaign before it becomes active.

### Introduction

- **Review and send**
- **Check the message, audience, cost, and send timing**

The review should confirm:

- Selected template.
- Template values.
- Message preview.
- Audience size.
- Excluded contacts.
- Estimated cost.
- Sending number.
- Send timing.

### Timing choices

#### Send now

- **Send now**
- **Start sending after you confirm.**

#### Schedule

- **Schedule**
- **Choose a future date and time.**

Scheduling fields:

- **Send date and time**
- **Browser timezone**

The browser timezone is shown so the user understands how the scheduled time will be interpreted.

### Before-send notice

- **Before you send**

The campaign’s consent and WhatsApp messaging notice is shown before the final action.

### Incomplete preview state

If the audience has not been successfully checked:

- **Preview audience to continue**
- **Check the audience preview before sending or scheduling.**

### Scheduling validation

- **Choose when this campaign should be sent.**
- **Choose a future time for the campaign.**

---

## 17. Send confirmation

Sending requires a final confirmation because it starts communication with multiple customers.

Confirmation message:

- **Send “{campaign name}” to {n} recipients?**
- **This will start sending “{campaign name}” to the selected audience. This action cannot be undone.**

Confirmation action:

- **Send to {n}**

The wording makes the audience size and irreversible nature of the action visible before confirmation.

---

## 18. Campaign feedback messages

Success messages include:

- **Campaign sent**
- **Campaign scheduled**
- **Campaign saved**
- **Campaign saved as draft**

Management feedback includes:

- **Campaign paused**
- **Campaign resumed**
- **Campaign cancelled**
- **Campaign deleted**
- **Campaign duplicated — review and send when ready**
- **Test message sent**
- **Failed campaign messages queued for retry**

These messages confirm what happened without requiring the user to infer the result from the list.

---

## 19. View-only campaign detail

Completed and other non-editable campaigns open in a detail view focused on delivery results.

### Header

- **Campaign details**

The header can show:

- Campaign name.
- Status.
- Template name.
- Audience label.
- Scheduled date, when applicable.

### Progress

- **Delivery progress**
- **{percentage}% · {sent} of {total}**

### Summary statistics

- **Recipients**
- **Sent**
- **Delivered**
- **Read**
- **Failed**

### Detail tabs

- **Overview**
- **Recipients ({n})**
- **Errors ({n})**

The tabs separate the overall result from the individual delivery records and problems.

### Detail actions

Depending on status and permission:

- **Send now**
- **Edit campaign**
- **Pause**
- **Resume**
- **Cancel campaign**
- **Retry failed sends**
- **Duplicate campaign**
- **Export results**
- **Close**

---

## 20. Delivery analytics

The Overview area summarizes how recipients are progressing.

### Overview content

- **Delivery results**
- **Delivery is still in progress**
- **No delivery issues**
- **{n} recipient(s) need attention**
- **Review the Errors section, fix the reported issue, then retry.**
- **All recipients are currently clear of reported delivery issues.**
- **Use the status breakdown below for the current recipient state.**
- **Recipient delivery status**
- **Delivery status will appear once sending starts.**

The analytics view is designed to answer:

- Is the campaign still active?
- How many messages have been sent?
- How many were delivered or read?
- Are there recipients needing attention?

---

## 21. Errors and retry experience

The Errors area gives the team a focused recovery path.

### Error panel

- **Errors**
- **{n} failed recipient(s)**
- **Review the failed recipients below, fix the reported issue, then retry.**
- **View failed recipients**
- **Retry failed sends**

Individual problems can be summarized as:

- **{count}× {formatted error}**

When additional detail is not available:

- **Details unavailable. Check recipient statuses for more information.**

The intended flow is:

1. Review failed recipients.
2. Understand or correct the reported issue.
3. Retry failed sends.

---

## 22. Recipient details

The recipient view shows delivery status for every person included in the campaign.

### Panel identity

- **Campaign recipients ({total})**
- **Delivery status for each recipient**

### Filters

- **All statuses**
- **Pending**
- **Sent**
- **Delivered**
- **Read**
- **Failed**

### Recipient information

Each recipient can show:

- Phone number.
- Contact name or **Unnamed contact**.
- Current status.
- Sent timestamp.
- Retry count.
- Formatted error message.

### Empty state

- **No recipients match this filter. Choose another status or select All statuses.**

### Mobile pagination

- **{n} recipients**
- **Previous**
- **Page {n}**
- **Next**

### Desktop no-error state

- **No delivery issue reported**

---

## 23. Recipient statuses

Individual recipients can have these states:

- **Pending**
- **Sent**
- **Delivered**
- **Read**
- **Failed**
- **Queued**
- **Sending**
- **Rejected**
- **Cancelled**

These labels help the team distinguish messages that have not started, are currently moving through delivery, reached the customer, or need intervention.

---

## 24. Campaign actions and menus

### Draft and scheduled campaigns

These campaigns can generally be edited before sending.

### Running campaigns

The primary control is:

- **Pause**

### Paused campaigns

The primary control is:

- **Resume**

### Finished or problem campaigns

The focus moves to results and recovery:

- View results.
- Retry failed sends.
- Duplicate campaign.
- Export results.

### Overflow menu

Additional actions may include:

- **Cancel campaign**
- **Retry failed sends**
- **Duplicate campaign**
- **Export results**

### Delete confirmation

Deleting uses a confirmation message:

- **Delete campaign?**
- **“{campaign name}” will be permanently removed.**
- **Delete campaign**

---

## 25. WhatsApp template and service connection

Campaign messages are based on approved WhatsApp templates.

The interface:

- Shows only approved templates for campaign use.
- Lets the user select a sending WhatsApp number when multiple numbers are connected.
- Reuses the same WhatsApp-style message preview used elsewhere in the product.
- Supports image, video, and document header links when the selected template requires them.

The campaign screen does not currently present a dedicated “Connect WhatsApp” empty state. Number connection is handled through the broader WhatsApp setup and settings experience, while the Campaigns screen uses the available connected number information.

If the business has multiple connected numbers, the user can choose which number sends the campaign.

---

## 26. Permission and service states

### Read-only users

Users without campaign management access can review campaigns but cannot perform management actions such as:

- Create.
- Edit.
- Send.
- Pause.
- Resume.
- Delete.
- Duplicate.
- Cancel.
- Retry failed sends.

The interface communicates this through:

- **You have read-only access to campaigns. Ask an admin to create or send campaigns.**

### Template availability

If there are no approved templates, the user is told:

- **No approved templates yet**
- **Create a template and wait for approval before sending.**

### Audience availability

The audience preview communicates whether the selected audience contains valid recipients and whether some contacts must be excluded.

### WhatsApp number availability

When there is more than one connected WhatsApp number, the sender can be selected. When there is only one, the interface avoids showing an unnecessary choice.

---

## 27. Desktop experience

The desktop Campaigns experience is optimized for planning and monitoring:

- A persistent navigation area provides access to Campaigns and related content tools.
- Summary statistics appear above the campaign list.
- Campaigns are displayed in a table for quick comparison.
- The creation and detail experience opens in a wide side panel.
- Audience tools can display multiple controls together.
- Delivery progress, status, and actions remain visible in the same row.
- Recipient details use a table for scanning many people.

The desktop pattern prioritizes overview and efficient management of multiple campaigns.

---

## 28. Mobile experience

The mobile Campaigns experience keeps the same campaign workflow while adapting the layout:

- Desktop tables become stacked cards.
- The campaign editor becomes a full-width vertical sheet.
- Form sections stack one after another.
- Audience controls remain touch-friendly.
- Contact selection uses a vertically scrollable list.
- Detail recipients become mobile cards.
- Pagination appears beneath the recipient cards.
- Long actions move into overflow menus.
- Primary actions such as Continue, Send, Pause, and Resume stay close to the current campaign.

The mobile experience avoids horizontal scrolling and keeps the campaign’s current step and next action obvious.

---

## 29. Related product connections

Campaigns connects naturally with the following areas:

### Templates

Approved templates provide the message format used by campaigns.

### Content Studio

Content Studio is available from the Campaigns landing page as a related content preparation area.

### Contacts

Contacts provide the people who can be selected individually, by tag, or through consent.

### Inbox

Inbox is where the team can continue conversations and handle customer replies after a campaign is sent.

### Settings

Settings provide campaign limits and broader WhatsApp configuration.

### Calls

Calls and Campaigns are separate communication workflows, but both depend on the connected WhatsApp service and clear service status.

---

## 30. Overall UI pattern

The Campaigns frontend follows a guided, decision-based pattern:

1. **Understand campaign activity** — review drafts, scheduled work, running campaigns, and completed campaigns.
2. **Choose a message** — select an approved WhatsApp template and complete its variables.
3. **Choose an audience** — use numbers, tags, selected contacts, or opted-in contacts.
4. **Preview the audience** — confirm the true recipient count and estimated cost.
5. **Choose timing** — send immediately or choose a future date and time.
6. **Confirm sending** — acknowledge the audience size and irreversible action.
7. **Monitor delivery** — follow progress and recipient statuses.
8. **Resolve problems** — review errors, correct issues, and retry failed sends.
9. **Reuse successful work** — duplicate a campaign and review it before sending again.

The interface progressively reveals detail. The landing page stays focused on campaign overview, while the side panel contains the complete message, audience, timing, and review workflow.

---

## 31. Product language principles visible in the UI

The existing Campaigns experience consistently:

- Uses plain language such as “who should receive this campaign?” instead of technical audience terminology.
- Shows examples beside fields.
- Makes approval and consent requirements visible.
- Shows the audience count before sending.
- Displays estimated cost before the final action.
- Clearly warns when an action cannot be undone.
- Separates planning, sending, and monitoring.
- Provides recovery actions for failed recipients.
- Adapts the same information for desktop tables and mobile cards.
- Makes read-only access explicit.
- Keeps WhatsApp template rules visible without requiring the user to understand the underlying service rules.

