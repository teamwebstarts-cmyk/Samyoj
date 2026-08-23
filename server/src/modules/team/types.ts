import type { OrgRole } from '@prisma/client';

export type AssignmentStrategy = 'LEAST_LOAD' | 'ROUND_ROBIN';

export interface TeamPermissions {
  manageInbox: boolean;
  manageCalls: boolean;
  manageAiBots: boolean;
  manageAutomations: boolean;
  manageCampaigns: boolean;
  manageTemplates: boolean;
  manageContacts: boolean;
  manageTickets: boolean;
  manageTeam: boolean;
  manageBilling: boolean;
  manageSettings: boolean;
}

/** Stored overrides may still use pre-2026 keys until re-saved from Team → Roles. */
type LegacyPermissionOverrides = Partial<TeamPermissions> & {
  manageFlows?: boolean;
  viewAnalytics?: boolean;
};

export interface ShiftSchedule {
  enabled: boolean;
  timezone: string;
  days: number[];
  startHour: number;
  endHour: number;
}

export interface TeamSettings {
  assignmentStrategy: AssignmentStrategy;
  roundRobinIndex: number;
  seatLimit: number;
  handoffOnlyOnline: boolean;
  respectShiftSchedule: boolean;
  rolePermissions?: Partial<Record<OrgRole, LegacyPermissionOverrides>>;
}

export const DEFAULT_TEAM_SETTINGS: TeamSettings = {
  assignmentStrategy: 'LEAST_LOAD',
  roundRobinIndex: 0,
  seatLimit: 25,
  handoffOnlyOnline: true,
  respectShiftSchedule: true,
};

export const DEFAULT_PERMISSIONS: Record<OrgRole, TeamPermissions> = {
  OWNER: {
    manageInbox: true,
    manageCalls: true,
    manageAiBots: true,
    manageAutomations: true,
    manageCampaigns: true,
    manageTemplates: true,
    manageContacts: true,
    manageTickets: true,
    manageTeam: true,
    manageBilling: true,
    manageSettings: true,
  },
  ADMIN: {
    manageInbox: true,
    manageCalls: true,
    manageAiBots: true,
    manageAutomations: true,
    manageCampaigns: true,
    manageTemplates: true,
    manageContacts: true,
    manageTickets: true,
    manageTeam: true,
    manageBilling: true,
    manageSettings: true,
  },
  SUPERVISOR: {
    manageInbox: true,
    manageCalls: true,
    manageAiBots: false,
    manageAutomations: false,
    manageCampaigns: false,
    manageTemplates: false,
    manageContacts: true,
    manageTickets: true,
    manageTeam: false,
    manageBilling: true,
    manageSettings: false,
  },
  AGENT: {
    manageInbox: true,
    manageCalls: true,
    manageAiBots: false,
    manageAutomations: false,
    manageCampaigns: false,
    manageTemplates: false,
    manageContacts: true,
    manageTickets: true,
    manageTeam: false,
    manageBilling: false,
    manageSettings: false,
  },
};

function mapLegacyOverrides(
  overrides?: LegacyPermissionOverrides | null
): Partial<TeamPermissions> | null | undefined {
  if (!overrides) return overrides;

  const { manageFlows, viewAnalytics, manageInbox, ...rest } = overrides;
  const mapped: Partial<TeamPermissions> = { ...rest };

  if (manageFlows !== undefined) {
    if (mapped.manageAiBots === undefined) mapped.manageAiBots = manageFlows;
    if (mapped.manageAutomations === undefined) mapped.manageAutomations = manageFlows;
  }
  if (viewAnalytics !== undefined && mapped.manageBilling === undefined) {
    mapped.manageBilling = viewAnalytics;
  }
  if (manageInbox !== undefined) {
    if (mapped.manageInbox === undefined) mapped.manageInbox = manageInbox;
    if (mapped.manageContacts === undefined) mapped.manageContacts = manageInbox;
    if (mapped.manageTickets === undefined) mapped.manageTickets = manageInbox;
    if (mapped.manageCalls === undefined) mapped.manageCalls = manageInbox;
  }

  return mapped;
}

export function resolvePermissions(
  role: OrgRole,
  memberOverrides?: LegacyPermissionOverrides | null,
  orgRolePermissions?: Partial<Record<OrgRole, LegacyPermissionOverrides>> | null
): TeamPermissions {
  if (role === 'OWNER') {
    return { ...DEFAULT_PERMISSIONS.OWNER };
  }

  const orgOverrides = mapLegacyOverrides(orgRolePermissions?.[role]);
  const base = { ...DEFAULT_PERMISSIONS[role], ...(orgOverrides || {}) };

  if (!memberOverrides) return base as TeamPermissions;

  const memberMapped = mapLegacyOverrides(memberOverrides);
  return { ...base, ...memberMapped } as TeamPermissions;
}

export type RolePermissionsMatrix = Record<OrgRole, TeamPermissions>;

export const CONFIGURABLE_ROLES: OrgRole[] = ['ADMIN', 'SUPERVISOR', 'AGENT'];

export function buildRolePermissionsMatrix(
  orgRolePermissions?: Partial<Record<OrgRole, LegacyPermissionOverrides>> | null
): RolePermissionsMatrix {
  return {
    OWNER: resolvePermissions('OWNER', null, orgRolePermissions),
    ADMIN: resolvePermissions('ADMIN', null, orgRolePermissions),
    SUPERVISOR: resolvePermissions('SUPERVISOR', null, orgRolePermissions),
    AGENT: resolvePermissions('AGENT', null, orgRolePermissions),
  };
}

export function getSeatLimit(plan: string, settings?: TeamSettings): number {
  const planLimits: Record<string, number> = {
    launch: 1,
    starter: 3,
    growth: 10,
    pro: 25,
    business: 25, // legacy mapped to Pro
    enterprise: 999,
  };
  const planMax = planLimits[plan] ?? 3;
  if (plan === 'enterprise') {
    return settings?.seatLimit && settings.seatLimit > 0 ? settings.seatLimit : 999;
  }
  // Clamp settings.seatLimit so it cannot exceed the plan maximum
  if (settings?.seatLimit && settings.seatLimit > 0) {
    return Math.min(settings.seatLimit, planMax);
  }
  return planMax;
}
