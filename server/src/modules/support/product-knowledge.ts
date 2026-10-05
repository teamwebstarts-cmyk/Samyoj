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
      'jodo',
      'connect karo',
      'number link',
    ],
    content: `Connect WhatsApp from Settings (or the Dashboard Connect button). Click Connect WhatsApp, sign in with Facebook, then pick the business number. You do not enter a Meta App ID or App Secret — those are platform credentials, not something customers fill in.

Disconnect keeps your workspace and conversation history (it turns the number off; it does not wipe chats). Connecting the same displayed phone again on this org reopens the same workspace even if Meta's phone id changed.

Each connected number is its own workspace. Switch numbers from the top bar. If you have more than one active number, the app always uses the one you selected — it will not silently pick “latest”.

After this org disconnects, another org may connect that Meta number and gets a new empty workspace, not this org's chats.`,
  },
  {
    id: 'connect-channels',
    title: 'Connect channels',
    keywords: [
      'connect channels',
      'facebook page',
      'instagram',
      'gmail',
      'email',
      'channels settings',
      'connect facebook',
      'connect instagram',
      'connect gmail',
      'mailbox',
      'page connect',
    ],
    content: `Connect every channel from Settings → Channels. You do not enter a Meta App ID or App Secret.

WhatsApp: click Connect WhatsApp, sign in with Facebook, pick the business number.

Facebook: click Connect Facebook, sign in, pick the Facebook Page. Messenger Inbox uses that Page.

Instagram: connect a professional Instagram account (Business or Creator) linked to the Facebook Page. Connect Facebook Page first if you have not.

Email: click Connect Gmail, sign in with Google, and allow send access. Email in Samyoj is send-only from that mailbox — it is not a Gmail inbox.

Disconnect turns the channel off. Conversation and sent history stay in Samyoj. Reconnecting the same WhatsApp number on this org reopens the same WhatsApp workspace.`,
  },
  {
    id: 'facebook-inbox',
    title: 'Messenger Inbox',
    keywords: [
      'messenger',
      'facebook inbox',
      'page message',
      'facebook chat',
      'messenger inbox',
      'page conversation',
    ],
    content: `Facebook Page messages open in Messenger Inbox (left nav → Facebook → Messenger Inbox), not in WhatsApp Inbox.

Reply from that thread list. The 24-hour customer-service window still applies: type a normal reply while it is open; if it is closed, use an approved message path Meta allows for that Page.

Messenger is scoped to the connected Facebook Page, not to the WhatsApp number switcher. Ads performance is a separate Facebook → Ads page.`,
  },
  {
    id: 'facebook-ads',
    title: 'Facebook Ads',
    keywords: ['facebook ads', 'ads manager', 'ad spend', 'leads', 'cpl', 'meta ads'],
    content: `Facebook → Ads (and the Dashboard ads snapshot) show Meta's numbers for the connected ad account: spend, leads, and CPL when Meta returns them.

Those figures are Meta's, not Samyoj revenue. Meta Cloud API / ads charges stay on the Meta bill. Samyoj plan price is software only.

Samyoj does not replace Ads Manager. Use View ads / Open Ads Manager when you need to change campaigns in Meta.`,
  },
  {
    id: 'instagram-inbox',
    title: 'Instagram Inbox',
    keywords: ['instagram inbox', 'instagram dm', 'ig dm', 'direct message', 'instagram chat'],
    content: `Instagram Direct messages open in Instagram Inbox (left nav → Instagram → Inbox), not in WhatsApp Inbox.

Connect Instagram first from Settings → Channels. Replies you send here go out as the connected Instagram professional account.

Comments on posts are a separate page: Instagram → Comments.`,
  },
  {
    id: 'instagram-comments',
    title: 'Instagram Comments',
    keywords: [
      'instagram comments',
      'hide comment',
      'public reply',
      'private reply',
      'comment keyword',
      'comment automation',
    ],
    content: `Instagram → Comments lists comments on your posts. Hide sends Meta's hide flag, so the comment is hidden on Instagram itself for public viewers — it is not only a local filter in Samyoj.

You can reply publicly on the comment. A private reply sends one Instagram DM for that comment (Meta allows one private reply per comment).

Keyword automations can post a public reply and/or send a private DM when a comment matches a word or emoji (case-insensitive; comma-separated alternatives like offer, 🔥).`,
  },
  {
    id: 'instagram-posts',
    title: 'Instagram Posts',
    keywords: ['instagram posts', 'schedule post', 'create post', 'instagram composer', 'caption'],
    content: `Instagram → Posts is where you create, schedule, and manage feed posts for the connected Instagram professional account.

Write the caption in Samyoj, then publish or schedule. This is not the same as WhatsApp campaigns or Email templates.`,
  },
  {
    id: 'email-channel',
    title: 'Email (Gmail)',
    keywords: [
      'gmail',
      'email compose',
      'email template',
      'mailbox',
      'send email',
      'google mail',
    ],
    content: `Email is a send-only Gmail channel. Connect the mailbox in Settings → Channels (Connect Gmail). Compose is Email → Compose. Saved drafts live in Email → Templates.

Pick a contact that already has an email saved, write the message, and send as that Gmail mailbox. Samyoj stores a sent log. It does not show a Gmail inbox, does not pull replies, and does not report opens.

Google limits the mailbox (about 500 emails a day on free Gmail, about 2,000 a day on paid Workspace). If sending stops, wait up to 24 hours. Do not use Samyoj's own SMTP for customer mail — that is for password reset and invites only.`,
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
      'jawab',
      'reply nahi',
    ],
    content: `WhatsApp Inbox (left nav → WhatsApp → Inbox) is where you reply to customers on the active WhatsApp number. Facebook Page chats are Messenger Inbox. Instagram DMs are Instagram Inbox.

Start a WhatsApp chat from Inbox → New chat. Phone is required; name, email, tags, notes, custom fields, and campaign consent are optional — the same fields as Contacts. Starting a 1:1 chat does not opt the person into campaigns unless you check Allow campaign messages.

You can assign an agent, add labels, and leave private internal notes. Apply or pause an AI bot on a single chat from the conversation (personal pick). That personal pick is not overwritten when someone applies a bot to all chats from AI Bots.

If the 24-hour reply window is open, type a normal message. If it is closed, the composer asks you to send an approved template — tap Template, pick an approved one, fill variables, send.

If you can send WhatsApp messages but customer replies never appear, that is an inbound connection issue (see Inbound replies) — not an Inbox UI bug. Do not share passwords, OTPs, or app secrets.`,
  },
  {
    id: 'inbound',
    title: 'Inbound replies',
    keywords: [
      'inbound',
      'tunnel',
      'webhook',
      'receive',
      'replies',
      'not arriving',
      'reply nahi',
      'phone reply',
      'total received',
      'outgoing works',
    ],
    content: `Sending a WhatsApp message from Inbox to a phone does not need a public URL. Customer WhatsApp replies (phone → Inbox) do: Meta must reach Samyoj over HTTPS.

On a local or test workspace, start the app with the usual start script so the inbound tunnel is running, then send a *new* reply from the phone to the connected business number. An old thread is not a reliable test.

Facebook Messenger and Instagram DMs use Meta's Page / Instagram webhooks, not the WhatsApp number tunnel. Email does not receive replies in Samyoj.

If you can send WhatsApp but replies never appear, it is a connection issue — not something to fix by redesigning Inbox. Do not paste webhook URLs, App Secret, or environment values here.`,
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
    keywords: [
      'campaign',
      'broadcast',
      'audience',
      'bulk',
      'send now',
      'repeat',
      'opt in',
      'consent',
      'opt out',
      'bhejo',
    ],
    content: `Campaigns send an approved WhatsApp template to many contacts on the current number.

Wizard: Message → Audience → Review & Send. You can also schedule or repeat a campaign.

Sends are fail-closed: a contact must be opted in, with a recorded consent source and consent time, and must not have opted out. Inbox chats are not automatically campaign-eligible.

Use Contacts (or New chat) to collect consent. Do not import a list and blast it without opt-in.`,
  },
  {
    id: 'templates',
    title: 'Templates',
    keywords: ['template', 'hsm', 'utility', 'marketing', 'library', 'submit', 'approved', 'rejected', 'variable', 'inbox template', '24h', 'service window'],
    content: `Templates are Meta-approved messages used for campaigns and for Inbox when the 24-hour customer-service window is closed.

Create a template, review it, then submit to Meta. Statuses: Draft, Pending, Approved, Rejected. Only approved templates can be used for campaigns and for Inbox sends outside the window.

From Inbox: if the window is open, type a normal reply. If it is closed, tap Template, pick an approved template, fill variables, and send.

The Template library shows Samyoj-saved drafts (English + Hindi). Pick one, review name/language/buttons, then submit to THIS WhatsApp number. Meta still reviews that number. Utility and authentication are usually faster. Marketing is slower. Samyoj cannot pre-approve Meta on a customer WABA. Platform Admin can add or unpublish drafts; published rows appear for tenants.

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
    keywords: ['inbox ticket', 'customer ticket', 'needs reply'],
    content: `The Tickets page in the left nav tracks WhatsApp customer conversations that still need a reply (open Inbox work). Those are customer tickets, not this Help Center.

This Help Center is an assistant only — it answers how to use Samyoj. It does not create platform tickets.`,
  },
  {
    id: 'settings',
    title: 'Settings',
    keywords: ['settings', 'setup', 'business hours', 'appearance', 'canned', 'hours', 'theme'],
    content: `Settings covers Channels (WhatsApp, Facebook, Instagram, Gmail), appearance (theme, density, card spacing), canned replies, and workspace setup. There is no App ID / App Secret field for normal users.

Canned replies are shortcuts you type in WhatsApp Inbox. Appearance changes the product chrome, not the customer's WhatsApp, Messenger, or Instagram.`,
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
    keywords: [
      'billing',
      'plan',
      'razorpay',
      'payment',
      'invoice',
      'subscription',
      'price',
      'upgrade',
      'gst',
      'fees',
      'charges',
    ],
    content: `Billing is under Account → Billing (owners/admins). Paid plans use Razorpay subscription checkout when configured, with plan-period entitlements and GST invoice records. One-pack AI top-ups are separate, and plan availability depends on the current catalog and organization status.

The Samyoj plan price is software only. WhatsApp / Meta Cloud API message fees are billed by Meta on the WABA and are a separate bill. Do not mix them.

Do not invent prices, trials, cadences, or renewal outcomes. For payment failures or plan questions, use Account → Billing. Do not paste card numbers, OTPs, or passwords here.`,
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
    keywords: ['password', 'otp', 'secret', 'app secret', 'token', 'login', 'data', 'privacy', 'help'],
    content: `This assistant is for how to use Samyoj. Never share passwords, OTPs, API keys, App Secret, or card numbers here.

Samyoj staff should never ask you for your WhatsApp OTP. This Help Center cannot reset passwords or refund charges — use Account → Billing or Team for those.`,
  },
];
