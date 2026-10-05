import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  clearAllDismissedNotifications,
  dismissNotificationIds,
  isNotificationDismissed,
} from './notificationDismissals';

describe('notificationDismissals', () => {
  beforeEach(() => {
    vi.stubGlobal('sessionStorage', {
      store: {} as Record<string, string>,
      getItem(key: string) {
        return this.store[key] ?? null;
      },
      setItem(key: string, value: string) {
        this.store[key] = value;
      },
      removeItem(key: string) {
        delete this.store[key];
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
