import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../../config/database';
import { authenticate, requireOrg, loadOrgRole, requireOrgRole } from '../../middleware/auth';
import { AppError, sendSuccess, asyncHandler, paramId } from '../../utils/response';
import { z } from 'zod';

const router = Router();

const memberSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  createdAt: true,
} as const;

async function getMembership(orgId: string, userId: string) {
  return prisma.organizationUser.findUnique({
    where: { organizationId_userId: { organizationId: orgId, userId } },
    include: { user: { select: memberSelect } },
  });
}

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
      })),
    });
  })
);

router.get(
  '/',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const { search } = req.query;

    const memberships = await prisma.organizationUser.findMany({
      where: {
        organizationId: orgId,
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
      },
      orderBy: [{ role: 'asc' }, { user: { name: 'asc' } }],
    });

    const userIds = memberships.map((m) => m.userId);
    const assignmentCounts = await prisma.conversation.groupBy({
      by: ['assignedAgentId'],
      where: {
        organizationId: orgId,
        assignedAgentId: { in: userIds },
      },
      _count: { id: true },
    });

    const countMap = new Map(
      assignmentCounts.map((row) => [row.assignedAgentId!, row._count.id])
    );

    const members = memberships.map((m) => ({
      id: m.user.id,
      membershipId: m.id,
      name: m.user.name,
      email: m.user.email,
      orgRole: m.role,
      userRole: m.user.role,
      assignedCount: countMap.get(m.user.id) ?? 0,
      joinedAt: m.user.createdAt,
      isCurrentUser: m.user.id === req.user!.userId,
    }));

    const summary = {
      total: members.length,
      owners: members.filter((m) => m.orgRole === 'OWNER').length,
      admins: members.filter((m) => m.orgRole === 'ADMIN').length,
      agents: members.filter((m) => m.orgRole === 'AGENT').length,
    };

    sendSuccess(res, { members, summary });
  })
);

const createMemberSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  orgRole: z.enum(['ADMIN', 'AGENT']).default('AGENT'),
});

router.post(
  '/',
  authenticate,
  requireOrg,
  loadOrgRole,
  requireOrgRole('OWNER', 'ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const data = createMemberSchema.parse(req.body);
    const orgId = req.user!.organizationId!;

    const existingUser = await prisma.user.findUnique({ where: { email: data.email } });

    if (existingUser) {
      const existingMembership = await prisma.organizationUser.findUnique({
        where: {
          organizationId_userId: { organizationId: orgId, userId: existingUser.id },
        },
      });
      if (existingMembership) {
        throw new AppError(409, 'User is already a team member');
      }
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
        await tx.user.update({
          where: { id: user.id },
          data: { name: data.name },
        });
      }

      const membership = await tx.organizationUser.create({
        data: {
          organizationId: orgId,
          userId: user.id,
          role: data.orgRole,
        },
        include: { user: { select: memberSelect } },
      });

      return membership;
    });

    sendSuccess(
      res,
      {
        id: member.user.id,
        membershipId: member.id,
        name: member.user.name,
        email: member.user.email,
        orgRole: member.role,
        userRole: member.user.role,
        assignedCount: 0,
        joinedAt: member.user.createdAt,
        isCurrentUser: false,
      },
      201
    );
  })
);

const updateMemberSchema = z.object({
  name: z.string().min(2).optional(),
  orgRole: z.enum(['ADMIN', 'AGENT']).optional(),
  password: z.string().min(8).optional(),
});

router.patch(
  '/:id',
  authenticate,
  requireOrg,
  loadOrgRole,
  requireOrgRole('OWNER', 'ADMIN'),
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
    if (data.orgRole) userUpdate.role = data.orgRole;

    const updated = await prisma.$transaction(async (tx) => {
      if (Object.keys(userUpdate).length > 0) {
        await tx.user.update({ where: { id: userId }, data: userUpdate });
      }

      if (data.orgRole) {
        await tx.organizationUser.update({
          where: { id: membership.id },
          data: { role: data.orgRole },
        });
      }

      return getMembership(orgId, userId);
    });

    const assignedCount = await prisma.conversation.count({
      where: { organizationId: orgId, assignedAgentId: userId },
    });

    sendSuccess(res, {
      id: updated!.user.id,
      membershipId: updated!.id,
      name: updated!.user.name,
      email: updated!.user.email,
      orgRole: updated!.role,
      userRole: updated!.user.role,
      assignedCount,
      joinedAt: updated!.user.createdAt,
      isCurrentUser: userId === req.user!.userId,
    });
  })
);

router.delete(
  '/:id',
  authenticate,
  requireOrg,
  loadOrgRole,
  requireOrgRole('OWNER', 'ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = paramId(req);
    const orgId = req.user!.organizationId!;

    const membership = await getMembership(orgId, userId);
    if (!membership) throw new AppError(404, 'Team member not found');

    if (membership.role === 'OWNER') {
      throw new AppError(403, 'Cannot remove the organization owner');
    }

    if (membership.userId === req.user!.userId) {
      throw new AppError(403, 'Cannot remove yourself from the team');
    }

    await prisma.$transaction(async (tx) => {
      await tx.conversation.updateMany({
        where: { organizationId: orgId, assignedAgentId: userId },
        data: { assignedAgentId: null },
      });
      await tx.organizationUser.delete({ where: { id: membership.id } });
    });

    sendSuccess(res, { message: 'Team member removed' });
  })
);

export default router;
