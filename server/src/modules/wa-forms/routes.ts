import { Router, Request, Response } from 'express';
import { authenticate, requireOrg } from '../../middleware/auth';
import { AppError, sendSuccess, asyncHandler } from '../../utils/response';
import { MetaWhatsAppService } from '../whatsapp/meta.service';
import { getOrgWhatsappContext } from '../whatsapp/context';
import { buildMetaFlowJson } from './builder';
import { createWaFormSchema } from './types';

const router = Router();

router.get(
  '/',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const { wabaId, accessToken } = await getOrgWhatsappContext(req.user!.organizationId!);
    const forms = await MetaWhatsAppService.listWhatsAppFlows(wabaId, accessToken);
    sendSuccess(res, { forms });
  })
);

router.get(
  '/:id',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const { accessToken } = await getOrgWhatsappContext(req.user!.organizationId!);
    const form = await MetaWhatsAppService.getWhatsAppFlow(req.params.id as string, accessToken);
    sendSuccess(res, { form });
  })
);

router.post(
  '/',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const data = createWaFormSchema.parse(req.body);
    const { wabaId, accessToken } = await getOrgWhatsappContext(req.user!.organizationId!);
    const flowJson = buildMetaFlowJson(data);

    const created = await MetaWhatsAppService.createWhatsAppFlow(wabaId, accessToken, {
      name: data.name,
      categories: ['OTHER'],
      flowJson,
    });

    let published = false;
    try {
      await MetaWhatsAppService.publishWhatsAppFlow(created.id, accessToken);
      published = true;
    } catch {
      // Flow may need Meta review — still return created id for draft use
    }

    sendSuccess(
      res,
      {
        form: {
          id: created.id,
          name: data.name,
          status: published ? 'PUBLISHED' : created.status,
          categories: ['OTHER'],
          validationErrors: [],
        },
        published,
      },
      201
    );
  })
);

router.post(
  '/:id/publish',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const { accessToken } = await getOrgWhatsappContext(req.user!.organizationId!);
    await MetaWhatsAppService.publishWhatsAppFlow(req.params.id as string, accessToken);
    sendSuccess(res, { published: true });
  })
);

export default router;
