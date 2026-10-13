/** Pick the number Embedded Signup already chose. Ask again only when Meta sent no id. */
export function chooseConnectPhone<T extends { wabaId: string; phoneNumberId: string }>(
  phones: T[],
  hints: { wabaId?: string; phoneNumberId?: string }
): { chosen: T | null; options: T[] } {
  const hintedWaba = hints.wabaId?.trim();
  const hintedPhone = hints.phoneNumberId?.trim();
  const byWaba = hintedWaba ? phones.filter((phone) => phone.wabaId === hintedWaba) : phones;
  const pool = byWaba.length > 0 ? byWaba : phones;

  if (hintedPhone) {
    const exact =
      pool.find((phone) => phone.phoneNumberId === hintedPhone) ||
      phones.find((phone) => phone.phoneNumberId === hintedPhone);
    if (exact) return { chosen: exact, options: [] };
  }

  if (pool.length === 1) return { chosen: pool[0], options: [] };
  return { chosen: null, options: pool };
}
