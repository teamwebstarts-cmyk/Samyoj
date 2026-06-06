import { Router, Request, Response } from 'express';
import prisma from '../../config/database';
import { authenticate, requireOrg } from '../../middleware/auth';
import { sendSuccess, asyncHandler } from '../../utils/response';

const router = Router();

router.get(
  '/overview',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [
      messagesSent,
      messagesDelivered,
      messagesRead,
      messagesFailed,
      activeConversations,
      totalContacts,
    ] = await Promise.all([
      prisma.message.count({
        where: {
          direction: 'OUTBOUND',
          createdAt: { gte: thirtyDaysAgo },
          conversation: { organizationId: orgId },
        },
      }),
      prisma.message.count({
        where: {
          direction: 'OUTBOUND',
          status: 'DELIVERED',
          createdAt: { gte: thirtyDaysAgo },
          conversation: { organizationId: orgId },
        },
      }),
      prisma.message.count({
        where: {
          direction: 'OUTBOUND',
          status: 'READ',
          createdAt: { gte: thirtyDaysAgo },
          conversation: { organizationId: orgId },
        },
      }),
      prisma.message.count({
        where: {
          direction: 'OUTBOUND',
          status: 'FAILED',
          createdAt: { gte: thirtyDaysAgo },
          conversation: { organizationId: orgId },
        },
      }),
      prisma.conversation.count({
        where: { organizationId: orgId, status: 'OPEN' },
      }),
      prisma.contact.count({ where: { organizationId: orgId } }),
    ]);

    sendSuccess(res, {
      messagesSent,
      deliveryRate: messagesSent ? ((messagesDelivered / messagesSent) * 100).toFixed(1) : '0',
      readRate: messagesSent ? ((messagesRead / messagesSent) * 100).toFixed(1) : '0',
      failedMessages: messagesFailed,
      activeConversations,
      totalContacts,
    });
  })
);

export default router;
