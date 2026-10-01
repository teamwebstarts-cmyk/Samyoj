import { describe, expect, it } from 'vitest';
import { composeMarketingImagePrompt } from './prompts/image-creative-director';
import { extractJsonObject } from './studio-prompts';

describe('composeMarketingImagePrompt', () => {
  it('locks the model to one poster and keeps the user brief', () => {
    const prompt = composeMarketingImagePrompt('Diwali serum, 20% off, gold bottle');
    expect(prompt).toContain('One image. One poster.');
    expect(prompt).toContain('No collage');
    expect(prompt).toContain('Diwali serum, 20% off, gold bottle');
    expect(prompt).toContain('Do not put several posters');
  });
});

describe('extractJsonObject', () => {
  it('reads a fenced JSON object', () => {
    const pack = extractJsonObject('```json\n{"name":"Diwali","imagePrompt":"lamps"}\n```');
    expect(pack.name).toBe('Diwali');
  });
});
