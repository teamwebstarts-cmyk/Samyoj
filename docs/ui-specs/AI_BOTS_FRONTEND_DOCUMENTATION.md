# AI Bots Frontend Documentation

## 1. Purpose

AI Bots is the workspace for creating and managing WhatsApp auto-reply assistants. It helps a business teach an assistant about its products, services, policies, tone, and support process.

The assistant can:

- Reply to WhatsApp customers automatically.
- Use the same knowledge for WhatsApp chat and voice calls.
- Pass difficult or human-requested conversations to the team.
- Be enabled globally or controlled separately for each Inbox conversation.
- Be tested before it is used with real customers.

The product currently calls this area **AI Bots**. The term “AI Boards” is not used in the existing interface.

---

## 2. Main screen

### Page identity

The page is introduced with:

- **AI Bots**
- **Smart auto-replies for WhatsApp**
- **Auto-reply for WhatsApp, 24/7**
- **Teach your bot about your business. It answers customers instantly and passes tricky chats to your team.**

### Summary area

The top of the page gives a quick view of the bot setup:

- **Live status** — shows whether the workspace has an active live bot.
- **Active bots** — number of bots currently turned on.
- **Knowledge** — amount of training information available.
- **Total bots** — total number of created bots.

### Setup guidance

When setup is incomplete, the page shows a setup banner:

- **Setup incomplete · X/Y required steps done**
- **Set up AI**
- **View steps**
- **Hide**

The purpose is to guide a new user through the minimum work needed before the bot can answer confidently.

### Search and filters

Users can find and organize bots using:

- **Search bots…**
- **All statuses**
- **Live**
- **Paused**
- **Default**

### Bot actions

Available actions include:

- **New bot**
- **Create bot**
- **Activate**
- **Pause**
- **Delete bot**

### Empty state

When no bot exists, the page explains the benefit in simple steps:

- **No AI bots yet**
- **An AI bot can reply to customers automatically — even when you are offline.**
- **Tap Create bot below**
- **Add your business info and FAQs**
- **Turn it on — it starts replying instantly**

The screen also explains that AI can be paused for one customer without affecting other conversations:

- **Per-chat control — Pause AI for one customer from Inbox without affecting other chats.**

---

## 3. Bot list pattern

### Desktop

On larger screens, bots are shown in a structured table with:

- Bot
- Starts when
- Knowledge
- Status
- Actions

This format is intended for quick comparison and management of several bots.

### Mobile

On smaller screens, each bot becomes a separate card. The card keeps the same important information but stacks it vertically so the user does not need to scroll sideways.

The primary action remains easy to reach, while secondary actions such as pause, activate, and delete are kept with the individual bot.

---

## 4. New bot and edit experience

The bot editor opens in a side panel on desktop and a full-width panel on mobile.

### New bot

- **New AI bot**
- **Set up how this bot replies on WhatsApp**

### Existing bot

- The bot name is shown as the panel title.
- **Edit bot** is used when a name is not available.
- **Set up how your bot talks and what it knows**

### Panel behavior

The panel provides:

- A dimmed background to keep focus on the editor.
- Close by pressing the close control, clicking outside, or pressing Escape.
- A scrollable content area.
- A footer that remains available for saving or cancelling.

### Footer actions

- **Cancel**
- **Create & activate**
- **Save changes**
- **Delete bot**

On mobile, the panel uses the full available width and respects the bottom safe area so controls remain usable above the device navigation area.

---

## 5. Bot editor navigation

After a bot exists, the editor is divided into clear sections:

- **Personality**
- **Train**
- **AI call**
- **Connect**
- **Try it**
- **More**

Shorter labels are used where space is limited:

- AI call becomes **Voice**
- Connect becomes **People**
- Try it becomes **Try**

For a new bot, the initial experience focuses on **Personality** first. The remaining sections become available after the bot has been created.

---

## 6. Personality screen

The Personality screen defines who the bot is, when it replies, and how it sounds.

### Quick start

The screen gives the central instruction:

- **Turn the bot ON and set as Default to reply to all customer messages automatically.**

### Bot identity and routing

Users can configure:

- **Bot name**
- **Bot is ON**
- **Replies automatically on WhatsApp**
- **Default bot**
- **Replies to every message you receive**
- **Business hours only**
- **Only reply during business hours (set in Settings)**

### Trigger keywords

The bot can be limited to messages containing particular words:

- **Trigger keywords**
- **This bot replies when a customer message contains any of these words**
- **Keywords**
- **Comma-separated — e.g. pricing, quote, sales**

### Business information

The user describes the business through:

- **Business name**
- **What you do**
- **Never promise / never do**

This information helps the assistant answer in a way that matches the business and avoids inappropriate commitments.

### Communication style

- **How should I speak?**
- **Plain language for chat and WhatsApp voice calls**

Built-in style choices include:

- **Friendly helper** — Warm, clear, and patient
- **Professional** — Polite and precise
- **Sales assist** — Helpful recommendations
- **Custom** — Write your own style

The screen includes a **Live preview** so the user can understand the intended tone.

Additional guidance:

