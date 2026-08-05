/** CRM-local unread bump for POST /inbox/:id/unread */
export function nextUnreadCount(current: number | null | undefined): number {
  return Math.max(1, current || 0);
}
