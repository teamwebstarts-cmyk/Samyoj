import { describe, expect, it } from 'vitest';
import { fillTemplateMessageContent } from './inboxUtils';

describe('fillTemplateMessageContent', () => {
  it('replaces numbered placeholders with sent values', () => {
    expect(
      fillTemplateMessageContent(
        "Hi {{1}}, we've received a cancellation request for your {{2}}.",
        { body: ['Nirbhay', 'order #42'] }
      )
    ).toBe("Hi Nirbhay, we've received a cancellation request for your order #42.");
  });

  it('leaves placeholders when no values were saved', () => {
    expect(fillTemplateMessageContent('Hi {{1}}', { body: [] })).toBe('Hi {{1}}');
  });

  it('replaces the stored sample name with the name that was sent', () => {
    expect(
      fillTemplateMessageContent('Dear Rahul,\n\nWarm regards,', { body: ['Surendra'] })
    ).toBe('Dear Surendra,\n\nWarm regards,');
  });
});
