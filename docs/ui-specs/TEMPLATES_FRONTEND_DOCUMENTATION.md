# Templates Frontend Documentation

## 1. Purpose

Templates is the workspace for creating and managing approved WhatsApp message templates. Templates are reusable messages that a business can send through campaigns, Inbox conversations, and other outreach flows.

The Templates experience helps a business:

- Create a message in the format required by WhatsApp.
- Add personalization, media, footer text, and buttons.
- Submit a template for approval.
- Track approval and quality status.
- Preview the message as it will appear in WhatsApp.
- Test approved templates before using them with customers.
- Use approved templates in campaigns and Inbox conversations.
- Browse ready-made template examples from the template library.

Templates are especially important when a business needs to contact a customer outside the normal 24-hour reply window.

---

## 2. WhatsApp connection requirement

Templates require a connected WhatsApp Business number before they can be created.

When no number is connected, the page shows:

- **Connect WhatsApp first**
- **You need to link your WhatsApp Business number before creating message templates.**

The page explains the required steps:

1. **Open Settings**
2. **Connect your WhatsApp number**
3. **Come back here to create templates**

Primary action:

- **Go to Settings**

Other connection-related messages may include:

- **No WhatsApp number connected. Connect WhatsApp in Settings first.**
- **WhatsApp number not found or inactive.**
- **Selected WhatsApp number is not available.**

The experience makes the dependency clear before the user starts creating a message.

---

## 3. Main Templates screen

### Page identity

The page is introduced with:

- **Templates**
- **Message templates**
- **Create and manage approved templates for campaigns and outreach.**

### Summary area

The top of the page summarizes the template library:

- **Total** — all templates available on the account.
- **Approved** — templates ready to use.
- **Pending** — templates waiting for review.
- **Rejected** — templates that need correction and resubmission.

### Toolbar

The main toolbar contains:

- Search placeholder: **Search templates...**
- Status filter: **All statuses**
- Status options:
  - **Approved**
  - **Pending**
  - **Rejected**
  - **Paused**
- Category filter: **All categories**
- Language filter: **All languages**
- **Group**
- **Refresh**
- **Library**
- **New template**

The toolbar supports both quick searching and more structured filtering.

### Loading state

While templates are being loaded:

- **Loading templates...**

### Pending approval alert

When templates are waiting for review:

- **N template(s) waiting for approval · auto-refreshes every 30s**

This sets the expectation that approval status can update without requiring the user to submit the same template again.

---

## 4. Empty and filtered states

### No templates

When the account has no templates, the page explains their purpose:

- **No templates yet**
- **Templates are pre-approved messages you can send to customers anytime.**

The recommended steps are:

1. **Create a new template or browse the library**
2. **Submit for WhatsApp approval**
3. **Use it in campaigns and chats**

Actions:

- **Browse library**
- **Create template**

### No filtered results

When search or filters do not find a matching template:

- **No templates match your filters**
- **Try a different search word or filter.**

The user can change the search or reset the filters without leaving the page.

---

## 5. Template list

### Desktop table

On larger screens, templates are displayed in a table with:

- **S.No.**
- **Template**
- **Status**
- **Category**
- **Language**
- **Actions**

Each row can show:

- Category icon.
- Template name.
- Body preview snippet.
- Status badge.
- Quality label.
- Rejection reason, when available.
- Category badge.
- Friendly language name.

If no body preview is available:

- **No preview text**

Available row actions include:

- **View**
- Duplicate action with the accessible label **Duplicate template**

### Grouped view

When grouping is enabled, language variants of the same template are organized together.

Grouped information can include:

- **N languages**
- **N approved**
- Expand and collapse controls.

This is useful when one message exists in several languages.

### Mobile cards

On smaller screens, each table row becomes a template card. The card includes:

- Template name.
- Raw language code such as `en_US`.
- Category.
- Body preview.
- Status.
- **View**
- **Duplicate**

The mobile layout keeps the important information visible without requiring horizontal scrolling.

### Pagination

The list is shown ten templates at a time. Desktop and mobile use pagination controls suited to their layout.

---

## 6. Template statuses and quality

Templates use these main statuses:

- **Approved**
- **Pending**
- **Rejected**
- **Paused**

### Approved

The template is ready to use in campaigns, Inbox, and test sends.

### Pending

The template has been submitted and is waiting for WhatsApp review.

### Rejected

The template was not approved and needs to be corrected before resubmission.

### Paused

The template is not currently available for normal sending and may need to be reviewed or resubmitted.

