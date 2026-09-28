import { describe, expect, it } from 'vitest';
import { AI_USAGE_ACTIONS } from '../ai/ai-usage-actions';
import { captionAiMessages, stripCaptionOutput } from './posts.caption-ai';
import { CAPTION_MAX } from './posts.limits';

describe('captionAiMessages', () => {
  it('polish keeps the original caption and forbids a new one', () => {
    const { system, user } = captionAiMessages('polish', '  new drop live  ');
    expect(system).toMatch(/do not invent a new caption/i);
    expect(system).toMatch(/same language/i);
    expect(system).not.toMatch(/sarvam|openai|system prompt/i);
    expect(user).toContain('new drop live');
  });

  it('generate writes from the prompt in the prompt language', () => {
    const { system, user } = captionAiMessages('generate', 'Diwali sale on kurtas');
    expect(system).toMatch(/match the language/i);
    expect(system).toMatch(/instagram/i);
    expect(user).toContain('Diwali sale on kurtas');
  });
});

describe('stripCaptionOutput', () => {
  it('strips fences, caption labels, and wrapping quotes', () => {
    expect(stripCaptionOutput('```\nCaption: "Hello shop"\n```')).toBe('Hello shop');
  });

  it('clips to the Instagram caption max', () => {
    const raw = 'x'.repeat(CAPTION_MAX + 40);
    expect(stripCaptionOutput(raw).length).toBe(CAPTION_MAX);
  });
});

describe('AI_USAGE_ACTIONS', () => {
  it('records Instagram captions as a named Reports surface', () => {
    expect(AI_USAGE_ACTIONS).toContain('instagram_caption');
  });
});
