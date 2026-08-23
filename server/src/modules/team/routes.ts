import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../../config/database';
import { authenticate, requireOrg, loadOrgRole, requireOrgRole } from '../../middleware/auth';
import { withPermission } from '../../middleware/permissions';
import { passwordSchema } from '../auth/password-policy';
import { AppError, sendSuccess, asyncHandler, paramId } from '../../utils/response';
import { config } from '../../config';
import { z } from 'zod';
import { logTeamAudit } from './audit';
import { getAgentMetrics, getMemberAssignedConversations } from './metrics';
import { getTeamSettingsFromOrg, saveTeamSettings, pickAgentForHandoff, getOrgRolePermissions, saveOrgRolePermissions } from './assignment';
import { generateTwoFactorSecret, verifyTotp } from './totp';
import {
  DEFAULT_TEAM_SETTINGS,
  getSeatLimit,
  resolvePermissions,
  buildRolePermissionsMatrix,
  CONFIGURABLE_ROLES,
  type ShiftSchedule,
  type TeamPermissions,
  type TeamSettings,
} from './types';
import type { OrgRole } from '@prisma/client';
import { revokeRefreshSessionsForUser } from '../auth/session';

const router = Router();

const adminGuard = [authenticate, requireOrg, ...withPermission('manageTeam')];

const memberSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  createdAt: true,
} as const;

const shiftScheduleSchema = z.object({
  enabled: z.boolean(),
  timezone: z.string(),
  days: z.array(z.number().min(0).max(6)),
  startHour: z.number().min(0).max(23),
  endHour: z.number().min(1).max(24),
});

const permissionsSchema = z.object({
  manageTeam: z.boolean().optional(),
  manageSettings: z.boolean().optional(),
  manageCampaigns: z.boolean().optional(),
  manageTemplates: z.boolean().optional(),
  manageFlows: z.boolean().optional(),
  manageInbox: z.boolean().optional(),
  viewAnalytics: z.boolean().optional(),
});

async function getMembership(orgId: string, userId: string) {
  return prisma.organizationUser.findUnique({
    where: { organizationId_userId: { organizationId: orgId, userId } },
    include: {
      user: { select: memberSelect },
      department: { select: { id: true, name: true, color: true } },
    },
  });
}

function formatMember(
  m: Awaited<ReturnType<typeof getMembership>> & object,
  extras: {
    assignedCount: number;
    isCurrentUser: boolean;
    openCount?: number;
    orgRolePermissions?: Partial<Record<OrgRole, Partial<TeamPermissions>>> | null;
  }
) {
  if (!m) return null;
  const perms = resolvePermissions(
    m.role,
    m.permissions as Record<string, boolean> | null,
    extras.orgRolePermissions ?? null
  );
  return {
    id: m.user.id,
    membershipId: m.id,
    name: m.user.name,
    email: m.user.email,
    orgRole: m.role,
    userRole: m.user.role,
    assignedCount: extras.assignedCount,
    joinedAt: m.user.createdAt,
    isCurrentUser: extras.isCurrentUser,
    availability: m.availability,
    department: m.department,
    permissions: perms,
    shiftSchedule: m.shiftSchedule as ShiftSchedule | null,
    lastActiveAt: m.lastActiveAt,
    avatarUrl: m.avatarUrl,
    preferredLanguage: m.preferredLanguage,
    twoFactorEnabled: m.twoFactorEnabled,
    mustResetPassword: m.mustResetPassword,
  };
}

// ─── Agents list (for dropdowns) ───────────────────────────────────────────

router.get(
  '/agents',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const members = await prisma.organizationUser.findMany({
      where: { organizationId: orgId },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { user: { name: 'asc' } },
    });

    sendSuccess(res, {
      agents: members.map((m) => ({
        id: m.user.id,
        name: m.user.name,
        email: m.user.email,
        availability: m.availability,
        departmentId: m.departmentId,
      })),
    });
  })
);

// ─── Team settings ─────────────────────────────────────────────────────────

router.get(
  '/settings',
  authenticate,
  requireOrg,
  loadOrgRole,
  requireOrgRole('OWNER', 'ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { plan: true, settings: true },
    });
    const teamSettings = await getTeamSettingsFromOrg(orgId);
    const memberCount = await prisma.organizationUser.count({ where: { organizationId: orgId } });

    sendSuccess(res, {
      ...teamSettings,
      seatLimit: getSeatLimit(org?.plan ?? 'starter', teamSettings),
      seatsUsed: memberCount,
      plan: org?.plan ?? 'starter',
    });
  })
);

