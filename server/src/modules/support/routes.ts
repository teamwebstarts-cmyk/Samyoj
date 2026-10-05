import { Router, Request, Response } from 'express';
import { authenticate, requireOrg } from '../../middleware/auth';
import { sendSuccess, asyncHandler } from '../../utils/response';
import { answerSupportQuestion, parseSupportChatBody } from './chat.service';
import { assertHelpCenterChatAllowed, loadHelpCenterPolicy } from './help-center';

const router = Router();

router.use(authenticate, requireOrg);

router.get(
  '/status',
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const policy = await loadHelpCenterPolicy(orgId);
    sendSuccess(res, {
      assistantOnline: policy.assistantOnline,
      reason: policy.reason,
      enabled: policy.enabled,
      dailyCap: policy.dailyCap,
      dailyUsed: policy.dailyUsed,
    });
  })
);

router.post(
  '/chat',
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    await assertHelpCenterChatAllowed(orgId);
    const body = parseSupportChatBody(req.body);
    const reply = await answerSupportQuestion({ organizationId: orgId, messages: body.messages });
    sendSuccess(res, { reply });
  })
);

export default router;
