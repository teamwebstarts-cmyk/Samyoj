export interface FilterableSend {
  name: string;
  email: string;
  subject: string;
  status: string;
}

export function filterRecentSends<T extends FilterableSend>(sends: T[], query: string, status: string): T[] {
  const q = String(query || '').trim().toLowerCase();
  const want = status && status !== 'ALL' ? status : '';
  return (sends || []).filter((send) => {
    if (want && send.status !== want) return false;
    if (!q) return true;
    return [send.name, send.email, send.subject].some((part) =>
      String(part || '').toLowerCase().includes(q)
    );
  });
}

export function priorSendsFor<T extends { email: string }>(sends: T[], email: string): T[] {
  const needle = String(email || '').trim().toLowerCase();
  if (!needle) return [];
  return (sends || []).filter((send) => String(send.email || '').trim().toLowerCase() === needle);
}

/** Sidebar list: one row per recipient (latest send), avoids duplicate scroll clutter. */
export function dedupeLatestSendPerEmail<T extends { email: string; createdAt: string }>(sends: T[]): T[] {
  const byEmail = new Map<string, T>();
  for (const send of sends || []) {
    const key = String(send.email || '').trim().toLowerCase();
    if (!key) continue;
    const existing = byEmail.get(key);
    if (!existing) {
      byEmail.set(key, send);
      continue;
    }
    const nextAt = new Date(send.createdAt).getTime();
    const prevAt = new Date(existing.createdAt).getTime();
    if (nextAt >= prevAt) byEmail.set(key, send);
  }
  return [...byEmail.values()].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}