router.patch(
  '/settings',
  ...adminGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const schema = z.object({
      assignmentStrategy: z.enum(['LEAST_LOAD', 'ROUND_ROBIN']).optional(),
      seatLimit: z.number().int().min(1).max(500).optional(),
      handoffOnlyOnline: z.boolean().optional(),
      respectShiftSchedule: z.boolean().optional(),
    });
    const data = schema.parse(req.body);

    if (data.seatLimit !== undefined) {
      const org = await prisma.organization.findUnique({
        where: { id: orgId },
        select: { plan: true },
      });
      const maxAllowed = getSeatLimit(org?.plan ?? 'starter');
      if (org?.plan !== 'enterprise' && data.seatLimit > maxAllowed) {
        throw new AppError(
          400,
          `Cannot increase seat limit beyond plan maximum (${maxAllowed} seats). Upgrade plan to add more seats.`
        );
      }
    }

    const updated = await saveTeamSettings(orgId, data);

    await logTeamAudit({
      organizationId: orgId,
      actorId: req.user!.userId,
      action: 'SETTINGS_CHANGED',
      metadata: data,
    });

    sendSuccess(res, updated);
  })
);

router.get(
  '/role-permissions',
  authenticate,
  requireOrg,
  loadOrgRole,
  requireOrgRole('OWNER', 'ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const orgRolePermissions = await getOrgRolePermissions(orgId);

    sendSuccess(res, {
      roles: buildRolePermissionsMatrix(orgRolePermissions),
      overrides: orgRolePermissions ?? {},
    });
  })
);

router.patch(
  '/role-permissions',
  ...adminGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const schema = z.object({
      rolePermissions: z.record(
        z.enum(['ADMIN', 'SUPERVISOR', 'AGENT']),
        permissionsSchema
      ),
    });
    const data = schema.parse(req.body);

    for (const role of Object.keys(data.rolePermissions) as OrgRole[]) {
      if (!CONFIGURABLE_ROLES.includes(role)) {
        throw new AppError(400, `Role ${role} cannot be customized`);
      }
    }

    const overrides = await saveOrgRolePermissions(orgId, data.rolePermissions);

    await logTeamAudit({
      organizationId: orgId,
      actorId: req.user!.userId,
      action: 'SETTINGS_CHANGED',
      metadata: { rolePermissions: data.rolePermissions },
    });

    sendSuccess(res, {
      roles: buildRolePermissionsMatrix(overrides),
      overrides,
    });
  })
);

// ─── Heartbeat & availability ──────────────────────────────────────────────

router.post(
  '/heartbeat',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const userId = req.user!.userId;
    const { availability } = z
      .object({ availability: z.enum(['ONLINE', 'AWAY', 'OFFLINE']).optional() })
      .parse(req.body);

    const membership = await prisma.organizationUser.update({
      where: { organizationId_userId: { organizationId: orgId, userId } },
      data: {
        lastActiveAt: new Date(),
        ...(availability ? { availability } : { availability: 'ONLINE' }),
      },
    });

    sendSuccess(res, { availability: membership.availability, lastActiveAt: membership.lastActiveAt });
  })
);

router.patch(
  '/me/availability',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const userId = req.user!.userId;
    const { availability } = z
      .object({ availability: z.enum(['ONLINE', 'AWAY', 'OFFLINE']) })
      .parse(req.body);

    const membership = await prisma.organizationUser.update({
      where: { organizationId_userId: { organizationId: orgId, userId } },
      data: { availability, lastActiveAt: new Date() },
    });

    await logTeamAudit({
      organizationId: orgId,
      actorId: userId,
      action: 'AVAILABILITY_CHANGED',
      targetUserId: userId,
      metadata: { availability },
    });

    sendSuccess(res, { availability: membership.availability });
  })
);

// ─── Departments ───────────────────────────────────────────────────────────

router.get(
  '/departments',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const departments = await prisma.teamDepartment.findMany({
      where: { organizationId: orgId },
      include: { _count: { select: { members: true } } },
      orderBy: { name: 'asc' },
    });

    sendSuccess(res, {
      departments: departments.map((d) => ({
        id: d.id,
        name: d.name,
        color: d.color,
        memberCount: d._count.members,
        createdAt: d.createdAt,
      })),
    });
  })
);

