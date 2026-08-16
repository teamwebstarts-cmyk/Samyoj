import { describe, expect, it } from 'vitest';
import { formatBusinessExtrasBlock } from './business-context';
import { buildPersonalityGeneratePrompt, generatePersonalityInstructions } from './generate-personality.service';
import { canonicalAiUsageAction, charUsage } from './ai-usage-actions';

const extras = {
  companyName: 'Pune Dental',
  website: 'https://pune.dental',
  notes: 'Open 10–7, Kothrud. Parking in the basement.',
  audience: 'Families in Pune',
  valueProps: ['Same-day scaling'],
};

describe('buildPersonalityGeneratePrompt', () => {
  it('asks for rich chat instructions without platform chrome', () => {
    const { system, user } = buildPersonalityGeneratePrompt('CHAT', 'Dental clinic in Pune', extras);
    expect(system).toMatch(/WhatsApp/i);
    expect(system).toMatch(/greet/i);
    expect(system).toMatch(/tone/i);
    expect(system).toMatch(/person/i);
    expect(system).toMatch(/I cannot/i);
    expect(system).not.toMatch(/sarvam-105b|VOICE_SAFETY|embeddings/i);
    expect(user).toContain('Dental clinic in Pune');
    expect(user).toContain('https://pune.dental');
    expect(user).toContain('Kothrud');
    expect(user).toContain('Pune Dental');
  });

  it('asks for spoken calling instructions and includes business extras', () => {
    const { system, user } = buildPersonalityGeneratePrompt('CALL', 'Answer clinic calls', extras);
    expect(system).toMatch(/spoken|phone/i);
    expect(system).toMatch(/greet/i);
    expect(system).not.toMatch(/sarvam-105b|maxTokens|0\.7/i);
    expect(user).toContain('https://pune.dental');
    expect(user).toContain('Answer clinic calls');
  });
});

describe('formatBusinessExtrasBlock', () => {
  it('omits empty extras', () => {
    expect(
      formatBusinessExtrasBlock({
        companyName: 'Acme',
        website: '',
        notes: '',
        audience: '',
        valueProps: [],
      })
    ).toBe('Business name: Acme');
  });
});

describe('generatePersonalityInstructions', () => {
  it('rejects a too-short intent before calling the model', async () => {
    await expect(
      generatePersonalityInstructions({
        organizationId: 'org-1',
        intent: 'help',
        channel: 'CHAT',
      })
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('canonicalAiUsageAction', () => {
  it('maps legacy chat logs onto the chat bot surface', () => {
    expect(canonicalAiUsageAction('chat')).toBe('chat_bot');
    expect(canonicalAiUsageAction('stt')).toBe('stt');
  });
});

describe('charUsage', () => {
  it('stores listening/speaking as character units, not rupees', () => {
    expect(charUsage(12, 4)).toEqual({
      promptTokens: 12,
      completionTokens: 4,
      totalTokens: 16,
    });
  });
});
