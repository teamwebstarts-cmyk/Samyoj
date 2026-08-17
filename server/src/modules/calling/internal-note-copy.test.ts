import { describe, expect, it } from 'vitest';
import {
  formatCallbackInternalNote,
  formatCallSummaryInternalNote,
} from './internal-note-copy';

describe('internal-note-copy', () => {
  it('writes call summary without a Call ID', () => {
    const body = formatCallSummaryInternalNote(
      'Customer wanted to talk to support.',
      'handoff'
    );
    expect(body).toBe('📞 Call summary (handoff):\nCustomer wanted to talk to support.');
    expect(body).not.toMatch(/call\s*id/i);
    expect(body).not.toMatch(/\bCall:/);
  });

  it('writes callback note without Call: uuid', () => {
    const ticketId = '11111111-2222-3333-4444-555555555555';
    const body = formatCallbackInternalNote({
      when: 'as soon as possible',
      reason: 'wants a person',
      ticketId,
    });
    expect(body).toContain('Callback requested via AI voice agent.');
    expect(body).toContain('When: as soon as possible');
    expect(body).toContain('Reason: wants a person');
    expect(body).toContain(`Ticket: ${ticketId}`);
    expect(body).not.toMatch(/\bCall:/);
    expect(body).not.toMatch(/call\s*id/i);
  });
});
