import { describe, expect, it } from 'vitest';
import {
  SUPPORT_STARTER_PROMPTS,
  followUpPromptsFor,
  matchPrompt,
} from './prompts';

describe('support suggested prompts', () => {
  it('keeps the empty state to 6–10 starters', () => {
    expect(SUPPORT_STARTER_PROMPTS.length).toBeGreaterThanOrEqual(6);
    expect(SUPPORT_STARTER_PROMPTS.length).toBeLessThanOrEqual(10);
  });

  it('covers the core product how-tos', () => {
    const blob = SUPPORT_STARTER_PROMPTS.map((p) => `${p.label} ${p.question}`).join(' ').toLowerCase();
    expect(blob).toMatch(/connect whatsapp/);
    expect(blob).toMatch(/template/);
    expect(blob).toMatch(/all chats/);
    expect(blob).toMatch(/calling bot/);
    expect(blob).toMatch(/inbound|replies/);
    expect(blob).toMatch(/campaign/);
    expect(blob).toMatch(/train/);
    expect(blob).toMatch(/opt-in|opt in/);
  });

  it('returns related follow-ups after a connect question', () => {
    const follow = followUpPromptsFor('How do I connect WhatsApp?');
    expect(follow).toHaveLength(3);
    expect(follow.some((p) => p.id === 'connect')).toBe(false);
    expect(follow.some((p) => p.topicId === 'inbound' || p.id === 'inbound')).toBe(true);
  });

  it('matches a starter question exactly', () => {
    expect(matchPrompt('How do I start a campaign?')?.id).toBe('campaign');
  });
});
