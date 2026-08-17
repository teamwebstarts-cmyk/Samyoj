/**
 * Starter questions for the Help Center empty state.
 * `question` is sent to the assistant as if the user typed it.
 */

export interface SupportSuggestedPrompt {
  id: string;
  topicId: string;
  /** Short chip/card label */
  label: string;
  /** Full question sent to the assistant */
  question: string;
}

/** Shown on the welcome empty state — 8 common how-tos, not a wall. */
export const SUPPORT_STARTER_PROMPTS: SupportSuggestedPrompt[] = [
  {
    id: 'connect',
    topicId: 'connect',
    label: 'Connect WhatsApp',
    question: 'How do I connect WhatsApp?',
  },
  {
    id: 'inbox-template',
    topicId: 'templates',
    label: 'Send a template',
    question: 'How do I send a template from Inbox?',
  },
  {
    id: 'apply-bot',
    topicId: 'ai-bots',
    label: 'Apply bot to all chats',
    question: 'How do I apply a chat bot to all chats?',
  },
  {
    id: 'chat-vs-call',
    topicId: 'ai-bots',
    label: 'Chat vs calling bot',
    question: "What's the difference between a chat bot and a calling bot?",
  },
  {
    id: 'inbound',
    topicId: 'inbound',
    label: 'Inbound replies',
    question:
      "How do inbound replies work? I can send messages but customer replies don't appear in Inbox.",
  },
  {
    id: 'campaign',
    topicId: 'campaigns',
    label: 'Start a campaign',
    question: 'How do I start a campaign?',
  },
  {
    id: 'train',
    topicId: 'ai-bots',
    label: 'Train the AI bot',
    question: 'How do I train the AI bot?',
  },
  {
    id: 'opt-in',
    topicId: 'contacts',
    label: 'Contacts & opt-in',
    question: 'How do contacts and campaign opt-in work?',
  },
];

/** Extra prompts used as follow-ups so the empty state stays short. */
export const SUPPORT_FOLLOWUP_EXTRA_PROMPTS: SupportSuggestedPrompt[] = [
  {
    id: 'numbers',
    topicId: 'numbers',
    label: 'Multiple numbers',
    question: 'How do multiple WhatsApp numbers work?',
  },
  {
    id: 'team',
    topicId: 'team',
    label: 'Invite the team',
    question: 'How do I invite teammates and set roles?',
  },
  {
    id: 'settings',
    topicId: 'settings',
    label: 'Settings',
    question: 'What can I change in Settings?',
  },
];

export const SUPPORT_ALL_PROMPTS: SupportSuggestedPrompt[] = [
  ...SUPPORT_STARTER_PROMPTS,
  ...SUPPORT_FOLLOWUP_EXTRA_PROMPTS,
];

const RELATED_TOPICS: Record<string, string[]> = {
  connect: ['inbound', 'numbers', 'settings'],
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

export function matchPrompt(text: string): SupportSuggestedPrompt | undefined {
  const trimmed = text.trim();
  return SUPPORT_ALL_PROMPTS.find((p) => p.question === trimmed || trimmed.startsWith(p.question));
}

/** 2–3 related questions after an answer, excluding the one just asked. */
export function followUpPromptsFor(lastUserText: string, limit = 3): SupportSuggestedPrompt[] {
  const asked = matchPrompt(lastUserText);
  const topicIds = asked
    ? [asked.topicId, ...(RELATED_TOPICS[asked.topicId] || [])]
    : ['connect', 'inbox', 'ai-bots'];
  const seen = new Set<string>(asked ? [asked.id] : []);
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
