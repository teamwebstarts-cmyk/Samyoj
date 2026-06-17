import { Router, Request, Response } from 'express';
import prisma from '../../config/database';
import { authenticate, requireOrg } from '../../middleware/auth';
import { loadPermissions, requirePermission } from '../../middleware/permissions';
import { AppError, sendSuccess, asyncHandler } from '../../utils/response';

const router = Router();

router.get(
  '/export',
  authenticate,
  requireOrg,
  loadPermissions,
  requirePermission('manageSettings'),
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;

    const [org, contacts, conversations, campaigns] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: orgId },
        select: {
          id: true,
          companyName: true,
          plan: true,
          createdAt: true,
          settings: true,
        },
      }),
      prisma.contact.findMany({ where: { organizationId: orgId } }),
      prisma.conversation.findMany({
        where: { organizationId: orgId },
        include: {
          contact: { select: { phone: true, name: true } },
          messages: { take: 100, orderBy: { createdAt: 'desc' } },
        },
        take: 500,
      }),
      prisma.campaign.findMany({
        where: { organizationId: orgId },
        select: {
          id: true,
          name: true,
          status: true,
          totalContacts: true,
          sentCount: true,
          createdAt: true,
        },
      }),
    ]);

    if (!org) throw new AppError(404, 'Organization not found');

    const exportData = {
      exportedAt: new Date().toISOString(),
      organization: org,
      contacts,
      conversations,
      campaigns,
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="gdpr-export-${orgId.slice(0, 8)}.json"`
    );
    res.send(JSON.stringify(exportData, null, 2));
  })
);

router.post(
  '/delete-request',
  authenticate,
  requireOrg,
  loadPermissions,
  requirePermission('manageSettings'),
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const { confirm } = req.body as { confirm?: string };

    if (confirm !== 'DELETE MY DATA') {
      throw new AppError(400, 'Send { "confirm": "DELETE MY DATA" } to proceed');
    }

    await prisma.auditLog.create({
      data: {
        organizationId: orgId,
        userId: req.user!.userId,
        action: 'gdpr_delete_requested',
        resource: 'organization',
        details: { requestedAt: new Date().toISOString() },
      },
    });

    const { compliancePurgeQueue } = await import('../../config/queues');
    const purgeDelayMs = parseInt(process.env.COMPLIANCE_PURGE_DELAY_MS || String(30 * 24 * 60 * 60 * 1000), 10);
    await compliancePurgeQueue.add('purge', { organizationId: orgId }, { attempts: 3, delay: purgeDelayMs });

    sendSuccess(res, {
      message: `Deletion request queued. Your workspace data will be purged in ${Math.round(purgeDelayMs / 86400000)} days per GDPR policy.`,
      status: 'queued',
    });
  })
);

router.get(
  '/sla',
  authenticate,
  requireOrg,
  loadPermissions,
  requirePermission('viewAnalytics'),
  asyncHandler(async (req: Request, res: Response) => {
    const { getSlaStats } = await import('../sla/service');
    const stats = await getSlaStats(req.user!.organizationId!);
    sendSuccess(res, stats);
  })
);

export default router;