router.post(
  '/departments',
  ...adminGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const data = z
      .object({ name: z.string().min(2).max(50), color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional() })
      .parse(req.body);

    const dept = await prisma.teamDepartment.create({
      data: { organizationId: orgId, name: data.name, color: data.color ?? '#10b981' },
    });

    await logTeamAudit({
      organizationId: orgId,
      actorId: req.user!.userId,
      action: 'DEPARTMENT_CREATED',
      metadata: { departmentId: dept.id, name: dept.name },
    });

    sendSuccess(res, dept, 201);
  })
);

router.patch(
  '/departments/:id',
  ...adminGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const id = paramId(req);
    const data = z
      .object({
        name: z.string().min(2).max(50).optional(),
        color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      })
      .parse(req.body);

    const existing = await prisma.teamDepartment.findFirst({ where: { id, organizationId: orgId } });
    if (!existing) throw new AppError(404, 'Department not found');

    const dept = await prisma.teamDepartment.update({ where: { id }, data });

    await logTeamAudit({
      organizationId: orgId,
      actorId: req.user!.userId,
      action: 'DEPARTMENT_UPDATED',
      metadata: { departmentId: id, ...data },
    });

    sendSuccess(res, dept);
  })
);

router.delete(
  '/departments/:id',
  ...adminGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const id = paramId(req);

    const existing = await prisma.teamDepartment.findFirst({ where: { id, organizationId: orgId } });
    if (!existing) throw new AppError(404, 'Department not found');

    await prisma.$transaction([
      prisma.organizationUser.updateMany({
        where: { departmentId: id },
        data: { departmentId: null },
      }),
      prisma.teamDepartment.delete({ where: { id } }),
    ]);

    await logTeamAudit({
      organizationId: orgId,
      actorId: req.user!.userId,
      action: 'DEPARTMENT_DELETED',
      metadata: { departmentId: id, name: existing.name },
    });

    sendSuccess(res, { message: 'Department deleted' });
  })
);

// ─── Invites ───────────────────────────────────────────────────────────────

router.get(
  '/invites',
  ...adminGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const invites = await prisma.teamInvite.findMany({
      where: { organizationId: orgId, status: { in: ['PENDING', 'EXPIRED'] } },
      include: {
        department: { select: { id: true, name: true, color: true } },
        invitedBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    sendSuccess(res, {
      invites: invites.map((inv) => ({
        id: inv.id,
        email: inv.email,
        name: inv.name,
        orgRole: inv.orgRole,
        department: inv.department,
        status: inv.status === 'PENDING' && inv.expiresAt < new Date() ? 'EXPIRED' : inv.status,
        invitedBy: inv.invitedBy,
        expiresAt: inv.expiresAt,
        createdAt: inv.createdAt,
        inviteUrl: `${config.clientUrl}/invite/${inv.token}`,
      })),
    });
  })
);

router.post(
  '/invites',
  ...adminGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const data = z
      .object({
        email: z.string().email(),
        name: z.string().min(2).optional(),
        orgRole: z.enum(['ADMIN', 'SUPERVISOR', 'AGENT']).default('AGENT'),
        departmentId: z.string().uuid().optional().nullable(),
        permissions: permissionsSchema.optional(),
      })
      .parse(req.body);

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { plan: true, settings: true, companyName: true },
    });
    const teamSettings = await getTeamSettingsFromOrg(orgId);
    const seatLimit = getSeatLimit(org?.plan ?? 'starter', teamSettings);
    const [memberCount, pendingInvites] = await Promise.all([
      prisma.organizationUser.count({ where: { organizationId: orgId } }),
      prisma.teamInvite.count({ where: { organizationId: orgId, status: 'PENDING' } }),
    ]);

    if (memberCount + pendingInvites >= seatLimit) {
      throw new AppError(403, `Seat limit reached (${seatLimit}). Upgrade your plan or remove members.`);
    }

    const existingUser = await prisma.user.findUnique({ where: { email: data.email } });
    if (existingUser) {
      const existingMembership = await prisma.organizationUser.findUnique({
        where: { organizationId_userId: { organizationId: orgId, userId: existingUser.id } },
      });
      if (existingMembership) throw new AppError(409, 'User is already a team member');
    }

    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const invite = await prisma.teamInvite.create({
      data: {
        organizationId: orgId,
        email: data.email,
        name: data.name,
        orgRole: data.orgRole as OrgRole,
        departmentId: data.departmentId ?? null,
        permissions: data.permissions ?? undefined,
        token,
        invitedById: req.user!.userId,
        expiresAt,
      },
      include: {
        department: { select: { id: true, name: true, color: true } },
        invitedBy: { select: { id: true, name: true } },
      },
    });

    await logTeamAudit({
      organizationId: orgId,
      actorId: req.user!.userId,
      action: 'INVITE_SENT',
      metadata: { email: data.email, orgRole: data.orgRole },
    });

    const inviteUrl = `${config.clientUrl}/invite/${token}`;
    const inviter = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { name: true },
    });

    const { sendTeamInviteEmail } = await import('../../services/email.service');
    await sendTeamInviteEmail(
      data.email,
      inviteUrl,
      org?.companyName || 'your workspace',
      inviter?.name || 'A team admin'
    );

    sendSuccess(
      res,
      {
        id: invite.id,
        email: invite.email,
        name: invite.name,
        orgRole: invite.orgRole,
        department: invite.department,
        status: invite.status,
        expiresAt: invite.expiresAt,
        inviteUrl,
        emailSent: true,
      },
      201
    );
  })
);

