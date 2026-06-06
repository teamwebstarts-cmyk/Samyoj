export function getTemplateRejectedReason(reason?: string): string | null {
  if (!reason) return null;
  const trimmed = reason.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  if (['none', 'n/a', 'na', '-', 'null'].includes(lower)) return null;
  return trimmed;
}