### Quality labels

Approved templates can show quality information:

- **High quality**
- **Medium quality**
- **Low quality**

When a template has been rejected, the reason can appear directly beside its status so the user understands what needs attention.

---

## 7. Create template experience

Selecting **New template** opens a side panel.

### Panel title

- **Create message template**

### Panel subtitle

- **Sent for review after you create it**

### Final action

- **Submit for review**

The form submits the template for WhatsApp review after the user completes the required information. It does not present a separate local draft flow in the current interface.

### Success message

- **Template submitted for approval**

### General error messages

- **Failed to load templates.**
- **Failed to save template.**

The panel is scrollable and keeps the preview and form controls available within the same creation experience.

---

## 8. Duplicate template experience

Templates can be duplicated from:

- The desktop table.
- Mobile cards.
- The template detail view.

When duplicated, the new name is automatically prepared as:

- **`<original_name>_copy`**

The duplicate opens in the creation form as a separate template. The user can adjust its content and submit it independently for approval.

This is useful when a business wants to create a variation of an already successful message.

---

## 9. Edit and resubmit experience

Only rejected and paused templates show:

- **Edit & resubmit**

The side panel title becomes:

- **Edit & resubmit template**

The form callout becomes:

- **Edit & resubmit for approval**

The existing template name is not changed during this process.

Success message:

- **Template resubmitted for review**

Restriction message:

- **Only rejected or paused templates can be resubmitted**

The flow is designed to correct a problem template while preserving the relationship to the original submission.

---

## 10. Template identity fields

### Template name

- **Template name**
- Placeholder: **order_update**
- Guidance: lowercase letters, numbers, and underscores only.

The name is used internally to identify the template.

### Language

The user chooses the language for the message.

### Category

The available categories are:

- **Utility**
- **Marketing**
- **Authentication**

### Header type

Header choices include:

- **No header**
- **Text header**
- **Image header**
- **Video header**
- **Document header**

These choices determine what appears above the message body.

---

## 11. Header content

### Text header

For a text header:

- **Header text**
- **Optional · max 60 characters**
- Example placeholder: **Order update**

### Media header

For image, video, or document headers:

- **Sample image/video/document for approval**
- **Upload a sample file. WhatsApp uses this during template approval.**
- **Upload sample file**
- **Replace sample file**
- **Sample uploaded successfully**

The interface accepts:

- Images for image headers.
- Videos for video headers.
- PDF files for document headers.

If the file is too large:

- **File too large. Maximum size is 16 MB.**

The sample file gives WhatsApp a concrete example while reviewing the template.

---

## 12. Message body

### Body field

- **Body text**
- Hint: **Use {{1}}, {{2}} for placeholders like a name or order number**

Normal example:

- **Hi {{1}}, your order {{2}} is ready.**

Authentication example:

- **Your verification code is {{1}}.**

The message body can contain up to 1,024 characters.

### Footer

- **Footer**
- **Optional · recommended for marketing**
- Example placeholder: **Reply STOP to unsubscribe**

The footer is useful for opt-out guidance and additional short instructions.

### Authentication guidance

Authentication templates show:

- **Authentication template**
- **Use for OTP and verification codes. Security recommendation will be added automatically.**

Authentication-specific option:

- **Add security recommendation ("Do not share this code")**

This supports verification and one-time-password messages in a clear, security-conscious format.

### Validation messages

The form can show:

- **Template name is required**
- **Use lowercase letters, numbers, and underscores only**
- **Body text is required**

---

## 13. Variables and sample values

Templates use numbered variables:

- `{{1}}`
- `{{2}}`

Variables allow one approved message to be personalized for different customers.

### Sample sections

- **Body variable samples**
- **Header variable samples**
- **Required by WhatsApp for approval**
- **Sample for {{1}}**
- **Sample for {{2}}**

Example values:

- First body sample: **John**
- Other sample values: **Value**

Validation messages:

- **Add sample values for all N body variable(s)**
- **Add sample values for all N body variable(s)** for header variables.

The user must provide examples so the approval reviewer can understand how the final message will look.

---

## 14. Buttons

The optional button editor allows the message to include actions customers can take.

### Section content

- **Buttons**
- **Optional · up to N (Quick reply, URL, Call, or Copy code)**
- **Add button**
- **No buttons yet. Add quick replies or call-to-action links.**

### Button types

- **Quick reply**
- **Visit website (URL)**
- **Call phone number**
- **Copy offer code**

### Button fields

Common field:

