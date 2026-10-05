/**
 * Starter + follow-up questions for the Support assistant.
 * `label` is what the user sees; `question` is sent to the API.
 */

export interface SupportSuggestedPrompt {
  id: string;
  topicId: string;
  /** User-facing suggestion (full question or clear phrase). */
  label: string;
  /** Full question sent to the assistant */
  question: string;
}

export const SUPPORT_CHANNEL_CHIPS: SupportSuggestedPrompt[] = [
  {
    id: 'chip-whatsapp',
    topicId: 'connect',
    label: 'WhatsApp',
    question: 'How do I connect WhatsApp and reply from Inbox in Samyoj?',
  },
  {
    id: 'chip-messenger',
    topicId: 'facebook-inbox',
    label: 'Messenger',
    question: 'How do I reply to Facebook Messenger in Samyoj?',
  },
  {
    id: 'chip-instagram',
    topicId: 'instagram-inbox',
    label: 'Instagram',
    question: 'How do I manage Instagram DMs and comments in Samyoj?',
  },
  {
    id: 'chip-email',
    topicId: 'email-channel',
    label: 'Email',
    question: 'How do I send email from my connected Gmail in Samyoj?',
  },
];

/** Welcome screen — keep short (2-3 items); channel chips sit above. */
export const SUPPORT_STARTER_PROMPTS: SupportSuggestedPrompt[] = [
  {
    id: 'connect-channels',
    topicId: 'connect-channels',
    label: 'How do I connect WhatsApp, Facebook, Instagram, or Email?',
    question: 'How do I connect WhatsApp, Facebook, Instagram, or Email in Samyoj?',
  },
  {
    id: 'inbound',
    topicId: 'inbound',
    label: 'Why are customer replies not showing in Inbox?',
    question:
      'Customer replies are not showing in Samyoj Inbox (WhatsApp, Messenger, or Instagram). What should I check?',
  },
];

/** Follow-ups when the user has already started chatting. */
export const SUPPORT_FOLLOWUP_EXTRA_PROMPTS: SupportSuggestedPrompt[] = [
  {
    id: 'inbox-template',
    topicId: 'templates',
    label: 'How do I send a template message from Inbox?',
    question: 'How do I send a template message from Inbox?',
  },
  {
    id: 'apply-bot',
    topicId: 'ai-bots',
    label: 'How do I turn on the AI bot for all chats?',
    question: 'How do I apply a chat bot to all conversations?',
  },
  {
    id: 'chat-vs-call',
    topicId: 'ai-bots',
    label: 'What is the difference between chat and calling bots?',
    question: 'What is the difference between a chat bot and a calling bot?',
  },
  {
    id: 'campaign',
    topicId: 'campaigns',
    label: 'How do I start a WhatsApp campaign?',
    question: 'How do I create and send a WhatsApp campaign?',
  },
  {
    id: 'train',
    topicId: 'ai-bots',
    label: 'How do I train the AI bot with my business info?',
    question: 'How do I train the AI bot with FAQs and business information?',
  },
  {
    id: 'opt-in',
    topicId: 'contacts',
    label: 'How does campaign opt-in work for contacts?',
    question: 'How do contacts opt in for campaign messages?',
  },
  {
    id: 'numbers',
    topicId: 'numbers',
    label: 'How do I manage multiple WhatsApp numbers?',
    question: 'How do multiple WhatsApp numbers work in one workspace?',
  },
  {
    id: 'messenger',
    topicId: 'facebook-inbox',
    label: 'Where do Facebook Page messages appear?',
    question: 'Where do Facebook Page messages appear in Samyoj?',
  },
  {
    id: 'ig-comments',
    topicId: 'instagram-comments',
    label: 'What does Hide do on an Instagram comment?',
    question: 'What does Hide do on an Instagram comment in Samyoj?',
  },
  {
    id: 'gmail-send',
    topicId: 'email-channel',
    label: 'Does Email show Gmail replies?',
    question: 'Does Samyoj Email show Gmail replies and inbox?',
  },
  {
    id: 'team',
    topicId: 'team',
    label: 'How do I invite teammates to my workspace?',
    question: 'How do I invite teammates and set their roles?',
  },
  {
    id: 'settings',
    topicId: 'settings',
    label: 'What can I change in Settings?',
    question: 'What can I change in Settings for my workspace?',
  },
];

export const SUPPORT_ALL_PROMPTS: SupportSuggestedPrompt[] = [
  ...SUPPORT_CHANNEL_CHIPS,
  ...SUPPORT_STARTER_PROMPTS,
  ...SUPPORT_FOLLOWUP_EXTRA_PROMPTS,
];

