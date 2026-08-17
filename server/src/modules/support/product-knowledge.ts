/**
 * Grounded Samyoj product facts for the in-app Help Center assistant.
 * Compiled from current product behavior (code + docs/memory). Not FEATURE_MATRIX.
 * Never include secrets, .env keys, App Secret, webhook URLs, or TARGET billing catalogs.
 */

export interface SupportKnowledgeTopic {
  id: string;
  title: string;
  keywords: string[];
  content: string;
}

export const SUPPORT_KNOWLEDGE_TOPICS: SupportKnowledgeTopic[] = [
  {
    id: 'connect',
    title: 'Connect WhatsApp',
    keywords: [
      'connect',
      'whatsapp',
      'oauth',
      'facebook',
      'meta',
      'number',
      'waba',
      'login facebook',
      'link number',
      'disconnect',
      'reconnect',
    ],
    content: `Connect WhatsApp from Settings (or the Dashboard Connect button). Click Connect WhatsApp, sign in with Facebook, then pick the business number. You do not enter a Meta App ID or App Secret — those are platform credentials, not something customers fill in.

Disconnect keeps your workspace and conversation history (it turns the number off; it does not wipe chats). Connecting the same displayed phone again on this org reopens the same workspace even if Meta's phone id changed.

Each connected number is its own workspace. Switch numbers from the top bar. If you have more than one active number, the app always uses the one you selected — it will not silently pick “latest”.

After this org disconnects, another org may connect that Meta number and gets a new empty workspace, not this org's chats.`,
  },
  {
    id: 'inbox',
    title: 'Inbox',
    keywords: [
      'inbox',
      'chat',
      'message',
      'reply',
      'conversation',
      'new chat',
      'unread',
      'assign',
      'label',
      'note',
      'receive',
      'inbound',
    ],
    content: `Inbox is where you reply to customers on the active WhatsApp number.

Start a chat from Inbox → New chat. Phone is required; name, email, tags, notes, custom fields, and campaign consent are optional — the same fields as Contacts. Starting a 1:1 chat does not opt the person into campaigns unless you check Allow campaign messages.

You can assign an agent, add labels, and leave private internal notes. Apply or pause an AI bot on a single chat from the conversation (personal pick). That personal pick is not overwritten when someone applies a bot to all chats from AI Bots.

If you can send messages but customer replies never appear, that is a connection issue — create a Support ticket instead of sharing passwords, OTPs, or app secrets.`,
  },
  {
    id: 'numbers',
    title: 'WhatsApp numbers',
    keywords: ['number switcher', 'phone number', 'workspace', 'isolation', 'multiple numbers', 'header'],
    content: `Contacts, tags, Inbox, campaigns, and tickets are scoped to the WhatsApp number you have selected. Switching numbers switches the whole workspace.

Connect more than one number if you need separate lines. Never mix data across numbers. If the app asks you to pick a number, do that before sending or importing.`,
  },
  {
    id: 'campaigns',
    title: 'Campaigns',
    keywords: ['campaign', 'broadcast', 'audience', 'bulk', 'send now', 'repeat', 'opt in', 'consent', 'opt out'],
    content: `Campaigns send an approved WhatsApp template to many contacts on the current number.

Wizard: Message → Audience → Review & Send. You can also schedule or repeat a campaign.

Sends are fail-closed: a contact must be opted in, with a recorded consent source and consent time, and must not have opted out. Inbox chats are not automatically campaign-eligible.

Use Contacts (or New chat) to collect consent. Do not import a list and blast it without opt-in.`,
  },
  {
    id: 'templates',
    title: 'Templates',
    keywords: ['template', 'hsm', 'utility', 'marketing', 'library', 'submit', 'approved', 'rejected', 'variable'],
    content: `Templates are Meta-approved messages used for campaigns and some outbound chats outside the 24-hour service window.

Create a template, review it, then submit to Meta. Statuses: Draft, Pending, Approved, Rejected. Only approved templates can be used for campaigns.

The Template library lists Meta's pre-approved templates you can add. Do not invent extra marketing templates that are not in Meta's library or the Create starters.

Variables like {{1}} must match the sample values you submitted. Test send from an approved template when you need a one-off check.`,
  },
  {
    id: 'ai-bots',
    title: 'AI Bots',
    keywords: [
      'ai bot',
      'chatbot',
      'auto reply',
      'personality',
      'train',
      'faq',
      'calling bot',
      'chat bot',
      'apply all',
      'pause',
      'default',
    ],
    content: `AI Bots are split into Chat bots (WhatsApp messages) and Calling bots (voice). They are separate rows — training and personality on one do not automatically apply to the other.

Typical setup: Personality → Train (FAQs / business info) → Voice or People (calling) → Try it. Keep instructions in business language; you do not need to set model names or temperature.

Each org has a baseline Support bot that cannot be deleted. You can apply a chat bot to all chats on this number, or remove that global apply. Inbox personal picks stay. Pause/Activate on the bot card turns the bot on or off everywhere it would run.

Per-contact calling AI: a contact can be set to AI answers or Person only. If the workspace calling AI is Off, that wins. Person only tries a human first and does not fall back to AI.

Train “Ready” needs embeddings to finish vector search. If training stays on Learning, the bot can still use written FAQs, but semantic search is not fully ready.`,
  },
  {
    id: 'calls',
    title: 'Calls',
    keywords: [
      'call',
      'voice',
      'phone call',
      'calling',
      'transcript',
      'transfer',
      'speaker',
      'shubh',
      'missed',
      'summary',
    ],
    content: `Calls are WhatsApp voice calls for the connected number. Recents show who called, state, and duration. Open a call for the transcript and post-call summary.

AI speaking/listening is configured on the Calling bot (When they call), not on Calls → Customize. Customize is for telephony knobs. Voices in the picker: Shubh, Ratan, Priya, Ishita.

Live transfer onto the same phone call (WebRTC hold-and-transfer) is not available. Do not tell customers “please hold for a person” as if the call will be handed off live.

Enable calling on Meta after WhatsApp is connected. If calling is off, the Calls page will say so.`,
  },
  {
    id: 'automations',
    title: 'Automations',
    keywords: ['automation', 'flow', 'keyword', 'auto reply', 'journey', 'trigger'],
    content: `Automations and Flows send structured replies when a customer message matches a trigger (for example a keyword). The default tab is flows.

A paused Inbox bot does not automatically pause a running flow — those are separate. Keep one clear path so customers are not double-messaged.

Do not promise catalog checkout, form-builder merge, or “generate a flow from a sentence” — those are not shipped.`,
  },
  {
    id: 'contacts',
    title: 'Contacts',
    keywords: ['contact', 'import', 'csv', 'tag', 'opt in', 'consent', 'phone', 'merge'],
    content: `Contacts live on the active WhatsApp number. Unique key is this org + this number + normalized phone.

Add a contact with phone (required) and optional name, email, tags, notes, custom fields, and campaign consent. Import CSV from Contacts when you have a list — still respect opt-in before campaigns.

Custom fields can feed template variables such as {{order_id}}.`,
  },
  {
    id: 'tickets-inbox',
    title: 'Inbox tickets',
    keywords: ['inbox ticket', 'sla', 'customer ticket', 'needs reply'],
    content: `The Tickets page in the left nav tracks WhatsApp customer conversations that still need a reply (open Inbox work). Those are not the same as Help Center tickets.

Help Center → Tickets (this Support board) is for you, the Samyoj user: billing, login, and data issues. Use Inbox tickets for customer chats; use Support tickets for platform help.`,
  },
  {
    id: 'settings',
    title: 'Settings',
    keywords: ['settings', 'setup', 'business hours', 'appearance', 'canned', 'hours', 'theme'],
    content: `Settings covers Connect WhatsApp, appearance (theme, density, card spacing), canned replies, and workspace setup. There is no App ID / App Secret field for normal users.

Canned replies are shortcuts you type in Inbox. Appearance changes the product chrome, not the customer's WhatsApp.`,
  },
  {
    id: 'team',
    title: 'Team',
    keywords: ['team', 'invite', 'role', 'agent', 'owner', 'admin', 'permission', '2fa'],
    content: `Owners and admins invite teammates from Team. Roles: Owner, Admin, Supervisor, Agent. Permissions control Inbox, campaigns, templates, flows, settings, and analytics.

Agents work the Inbox; they do not manage billing. Two-factor can be required from Team security settings.`,
  },
  {
    id: 'billing',
    title: 'Billing',
    keywords: ['billing', 'plan', 'razorpay', 'payment', 'invoice', 'subscription', 'price', 'upgrade', 'gst'],
    content: `Billing is under Account → Billing (owners/admins). Current checkout is a one-shot Razorpay payment for Growth (₹3,999) or Business (₹11,999), plus a free Starter plan. Activation is about 30 days — this is not a full auto-renewing subscription, GST invoice, or dunning product yet.

The Samyoj plan price is software only. WhatsApp / Meta Cloud API message fees are billed by Meta on the WABA and are a separate bill. Do not mix them.

Do not quote other catalogs, trials, or monthly/quarterly/yearly SKUs as if they were live. For payment failures, login lockouts, or data questions, create a Support ticket — do not paste card numbers, OTPs, or passwords here.`,
  },
  {
    id: 'reports',
    title: 'Reports',
    keywords: ['reports', 'analytics', 'ai usage', 'tokens', 'stt', 'tts'],
    content: `Reports include AI usage for chat replies, call replies, listening (STT), speaking (TTS), training embeddings, and writers. Figures are usage units, not rupees, and they do not include WhatsApp message fees.`,
  },
  {
    id: 'privacy',
    title: 'Privacy and safety',
    keywords: ['password', 'otp', 'secret', 'app secret', 'token', 'login', 'data', 'privacy'],
    content: `This assistant is for how to use Samyoj. Never share passwords, OTPs, API keys, App Secret, or card numbers here.

For billing, login, or data issues, create a Support ticket from the Tickets tab (or Escalate to ticket from this chat). Samyoj staff should never ask you for your WhatsApp OTP.`,
  },
];
