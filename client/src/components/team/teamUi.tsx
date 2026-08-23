import type { AgentAvailability, OrgRole, TeamPermissions } from '../../types';

export const roleBadgeStyles: Record<OrgRole, string> = {
  OWNER: 'bg-violet-500/10 text-violet-700 ring-violet-500/20 dark:text-violet-300',
  ADMIN: 'bg-sky-500/10 text-sky-700 ring-sky-500/20 dark:text-sky-300',
  SUPERVISOR: 'bg-amber-500/10 text-amber-700 ring-amber-500/20 dark:text-amber-300',
  AGENT: 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:text-emerald-300',
};

export const roleAccentStyles: Record<OrgRole, { border: string; bg: string; icon: string; column: string }> = {
  OWNER: {
    border: 'border-violet-200 dark:border-violet-500/30',
    bg: 'bg-violet-500/10',
    icon: 'text-violet-600 dark:text-violet-300',
    column: 'bg-violet-500/[0.04]',
  },
  ADMIN: {
    border: 'border-sky-200 dark:border-sky-500/30',
    bg: 'bg-sky-500/10',
    icon: 'text-sky-600 dark:text-sky-300',
    column: 'bg-sky-500/[0.04]',
  },
  SUPERVISOR: {
    border: 'border-amber-200 dark:border-amber-500/30',
    bg: 'bg-amber-500/10',
    icon: 'text-amber-600 dark:text-amber-300',
    column: 'bg-amber-500/[0.04]',
  },
  AGENT: {
    border: 'border-emerald-200 dark:border-emerald-500/30',
    bg: 'bg-emerald-500/10',
    icon: 'text-emerald-600 dark:text-emerald-300',
    column: 'bg-emerald-500/[0.04]',
  },
};

export const roleSummaries: Record<OrgRole, string> = {
  OWNER: 'Full workspace control — always unlocked',
  ADMIN: 'Operations lead with broad access',
  SUPERVISOR: 'Oversees agents and inbox quality',
  AGENT: 'Frontline support and customer chats',
};

export const roleInfo: Record<
  OrgRole,
  { tagline: string; description: string; responsibilities: string[] }
> = {
  OWNER: {
    tagline: 'Workspace owner',
    description:
      'The account holder with full control. Billing, team, settings, and every feature — permissions cannot be changed.',
    responsibilities: ['Billing & subscription', 'Team & role management', 'All features unlocked'],
  },
  ADMIN: {
    tagline: 'Operations manager',
    description:
      'Runs day-to-day operations. You choose which areas they can access — inbox, campaigns, AI bots, billing, and more.',
    responsibilities: ['Configurable per feature', 'Team & invites when enabled', 'Billing & settings when enabled'],
  },
  SUPERVISOR: {
    tagline: 'Team lead',
    description:
      'Oversees agents and inbox quality. You choose whether they can access calls, tickets, usage stats, or growth tools.',
    responsibilities: ['Inbox & calls by default', 'Usage stats when enabled', 'Growth tools optional'],
  },
  AGENT: {
    tagline: 'Support agent',
    description:
      'Frontline teammate who handles customer conversations. Typically inbox, calls, contacts, and tickets.',
    responsibilities: ['Reply in shared inbox', 'Handle assigned chats', 'Update availability status'],
  },
};

export const roleLabels: Record<OrgRole, string> = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  SUPERVISOR: 'Supervisor',
  AGENT: 'Agent',
};

export const ROLE_COLUMNS: OrgRole[] = ['OWNER', 'ADMIN', 'SUPERVISOR', 'AGENT'];

export const CONFIGURABLE_ROLES: OrgRole[] = ['ADMIN', 'SUPERVISOR', 'AGENT'];

export const PERMISSION_KEYS: (keyof TeamPermissions)[] = [
  'manageInbox',
  'manageCalls',
  'manageAiBots',
  'manageAutomations',
  'manageCampaigns',
  'manageTemplates',
  'manageContacts',
  'manageTickets',
  'manageTeam',
  'manageBilling',
  'manageSettings',
];

/** All keys are enforced on the API when toggled off (Owner always passes). */
export const ENFORCED_PERMISSION_KEYS: (keyof TeamPermissions)[] = [...PERMISSION_KEYS];

export interface PermissionGroup {
  id: string;
  label: string;
  keys: (keyof TeamPermissions)[];
}

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    id: 'messaging',
    label: 'Messaging & support',
    keys: ['manageInbox', 'manageCalls', 'manageContacts', 'manageTickets'],
  },
  {
    id: 'growth',
    label: 'Growth & automation',
    keys: ['manageAiBots', 'manageAutomations', 'manageCampaigns', 'manageTemplates'],
  },
  {
    id: 'admin',
    label: 'Workspace administration',
    keys: ['manageTeam', 'manageBilling', 'manageSettings'],
  },
];

export const permissionMeta: Record<
  keyof TeamPermissions,
  { label: string; description: string; mapsTo: string }
> = {
  manageInbox: {
    label: 'Inbox',
    description: 'Open Inbox, reply to chats, labels, canned replies, and assignments.',
    mapsTo: 'Inbox',
  },
  manageCalls: {
    label: 'Calls',
    description: 'Place and receive WhatsApp calls, view call history, and call settings.',
    mapsTo: 'Calls',
  },
  manageAiBots: {
    label: 'AI Bots',
    description: 'Create, train, and manage AI bots for chat and calling.',
    mapsTo: 'AI Bots',
  },
  manageAutomations: {
    label: 'Automations',
    description: 'Build and publish automation workflows and chat flows.',
    mapsTo: 'Automations',
  },
  manageCampaigns: {
    label: 'Campaigns',
    description: 'Create, schedule, send, and manage WhatsApp campaigns.',
    mapsTo: 'Campaigns',
  },
  manageTemplates: {
    label: 'Templates',
    description: 'Sync, create, edit, and send test WhatsApp templates.',
    mapsTo: 'Templates',
  },
  manageContacts: {
    label: 'Contacts',
    description: 'View, import, edit, tag, and export customer contacts.',
    mapsTo: 'Contacts',
  },
  manageTickets: {
    label: 'Tickets',
    description: 'Create, assign, update, and resolve support tickets.',
    mapsTo: 'Tickets',
  },
  manageTeam: {
    label: 'Team',
    description: 'Add or remove members, send invites, edit departments, and save role access.',
    mapsTo: 'Team',
  },
  manageBilling: {
    label: 'Billing & usage',
    description: 'View usage statistics, plans, invoices, and subscription details.',
    mapsTo: 'Billing & Usage',
  },
  manageSettings: {
    label: 'Settings',
    description: 'Workspace configuration, integrations, compliance, and WhatsApp connect.',
    mapsTo: 'Settings',
  },
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
