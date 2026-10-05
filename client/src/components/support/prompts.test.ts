import { describe, expect, it } from 'vitest';
import {
  SUPPORT_STARTER_PROMPTS,
  followUpPromptsFor,
  matchPrompt,
} from './prompts';

describe('support suggested prompts', () => {
  it('keeps the welcome screen to a short list', () => {
    expect(SUPPORT_STARTER_PROMPTS.length).toBeGreaterThanOrEqual(2);
    expect(SUPPORT_STARTER_PROMPTS.length).toBeLessThanOrEqual(3);
  });

  it('covers connect channels and inbound on the welcome screen', () => {
    const ids = SUPPORT_STARTER_PROMPTS.map((p) => p.id);
    expect(ids).toContain('connect-channels');
    expect(ids).toContain('inbound');
  });

  it('returns personalized follow-ups after a connect question', () => {
    const follow = followUpPromptsFor(
      'How do I connect WhatsApp, Facebook, Instagram, or Email in Samyoj?',
      '1. Open Settings → Channels. 2. Click Connect for the channel you need.'
    );
    expect(follow.length).toBeGreaterThanOrEqual(2);
    expect(follow.length).toBeLessThanOrEqual(4);
    expect(follow.some((p) => p.id === 'connect-channels')).toBe(false);
  });

  it('matches a follow-up question exactly', () => {
    expect(matchPrompt('How do I create and send a WhatsApp campaign?')?.id).toBe('campaign');
  });
});