router.delete(
  '/invites/:id',
  ...adminGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const id = paramId(req);

    const invite = await prisma.teamInvite.findFirst({
      where: { id, organizationId: orgId, status: 'PENDING' },
    });
    if (!invite) throw new AppError(404, 'Invite not found');

    await prisma.teamInvite.update({ where: { id }, data: { status: 'REVOKED' } });

    await logTeamAudit({
      organizationId: orgId,
      actorId: req.user!.userId,
      action: 'INVITE_REVOKED',
      metadata: { email: invite.email },
    });

    sendSuccess(res, { message: 'Invite revoked' });
  })
);

router.get(
  '/invites/token/:token',
  asyncHandler(async (req: Request, res: Response) => {
    const token = String(req.params.token);
    const invite = await prisma.teamInvite.findUnique({
      where: { token },
      include: {
        organization: { select: { companyName: true } },
        department: { select: { id: true, name: true } },
      },
    });

    if (!invite || invite.status !== 'PENDING') {
      throw new AppError(404, 'Invite not found or already used');
    }
    if (invite.expiresAt < new Date()) {
      await prisma.teamInvite.update({ where: { id: invite.id }, data: { status: 'EXPIRED' } });
      throw new AppError(410, 'Invite has expired');
    }

    sendSuccess(res, {
      email: invite.email,
      name: invite.name,
      orgRole: invite.orgRole,
      companyName: invite.organization.companyName,
      department: invite.department,
      expiresAt: invite.expiresAt,
    });
  })
);

router.post(
  '/invites/accept',
  asyncHandler(async (req: Request, res: Response) => {
    const data = z
      .object({
        token: z.string().uuid(),
        name: z.string().min(2).optional(),
        password: z.string().min(8),
      })
      .parse(req.body);

    const invite = await prisma.teamInvite.findUnique({
      where: { token: data.token },
      include: { organization: true },
    });

    if (!invite || invite.status !== 'PENDING') {
      throw new AppError(404, 'Invite not found or already used');
    }
    if (invite.expiresAt < new Date()) {
      await prisma.teamInvite.update({ where: { id: invite.id }, data: { status: 'EXPIRED' } });
      throw new AppError(410, 'Invite has expired');
    }

    const passwordHash = await bcrypt.hash(data.password, 12);
    const displayName = data.name || invite.name || invite.email.split('@')[0];

    // If an account already exists for this email, the invite must be accepted
    // by signing in — never overwrite an existing password from a public link.
    const existingUser = await prisma.user.findUnique({ where: { email: invite.email } });
    if (existingUser) {
      const alreadyMember = await prisma.organizationUser.findUnique({
        where: {
          organizationId_userId: {
            organizationId: invite.organizationId,
            userId: existingUser.id,
          },
        },
      });
      if (alreadyMember) {
        throw new AppError(409, 'This user is already a member of the workspace');
      }
      throw new AppError(
        409,
        'An account with this email already exists. Sign in first, then open the invite link to join this workspace.'
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: displayName,
          email: invite.email,
          passwordHash,
          role: invite.orgRole === 'ADMIN' ? 'ADMIN' : 'AGENT',
        },
      });

      const membership = await tx.organizationUser.create({
        data: {
          organizationId: invite.organizationId,
          userId: user.id,
          role: invite.orgRole,
          departmentId: invite.departmentId,
          permissions: invite.permissions ?? undefined,
          availability: 'ONLINE',
          lastActiveAt: new Date(),
        },
      });

      await tx.teamInvite.update({
        where: { id: invite.id },
        data: { status: 'ACCEPTED', acceptedAt: new Date() },
      });

      return { user, membership };
    });

    await logTeamAudit({
      organizationId: invite.organizationId,
      actorId: result.user.id,
      action: 'INVITE_ACCEPTED',
      targetUserId: result.user.id,
      metadata: { email: invite.email },
    });

    const { emitProductEvent } = await import('../platform/events');
    emitProductEvent({
      organizationId: invite.organizationId,
      name: 'INVITE_ACCEPT',
    });

    const payload = {
      userId: result.user.id,
      email: result.user.email,
      organizationId: invite.organizationId,
    };

    const { signAccessToken, signRefreshToken } = await import('../../utils/jwt');
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: result.user.id,
        expiresAt: (await import('../../utils/jwt')).parseExpiry(config.jwt.refreshExpiresIn),
      },
    });

    sendSuccess(res, {
      user: { id: result.user.id, name: result.user.name, email: result.user.email },
      organization: {
        id: invite.organizationId,
        companyName: invite.organization.companyName,
        role: invite.orgRole,
      },
      accessToken,
      refreshToken,
    });
  })
);

