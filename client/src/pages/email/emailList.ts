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
