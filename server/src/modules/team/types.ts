import type { OrgRole } from '@prisma/client';

export type AssignmentStrategy = 'LEAST_LOAD' | 'ROUND_ROBIN';

export interface TeamPermissions {
  manageTeam: boolean;
  manageSettings: boolean;
  manageCampaigns: boolean;
  manageTemplates: boolean;
  manageFlows: boolean;
  manageInbox: boolean;
  viewAnalytics: boolean;
}

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
  rolePermissions?: Partial<Record<OrgRole, Partial<TeamPermissions>>>;
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
    manageTeam: true,
    manageSettings: true,
    manageCampaigns: true,
    manageTemplates: true,
    manageFlows: true,
    manageInbox: true,
    viewAnalytics: true,
  },
  ADMIN: {
    manageTeam: true,
    manageSettings: true,
    manageCampaigns: true,
    manageTemplates: true,
    manageFlows: true,
    manageInbox: true,
    viewAnalytics: true,
  },
  SUPERVISOR: {
    manageTeam: false,
    manageSettings: false,
    manageCampaigns: false,
    manageTemplates: false,
    manageFlows: false,
    manageInbox: true,
    viewAnalytics: true,
  },
  AGENT: {
    manageTeam: false,
    manageSettings: false,
    manageCampaigns: false,
    manageTemplates: false,
    manageFlows: false,
    manageInbox: true,
    viewAnalytics: false,
  },
};

export function resolvePermissions(
  role: OrgRole,
  memberOverrides?: Record<string, boolean> | null,
  orgRolePermissions?: Partial<Record<OrgRole, Partial<TeamPermissions>>> | null
): TeamPermissions {
  if (role === 'OWNER') {
    return { ...DEFAULT_PERMISSIONS.OWNER };
  }

  const orgOverrides = orgRolePermissions?.[role];
  const base = { ...DEFAULT_PERMISSIONS[role], ...(orgOverrides || {}) };

  if (!memberOverrides) return base as TeamPermissions;
  return { ...base, ...memberOverrides } as TeamPermissions;
}

export type RolePermissionsMatrix = Record<OrgRole, TeamPermissions>;

export const CONFIGURABLE_ROLES: OrgRole[] = ['ADMIN', 'SUPERVISOR', 'AGENT'];

export function buildRolePermissionsMatrix(
  orgRolePermissions?: Partial<Record<OrgRole, Partial<TeamPermissions>>> | null
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

