import { describe, expect, it } from 'vitest';
import { formatRecipientError } from './plainLanguage';

describe('formatRecipientError', () => {
  it('explains a Meta account lock instead of hiding it as jargon', () => {
    const text = formatRecipientError('(#131031) Business Account locked');
    expect(text.toLowerCase()).toMatch(/locked/);
    expect(text.toLowerCase()).toMatch(/template/);
    expect(text).not.toMatch(/this recipient could not be sent/i);
  });
});
