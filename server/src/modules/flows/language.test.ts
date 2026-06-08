import { describe, expect, it } from 'vitest';
import { detectMessageLanguage } from './language';

describe('detectMessageLanguage', () => {
  it('detects English for latin text', () => {
    expect(detectMessageLanguage('Hello, how are you?')).toBe('en');
  });

  it('detects Hindi for Devanagari script', () => {
    expect(detectMessageLanguage('नमस्ते')).toBe('hi');
  });

  it('detects Arabic script', () => {
    expect(detectMessageLanguage('مرحبا')).toBe('ar');
  });

  it('defaults to en for empty', () => {
    expect(detectMessageLanguage('')).toBe('en');
    expect(detectMessageLanguage('   ')).toBe('en');
  });
});
