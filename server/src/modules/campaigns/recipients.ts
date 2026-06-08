export interface ResolvedRecipient {
  phone: string;
  name?: string;
  variables?: { body?: string[]; header?: string[] };
}

export function dedupeRecipients(recipients: ResolvedRecipient[]): ResolvedRecipient[] {
  const seen = new Set<string>();
  const result: ResolvedRecipient[] = [];
  for (const r of recipients) {
    if (seen.has(r.phone)) continue;
    seen.add(r.phone);
    result.push(r);
  }
  return result;
}
