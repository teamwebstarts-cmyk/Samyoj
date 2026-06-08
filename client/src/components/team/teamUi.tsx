import type { AgentAvailability, OrgRole } from '../../types';

export const roleBadgeStyles: Record<OrgRole, string> = {
  OWNER: 'bg-violet-500/10 text-violet-700 ring-violet-500/20 dark:text-violet-300',
  ADMIN: 'bg-sky-500/10 text-sky-700 ring-sky-500/20 dark:text-sky-300',
  SUPERVISOR: 'bg-amber-500/10 text-amber-700 ring-amber-500/20 dark:text-amber-300',
  AGENT: 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:text-emerald-300',
};

export const roleLabels: Record<OrgRole, string> = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  SUPERVISOR: 'Supervisor',
  AGENT: 'Agent',
};

export const availabilityConfig: Record<
  AgentAvailability,
  { label: string; dot: string; ring: string }
> = {
  ONLINE: {
    label: 'Online',
    dot: 'bg-emerald-500',
    ring: 'ring-emerald-500/30',
  },
  AWAY: {
    label: 'Away',
    dot: 'bg-amber-400',
    ring: 'ring-amber-400/30',
  },
  OFFLINE: {
    label: 'Offline',
    dot: 'bg-neutral-400',
    ring: 'ring-neutral-400/20',
  },
};

export const auditActionLabels: Record<string, string> = {
  MEMBER_ADDED: 'Member added',
  MEMBER_UPDATED: 'Member updated',
  MEMBER_REMOVED: 'Member removed',
  ROLE_CHANGED: 'Role changed',
  INVITE_SENT: 'Invite sent',
  INVITE_ACCEPTED: 'Invite accepted',
  INVITE_REVOKED: 'Invite revoked',
  AVAILABILITY_CHANGED: 'Availability changed',
  DEPARTMENT_CREATED: 'Department created',
  DEPARTMENT_UPDATED: 'Department updated',
  DEPARTMENT_DELETED: 'Department deleted',
  SETTINGS_CHANGED: 'Settings changed',
  SESSION_REVOKED: 'Session revoked',
  PASSWORD_RESET: 'Password reset',
  TWO_FACTOR_ENABLED: '2FA enabled',
  TWO_FACTOR_DISABLED: '2FA disabled',
};

export const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function formatJoinedDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatRelativeTime(value: string) {
  const diff = Date.now() - new Date(value).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}
