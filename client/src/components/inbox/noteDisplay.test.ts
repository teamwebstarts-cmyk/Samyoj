import { describe, expect, it } from 'vitest';
import { stripCallIdsFromNote } from './noteDisplay';

const UUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

describe('stripCallIdsFromNote', () => {
  it('keeps call-summary prose and drops Call ID line', () => {
    const body = stripCallIdsFromNote(
      `📞 Call summary (handoff):\nCustomer asked to talk to support.\n\nCall ID: ${UUID}`
    );
    expect(body).toBe('📞 Call summary (handoff):\nCustomer asked to talk to support.');
    expect(body).not.toContain(UUID);
    expect(body).not.toMatch(/Call ID/i);
  });

  it('drops Call: uuid from callback notes and keeps when/reason', () => {
    const body = stripCallIdsFromNote(
      [
        'Callback requested via AI voice agent.',
        'When: as soon as possible',
        'Reason: wants a person',
        'Ticket: 11111111-2222-3333-4444-555555555555',
        `Call: ${UUID}`,
      ].join('\n')
    );
    expect(body).toContain('Callback requested via AI voice agent.');
    expect(body).toContain('When: as soon as possible');
    expect(body).toContain('Reason: wants a person');
    expect(body).toContain('Ticket: 11111111-2222-3333-4444-555555555555');
    expect(body).not.toContain(UUID);
    expect(body).not.toMatch(/^Call:/m);
  });

  it('drops Graph / Meta labeled call ids', () => {
    expect(stripCallIdsFromNote(`Talked to customer.\nGraph call id: wacid.${'x'.repeat(24)}`)).toBe(
      'Talked to customer.'
    );
    expect(stripCallIdsFromNote(`Note\nMeta call id: ${'m'.repeat(22)}`)).toBe('Note');
  });

  it('keeps the agent typed note', () => {
    expect(stripCallIdsFromNote('dsasda')).toBe('dsasda');
    expect(stripCallIdsFromNote('Call tomorrow morning')).toBe('Call tomorrow morning');
    expect(stripCallIdsFromNote('Call: after lunch')).toBe('Call: after lunch');
  });

  it('hides a note that only existed to show an id', () => {
    expect(stripCallIdsFromNote(`Call ID: ${UUID}`)).toBe('');
    expect(stripCallIdsFromNote(`Call: ${UUID}`)).toBe('');
  });
});