- **This AI also answers WhatsApp voice calls when Calls is set to AI.**
- **Change note (optional)**
- **Saved in version history when you update this bot**

---

## 7. Train screen

The Train screen is where the business gives the assistant reliable answers.

### Introduction

- **Train your AI**
- **Add answers once — used on WhatsApp chat and voice calls.**

### Training status

The interface indicates whether the bot has enough information:

- **Training status**
- **Add 3 answers so the AI stays accurate on calls and chat.**
- **answers ready**
- **still learning…**
- **Empty**
- **Ready**
- **Still learning**

### Search and filter

- **Search training**
- **Filter by question or answer…**

### Training sources

Users can add information in several ways:

#### Questions and answers

- **Pre-built**
- **Add 3 answers so the AI stays accurate on calls and chat.**
- **Edit Q&A**
- **Add Q&A**
- **Question customers ask**
- Example: **What are your business hours?**
- **Your answer**
- **Paste info**

#### Website content

- **Website URL**
- **Paste policies, hours, prices from a page — we pull the text into training.**
- **Import from URL**

#### PDF documents

- **Upload PDF**
- **Menus, manuals, brochures**
- **Drop PDF or click to upload**

If the current search does not find anything, the interface shows:

- **No training items match your search.**

The overall idea is that the business teaches the assistant once and then reuses that information for both chat and voice conversations.

---

## 8. Professional brain selection

The product provides ready-made starting points so users do not have to write the assistant’s behavior from scratch.

### Section introduction

- **Professional brains**
- **Pre-loaded instructions + FAQs for chat and voice calls**
- **Recommended**
- **pre-loaded FAQs**
- **Chat + Voice**
- **Use this brain**

### The Support Professional

- **Tagline:** Warm, thorough, always resolves
- **Purpose:** Empathetic customer care for complaints, orders, returns, and general questions.
- **Style qualities:**
  - Empathetic
  - Thorough
  - Resolution-focused
  - 24/7 availability
  - Hindi/English
- **Default name:** Support Pro

Handoff message:

> I understand this needs personal attention. Let me connect you with our support team — someone will reply shortly on WhatsApp with a resolution.

### The Sales Consultant

- **Tagline:** Persuasive, consultative, relationship-focused
- **Purpose:** Qualifies leads, recommends a suitable option, and guides prospects toward a decision.
- **Style qualities:**
  - Consultative
  - Persuasive
  - Discovery-driven
  - Relationship-focused
  - Hindi/English
- **Default name:** Sales Pro

Handoff message:

> I've noted your interest. A sales specialist will reach out shortly to help you take the next step.

### Responsive presentation

The professional brain cards use one column on very small screens and two columns on larger mobile and desktop layouts. On narrow screens, longer descriptions are reduced so the choices remain easy to scan.

---

## 9. AI call and voice screen

The AI call area extends the same bot brain to WhatsApp voice calls.

### Introduction

- **Voice & AI call**
- **This AI answers WhatsApp voice calls too. One brain drives chat and voice — set the greeting, voice style, and language here.**

### Connection readiness

If voice is not fully configured, the screen explains:

- **Voice calling is not fully set up yet.**
- **A team admin needs to connect WhatsApp calling and configure Sarvam voice in Calls → Customize → Voice.**

### Voice greeting

- **AI voice greeting**
- **The first thing the bot says when it answers a call**
- **Greeting**
- **Play preview**
- **Voice ready**

### Voice style and language

- **Voice style**
- **Pick how the AI sounds — same voice is used for all calls**
- **Language**

### Call routing

- **AI call routing**
- **Which brain answers WhatsApp voice calls**
- **Use this brain for WhatsApp calls**
- **When Calls is set to AI, this brain answers voice calls**

Status messages include:

- **This bot will answer WhatsApp calls.**
- **Bot unassigned from calls.**

The interface also explains that voice-specific rules are automatically applied:

- **Voice rules are injected automatically — short replies, no formatting, and language matching for calls.**

---

## 10. Connect a person screen

This screen describes how the bot gives control to a human team member.

### Purpose

- **Connect a person**
- **When someone asks for a human — or the bot gets stuck — bring your team in.**

### Handoff controls

- **Offer to connect a person when asked or stuck**
- **Uses common phrases below**
- **Common phrases**
- **Comma-separated — e.g. human, agent, talk to someone**
- **What to say when connecting**
- **Sent before your team takes over**
- **Preview**

The user can define:

- Words that indicate a customer wants a person.
- Whether the bot should offer a human when it cannot confidently continue.
- The message sent before the team takes over.

The screen also communicates the current service behavior:

- **Live ring vs WhatsApp if busy is set in Calls → Customize → Call behavior**

---

## 11. Try it screen

Try it is a safe preview area for testing the bot without contacting a real customer.

### Introduction

- **Try it**
- **Send a sample customer message — no real WhatsApp message is sent.**

If the bot has not been trained sufficiently:

- **Add a few Train answers first so replies stay accurate on chat and calls.**

### Test controls

- **Sample customer message**
- Example: **What are your hours?**
- **Send test**

