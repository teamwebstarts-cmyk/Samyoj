import { Router, Request, Response } from 'express';
import { authenticate, requireOrg } from '../../middleware/auth';
import { sendSuccess, asyncHandler, AppError } from '../../utils/response';
import { isAiConfigured } from '../ai/chat-completion.service';
import {
  answerSupportQuestion,
  formatChatTranscript,
  lastUserQuestion,
  supportChatBodySchema,
} from './chat.service';
import { createSupportTicket, listSupportTickets } from './tickets.service';

const router = Router();

router.use(authenticate, requireOrg);

router.get(
  '/status',
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const assistantOnline = await isAiConfigured(orgId);
    sendSuccess(res, { assistantOnline, ticketsAvailable: true });
  })
);

router.post(
  '/chat',
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const body = supportChatBodySchema.parse(req.body);
    const reply = await answerSupportQuestion({ organizationId: orgId, messages: body.messages });
    sendSuccess(res, { reply });
  })
);

router.get(
  '/tickets',
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const userId = req.user!.userId;
    const tickets = await listSupportTickets(orgId, userId);
    sendSuccess(res, { tickets });
  })
);

router.post(
  '/tickets',
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const userId = req.user!.userId;
    const ticket = await createSupportTicket({
      organizationId: orgId,
      createdById: userId,
      data: req.body,
    });
    sendSuccess(res, ticket, 201);
  })
);

router.post(
  '/tickets/escalate',
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const userId = req.user!.userId;
    const parsed = supportChatBodySchema.parse(req.body);
    const question = lastUserQuestion(parsed.messages);
    if (!question.trim()) {
      throw new AppError(400, 'Chat with the assistant first, then escalate.');
    }
    const subject =
      question.trim().length > 80 ? `${question.trim().slice(0, 77).trimEnd()}…` : question.trim();
    const ticket = await createSupportTicket({
      organizationId: orgId,
      createdById: userId,
      data: {
        subject,
        body: question.trim(),
        source: 'chat',
        transcript: formatChatTranscript(parsed.messages),
      },
    });
    sendSuccess(res, ticket, 201);
  })
);

export default router;
