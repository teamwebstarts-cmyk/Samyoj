/** Pure sent-list helpers. Shared by the compose UI and the polish checker. */

export function filterRecentSends(sends, query, status) {
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

export function priorSendsFor(sends, email) {
  const needle = String(email || '').trim().toLowerCase();
  if (!needle) return [];
  return (sends || []).filter((send) => String(send.email || '').trim().toLowerCase() === needle);
}

/** Sidebar list: one row per recipient (latest send). */
export function dedupeLatestSendPerEmail(sends) {
  const byEmail = new Map();
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