### Test result

The preview can show:

- **Bot reply**
- **WhatsApp preview**
- **Would connect a person? Yes/No**
- **From your training (N)**
- **No training answers matched this message.**
- **Run a test to see how your bot responds here.**
- **AI call**

The purpose is to let the business adjust its training and handoff behavior before activation.

---

## 12. More screen

The More area contains advanced controls and history:

- **Reply style**
- **Creativity**
- **Max reply length**
- **Replies per minute**
- **Analytics · 30 days**
- **Version history**
- **Restore**
- **Activity log**

These controls let the team manage how the bot responds, review what changed, and understand recent usage.

---

## 13. Inbox connection and per-chat control

AI Bots are connected to the Inbox through a bot assignment control.

### Assignment popover

The Inbox presents:

- **AI auto-replies**
- **Bot is replying in this chat**
- **Bot is paused for this chat**
- **Bot for this chat**
- **Auto · default**
- **Uses [bot name]**
- **Org default chatbot**
- **Default**

### Available states

The team can:

- Let the organization’s default bot reply.
- Select a particular enabled bot.
- Pause AI for only the current conversation.
- Return the conversation to automatic assignment.

Loading and problem states include:

- **Loading bots…**
- **No enabled bots. Create one in AI Bots.**
- **Assigned bot is unavailable — pick another or Auto.**

Management links:

- **Train & manage in AI Bots**
- **View AI Bots**

This design keeps automation flexible: a team can pause one customer’s bot without turning off automation for the entire business.

---

## 14. Calls and support connection screens

### Calls help rail

The Calls area includes a help panel with:

- **Help**
- **Outbound**
- **Start a call from Inbox — no tunnel needed.**
- **Inbound**
- **Callers need calling enabled on your WhatsApp number.**
- **One brain**
- **Train answers on AI Bots → Train so voice and chat stay aligned.**
- **Open AI Bots → Train**
- **Open setup guide**
- **Go to Inbox to place a call**

The message connects the Calls experience back to AI Bots so users understand that chat and voice should share one source of knowledge.

### Transfer state

The current transfer experience is intentionally clear about what is and is not available:

- **Transfer**
- **Live transfer coming soon — human handoff stays in Inbox for now.**
- **Message on WhatsApp**
- **Connect live if team online (coming soon)**

When the caller asks for a person:

- **When caller asks for a person**

Supporting links and guidance:

- **AI Bot personality**
- **Personality presets and speaking style live on AI Bots — same brain for chat and voice calls.**
- **Open Personality**
- **Add FAQs and documents**
- **Train answers once. Your AI uses them on WhatsApp chat and voice calls.**
- **Open Train**

The current service design uses WhatsApp and Inbox handoff while live human call transfer is still marked as coming soon.

---

## 15. Desktop experience

The desktop experience is designed for users managing several bots and detailed configuration:

- Persistent left navigation.
- Wide page content with summary metrics.
- Table-based bot management.
- Side-panel editor with a dedicated footer.
- Multi-column professional brain cards.
- More information visible at once in training, voice, and handoff sections.
- Help and support information can appear beside the main Calls content.

The visual pattern prioritizes overview first, then detailed configuration inside the editor.

---

## 16. Mobile experience

The mobile experience keeps the same content but changes the presentation:

- Bot tables become stacked cards.
- Side panels become full-width sheets or drawers.
- Content is vertically scrollable.
- Segmented controls use shorter labels where necessary.
- Professional brain options use compact cards.
- Long descriptions are reduced or stacked to preserve readability.
- Primary actions remain visible and easy to tap.
- Bottom navigation and a **More** sheet provide access to secondary areas.

The mobile design avoids horizontal scrolling wherever possible and keeps important actions close to the content they affect.

### Mobile navigation

The secondary navigation opens a sheet titled:

- **More**

It can include:

- Dashboard
- Calls
- AI Bots
- Templates
- Tickets
- Orders
- Reports
- Team
- Billing
- Settings

---

## 17. Overall UI pattern

The AI Bots frontend follows a guided configuration pattern:

1. **Understand status** — see whether automation is live and how much knowledge exists.
2. **Create or select a bot** — start from a blank bot or a professional brain.
3. **Set personality** — define identity, business context, tone, and routing.
4. **Train the bot** — add FAQs, URLs, PDFs, policies, and business information.
5. **Connect services** — configure WhatsApp behavior, voice calls, and human handoff.
6. **Try it safely** — test sample messages without sending a real WhatsApp message.
7. **Activate and manage** — turn the bot on, make it default, pause it, review history, or assign it per conversation.

The interface is built around progressive disclosure: the main page stays understandable, while deeper controls appear inside clearly named sections.

---

## 18. Product language principles visible in the UI

The existing interface consistently:

- Uses direct, non-technical language.
- Explains why a setting matters.
- Shows examples beside fields.
- States when a feature is not yet available.
- Connects chat and voice behavior instead of treating them as separate assistants.
- Gives users control over automation at both workspace and individual-conversation levels.
- Encourages testing before activation.
- Makes human support a normal part of the automation flow.

