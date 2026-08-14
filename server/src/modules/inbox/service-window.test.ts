import { describe, expect, it } from 'vitest';
import {
  MetaApiError,
  extractMetaErrorFields,
  isWithin24HourWindow,
} from '../whatsapp/meta.service';
import { latestWindowOpenAt } from './service-window';
import { nextUnreadCount } from './unread';

describe('latestWindowOpenAt', () => {
  it('picks the newest inbound or call timestamp', () => {
    const older = new Date('2026-08-01T00:00:00.000Z');
    const newer = new Date('2026-08-02T00:00:00.000Z');
    expect(latestWindowOpenAt(older, null, newer)?.toISOString()).toBe(newer.toISOString());
    expect(latestWindowOpenAt(undefined, null)).toBeNull();
  });
});

describe('isWithin24HourWindow', () => {
  it('is closed when window never opened', () => {
    expect(isWithin24HourWindow(null)).toBe(false);
    expect(isWithin24HourWindow(undefined)).toBe(false);
  });

  it('is open within 24h of last inbound', () => {
    const opensAt = new Date(Date.now() - 2 * 60 * 60 * 1000);
    expect(isWithin24HourWindow(opensAt)).toBe(true);
  });

  it('is closed after 24h', () => {
    const opensAt = new Date(Date.now() - 25 * 60 * 60 * 1000);
    expect(isWithin24HourWindow(opensAt)).toBe(false);
  });
});

describe('extractMetaErrorFields', () => {
  it('reads MetaApiError fields', () => {
    const err = new MetaApiError('Recipient phone number not in allowed list', {
      metaCode: 131030,
      fbtraceId: 'AbCd',
      status: 400,
      statusCode: 400,
    });
    expect(extractMetaErrorFields(err)).toEqual({
      message: 'Recipient phone number not in allowed list',
      metaCode: 131030,
      metaSubcode: undefined,
      fbtraceId: 'AbCd',
      status: 400,
      statusCode: 400,
    });
  });

  it('parses (#code) from plain Error messages', () => {
    const err = new Error('(#131047) Message failed to send because more than 24 hours have passed');
    expect(extractMetaErrorFields(err).metaCode).toBe(131047);
  });
});

describe('nextUnreadCount', () => {
  it('bumps empty to 1 and preserves higher counts', () => {
    expect(nextUnreadCount(0)).toBe(1);
    expect(nextUnreadCount(undefined)).toBe(1);
    expect(nextUnreadCount(4)).toBe(4);
  });
});