- **Type**
- **Button label**
- Placeholder: **e.g. Track order**

Website button:

- **Website URL**
- Hint: **Use {{1}} for one dynamic parameter at the end**
- Placeholder: **https://example.com/order/{{1}}**

Phone button:

- **Phone number**
- Hint: **E.164 format, e.g. +919876543210**
- Placeholder: **+919876543210**

Copy-code button:

- **Sample offer code**
- Hint: **Example code shown during Meta review**
- Placeholder: **SALE25**

Remove action:

- **Remove button**

The normal maximum is ten buttons. Authentication templates are limited to one button.

---

## 15. Categories and language choices

### Categories

- **Utility**
- **Marketing**
- **Authentication**

### Languages

The current language choices include:

- **English (US)**
- **English (UK)**
- **Hindi**
- **Hindi (India)**
- **Spanish**
- **Spanish (Spain)**
- **Portuguese (Brazil)**
- **Arabic**

### Marketing guidance

Marketing templates include additional guidance:

- **Marketing template guidelines**
- **Add a way to stop messages in the footer (e.g. Reply STOP to unsubscribe). Avoid misleading claims. WhatsApp may take 24–48 hours to review.**

This helps the user create marketing content that is transparent and easier for customers to opt out of.

---

## 16. Live WhatsApp preview

The creation form includes:

- **Live WhatsApp preview**

If the body is not yet filled:

- **Your message body will appear here.**

The preview can show:

- Text headers.
- Image, video, or document placeholders.
- Header substitutions.
- Body substitutions.
- Footer text.
- Quick reply buttons.
- Website buttons.
- Phone buttons.
- Copy-code buttons.
- WhatsApp outbound message styling.

The preview exists to help the user check the message visually before approval and sending.

---

## 17. Template detail view

Opening a template shows a detail side panel titled with the template name.

The subtitle follows this format:

- **<language> · <category>**

The detail view can show:

- Status.
- Category.
- Language.
- Quality.
- Rejection reason.
- WhatsApp preview.

### Detail preview

- **Preview**

### Approved template actions

Approved templates show:

- **Test send**
- **Use in campaign**

---

## 18. Test send

Test send lets the user send an approved template to their own phone before using it with customers.

### Section content

- **Test send**
- **Send this template to your phone before using it in a campaign.**

Variable fields can include:

- **Body {{1}}**
- **Header {{1}}**

For media templates:

- **Header media URL**

Phone field:

- **Your phone number**
- Placeholder: **919876543210**

Action:

- **Send test**

Success message:

- **Test template sent**

Only approved templates can be test-sent. If the template is not approved, the user must wait for approval or correct and resubmit it.

---

## 19. Campaign connection

Approved templates connect directly to Campaigns.

The detail view includes:

- **Use in campaign**

This opens campaign creation with the selected template and language already prepared.

Campaigns presents the template step as:

- **Use an approved template**
- **Choose an approved WhatsApp template for this campaign.**
- **Approved template**
- **Select approved template**

Template variables become campaign personalization fields:

- **Personalize message**
- **Message detail 1**
- **Header detail 1**

Header media fields can appear as:

- **Header image link**
- **Header video link**
- **Header document link**

If there are no approved templates:

- **No approved templates yet**
- **Create a template and wait for approval before sending.**

The relationship between Templates and Campaigns is intentionally direct: create and approve the reusable message first, then use it for a larger audience.

---

## 20. Inbox connection

Inbox also loads approved templates for customer conversations.

### Template picker

- **Approved template**
- Placeholder: **Search templates…**

If no matching template is found:

- **No templates found**

If the account has no approved templates:

- **No approved templates**
- **Create and get a template approved under Templates to message outside the 24-hour window.**
- **Send template**

### Closed reply window

When the normal WhatsApp reply window is closed:

- **24-hour reply window is closed — send an approved template to restart the conversation.**
- **Reply window closed**
- **You can only send free-text replies within 24 hours of the customer's last message.**
- **Tap Template below, or start a campaign.**

The Inbox keeps approved templates available while free-text and interactive reply modes are restricted.

### Copy-code templates

For offer codes:

- **No copy-code templates yet**
- **Create an approved template with a copy-code button to send offers outside the 24-hour window.**
- **Go to Templates**

---

## 21. Template library

Selecting **Library** opens a larger browsing panel.

### Library identity

- **Template library**
- **Ready-made templates you can use or submit**

### Explanation

- **Template reference browser**
- **Meta library — pre-approved Utility & Authentication templates.**
- **Your templates — all categories on your account (Marketing, Utility, etc.).**

