import { describe, expect, it } from 'vitest';
import {
  formatInstagramContactTitle,
  instagramProfileUrlFromContact,
  isInstagramPlaceholderContactName,
} from './inboxUtils';

describe('instagram contact display', () => {
  it('formats resolved username with @', () => {
    expect(formatInstagramContactTitle({ name: 'nirbhay_hiwse' })).toBe('@nirbhay_hiwse');
    expect(formatInstagramContactTitle({ name: '@nirbhay_hiwse' })).toBe('@nirbhay_hiwse');
  });

  it('keeps placeholder label without @', () => {
    expect(isInstagramPlaceholderContactName('Instagram 579468')).toBe(true);
    expect(formatInstagramContactTitle({ name: 'Instagram 579468' })).toBe('Instagram 579468');
    expect(instagramProfileUrlFromContact({ name: 'Instagram 579468' })).toBeNull();
  });

  it('builds profile URL for valid handles', () => {
    expect(instagramProfileUrlFromContact({ name: 'nirbhay_hiwse' })).toBe(
      'https://www.instagram.com/nirbhay_hiwse/'
    );
  });
});
