import { describe, expect, it } from 'vitest';
import {
  CAPTION_MAX,
  CAROUSEL_MAX,
  CAROUSEL_MIN,
  HASHTAG_MAX,
  countHashtags,
  extractHashtags,
  formatPostDate,
  isRemoteId,
  postDisplayDate,
  statusLabel,
  statusModifier,
} from './types';

describe('statusLabel', () => {
  it('maps documented statuses to user-facing labels', () => {
    expect(statusLabel('DRAFT')).toBe('Draft');
    expect(statusLabel('SCHEDULED')).toBe('Scheduled');
    expect(statusLabel('PROCESSING')).toBe('Publishing');
    expect(statusLabel('PUBLISHED')).toBe('Published');
    expect(statusLabel('FAILED')).toBe('Failed');
    expect(statusLabel('CANCELLED')).toBe('Cancelled');
  });

  it('does not invent statuses', () => {
    expect(statusLabel('ALL')).toBe('All');
  });
});

describe('statusModifier', () => {
  it('maps PROCESSING to the same pill style key as its label', () => {
    expect(statusModifier('PROCESSING')).toBe('processing');
    expect(statusModifier('DRAFT')).toBe('draft');
    expect(statusModifier('CANCELLED')).toBe('cancelled');
  });
});

describe('formatPostDate', () => {
  it('formats to a readable date and time', () => {
    const iso = new Date(2026, 8, 22, 10, 30).toISOString();
    expect(formatPostDate(iso)).toContain('Sep 22, 2026');
    expect(formatPostDate(iso)).toContain('10:30');
  });

  it('returns null for missing or invalid dates', () => {
    expect(formatPostDate(null)).toBeNull();
    expect(formatPostDate('')).toBeNull();
    expect(formatPostDate('not-a-date')).toBeNull();
  });
});

describe('postDisplayDate', () => {
  it('uses scheduledAt for scheduled posts', () => {
    const scheduled = new Date(2026, 8, 30, 9, 0).toISOString();
    const row = {
      id: 'p1',
      status: 'SCHEDULED',
      mediaType: 'IMAGE' as const,
      caption: '',
      imageUrl: '',
      mediaPayload: [],
      scheduledAt: scheduled,
      publishedAt: null,
      igMediaId: null,
      lastError: null,
    };
    expect(postDisplayDate(row)).toContain('Sep 30, 2026');
  });

  it('uses publishedAt for published posts', () => {
    const published = new Date(2026, 8, 20, 17, 15).toISOString();
    const row = {
      id: 'p2',
      status: 'PUBLISHED',
      mediaType: 'IMAGE' as const,
      caption: '',
      imageUrl: '',
      mediaPayload: [],
      scheduledAt: null,
      publishedAt: published,
      igMediaId: null,
      lastError: null,
    };
    expect(postDisplayDate(row)).toContain('Sep 20, 2026');
  });

  it('falls back through published/scheduled/createdAt for other statuses', () => {
    const row = {
      id: 'p3',
      status: 'DRAFT',
      mediaType: 'IMAGE' as const,
      caption: '',
      imageUrl: '',
      mediaPayload: [],
      scheduledAt: null,
      publishedAt: null,
      igMediaId: null,
      lastError: null,
      createdAt: new Date(2026, 8, 26, 12, 0).toISOString(),
    };
    expect(postDisplayDate(row)).toContain('Sep 26, 2026');
  });
});

describe('remote library ids', () => {
  it('detects remote: prefix used by Already on Instagram selections', () => {
    expect(isRemoteId('remote:17900')).toBe(true);
    expect(isRemoteId('cuid123')).toBe(false);
    expect(isRemoteId(null)).toBe(false);
    expect(isRemoteId('')).toBe(false);
  });
});

describe('hashtags', () => {
  it('counts hashtags with letters, digits and underscores', () => {
    expect(countHashtags('New #collection and #summer_vibes plus #goodvibes2')).toBe(3);
    expect(countHashtags('no tags here')).toBe(0);
    expect(countHashtags('')).toBe(0);
  });

  it('extracts hashtags in order', () => {
    expect(extractHashtags('first #A then #B_2')).toEqual(['#A', '#B_2']);
  });

  it('keeps documented limits aligned with the server', () => {
    expect(CAPTION_MAX).toBe(2200);
    expect(HASHTAG_MAX).toBe(30);
    expect(CAROUSEL_MIN).toBe(2);
    expect(CAROUSEL_MAX).toBe(10);
  });
});
