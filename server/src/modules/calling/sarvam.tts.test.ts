import { describe, expect, it } from 'vitest';
import { normalizeSarvamLanguageCode } from './sarvam.tts';

describe('normalizeSarvamLanguageCode', () => {
  it('passes through valid BCP-47 locales', () => {
    expect(normalizeSarvamLanguageCode('hi-IN')).toBe('hi-IN');
    expect(normalizeSarvamLanguageCode('en-IN')).toBe('en-IN');
  });

  it('maps bare STT language codes to Sarvam Bulbul locales', () => {
    expect(normalizeSarvamLanguageCode('hi')).toBe('hi-IN');
    expect(normalizeSarvamLanguageCode('en')).toBe('en-IN');
    expect(normalizeSarvamLanguageCode('Hindi')).toBe('hi-IN');
  });

  it('falls back for unknown or auto', () => {
    expect(normalizeSarvamLanguageCode('unknown')).toBe('hi-IN');
    expect(normalizeSarvamLanguageCode('auto')).toBe('hi-IN');
    expect(normalizeSarvamLanguageCode(undefined)).toBe('hi-IN');
  });
});