// ─── Audit log ─────────────────────────────────────────────────────────────

router.get(
  '/audit',
  ...adminGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const limit = Math.min(parseInt(String(req.query.limit || '50'), 10), 100);

    const logs = await prisma.teamAuditLog.findMany({
      where: { organizationId: orgId },
      include: {
        actor: { select: { id: true, name: true, email: true } },
        targetUser: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    sendSuccess(res, { logs });
  })
);

// ─── Sessions ──────────────────────────────────────────────────────────────

router.get(
  '/sessions',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const sessions = await prisma.refreshToken.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        createdAt: true,
        expiresAt: true,
        userAgent: true,
        ipAddress: true,
      },
    });

    sendSuccess(res, { sessions });
  })
);

router.delete(
  '/sessions/:id',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const id = paramId(req);

    const session = await prisma.refreshToken.findFirst({
      where: { id, userId, revokedAt: null },
    });
    if (!session) throw new AppError(404, 'Session not found');

    await prisma.refreshToken.update({ where: { id }, data: { revokedAt: new Date() } });

    const orgId = req.user!.organizationId!;
    await logTeamAudit({
      organizationId: orgId,
      actorId: userId,
      action: 'SESSION_REVOKED',
      metadata: { sessionId: id },
    });

    sendSuccess(res, { message: 'Session revoked' });
  })
);

router.delete(
  '/sessions',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const { exceptCurrent } = z.object({ exceptCurrent: z.string().optional() }).parse(req.body);

    await prisma.refreshToken.updateMany({
      where: {
        userId,
        revokedAt: null,
        ...(exceptCurrent ? { token: { not: exceptCurrent } } : {}),
      },
      data: { revokedAt: new Date() },
    });

    sendSuccess(res, { message: 'All other sessions revoked' });
  })
);

// ─── 2FA ───────────────────────────────────────────────────────────────────

router.post(
  '/me/2fa/setup',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const userId = req.user!.userId;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError(404, 'User not found');

    const { secret, otpauthUrl } = generateTwoFactorSecret(user.email);

    await prisma.organizationUser.update({
      where: { organizationId_userId: { organizationId: orgId, userId } },
      data: { twoFactorSecret: secret },
    });

    sendSuccess(res, { secret, otpauthUrl });
  })
);

router.post(
  '/me/2fa/enable',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const userId = req.user!.userId;
    const { code } = z.object({ code: z.string().length(6) }).parse(req.body);

    const membership = await prisma.organizationUser.findUnique({
      where: { organizationId_userId: { organizationId: orgId, userId } },
    });
    if (!membership?.twoFactorSecret) throw new AppError(400, 'Run 2FA setup first');
    if (!verifyTotp(membership.twoFactorSecret, code)) {
      throw new AppError(400, 'Invalid verification code');
    }

    await prisma.organizationUser.update({
      where: { organizationId_userId: { organizationId: orgId, userId } },
      data: { twoFactorEnabled: true },
    });

    await logTeamAudit({
      organizationId: orgId,
      actorId: userId,
      action: 'TWO_FACTOR_ENABLED',
    });

    sendSuccess(res, { enabled: true });
  })
);

