import { describe, expect, it } from 'vitest';
import {
  embedVoiceInstructions,
  extractVoiceInstructions,
  stripVoiceInstructions,
  relaxClippedVoiceLines,
  VOICE_SAFETY_RULES,
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

describe('VOICE_SAFETY_RULES', () => {
  it('asks for a natural phone turn, not a clipped 5-15 word IVR', () => {
    expect(VOICE_SAFETY_RULES).not.toMatch(/5-15 words/i);
    expect(VOICE_SAFETY_RULES).toMatch(/one or two spoken sentences/i);
    expect(VOICE_SAFETY_RULES).toMatch(/Hinglish/i);
    expect(VOICE_SAFETY_RULES).toMatch(/end_call/);
    expect(VOICE_SAFETY_RULES).toMatch(/continuous thought/i);
    expect(VOICE_SAFETY_RULES).toMatch(/previous spoken turn/i);
  });
});

describe('relaxClippedVoiceLines', () => {
  it('removes old 15-word call caps from stored bot instructions', () => {
    const relaxed = relaxClippedVoiceLines(
      'Be warm. Voice replies must be under 15 words, one sentence. Help the customer.'
    );
    expect(relaxed).not.toMatch(/under 15 words/i);
    expect(relaxed).toMatch(/Be warm/);
    expect(relaxed).toMatch(/Help the customer/);
  });
});
