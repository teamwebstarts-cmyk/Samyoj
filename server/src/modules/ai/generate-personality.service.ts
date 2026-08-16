import { config } from '../../config';
import { AppError } from '../../utils/response';
import { createChatCompletion } from './chat-completion.service';
import { SAFE_CHAT_TEMPERATURE } from './ai-constants';
import {
  formatBusinessExtrasBlock,
  loadBusinessContext,
  type BusinessExtras,
} from './business-context';

export type PersonalityChannel = 'CHAT' | 'CALL';

const CHAT_SYSTEM = `You write WhatsApp chat personality instructions for a support assistant. Output only those instructions. No markdown headings, no model names, no temperature, no Train/FAQ/embedding talk, no platform rules, no identity or voice-safety chrome.

Write a detailed business-personality layer the bot will follow:
- How to greet, matching the customer's language
- What this business does and who they help, using only the user's note and business extras
- Tone: warm, clear, specific — like a skilled front-desk person on WhatsApp
- What to ask so you can actually help (one or two useful questions)
- When and how to offer a person, in one short line

Chat replies should stay 1 to 3 lines. Write about 220 to 380 words of instructions. Be specific to this business. Never invent prices, hours, policies, or promises. Never write filler such as "I cannot", "I don't", "etc.", or vague disclaimers. If a fact is missing, tell the bot to ask a short follow-up or offer a person — do not hedge.`;

const CALL_SYSTEM = `You write spoken personality instructions for a phone-support assistant. Output only those instructions. No markdown headings, no model names, no temperature, no Train/FAQ/embedding talk, no platform rules, no identity or voice-safety chrome.

Write a detailed spoken business-personality layer:
- How to greet out loud, matching the caller's language
- What this business does and who they help, using only the user's note and business extras
- Tone: warm, clear, unhurried — one or two short spoken sentences per turn
- What to ask so you can actually help (one useful question at a time)
- When and how to offer a person, in one short spoken line

Write about 140 to 240 words. Be specific to this business. Never invent prices, hours, policies, or promises. Never write filler such as "I cannot", "I don't", "etc.", or vague disclaimers. If a fact is missing, tell the bot to ask a short follow-up or offer a person — do not hedge.`;

export function buildPersonalityGeneratePrompt(
  channel: PersonalityChannel,
  intent: string,
  extras?: BusinessExtras | null
): { system: string; user: string } {
  const trimmed = intent.trim();
  const extraBlock = extras ? formatBusinessExtrasBlock(extras) : '';
  const context = extraBlock ? `Business extras (use these facts; do not invent others):\n${extraBlock}\n\n` : '';
  if (channel === 'CALL') {
    return {
      system: CALL_SYSTEM,
      user: `${context}Write calling-support instructions from this business note:\n${trimmed}`,
    };
  }
  return {
    system: CHAT_SYSTEM,
    user: `${context}Write WhatsApp chat-support instructions from this business note:\n${trimmed}`,
  };
}

export async function generatePersonalityInstructions(input: {
  organizationId: string;
  intent: string;
  channel: PersonalityChannel;
  botId?: string;
  whatsappNumberId?: string;
  businessWebsite?: string | null;
  businessNotes?: string | null;
}): Promise<string> {
  const intent = input.intent.trim();
  if (intent.length < 8) {
    throw new AppError(400, 'Tell us a bit more about what this bot should do.');
  }
  if (intent.length > 800) {
    throw new AppError(400, 'Keep that description a bit shorter.');
  }

  const extras = await loadBusinessContext(input.organizationId, {
    website: input.businessWebsite,
    notes: input.businessNotes,
  });
  const { system, user } = buildPersonalityGeneratePrompt(input.channel, intent, extras);
  const completion = await createChatCompletion({
    organizationId: input.organizationId,
    botId: input.botId,
    whatsappNumberId: input.whatsappNumberId,
    usageAction: 'generate_personality',
    model: config.sarvam.chatModel || 'sarvam-105b',
    temperature: SAFE_CHAT_TEMPERATURE,
    maxTokens: input.channel === 'CALL' ? 640 : 900,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  });

  const text = completion.content?.trim();
  if (!text) {
    throw new AppError(502, 'Could not write those instructions. Try again in a moment.');
  }
  return text;
}
