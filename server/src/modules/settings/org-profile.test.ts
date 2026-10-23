import { describe, expect, it } from 'vitest';
import {
  clipProfileSource,
  computeProfileCompleteness,
  isProfileCoreComplete,
  parseOrgProfile,
  PROFILE_SOURCE_STORE_CHARS,
} from './org-profile';
import { formatBusinessExtrasBlock } from '../ai/business-context';

describe('org-profile', () => {
  it('parses profile from settings JSON', () => {
    const profile = parseOrgProfile({
      profile: {
        description: 'We sell shoes',
        industry: 'RETAIL',
        website: 'https://shop.example',
      },
    });
    expect(profile.description).toBe('We sell shoes');
    expect(profile.industry).toBe('RETAIL');
    expect(profile.website).toBe('https://shop.example');
  });

  it('computes completeness for core fields', () => {
    const complete = computeProfileCompleteness('Acme', {
      description: 'We help',
      industry: 'RETAIL',
      website: 'https://acme.test',
    });
    expect(complete.isComplete).toBe(true);
    expect(complete.percent).toBe(100);

    const partial = computeProfileCompleteness('Acme', { description: 'Hi' });
    expect(partial.isComplete).toBe(false);
    expect(partial.requiredFilled).toBe(2);
  });

  it('keeps a short slice of PDF text and feeds AI prompts', () => {
    const clipped = clipProfileSource('  Price  list   ₹999  '.repeat(2000));
    expect(clipped.length).toBe(PROFILE_SOURCE_STORE_CHARS);
    expect(clipped.startsWith('Price list')).toBe(true);
    const block = formatBusinessExtrasBlock({
      companyName: 'Acme',
      website: '',
      notes: '',
      audience: '',
      valueProps: [],
      sourceExcerpt: 'Price list ₹999',
    });
    expect(block).toContain('Price list ₹999');
  });

  it('isProfileCoreComplete matches four required fields', () => {
    expect(
      isProfileCoreComplete('Acme', {
        description: 'x',
        industry: 'OTHER',
        website: 'https://a.test',
      })
    ).toBe(true);
    expect(isProfileCoreComplete('Acme', { description: 'x' })).toBe(false);
  });
});