### Tabs

- **Meta library (N)**
- **Your templates (N)**

The Meta library provides reference and pre-approved options, while Your templates shows the templates belonging to the account.

### Filters

- **Category**
- **Topic**
- **Industry**
- **Use case**
- **Language**
- **Search by name or content...**

### Meta library topics

- **All topics**
- **Account update**
- **Customer feedback**
- **Order management**
- **Payments**

### Industries

- **All industries**
- **E-commerce**
- **Financial services**
- **Healthcare**
- **Education**
- **Travel**

### Use cases

- **All use cases**
- **Confirmation**
- **Reminder**
- **Shipping**
- **Account update**

### Library states

- **Loading templates...**
- **No templates match these filters.**
- **Marketing templates are not in Meta's library. Switch to Your templates tab or set category to All / Utility / Authentication.**

### Selected template actions

- **Use as reference**
- **Create from Meta library**
- **Clones this library template to your WABA (Utility only).**
- **Your template name**
- Placeholder: **my_delivery_update**
- **Submit library template to Meta**

Success message:

- **Template submitted to Meta from library. Refresh after approval.**

### Responsive library layout

The library uses two columns on larger screens and collapses to one column on smaller screens. This keeps template browsing comfortable on desktop while preserving readability on mobile.

---

## 22. Delete template

Delete is available from the template detail view.

Confirmation:

- **Delete template "<name>"?**

Success message:

- **Template deleted**

Failure message:

- **Failed to delete template.**

Deletion is separated from normal viewing so the user has an opportunity to confirm the action.

---

## 23. Desktop experience

The desktop Templates experience is designed for managing a library:

- Summary statistics appear above the list.
- Search and filters stay together in the toolbar.
- Templates are shown in a comparison-friendly table.
- Language variants can be grouped.
- The create and detail forms open in wide side panels.
- The library can show multiple browsing columns.
- The live preview remains close to the editing fields.

The desktop pattern prioritizes scanning, comparing, and maintaining multiple message variants.

---

## 24. Mobile experience

The mobile Templates experience keeps the same workflow while adapting the layout:

- Table rows become stacked template cards.
- The create form becomes a full-width scrollable panel.
- Library columns collapse into one column.
- Form fields stack vertically.
- Preview content appears below or beside the relevant fields in the reading order.
- Actions such as View and Duplicate remain available on each card.
- Long template lists use mobile pagination.
- Filters remain available without requiring desktop table space.

The mobile layout avoids horizontal scrolling for normal use and keeps the main action associated with the current template.

---

## 25. Roles and access behavior

The product defines a Templates management capability intended for users who create and manage message templates.

The intended permission description is:

- **Templates**
- **Create and manage message templates**

The intended role defaults are:

- Owner: enabled.
- Admin: enabled.
- Supervisor: disabled.
- Agent: disabled.

The current frontend behavior should be understood as follows: the Templates page is available to authenticated organization members when a WhatsApp number is connected, and the page currently does not visibly enforce the role-level management restriction in every location. This is an existing product behavior, not a new design rule.

---

## 26. Overall UI pattern

The Templates frontend follows a guided message lifecycle:

1. **Connect WhatsApp** — ensure a WhatsApp Business number is available.
2. **Choose a starting point** — create a new template or browse the library.
3. **Define the message** — choose language, category, header, body, footer, and buttons.
4. **Add examples** — provide sample values for each variable.
5. **Preview the message** — confirm the final WhatsApp appearance.
6. **Submit for approval** — send the completed template for review.
7. **Monitor status** — watch for approved, pending, rejected, or paused states.
8. **Correct if needed** — edit and resubmit rejected or paused templates.
9. **Test approved content** — send a test to the business phone.
10. **Use it in conversations** — select it in Campaigns or Inbox.

The experience progressively reveals more detail: the main page focuses on library management, while the side panels contain creation, preview, testing, and detail actions.

---

## 27. Product language principles visible in the UI

The existing Templates experience consistently:

- Explains why approval is required.
- Shows examples beside complex fields.
- Makes variable requirements visible.
- Uses a live WhatsApp preview to reduce uncertainty.
- Separates pending, approved, rejected, and paused states.
- Provides a clear correction path through Edit & resubmit.
- Connects templates directly to Campaigns and Inbox.
- Makes the WhatsApp connection dependency explicit.
- Includes consent and unsubscribe guidance for marketing messages.
- Adapts the same information for desktop tables, mobile cards, and side panels.

