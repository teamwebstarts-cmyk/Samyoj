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
  overrides?: Record<string, boolean> | null
): TeamPermissions {
  const base = { ...DEFAULT_PERMISSIONS[role] };
  if (!overrides) return base;
  return { ...base, ...overrides } as TeamPermissions;
}

export function getSeatLimit(plan: string, settings?: TeamSettings): number {
  if (settings?.seatLimit) return settings.seatLimit;
  const planLimits: Record<string, number> = {
    starter: 5,
    growth: 15,
    business: 50,
    enterprise: 200,
  };
  return planLimits[plan] ?? 10;
}
