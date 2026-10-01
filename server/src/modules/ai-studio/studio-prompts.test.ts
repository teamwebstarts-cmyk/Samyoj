import { describe, expect, it } from 'vitest';
import { extractJsonObject } from './studio-prompts';

describe('extractJsonObject', () => {
  it('reads a fenced JSON object', () => {
    const pack = extractJsonObject('```json\n{"name":"Diwali","imagePrompt":"lamps"}\n```');
    expect(pack.name).toBe('Diwali');
  });
});
