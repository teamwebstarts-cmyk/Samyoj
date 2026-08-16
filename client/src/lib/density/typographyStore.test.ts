import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FONT_FAMILY,
  DEFAULT_TEXT_SIZE,
  FONT_FAMILIES,
  TEXT_SIZE_PX,
  isFontFamilyId,
  isTextSize,
} from './typographyStore';

describe('typography', () => {
  it('scales the html root in three steps', () => {
    expect(DEFAULT_TEXT_SIZE).toBe('default');
    expect(TEXT_SIZE_PX.small).toBe('14px');
    expect(TEXT_SIZE_PX.default).toBe('16px');
    expect(TEXT_SIZE_PX.large).toBe('18px');
    expect(isTextSize('large')).toBe(true);
    expect(isTextSize('xl')).toBe(false);
  });

  it('offers CRM-grade families and keeps Plus Jakarta Sans as default', () => {
    expect(DEFAULT_FONT_FAMILY).toBe('jakarta');
    expect(FONT_FAMILIES.map((f) => f.id)).toEqual([
      'jakarta',
      'inter',
      'geist',
      'ibm-plex',
      'source-sans',
      'roboto',
      'public-sans',
      'figtree',
      'noto',
      'atkinson',
      'system',
    ]);
    expect(isFontFamilyId('geist')).toBe(true);
    expect(isFontFamilyId('roboto')).toBe(true);
    expect(isFontFamilyId('nunito')).toBe(false);
    expect(isFontFamilyId('Comic Sans')).toBe(false);
    expect(FONT_FAMILIES.find((f) => f.id === 'jakarta')?.badge).toBe('default');
    expect(FONT_FAMILIES.find((f) => f.id === 'inter')?.badge).toBe('recommended');
    expect(FONT_FAMILIES.find((f) => f.id === 'jakarta')?.href).toBeNull();
    expect(FONT_FAMILIES.find((f) => f.id === 'system')?.href).toBeNull();
    expect(FONT_FAMILIES.find((f) => f.id === 'geist')?.href).toMatch(/fonts\.googleapis\.com/);
  });
});
