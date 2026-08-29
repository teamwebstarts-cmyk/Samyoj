import { describe, expect, it } from 'vitest';
import {
  MetaApiError,
  extractMetaErrorFields,
  isWithin24HourWindow,
} from '../whatsapp/meta.service';
import { conversationServiceWindowWhere, latestWindowOpenAt } from './service-window';
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

describe('conversationServiceWindowWhere', () => {
  it('treats a missing window as inactive', () => {
    const now = new Date('2026-08-29T12:00:00.000Z');
    expect(conversationServiceWindowWhere('closed', now)).toEqual({
      OR: [
        { cs24hWindowOpensAt: null },
        { cs24hWindowOpensAt: { lt: new Date('2026-08-28T12:00:00.000Z') } },
      ],
    });
  });

  it('requires opensAt within 24h for active', () => {
    const now = new Date('2026-08-29T12:00:00.000Z');
    expect(conversationServiceWindowWhere('open', now)).toEqual({
      cs24hWindowOpensAt: { gte: new Date('2026-08-28T12:00:00.000Z') },
    });
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
