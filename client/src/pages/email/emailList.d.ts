export function filterRecentSends<T extends { name: string; email: string; subject: string; status: string }>(
  sends: T[],
  query: string,
  status: string,
): T[];

export function priorSendsFor<T extends { email: string }>(sends: T[], email: string): T[];
