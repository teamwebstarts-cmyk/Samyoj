import { Router, Request, Response } from 'express';
import { authenticate, requireOrg } from '../../middleware/auth';
import { sendSuccess, asyncHandler } from '../../utils/response';
import { isAiConfigured } from '../ai/chat-completion.service';
import { answerSupportQuestion, parseSupportChatBody } from './chat.service';
import {
  requireActiveCommercialOnMutation,
  requireFeatureOnMutation,
} from '../../middleware/plan-guard';

const router = Router();

router.use(authenticate, requireOrg);
router.use(requireActiveCommercialOnMutation());
router.use(requireFeatureOnMutation('support'));

router.get(
  '/status',
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const assistantOnline = await isAiConfigured(orgId);
    sendSuccess(res, { assistantOnline });
  })
);

router.post(
  '/chat',
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const body = parseSupportChatBody(req.body);
    const reply = await answerSupportQuestion({ organizationId: orgId, messages: body.messages });
    sendSuccess(res, { reply });
  })
);

export default router;
