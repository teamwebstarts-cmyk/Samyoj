import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate, requireOrg } from '../../middleware/auth';
import { AppError, sendSuccess, asyncHandler } from '../../utils/response';
import { listCatalogProducts, listMetaCatalogs, syncCatalogProducts } from './service';
import { resolveActiveWhatsappNumber } from '../whatsapp/active-number';

const router = Router();

router.get(
  '/catalogs',
  authenticate,
  requireOrg,
  resolveActiveWhatsappNumber,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const catalogs = await listMetaCatalogs(orgId, req.activeWhatsappNumberId);
    sendSuccess(res, { catalogs });
  })
);

router.get(
  '/products',
  authenticate,
  requireOrg,
  resolveActiveWhatsappNumber,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const result = await listCatalogProducts(orgId, {
      catalogId: req.query.catalogId as string | undefined,
      search: req.query.search as string | undefined,
      page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
    }, req.activeWhatsappNumberId);
    sendSuccess(res, result);
  })
);

const syncSchema = z.object({
  catalogId: z.string().min(1),
});

router.post(
  '/sync',
  authenticate,
  requireOrg,
  resolveActiveWhatsappNumber,
  asyncHandler(async (req: Request, res: Response) => {
    const { catalogId } = syncSchema.parse(req.body);
    const orgId = req.user!.organizationId!;

    try {
      const result = await syncCatalogProducts(orgId, catalogId, req.activeWhatsappNumberId);
      sendSuccess(res, result);
    } catch (err) {
      if (err instanceof AppError) throw err;
      const message = err instanceof Error ? err.message : 'Catalog sync failed';
      throw new AppError(502, message);
    }
  })
);

export default router;
