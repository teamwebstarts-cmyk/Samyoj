export const ticketStatusLabels: Record<string, string> = {
  OPEN: 'Open',
  PENDING: 'Pending',
  WAITING: 'Waiting',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
};

export const ticketPriorityLabels: Record<string, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  URGENT: 'Urgent',
};

export const ticketStatusFilterOptions = [
  { value: '', label: 'All statuses' },
  { value: 'OPEN', label: 'Open' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'WAITING', label: 'Waiting' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'CLOSED', label: 'Closed' },
] as const;

export function ticketStatusLabel(status: string) {
  return ticketStatusLabels[status] ?? status.replace(/_/g, ' ').toLowerCase();
}

export function ticketPriorityLabel(priority: string) {
  return ticketPriorityLabels[priority] ?? priority.replace(/_/g, ' ').toLowerCase();
}
