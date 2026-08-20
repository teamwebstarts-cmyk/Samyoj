import { describe, expect, it } from 'vitest';
import {
  computeProfileCompleteness,
  isProfileCoreComplete,
  parseOrgProfile,
} from './org-profile';

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
