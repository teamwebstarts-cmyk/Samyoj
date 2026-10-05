import { describe, expect, it } from 'vitest';
import { getNotificationMockAlerts } from './notificationMockData';

describe('getNotificationMockAlerts', () => {
  it('covers messages, tickets, and updates for preview', () => {
    const rows = getNotificationMockAlerts(1_000_000);
    const categories = new Set(rows.map((r) => r.category));
    expect(rows.length).toBeGreaterThanOrEqual(6);
    expect(categories.has('messages')).toBe(true);
    expect(categories.has('tickets')).toBe(true);
    expect(categories.has('updates')).toBe(true);
    expect(categories.has('agents')).toBe(true);
  });
});
