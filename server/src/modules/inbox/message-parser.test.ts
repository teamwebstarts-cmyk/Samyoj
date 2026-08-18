import { describe, expect, it } from 'vitest';
import { parseInboundMessage } from './message-parser';
import { describeUnsupportedType } from './unsupported-message';

describe('parseInboundMessage — Meta unsupported', () => {
  it('maps poll_creation to a friendly unsupported payload', () => {
    const parsed = parseInboundMessage({
      from: '16505551234',
      id: 'wamid.test',
      timestamp: '1750090702',
      type: 'unsupported',
      unsupported: { type: 'poll_creation' },
      errors: [
        {
          code: 131051,
          title: 'Message type unknown',
          message: 'Message type unknown',
          error_data: { details: 'Message type is currently not supported.' },
        },
      ],
    });

    expect(parsed.metadata?.isUnsupported).toBe(true);
    expect(parsed.metadata?.unsupportedType).toBe('poll_creation');
    expect(parsed.metadata?.metaErrorCode).toBe(131051);
    expect(parsed.content).toContain('Poll');
    expect(parsed.content).not.toBe('[unsupported]');
  });

  it('parses location and contacts', () => {
    const loc = parseInboundMessage({
      type: 'location',
      location: { latitude: 1.2, longitude: 3.4, name: 'Office', address: '1 Main St' },
    });
    expect(loc.location?.name).toBe('Office');
    expect(loc.content).toBe('Office');

    const contacts = parseInboundMessage({
      type: 'contacts',
      contacts: [
        {
          name: { formatted_name: 'Ada Lovelace' },
          phones: [{ phone: '+15551212' }],
        },
      ],
    });
    expect(contacts.contacts?.[0].name).toBe('Ada Lovelace');
    expect(contacts.content).toBe('Ada Lovelace');
  });
});

describe('describeUnsupportedType', () => {
  it('labels poll_update', () => {
    expect(describeUnsupportedType('poll_update').title).toBe('Poll update');
  });
});

describe('parseInboundMessage — call_permission', () => {
  it('parses call_permission_request interactive type', () => {
    const parsed = parseInboundMessage({
      from: '16505551234',
      id: 'wamid.perm',
      timestamp: '1750090702',
      type: 'interactive',
      interactive: {
        type: 'call_permission_request',
        action: { name: 'call_permission_request' },
        body: { text: 'We would like to call you on WhatsApp to help with your request.' },
      },
    });

    expect(parsed.content).toBe(
      'We would like to call you on WhatsApp to help with your request.'
    );
    expect(parsed.callPermissionStatus).toBe('pending');
  });

  it('falls back to default content when body text is missing', () => {
    const parsed = parseInboundMessage({
      type: 'interactive',
      interactive: {
        type: 'call_permission_request',
        action: { name: 'call_permission_request' },
      },
    });

    expect(parsed.content).toBe('Call permission requested');
    expect(parsed.callPermissionStatus).toBe('pending');
  });

  it('parses call_permission_response with granted status', () => {
    const parsed = parseInboundMessage({
      type: 'interactive',
      interactive: {
        type: 'call_permission_response',
        call_permission_response: { status: 'granted' },
      },
    });

    expect(parsed.content).toBe('Call permission granted');
    expect(parsed.callPermissionStatus).toBe('granted');
  });

  it('parses call_permission_response with denied status', () => {
    const parsed = parseInboundMessage({
      type: 'interactive',
      interactive: {
        type: 'call_permission_response',
        call_permission_response: { status: 'denied' },
      },
    });

    expect(parsed.content).toBe('Call permission denied');
    expect(parsed.callPermissionStatus).toBe('denied');
  });
});