router.post(
  '/me/2fa/disable',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const userId = req.user!.userId;
    const { code, password } = z
      .object({ code: z.string().length(6), password: z.string() })
      .parse(req.body);

    const user = await prisma.user.findUnique({ where: { id: userId } });
    const membership = await prisma.organizationUser.findUnique({
      where: { organizationId_userId: { organizationId: orgId, userId } },
    });
    if (!user || !membership?.twoFactorSecret) throw new AppError(400, '2FA not enabled');

    if (!(await bcrypt.compare(password, user.passwordHash))) {
      throw new AppError(401, 'Invalid password');
    }
    if (!verifyTotp(membership.twoFactorSecret, code)) {
      throw new AppError(400, 'Invalid verification code');
    }

    await prisma.organizationUser.update({
      where: { organizationId_userId: { organizationId: orgId, userId } },
      data: { twoFactorEnabled: false, twoFactorSecret: null },
    });

    await logTeamAudit({
      organizationId: orgId,
      actorId: userId,
      action: 'TWO_FACTOR_DISABLED',
    });

    sendSuccess(res, { enabled: false });
  })
);

// ─── Change own password ───────────────────────────────────────────────────

router.post(
  '/me/password',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const { currentPassword, newPassword } = z
      .object({ currentPassword: z.string().min(1), newPassword: passwordSchema })
      .parse(req.body);

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError(404, 'User not found');

    if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
      throw new AppError(401, 'Current password is incorrect');
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await prisma.$transaction([
      prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
      prisma.organizationUser.updateMany({
        where: { userId },
        data: { mustResetPassword: false },
      }),
      // Keep other devices out; the current session's token stays valid.
      prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null, token: { not: req.body?.keepToken ?? undefined } },
        data: { revokedAt: new Date() },
      }),
    ]);

    await logTeamAudit({
      organizationId: req.user!.organizationId!,
      actorId: userId,
      action: 'PASSWORD_RESET',
      targetUserId: userId,
    });

    sendSuccess(res, { message: 'Password updated' });
  })
);

// ─── Member list & CRUD ────────────────────────────────────────────────────

router.get(
  '/',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const { search, departmentId } = req.query;

    const memberships = await prisma.organizationUser.findMany({
      where: {
        organizationId: orgId,
        ...(departmentId ? { departmentId: departmentId as string } : {}),
        ...(search
          ? {
              user: {
                OR: [
                  { name: { contains: search as string, mode: 'insensitive' } },
                  { email: { contains: search as string, mode: 'insensitive' } },
                ],
              },
            }
          : {}),
      },
      include: {
        user: { select: memberSelect },
        department: { select: { id: true, name: true, color: true } },
      },
      orderBy: [{ role: 'asc' }, { user: { name: 'asc' } }],
    });

    const userIds = memberships.map((m) => m.userId);

    const assignmentCounts = await prisma.conversation.groupBy({
      by: ['assignedAgentId'],
      where: { organizationId: orgId, assignedAgentId: { in: userIds } },
      _count: { id: true },
    });

    const countMap = new Map(assignmentCounts.map((r) => [r.assignedAgentId!, r._count.id]));
    const orgRolePermissions = await getOrgRolePermissions(orgId);

    const members = memberships.map((m) =>
      formatMember(m, {
        assignedCount: countMap.get(m.userId) ?? 0,
        isCurrentUser: m.userId === req.user!.userId,
        orgRolePermissions,
      })
    );

    const summary = {
      total: members.length,
      owners: members.filter((m) => m!.orgRole === 'OWNER').length,
      admins: members.filter((m) => m!.orgRole === 'ADMIN').length,
      supervisors: members.filter((m) => m!.orgRole === 'SUPERVISOR').length,
      agents: members.filter((m) => m!.orgRole === 'AGENT').length,
      online: members.filter((m) => m!.availability === 'ONLINE').length,
    };

    sendSuccess(res, { members, summary });
  })
);

router.get(
  '/:id',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const userId = paramId(req);

    const membership = await getMembership(orgId, userId);
    if (!membership) throw new AppError(404, 'Team member not found');

    const [metrics, conversations] = await Promise.all([
      getAgentMetrics(orgId, userId),
      getMemberAssignedConversations(orgId, userId),
    ]);

    const assignedCount = metrics.assignedCount;
    const orgRolePermissions = await getOrgRolePermissions(orgId);
    const member = formatMember(membership, {
      assignedCount,
      isCurrentUser: userId === req.user!.userId,
      orgRolePermissions,
    });

    sendSuccess(res, { member, metrics, conversations });
  })
);

const createMemberSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  orgRole: z.enum(['ADMIN', 'SUPERVISOR', 'AGENT']).default('AGENT'),
  departmentId: z.string().uuid().optional().nullable(),
  permissions: permissionsSchema.optional(),
  shiftSchedule: shiftScheduleSchema.optional(),
});

router.post(
  '/',
  ...adminGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const data = createMemberSchema.parse(req.body);
    const orgId = req.user!.organizationId!;

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { plan: true },
    });
    const teamSettings = await getTeamSettingsFromOrg(orgId);
    const seatLimit = getSeatLimit(org?.plan ?? 'starter', teamSettings);
    const memberCount = await prisma.organizationUser.count({ where: { organizationId: orgId } });
    if (memberCount >= seatLimit) {
      throw new AppError(403, `Seat limit reached (${seatLimit})`);
    }

    const existingUser = await prisma.user.findUnique({ where: { email: data.email } });
    if (existingUser) {
      const existingMembership = await prisma.organizationUser.findUnique({
        where: { organizationId_userId: { organizationId: orgId, userId: existingUser.id } },
      });
      if (existingMembership) throw new AppError(409, 'User is already a team member');
    }

    const passwordHash = await bcrypt.hash(data.password, 12);

    const member = await prisma.$transaction(async (tx) => {
      const user =
        existingUser ??
        (await tx.user.create({
          data: {
            name: data.name,
            email: data.email,
            passwordHash,
            role: data.orgRole === 'ADMIN' ? 'ADMIN' : 'AGENT',
          },
        }));

      if (existingUser && existingUser.name !== data.name) {
        await tx.user.update({ where: { id: user.id }, data: { name: data.name } });
      }

      return tx.organizationUser.create({
        data: {
          organizationId: orgId,
          userId: user.id,
          role: data.orgRole as OrgRole,
          departmentId: data.departmentId ?? null,
          permissions: data.permissions ?? undefined,
          shiftSchedule: data.shiftSchedule ?? undefined,
          mustResetPassword: true,
          availability: 'OFFLINE',
        },
        include: {
          user: { select: memberSelect },
          department: { select: { id: true, name: true, color: true } },
        },
      });
    });

    await logTeamAudit({
      organizationId: orgId,
      actorId: req.user!.userId,
      action: 'MEMBER_ADDED',
      targetUserId: member.userId,
      metadata: { email: data.email, orgRole: data.orgRole },
    });

    const orgRolePermissions = await getOrgRolePermissions(orgId);

    sendSuccess(
      res,
      formatMember(member, {
        assignedCount: 0,
        isCurrentUser: false,
        orgRolePermissions,
      }),
      201
    );
  })
);

const updateMemberSchema = z.object({
  name: z.string().min(2).optional(),
  orgRole: z.enum(['ADMIN', 'SUPERVISOR', 'AGENT']).optional(),
  password: z.string().min(8).optional(),
  departmentId: z.string().uuid().nullable().optional(),
  availability: z.enum(['ONLINE', 'AWAY', 'OFFLINE']).optional(),
  permissions: permissionsSchema.optional(),
  shiftSchedule: shiftScheduleSchema.nullable().optional(),
  preferredLanguage: z.string().min(2).max(10).optional(),
  mustResetPassword: z.boolean().optional(),
});