const RELATED_TOPICS: Record<string, string[]> = {
  connect: ['connect-channels', 'inbound', 'numbers'],
  'connect-channels': ['connect', 'facebook-inbox', 'instagram-inbox', 'email-channel'],
  templates: ['inbox', 'campaigns', 'contacts'],
  'ai-bots': ['ai-bots', 'inbox', 'calls'],
  inbox: ['inbound', 'templates', 'facebook-inbox', 'instagram-inbox'],
  inbound: ['connect', 'inbox', 'numbers'],
  campaigns: ['templates', 'contacts', 'numbers'],
  contacts: ['campaigns', 'numbers', 'team'],
  numbers: ['connect', 'inbox', 'contacts'],
  team: ['settings', 'contacts'],
  settings: ['connect-channels', 'team'],
  calls: ['ai-bots'],
  'facebook-inbox': ['facebook-ads', 'connect-channels', 'inbox'],
  'facebook-ads': ['facebook-inbox'],
  'instagram-inbox': ['instagram-comments', 'instagram-posts', 'connect-channels'],
  'instagram-comments': ['instagram-inbox', 'instagram-posts'],
  'instagram-posts': ['instagram-inbox', 'instagram-comments'],
  'email-channel': ['connect-channels', 'contacts'],
};

function inferTopicIds(text: string): string[] {
  const t = text.toLowerCase();
  const ids: string[] = [];
  if (/\bgmail\b|email compose|email template|mailbox|send email/.test(t)) ids.push('email-channel');
  if (/instagram comment|hide comment|ig comment/.test(t)) ids.push('instagram-comments');
  if (/instagram post|schedule post/.test(t)) ids.push('instagram-posts');
  if (/instagram|ig dm/.test(t)) ids.push('instagram-inbox');
  if (/facebook ads|ad spend|\bcpl\b/.test(t)) ids.push('facebook-ads');
  if (/messenger|facebook inbox|facebook page/.test(t)) ids.push('facebook-inbox');
  if (/connect.*channel|connect facebook|connect instagram|connect gmail/.test(t)) {
    ids.push('connect-channels');
  }
  if (/connect|whatsapp|oauth|link.*number|business number/.test(t)) ids.push('connect');
  if (/inbound|reply|replies|receive|not showing|missing|webhook|tunnel/.test(t)) ids.push('inbound');
  if (/template|broadcast message/.test(t)) ids.push('templates');
  if (/campaign|blast|bulk/.test(t)) ids.push('campaigns');
  if (/bot|ai|train|calling|call bot|automation/.test(t)) ids.push('ai-bots');
  if (/inbox|conversation|chat thread/.test(t)) ids.push('inbox');
  if (/contact|opt-?in|subscriber|customer list/.test(t)) ids.push('contacts');
  if (/team|invite|teammate|role/.test(t)) ids.push('team');
  if (/number|multiple|switch.*number/.test(t)) ids.push('numbers');
  if (/setting|billing|account|profile/.test(t)) ids.push('settings');
  if (/call|voice|phone call/.test(t)) ids.push('calls');
  return ids;
}

export function matchPrompt(text: string): SupportSuggestedPrompt | undefined {
  const trimmed = text.trim();
  return SUPPORT_ALL_PROMPTS.find(
    (p) =>
      p.question.toLowerCase() === trimmed.toLowerCase() ||
      p.label.toLowerCase() === trimmed.toLowerCase() ||
      trimmed.toLowerCase().startsWith(p.question.toLowerCase()) ||
      trimmed.toLowerCase().startsWith(p.label.toLowerCase())
  );
}

/** Personalized follow-ups from the last user + assistant turns (up to 4). */
export function followUpPromptsFor(
  lastUserText: string,
  lastAssistantText = '',
  limit = 4,
  priorUserTexts: string[] = []
): SupportSuggestedPrompt[] {
  const asked = matchPrompt(lastUserText);
  const inferred = inferTopicIds(`${lastUserText}\n${lastAssistantText}`);
  const topicIds = asked
    ? [asked.topicId, ...inferred, ...(RELATED_TOPICS[asked.topicId] || [])]
    : [...inferred, 'connect-channels', 'inbound', 'facebook-inbox', 'email-channel'];

  const seen = new Set<string>(asked ? [asked.id] : []);
  if (lastUserText.toLowerCase().includes('connect') || asked?.id === 'connect' || asked?.id === 'connect-channels') {
    seen.add('connect');
    seen.add('connect-channels');
  }
  for (const text of priorUserTexts) {
    const p = matchPrompt(text);
    if (p) seen.add(p.id);
  }
  const out: SupportSuggestedPrompt[] = [];

  for (const topicId of topicIds) {
    for (const p of SUPPORT_ALL_PROMPTS) {
      if (p.topicId !== topicId || seen.has(p.id) || p.id.startsWith('chip-')) continue;
      seen.add(p.id);
      out.push(p);
      if (out.length >= limit) return out;
    }
  }
  return out;
}
