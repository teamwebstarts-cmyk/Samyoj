export function sortContactIdsForLock(ids: string[]) {
  return [...ids].sort((a, b) => a.localeCompare(b));
}
