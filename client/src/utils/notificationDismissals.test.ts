import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  clearAllDismissedNotifications,
  dismissNotificationIds,
  isNotificationDismissed,
} from './notificationDismissals';

describe('notificationDismissals', () => {
  const store: Record<string, string> = {};

  beforeEach(() => {
    for (const key of Object.keys(store)) delete store[key];
    vi.stubGlobal('sessionStorage', {
      getItem(key: string) {
        return store[key] ?? null;
      },
      setItem(key: string, value: string) {
        store[key] = value;
      },
      removeItem(key: string) {
        delete store[key];
      },
    });
  });

  it('persists dismissed ids per user', () => {
    dismissNotificationIds('user-1', ['a', 'b']);
    expect(isNotificationDismissed('user-1', 'a')).toBe(true);
    expect(isNotificationDismissed('user-1', 'c')).toBe(false);
    clearAllDismissedNotifications('user-1', ['c']);
    expect(isNotificationDismissed('user-1', 'c')).toBe(true);
  });
});
