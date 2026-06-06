import { Router, Request, Response } from 'express';
import { authenticate, requireOrg } from '../../middleware/auth';
import { sendSuccess, asyncHandler } from '../../utils/response';
import { phoneFieldSchema } from '../../utils/phone';
import { sendDirectMessage } from './service';
import { z } from 'zod';

const router = Router();

const sendSchema = z.object({
  phone: phoneFieldSchema,
  name: z.string().optional(),
  content: z.string().min(1),
  type: z.enum(['TEXT', 'TEMPLATE']).default('TEXT'),
  templateName: z.string().optional(),
  templateLanguage: z.string().optional(),
});

router.post(
  '/send',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const data = sendSchema.parse(req.body);
    const result = await sendDirectMessage(req.user!.organizationId!, data);

    sendSuccess(
      res,
      {
        message: result.message,
        conversationId: result.conversationId,
        contact: result.contact,
      },
      201
    );
  })
);

export default router;
