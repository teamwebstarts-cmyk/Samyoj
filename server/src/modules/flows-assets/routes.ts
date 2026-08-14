import { Router, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../../config/database';
import { authenticate, requireOrg, loadOrgRole, requireOrgRole } from '../../middleware/auth';
import { AppError, sendSuccess, asyncHandler, paramId } from '../../utils/response';
import { MetaWhatsAppService } from '../whatsapp/meta.service';
import { getOrgWhatsappContext } from '../whatsapp/context';
import {
  createFlowAssetSchema,
  resolveFlowJson,
  updateFlowAssetSchema,
} from './types';
import { handleNfmReply } from './nfm-handler';
import dataEndpointRoutes from './data-endpoint.routes';
import { verifyWebhookSignatureForPayload } from '../whatsapp/org-meta.service';

const router = Router();
const memberGuard = [authenticate, requireOrg] as const;
const adminGuard = [authenticate, requireOrg, loadOrgRole, requireOrgRole('OWNER', 'ADMIN')] as const;

router.use('/data', dataEndpointRoutes);

router.get(
  '/',
  ...memberGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const { search, status, page = '1', limit = '20' } = req.query;
    const where: Prisma.FlowAssetWhereInput = { organizationId: orgId };

    if (search) where.name = { contains: search as string, mode: 'insensitive' };
    if (status) where.status = status as Prisma.EnumFlowAssetStatusFilter['equals'];

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);

    const [assets, total] = await Promise.all([
      prisma.flowAsset.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
      }),
      prisma.flowAsset.count({ where }),
    ]);

    sendSuccess(res, { assets, total, page: pageNum, limit: limitNum });
  })
);

router.get(
  '/:id',
  ...memberGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const asset = await prisma.flowAsset.findFirst({
      where: { id: paramId(req), organizationId: req.user!.organizationId! },
    });
    if (!asset) throw new AppError(404, 'Flow asset not found');
    sendSuccess(res, asset);
  })
);

router.post(
  '/',
  ...adminGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const data = createFlowAssetSchema.parse(req.body);
    const flowJson = resolveFlowJson(data);

    const asset = await prisma.flowAsset.create({
      data: {
        organizationId: req.user!.organizationId!,
        name: data.name,
        description: data.description,
        flowJson: flowJson as Prisma.InputJsonValue,
        categories: data.categories,
        status: 'DRAFT',
      },
    });

    sendSuccess(res, asset, 201);
  })
);

router.patch(
  '/:id',
  ...adminGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const id = paramId(req);
    const existing = await prisma.flowAsset.findFirst({
      where: { id, organizationId: req.user!.organizationId! },
    });
    if (!existing) throw new AppError(404, 'Flow asset not found');

    const data = updateFlowAssetSchema.parse(req.body);
    const updateData: Prisma.FlowAssetUpdateInput = {
      name: data.name,
      description: data.description,
      categories: data.categories,
    };

    if (data.flowJson || (data.title && data.fields)) {
      const merged = {
        flowJson: data.flowJson,
        title: data.title,
        submitLabel: data.submitLabel,
        fields: data.fields,
      };
      updateData.flowJson = resolveFlowJson(merged) as Prisma.InputJsonValue;
      updateData.version = { increment: 1 };
      updateData.status = 'DRAFT';
    }

    const asset = await prisma.flowAsset.update({ where: { id }, data: updateData });
    sendSuccess(res, asset);
  })
);

router.delete(
  '/:id',
  ...adminGuard,
  asyncHandler(async (req: Request, res: Response) => {
    await prisma.flowAsset.deleteMany({
      where: { id: paramId(req), organizationId: req.user!.organizationId! },
    });
    sendSuccess(res, { deleted: true });
  })
);

router.post(
  '/:id/publish',
  ...adminGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const id = paramId(req);
    const orgId = req.user!.organizationId!;
    const asset = await prisma.flowAsset.findFirst({ where: { id, organizationId: orgId } });
    if (!asset) throw new AppError(404, 'Flow asset not found');

    const { wabaId, accessToken } = await getOrgWhatsappContext(orgId);
    const flowJsonStr = JSON.stringify(asset.flowJson);

    let metaFlowId = asset.metaFlowId;
    let metaStatus = asset.metaStatus || 'DRAFT';

    if (!metaFlowId) {
      const created = await MetaWhatsAppService.createWhatsAppFlow(wabaId, accessToken, {
        name: asset.name,
        categories: asset.categories.length ? asset.categories : ['OTHER'],
        flowJson: flowJsonStr,
      });
      metaFlowId = created.id;
      metaStatus = created.status;
    } else {
      await MetaWhatsAppService.updateWhatsAppFlowJson(metaFlowId, accessToken, flowJsonStr);
    }

    let published = false;
    try {
      await MetaWhatsAppService.publishWhatsAppFlow(metaFlowId, accessToken);
      published = true;
      metaStatus = 'PUBLISHED';
    } catch {
      // Flow may need Meta review
    }

    const metaForm = await MetaWhatsAppService.getWhatsAppFlow(metaFlowId, accessToken);

    const updated = await prisma.flowAsset.update({
      where: { id },
      data: {
        metaFlowId,
        metaStatus: published ? 'PUBLISHED' : metaForm.status,
        status: published ? 'PUBLISHED' : 'DRAFT',
        validationErrors: metaForm.validationErrors,
      },
    });

    sendSuccess(res, { asset: updated, published, metaForm });
  })
);

router.post(
  '/webhook/nfm',
  asyncHandler(async (req: Request, res: Response) => {
    const signature = req.headers['x-hub-signature-256'];
    if (!signature || typeof signature !== 'string') {
      throw new AppError(401, 'Missing webhook signature');
    }
    const rawBody = req.rawBody || JSON.stringify(req.body ?? {});
    const payload =
      req.body && typeof req.body === 'object' && !Array.isArray(req.body)
        ? (req.body as Record<string, unknown>)
        : {};
    const valid = await verifyWebhookSignatureForPayload(signature, rawBody, payload);
    if (!valid) {
      throw new AppError(401, 'Invalid signature');
    }
    const result = await handleNfmReply(req.body);
    sendSuccess(res, result);
  })
);

export default router;
