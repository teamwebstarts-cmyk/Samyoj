import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AppError } from '../../utils/response';
import { AI_USAGE_ACTIONS } from '../ai/ai-usage-actions';
import {
  formatSupportKnowledge,
  scoreSupportTopic,
  selectSupportKnowledge,
  tokenizeSupportQuery,
} from './knowledge';
import { SUPPORT_KNOWLEDGE_TOPICS } from './product-knowledge';
import {
  buildSupportSystemPrompt,
  clipSupportHistory,
  clipTranscript,
  fallbackSupportReply,
  formatChatTranscript,
  parseSupportChatBody,
  supportRetrievalQuery,
  userSafeSupportAiError,
} from './chat.service';
import { supportTicketCreateSchema } from './tickets.service';

describe('support knowledge retrieval', () => {
  it('matches Connect WhatsApp questions to the connect topic', () => {
    const topics = selectSupportKnowledge('How do I connect WhatsApp?');
    expect(topics[0]?.id).toBe('connect');
    expect(topics.some((t) => t.id === 'privacy')).toBe(true);
  });

  it('matches multiple WhatsApp numbers to the numbers topic', () => {
    const topics = selectSupportKnowledge('How do multiple WhatsApp numbers work?');
    expect(topics[0]?.id).toBe('numbers');
  });

  it('matches chat vs calling bot questions', () => {
    const topics = selectSupportKnowledge('What is the difference between chat bot and calling bot?');
    expect(topics.some((t) => t.id === 'ai-bots')).toBe(true);
  });

  it('matches inbound reply questions to the inbound topic', () => {
    const topics = selectSupportKnowledge(
      "How do inbound replies work? I can send messages but customer replies don't appear in Inbox."
    );
    expect(topics[0]?.id).toBe('inbound');
  });

  it('matches Inbox template questions to templates', () => {
    const topics = selectSupportKnowledge('How do I send a template from Inbox?');
    expect(topics.some((t) => t.id === 'templates')).toBe(true);
  });

  it('does not dump the whole corpus on a nonsense query', () => {
    const topics = selectSupportKnowledge('Nike T-shirt discount code xyzzy');
    expect(topics.length).toBeLessThanOrEqual(2);
    expect(topics.every((t) => t.id === 'privacy')).toBe(true);
  });

  it('scores keyword hits above incidental words', () => {
    const campaign = SUPPORT_KNOWLEDGE_TOPICS.find((t) => t.id === 'campaigns')!;
    const reports = SUPPORT_KNOWLEDGE_TOPICS.find((t) => t.id === 'reports')!;
    const tokens = tokenizeSupportQuery('campaign opt in audience');
    expect(scoreSupportTopic(campaign, tokens)).toBeGreaterThan(scoreSupportTopic(reports, tokens));
  });
});

describe('support system prompt', () => {
  it('grounds in product facts and refuses secrets and TARGET billing', () => {
    const knowledge = formatSupportKnowledge(selectSupportKnowledge('How do I connect WhatsApp?'));
    const prompt = buildSupportSystemPrompt(knowledge);
    expect(prompt).toMatch(/Connect WhatsApp/i);
    expect(prompt).toMatch(/left-nav Tickets/i);
    expect(prompt).not.toMatch(/Escalate to ticket/i);
    expect(prompt).toMatch(/Do not use markdown/i);
    expect(prompt).not.toMatch(/META_APP_SECRET|SARVAM_API_KEY/);
    expect(knowledge).not.toMatch(/14-day trial/i);
    expect(knowledge).not.toMatch(/META_APP_SECRET|webhook URL|ngrok/i);
  });

  it('does not present stale manual-billing copy as live', () => {
    const billing = SUPPORT_KNOWLEDGE_TOPICS.find((t) => t.id === 'billing')!;
    expect(billing.content).toMatch(/Razorpay subscription/i);
    expect(billing.content).toMatch(/GST invoice/i);
    expect(billing.content).not.toMatch(/one-shot Razorpay|not a full auto-renewing subscription/i);
    expect(billing.content).not.toMatch(/14-day/);
    expect(billing.content).toMatch(/Meta/);
  });
});

describe('support chat history', () => {
  it('clips long chats before schema max', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: `turn ${i}`,
    }));
    const clipped = clipSupportHistory(many);
    expect(clipped).toHaveLength(16);
    expect(clipped[0]?.content).toBe('turn 4');
    expect(parseSupportChatBody({ messages: many }).messages).toHaveLength(16);
  });

  it('retrieves from the previous user turn on a vague follow-up', () => {
    const query = supportRetrievalQuery([
      { role: 'user', content: 'How do I connect WhatsApp?' },
      { role: 'assistant', content: 'Click Connect WhatsApp in Settings.' },
      { role: 'user', content: 'and then?' },
    ]);
    expect(query).toContain('connect WhatsApp');
    expect(selectSupportKnowledge(query)[0]?.id).toBe('connect');
  });

  it('does not leak provider secrets in user-facing AI errors', () => {
    const wrapped = userSafeSupportAiError(
      new AppError(503, 'No AI brain configured. Set SARVAM_API_KEY in server/.env.')
    );
    expect(wrapped.statusCode).toBe(502);
    expect(wrapped.message).not.toMatch(/SARVAM|API_KEY|\.env/);
    expect(wrapped.message).toMatch(/Try again/);
    expect(wrapped.message).not.toMatch(/ticket/i);
  });

  it('returns knowledge text when the LLM is unavailable', () => {
    const knowledge = formatSupportKnowledge(
      selectSupportKnowledge('How do multiple WhatsApp numbers work?')
    );
    const reply = fallbackSupportReply(knowledge, 'How do multiple WhatsApp numbers work?');
    expect(reply.toLowerCase()).toMatch(/number/);
    expect(reply.length).toBeGreaterThan(40);
  });
});

describe('transcript helpers', () => {
  it('clips long transcripts', () => {
    expect(clipTranscript('hello', 4)).toBe('hel…');
    expect(clipTranscript('hello', 50)).toBe('hello');
  });

  it('formats a chat transcript', () => {
    const text = formatChatTranscript([
      { role: 'user', content: 'How do I connect WhatsApp?' },
      { role: 'assistant', content: 'Click Connect WhatsApp in Settings.' },
    ]);
    expect(text).toContain('User: How do I connect WhatsApp?');
    expect(text).toContain('Support AI:');
  });
});

describe('support ticket schema', () => {
  it('rejects a too-short subject', () => {
    const result = supportTicketCreateSchema.safeParse({ subject: 'hi', body: 'Need help with login.' });
    expect(result.success).toBe(false);
  });

  it('accepts a manual ticket', () => {
    const result = supportTicketCreateSchema.parse({
      subject: 'Cannot log in',
      body: 'I am locked out after a password reset.',
      source: 'manual',
    });
    expect(result.subject).toBe('Cannot log in');
  });
});

describe('AI usage', () => {
  it('records Help Center replies as support_help', () => {
    expect(AI_USAGE_ACTIONS).toContain('support_help');
  });
});

describe('support routes', () => {
  const routes = readFileSync(join(__dirname, 'routes.ts'), 'utf8');

  it('exposes tenant-authenticated chat and does not expose Help Center tickets', () => {
    expect(routes).toContain("'/status'");
    expect(routes).toContain("'/chat'");
    expect(routes).not.toContain("'/tickets'");
    expect(routes).not.toContain("'/tickets/escalate'");
    expect(routes).toContain('authenticate, requireOrg');
  });
});
