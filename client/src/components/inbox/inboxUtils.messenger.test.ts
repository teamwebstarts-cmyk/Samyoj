import { describe, expect, it } from 'vitest';
import {
  formatMessengerContactTitle,
  isMessengerPlaceholderContactName,
} from './inboxUtils';

describe('messenger contact display', () => {
  it('detects server placeholder names', () => {
    expect(isMessengerPlaceholderContactName('Messenger 579468')).toBe(true);
    expect(isMessengerPlaceholderContactName('')).toBe(true);
    expect(isMessengerPlaceholderContactName('Jane Doe')).toBe(false);
  });

  it('shows real display name when present', () => {
    expect(formatMessengerContactTitle({ name: 'Jane Doe' })).toBe('Jane Doe');
  });

  it('keeps placeholder label without inventing a handle', () => {
    expect(formatMessengerContactTitle({ name: 'Messenger 579468' })).toBe('Messenger 579468');
  });

  it('falls back to phone then default label', () => {
    expect(formatMessengerContactTitle({ name: 'Messenger 1', phone: '+15551234' })).toBe(
      '+15551234'
    );
    expect(formatMessengerContactTitle({})).toBe('Messenger');
  });
});
