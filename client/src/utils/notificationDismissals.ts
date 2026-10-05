const STORAGE_PREFIX = 'samyoj.notifications.dismissed';

function storageKey(userId: string | undefined): string | null {
  if (!userId || typeof sessionStorage === 'undefined') return null;
  return `${STORAGE_PREFIX}.${userId}`;
}

function readSet(userId: string | undefined): Set<string> {
  const key = storageKey(userId);
  if (!key) return new Set();
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is string => typeof id === 'string' && id.length > 0));
  } catch {
    return new Set();
  }
}

function writeSet(userId: string | undefined, ids: Set<string>) {
  const key = storageKey(userId);
  if (!key) return;
  try {
    sessionStorage.setItem(key, JSON.stringify([...ids]));
  } catch {
    // quota / private mode
  }
}

export function isNotificationDismissed(userId: string | undefined, id: string): boolean {
  return readSet(userId).has(id);
}

export function dismissNotificationIds(userId: string | undefined, ids: string[]) {
  if (!ids.length) return;
  const set = readSet(userId);
  for (const id of ids) set.add(id);
  writeSet(userId, set);
}

export function clearAllDismissedNotifications(userId: string | undefined, ids: string[]) {
  dismissNotificationIds(userId, ids);
}
