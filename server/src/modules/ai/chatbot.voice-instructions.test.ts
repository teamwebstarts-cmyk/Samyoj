import { describe, expect, it } from 'vitest';
import {
  embedVoiceInstructions,
  extractVoiceInstructions,
  stripVoiceInstructions,
} from './voice-instructions';

describe('extractVoiceInstructions', () => {
  it('returns null when no voice block is present', () => {
    expect(extractVoiceInstructions('Be helpful and concise.')).toBeNull();
    expect(extractVoiceInstructions('')).toBeNull();
  });

  it('extracts the voice block body', () => {
    const instructions = [
      'Chat personality: friendly.',
      '',
      '<!-- VOICE_INSTRUCTIONS -->',
      'Speak slowly. Keep answers under 12 words.',
      '<!-- /VOICE_INSTRUCTIONS -->',
    ].join('\n');

    expect(extractVoiceInstructions(instructions)).toBe(
      'Speak slowly. Keep answers under 12 words.'
    );
  });

  it('returns null for empty or unclosed voice blocks', () => {
    expect(
      extractVoiceInstructions('<!-- VOICE_INSTRUCTIONS -->\n\n<!-- /VOICE_INSTRUCTIONS -->')
    ).toBeNull();
    expect(extractVoiceInstructions('<!-- VOICE_INSTRUCTIONS -->\nSay hello')).toBeNull();
  });
});

describe('stripVoiceInstructions / embedVoiceInstructions', () => {
  it('round-trips chat + voice instructions', () => {
    const embedded = embedVoiceInstructions('Be warm.', 'Keep replies short on calls.');
    expect(extractVoiceInstructions(embedded)).toBe('Keep replies short on calls.');
    expect(stripVoiceInstructions(embedded)).toBe('Be warm.');
  });
});
