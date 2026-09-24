import { describe, expect, it } from 'vitest';
import { channelListScope, formatChannelExport } from './channel-inbox-actions';
import { httpsMediaUrl } from './page-client';

describe('formatChannelExport', () => {
  it('names the customer on inbound text', () => {
    const text = formatChannelExport(
      [
        {
          createdAt: new Date('2026-09-24T10:05:00Z'),
          direction: 'INBOUND',
          type: 'TEXT',
          content: 'hello',
        },
      ],
      { agent: 'Agent', customer: 'Nirbhay' }
    );
    expect(text).toContain('Nirbhay: hello');
    expect(text).not.toContain('Agent: hello');
  });
});

describe('httpsMediaUrl', () => {
  it('accepts https and rejects http', () => {
    expect(httpsMediaUrl('https://cdn.example.com/a.jpg')).toBe('https://cdn.example.com/a.jpg');
    expect(httpsMediaUrl('http://cdn.example.com/a.jpg')).toBeNull();
  });
});

describe('channelListScope', () => {
  it('keeps snoozed chats off the default list', () => {
    const scope = channelListScope({});
    expect(JSON.stringify(scope.AND[0])).toContain('snoozedUntil');
  });
});
