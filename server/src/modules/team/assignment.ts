import prisma from '../../config/database';
import type { AgentAvailability, OrgRole } from '@prisma/client';
import {
  DEFAULT_TEAM_SETTINGS,
  type ShiftSchedule,
  type TeamSettings,
} from './types';

function getTeamSettings(orgSettings: unknown): TeamSettings {
  const settings = (orgSettings as Record<string, unknown>) || {};
  const team = (settings.team as Partial<TeamSettings>) || {};
  return { ...DEFAULT_TEAM_SETTINGS, ...team };
}

function isWithinShift(schedule: ShiftSchedule | null | undefined, now = new Date()): boolean {
  if (!schedule?.enabled) return true;
  const tz = schedule.timezone || 'UTC';
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      weekday: 'short',
      hour: 'numeric',
      hour12: false,
    });
    const parts = formatter.formatToParts(now);
    const weekday = parts.find((p) => p.type === 'weekday')?.value ?? '';
    const hour = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10);
    const dayMap: Record<string, number> = {
      Sun: 0,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
    };
    const day = dayMap[weekday] ?? now.getDay();
    if (!schedule.days.includes(day)) return false;
    const start = schedule.startHour;
    const end = schedule.endHour;
    if (end > start) return hour >= start && hour < end;
    return hour >= start || hour < end;
  } catch {
    return true;
  }
}

export interface EligibleAgent {
  userId: string;
  name: string;
  pending: number;
  availability: AgentAvailability;
}

export async function getEligibleAgents(
  organizationId: string,
  options?: { departmentId?: string | null }
): Promise<EligibleAgent[]> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { settings: true },
  });
  const teamSettings = getTeamSettings(org?.settings);

  const members = await prisma.organizationUser.findMany({
    where: {
      organizationId,
      role: { in: ['OWNER', 'ADMIN', 'SUPERVISOR', 'AGENT'] as OrgRole[] },
      ...(options?.departmentId ? { departmentId: options.departmentId } : {}),
    },
    include: {
      user: { select: { id: true, name: true } },
    },
  });

  const eligible: EligibleAgent[] = [];

  for (const member of members) {
    if (teamSettings.handoffOnlyOnline && member.availability === 'OFFLINE') continue;
    if (teamSettings.handoffOnlyOnline && member.availability === 'AWAY') continue;

    const schedule = member.shiftSchedule as ShiftSchedule | null;
    if (teamSettings.respectShiftSchedule && !isWithinShift(schedule)) continue;

    const pending = await prisma.conversation.count({
      where: {
        organizationId,
        assignedAgentId: member.userId,
        status: { in: ['OPEN', 'PENDING'] },
      },
    });

    if (pending >= member.maxConcurrentChats) continue;

    eligible.push({
      userId: member.userId,
      name: member.user.name,
      pending,
      availability: member.availability,
    });
  }

  return eligible;
}

export async function pickAgentForHandoff(
  organizationId: string,
  departmentId?: string | null
): Promise<string | null> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { settings: true },
  });
  const teamSettings = getTeamSettings(org?.settings);
  const eligible = await getEligibleAgents(organizationId, { departmentId });

  if (eligible.length === 0) return null;

  if (teamSettings.assignmentStrategy === 'ROUND_ROBIN') {
    const index = teamSettings.roundRobinIndex % eligible.length;
    const picked = eligible[index];

    const current = (org?.settings as Record<string, unknown>) || {};
    await prisma.organization.update({
      where: { id: organizationId },
      data: {
        settings: {
          ...current,
          team: {
            ...teamSettings,
            roundRobinIndex: teamSettings.roundRobinIndex + 1,
          },
        },
      },
    });

    return picked.userId;
  }

  eligible.sort((a, b) => a.pending - b.pending);
  return eligible[0].userId;
}

export async function getTeamSettingsFromOrg(organizationId: string): Promise<TeamSettings> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { settings: true },
  });
  return getTeamSettings(org?.settings);
}

export async function saveTeamSettings(
  organizationId: string,
  updates: Partial<TeamSettings>
): Promise<TeamSettings> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { settings: true },
  });
  const current = (org?.settings as Record<string, unknown>) || {};
  const existing = getTeamSettings(org?.settings);
  const merged = { ...existing, ...updates };

  await prisma.organization.update({
    where: { id: organizationId },
    data: {
      settings: {
        ...current,
        team: merged,
      },
    },
  });

  return merged;
}

export { getTeamSettings, isWithinShift };
