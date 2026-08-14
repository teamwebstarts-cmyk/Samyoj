import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticateApiKey } from '../../middleware/api-key';
import { requireOrg } from '../../middleware/auth';
import { sendSuccess, asyncHandler, AppError } from '../../utils/response';
import { phoneFieldSchema } from '../../utils/phone';
import { sendDirectMessage } from '../messages/service';
import { resolveActiveWhatsappNumber } from '../whatsapp/active-number';

const router = Router();

const inboundSchema = z.object({
  phone: phoneFieldSchema,
  name: z.string().optional(),
  content: z.string().min(1),
  type: z.enum(['TEXT', 'TEMPLATE']).default('TEXT'),
  templateName: z.string().optional(),
  templateLanguage: z.string().optional(),
  externalId: z.string().max(200).optional(),
});

router.post(
  '/',
  authenticateApiKey,
  requireOrg,
  resolveActiveWhatsappNumber,
  asyncHandler(async (req: Request, res: Response) => {
    const data = inboundSchema.parse(req.body);
    const orgId = req.user!.organizationId!;

    if (data.type === 'TEMPLATE' && !data.templateName) {
      throw new AppError(400, 'templateName is required for TEMPLATE messages');
    }

    const result = await sendDirectMessage(orgId, {
      phone: data.phone,
      name: data.name,
      content: data.content,
      type: data.type,
      templateName: data.templateName,
      templateLanguage: data.templateLanguage,
      whatsappNumberId: req.activeWhatsappNumberId,
    });

    sendSuccess(
      res,
      {
        messageId: result.message.id,
        conversationId: result.conversationId,
        contactId: result.contact.id,
        externalId: data.externalId,
        status: 'queued',
      },
      202
    );
  })
);

export default router;