router.patch(
  '/:id',
  ...adminGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = paramId(req);
    const data = updateMemberSchema.parse(req.body);
    const orgId = req.user!.organizationId!;

    const membership = await getMembership(orgId, userId);
    if (!membership) throw new AppError(404, 'Team member not found');

    if (membership.role === 'OWNER') {
      throw new AppError(403, 'Cannot modify the organization owner');
    }

    if (data.orgRole && req.orgRole !== 'OWNER') {
      throw new AppError(403, 'Only the owner can change roles');
    }

    if (membership.userId === req.user!.userId && data.orgRole && data.orgRole !== membership.role) {
      throw new AppError(403, 'Cannot change your own role');
    }

    const userUpdate: { name?: string; passwordHash?: string; role?: 'ADMIN' | 'AGENT' } = {};
    if (data.name) userUpdate.name = data.name;
    if (data.password) userUpdate.passwordHash = await bcrypt.hash(data.password, 12);
    if (data.orgRole) userUpdate.role = data.orgRole === 'ADMIN' ? 'ADMIN' : 'AGENT';

    const memberUpdate: Record<string, unknown> = {};
    if (data.orgRole) memberUpdate.role = data.orgRole;
    if (data.departmentId !== undefined) memberUpdate.departmentId = data.departmentId;
    if (data.availability) memberUpdate.availability = data.availability;
    if (data.permissions !== undefined) memberUpdate.permissions = data.permissions;
    if (data.shiftSchedule !== undefined) memberUpdate.shiftSchedule = data.shiftSchedule;
    if (data.preferredLanguage) memberUpdate.preferredLanguage = data.preferredLanguage;
    if (data.mustResetPassword !== undefined) memberUpdate.mustResetPassword = data.mustResetPassword;

    const updated = await prisma.$transaction(async (tx) => {
      if (Object.keys(userUpdate).length > 0) {
        await tx.user.update({ where: { id: userId }, data: userUpdate });
      }
      if (Object.keys(memberUpdate).length > 0) {
        await tx.organizationUser.update({ where: { id: membership.id }, data: memberUpdate });
      }
      return getMembership(orgId, userId);
    });

    if (data.orgRole) {
      await logTeamAudit({
        organizationId: orgId,
        actorId: req.user!.userId,
        action: 'ROLE_CHANGED',
        targetUserId: userId,
        metadata: { from: membership.role, to: data.orgRole },
      });
    } else {
      await logTeamAudit({
        organizationId: orgId,
        actorId: req.user!.userId,
        action: 'MEMBER_UPDATED',
        targetUserId: userId,
        metadata: data,
      });
    }

    const metrics = await getAgentMetrics(orgId, userId);
    const orgRolePermissions = await getOrgRolePermissions(orgId);

    sendSuccess(
      res,
      formatMember(updated!, {
        assignedCount: metrics.assignedCount,
        openCount: metrics.openCount,
        isCurrentUser: userId === req.user!.userId,
        orgRolePermissions,
      })
    );
  })
);

router.post(
  '/:id/reassign',
  ...adminGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const fromUserId = paramId(req);
    const orgId = req.user!.organizationId!;
    const { toAgentId } = z
      .object({ toAgentId: z.string().uuid().nullable() })
      .parse(req.body);

    const membership = await getMembership(orgId, fromUserId);
    if (!membership) throw new AppError(404, 'Team member not found');

    if (toAgentId) {
      const target = await getMembership(orgId, toAgentId);
      if (!target) throw new AppError(404, 'Reassign target is not a team member');
      if (target.userId === fromUserId) throw new AppError(400, 'Pick a different agent');
    }

    const count = await prisma.conversation.updateMany({
      where: { organizationId: orgId, assignedAgentId: fromUserId },
      data: { assignedAgentId: toAgentId },
    });

    sendSuccess(res, { reassigned: count.count });
  })
);

router.delete(
  '/:id',
  ...adminGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = paramId(req);
    const orgId = req.user!.organizationId!;
    const { reassignToId } = z
      .object({ reassignToId: z.string().uuid().optional() })
      .parse(req.body ?? {});

    const membership = await getMembership(orgId, userId);
    if (!membership) throw new AppError(404, 'Team member not found');

    if (membership.role === 'OWNER') {
      throw new AppError(403, 'Cannot remove the organization owner');
    }

    if (membership.userId === req.user!.userId) {
      throw new AppError(403, 'Cannot remove yourself from the team');
    }

    if (reassignToId) {
      const target = await getMembership(orgId, reassignToId);
      if (!target) throw new AppError(404, 'Reassign target is not a team member');
      if (target.userId === userId) throw new AppError(400, 'Pick a different agent');
    }

    await prisma.$transaction(async (tx) => {
      await tx.conversation.updateMany({
        where: { organizationId: orgId, assignedAgentId: userId },
        data: { assignedAgentId: reassignToId ?? null },
      });
      await tx.call.updateMany({
        where: { organizationId: orgId, assignedAgentId: userId },
        data: { assignedAgentId: null },
      });
      await tx.ticket.updateMany({
        where: { organizationId: orgId, assignedAgentId: userId },
        data: { assignedAgentId: reassignToId ?? null },
      });
      await tx.lead.updateMany({
        where: { organizationId: orgId, assignedAgentId: userId },
        data: { assignedAgentId: reassignToId ?? null },
      });
      await tx.organizationUser.delete({ where: { id: membership.id } });
      await revokeRefreshSessionsForUser(userId, tx);
    });

    await logTeamAudit({
      organizationId: orgId,
      actorId: req.user!.userId,
      action: 'MEMBER_REMOVED',
      targetUserId: userId,
      metadata: { reassignToId: reassignToId ?? null },
    });

    sendSuccess(res, { message: 'Team member removed' });
  })
);

export default router;
