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

/** Welcome screen — keep short (2-3 items); everything else surfaces after chat. */
export const SUPPORT_STARTER_PROMPTS: SupportSuggestedPrompt[] = [
  {
    id: 'connect',
    topicId: 'connect',
    label: 'How do I connect my WhatsApp business number?',
    question: 'How do I connect my WhatsApp business number in Samyoj?',
  },
  {
    id: 'inbound',
    topicId: 'inbound',
    label: 'Why are customer replies not showing in Inbox?',
    question:
      'I can send WhatsApp messages but customer replies do not appear in Inbox. What should I check?',
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
  ...SUPPORT_STARTER_PROMPTS,
  ...SUPPORT_FOLLOWUP_EXTRA_PROMPTS,
];

const RELATED_TOPICS: Record<string, string[]> = {
  connect: ['inbound', 'numbers', 'templates'],
  templates: ['inbox', 'campaigns', 'contacts'],
  'ai-bots': ['ai-bots', 'inbox', 'calls'],
  inbox: ['inbound', 'templates', 'ai-bots', 'connect'],
  inbound: ['connect', 'inbox', 'numbers'],
  campaigns: ['templates', 'contacts', 'numbers'],
  contacts: ['campaigns', 'numbers', 'team'],
  numbers: ['connect', 'inbox', 'contacts'],
  team: ['settings', 'contacts'],
  settings: ['connect', 'team'],
  calls: ['ai-bots'],
};

function inferTopicIds(text: string): string[] {
  const t = text.toLowerCase();
  const ids: string[] = [];
  if (/connect|whatsapp|facebook|oauth|link.*number|business number/i.test(t)) ids.push('connect');
  if (/inbound|reply|replies|receive|not showing|missing|webhook|tunnel/i.test(t)) ids.push('inbound');
  if (/template|broadcast message/i.test(t)) ids.push('templates');
  if (/campaign|blast|bulk/i.test(t)) ids.push('campaigns');
  if (/bot|ai|train|calling|call bot|automation/i.test(t)) ids.push('ai-bots');
  if (/inbox|conversation|chat thread/i.test(t)) ids.push('inbox');
  if (/contact|opt-?in|subscriber|customer list/i.test(t)) ids.push('contacts');
  if (/team|invite|teammate|role/i.test(t)) ids.push('team');
  if (/number|multiple|switch.*number/i.test(t)) ids.push('numbers');
  if (/setting|billing|account|profile/i.test(t)) ids.push('settings');
  if (/call|voice|phone call/i.test(t)) ids.push('calls');
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
    : [...inferred, 'connect', 'inbound', 'inbox', 'ai-bots'];

  const seen = new Set<string>(asked ? [asked.id] : []);
  if (lastUserText.toLowerCase().includes('connect') || asked?.id === 'connect') {
    seen.add('connect');
  }
  for (const text of priorUserTexts) {
    const p = matchPrompt(text);
    if (p) seen.add(p.id);
  }
  const out: SupportSuggestedPrompt[] = [];

  for (const topicId of topicIds) {
    for (const p of SUPPORT_ALL_PROMPTS) {
      if (p.topicId !== topicId || seen.has(p.id)) continue;
      seen.add(p.id);
      out.push(p);
      if (out.length >= limit) return out;
    }
  }
  return out;
}
