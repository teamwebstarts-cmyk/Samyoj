import { describe, expect, it } from 'vitest';
import {
  displayNameFromIgProfile,
  instagramPlaceholderName,
  isInstagramPlaceholderContactName,
} from './contact-name';

describe('instagram contact-name', () => {
  it('builds placeholder from igsid tail', () => {
    expect(instagramPlaceholderName('123456789468')).toBe('Instagram 789468');
  });

  it('prefers username over legal name', () => {
    expect(displayNameFromIgProfile({ name: 'Peter', username: 'peter_live' })).toBe('peter_live');
  });

  it('detects placeholder names', () => {
    expect(isInstagramPlaceholderContactName('Instagram 579468')).toBe(true);
    expect(isInstagramPlaceholderContactName('nirbhay_hiwse')).toBe(false);
  });
});
