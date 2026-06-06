import { Router, Request, Response } from 'express';
import prisma from '../../config/database';
import { authenticate, requireOrg } from '../../middleware/auth';
import { AppError, sendSuccess, asyncHandler, paramId } from '../../utils/response';
import { phoneFieldSchema, validatePhone } from '../../utils/phone';
import { z } from 'zod';

const router = Router();

router.get(
  '/',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const { search, tag, named: namedFilter, page = '1', limit = '50' } = req.query;
    const orgId = req.user!.organizationId!;

    const andConditions: Record<string, unknown>[] = [];

    if (search) {
      andConditions.push({
        OR: [
          { name: { contains: search as string, mode: 'insensitive' } },
          { phone: { contains: search as string } },
        ],
      });
    }
    if (tag === '__none__') {
      andConditions.push({ tags: { equals: [] } });
    } else if (tag) {
      andConditions.push({ tags: { has: tag as string } });
    }
    if (namedFilter === 'true') {
      andConditions.push({ name: { not: null } }, { NOT: { name: '' } });
    } else if (namedFilter === 'false') {
      andConditions.push({ OR: [{ name: null }, { name: '' }] });
    }

    const where: Record<string, unknown> = { organizationId: orgId };
    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const [contacts, total, totalAll, named] = await Promise.all([
      prisma.contact.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit as string),
      }),
      prisma.contact.count({ where }),
      prisma.contact.count({ where: { organizationId: orgId } }),
      prisma.contact.count({
        where: {
          organizationId: orgId,
          AND: [{ name: { not: null } }, { NOT: { name: '' } }],
        },
      }),
    ]);

    sendSuccess(res, {
      contacts,
      total,
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      summary: { total: totalAll, named },
    });
  })
);

const contactSchema = z.object({
  phone: phoneFieldSchema,
  name: z.string().optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

router.post(
  '/',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const data = contactSchema.parse(req.body);

    const contact = await prisma.contact.upsert({
      where: {
        organizationId_phone: {
          organizationId: req.user!.organizationId!,
          phone: data.phone,
        },
      },
      create: {
        organizationId: req.user!.organizationId!,
        phone: data.phone,
        name: data.name,
        tags: data.tags || [],
        notes: data.notes,
      },
      update: {
        name: data.name,
        tags: data.tags,
        notes: data.notes,
      },
    });

    sendSuccess(res, contact, 201);
  })
);

router.post(
  '/import',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const { contacts } = req.body as {
      contacts: Array<{ phone: string; name?: string; tags?: string[]; notes?: string }>;
    };

    if (!Array.isArray(contacts)) throw new AppError(400, 'Contacts array required');

    const orgId = req.user!.organizationId!;
    let imported = 0;

    for (let i = 0; i < contacts.length; i++) {
      const c = contacts[i];
      const result = validatePhone(c.phone);
      if (!result.ok) throw new AppError(400, `Contact ${i + 1}: ${result.error}`);

      await prisma.contact.upsert({
        where: { organizationId_phone: { organizationId: orgId, phone: result.phone } },
        create: {
          organizationId: orgId,
          phone: result.phone,
          name: c.name,
          tags: c.tags || [],
          notes: c.notes,
        },
        update: { name: c.name, tags: c.tags, notes: c.notes },
      });
      imported++;
    }

    sendSuccess(res, { imported });
  })
);

router.get(
  '/tags',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const contacts = await prisma.contact.findMany({
      where: { organizationId: orgId },
      select: { tags: true },
    });

    const tagSet = new Set<string>();
    for (const contact of contacts) {
      for (const tag of contact.tags) {
        tagSet.add(tag);
      }
    }

    sendSuccess(res, { tags: [...tagSet].sort((a, b) => a.localeCompare(b)) });
  })
);

router.get(
  '/export',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const contacts = await prisma.contact.findMany({
      where: { organizationId: req.user!.organizationId! },
      select: { phone: true, name: true, tags: true, notes: true, optedIn: true },
    });

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=contacts.json');
    res.send(JSON.stringify(contacts, null, 2));
  })
);

router.get(
  '/:id',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const contact = await prisma.contact.findFirst({
      where: { id: paramId(req), organizationId: req.user!.organizationId! },
    });
    if (!contact) throw new AppError(404, 'Contact not found');
    sendSuccess(res, contact);
  })
);

const updateContactSchema = z.object({
  name: z.string().optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

router.patch(
  '/:id',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const data = updateContactSchema.parse(req.body);
    const id = paramId(req);
    const existing = await prisma.contact.findFirst({
      where: { id, organizationId: req.user!.organizationId! },
    });
    if (!existing) throw new AppError(404, 'Contact not found');

    const contact = await prisma.contact.update({
      where: { id },
      data,
    });

    sendSuccess(res, contact);
  })
);

router.delete(
  '/:id',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const id = paramId(req);
    const deleted = await prisma.contact.deleteMany({
      where: { id, organizationId: req.user!.organizationId! },
    });
    if (deleted.count === 0) throw new AppError(404, 'Contact not found');
    sendSuccess(res, { deleted: true });
  })
);

export default router;
