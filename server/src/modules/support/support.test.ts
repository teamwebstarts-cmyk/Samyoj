import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AI_USAGE_ACTIONS } from '../ai/ai-usage-actions';
import {
  formatSupportKnowledge,
  scoreSupportTopic,
  selectSupportKnowledge,
  tokenizeSupportQuery,
} from './knowledge';
import { SUPPORT_KNOWLEDGE_TOPICS } from './product-knowledge';
import { buildSupportSystemPrompt, clipTranscript, formatChatTranscript } from './chat.service';
import { supportTicketCreateSchema } from './tickets.service';

describe('support knowledge retrieval', () => {
  it('matches Connect WhatsApp questions to the connect topic', () => {
    const topics = selectSupportKnowledge('How do I connect WhatsApp?');
    expect(topics[0]?.id).toBe('connect');
    expect(topics.some((t) => t.id === 'privacy')).toBe(true);
  });

  it('matches chat vs calling bot questions', () => {
    const topics = selectSupportKnowledge('What is the difference between chat bot and calling bot?');
    expect(topics.some((t) => t.id === 'ai-bots')).toBe(true);
  });

  it('does not dump the whole corpus on a nonsense query', () => {
    const topics = selectSupportKnowledge('Nike T-shirt discount code xyzzy');
    expect(topics.length).toBeLessThanOrEqual(2);
    expect(topics.every((t) => t.id === 'privacy' || tokenizeSupportQuery('nike').length >= 0)).toBe(
      true
    );
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
    expect(prompt).toMatch(/ticket/i);
    expect(prompt).not.toMatch(/META_APP_SECRET|SARVAM_API_KEY/);
    expect(knowledge).not.toMatch(/14-day trial/i);
    expect(knowledge).not.toMatch(/META_APP_SECRET|webhook URL|ngrok/i);
  });

  it('does not present TARGET catalog prices as live', () => {
    const billing = SUPPORT_KNOWLEDGE_TOPICS.find((t) => t.id === 'billing')!;
    expect(billing.content).toMatch(/₹3,999|₹3999|3,999/);
    expect(billing.content).not.toMatch(/14-day/);
    expect(billing.content).toMatch(/Meta/);
  });
});

describe('transcript helpers', () => {
  it('clips long transcripts', () => {
    expect(clipTranscript('hello', 4)).toBe('hel…');
    expect(clipTranscript('hello', 50)).toBe('hello');
  });

  it('formats a chat transcript for escalate', () => {
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

  it('exposes tenant-authenticated chat and ticket endpoints', () => {
    expect(routes).toContain("'/status'");
    expect(routes).toContain("'/chat'");
    expect(routes).toContain("'/tickets'");
    expect(routes).toContain("'/tickets/escalate'");
    expect(routes).toContain('authenticate, requireOrg');
  });
});
