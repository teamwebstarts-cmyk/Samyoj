import { describe, expect, it } from 'vitest';
import {
  describeUnsupportedMessage,
  isUnsupportedMessageContent,
  unsupportedTypeFromContent,
} from './unsupportedMessage';

describe('unsupportedMessage helpers', () => {
  it('recognizes legacy [unsupported] content', () => {
    expect(isUnsupportedMessageContent('[unsupported]', null)).toBe(true);
    expect(unsupportedTypeFromContent('[unsupported]')).toBe('unsupported');
    expect(describeUnsupportedMessage('poll_creation').title).toBe('Poll');
  });

  it('recognizes metadata flag', () => {
    expect(
      isUnsupportedMessageContent('anything', { isUnsupported: true, unsupportedType: 'poll_creation' })
    ).toBe(true);
  });
});
