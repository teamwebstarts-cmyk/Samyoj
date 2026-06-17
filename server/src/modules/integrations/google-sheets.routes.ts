import { Router, Request, Response } from 'express';
import prisma from '../../config/database';
import { authenticate, requireOrg } from '../../middleware/auth';
import { loadPermissions, requirePermission } from '../../middleware/permissions';
import { sendSuccess, asyncHandler } from '../../utils/response';

const router = Router();

router.get(
  '/export',
  authenticate,
  requireOrg,
  loadPermissions,
  requirePermission('manageSettings'),
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;

    const contacts = await prisma.contact.findMany({
      where: { organizationId: orgId },
      select: {
        phone: true,
        name: true,
        email: true,
        tags: true,
        optedIn: true,
        consentSource: true,
        source: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const header = 'phone,name,email,tags,opted_in,consent_source,source,created_at';
    const rows = contacts.map((c) =>
      [
        c.phone,
        c.name || '',
        c.email || '',
        (c.tags || []).join('|'),
        c.optedIn ? 'true' : 'false',
        c.consentSource || '',
        c.source,
        c.createdAt.toISOString(),
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(',')
    );

    const csv = [header, ...rows].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="contacts-${orgId.slice(0, 8)}.csv"`);
    res.send(csv);
  })
);

export default router;
