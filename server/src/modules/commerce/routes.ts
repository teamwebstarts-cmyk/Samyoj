import { Router, Request, Response } from 'express';
import { OrderPaymentStatus, OrderStatus } from '@prisma/client';
import { z } from 'zod';
import prisma from '../../config/database';
import { authenticate, requireOrg } from '../../middleware/auth';
import { loadPermissions, requirePermission } from '../../middleware/permissions';
import { AppError, sendSuccess, asyncHandler, paramId } from '../../utils/response';
import { logError } from '../../errors';
import { MetaWhatsAppService } from '../whatsapp/meta.service';
import { getWhatsappContextById } from '../whatsapp/context';
import { resolveActiveWhatsappNumber } from '../whatsapp/active-number';
import {
  buildOrderStatusPayload,
  buildPaymentStatusPayload,
  getOrder,
  listOrders,
  orderStatusCustomerMessage,
  updateOrderPaymentStatus,
  updateOrderStatus,
} from './service';
import { requireActiveCommercialOnMutation } from '../../middleware/plan-guard';

const router = Router();

router.use(authenticate, requireOrg, resolveActiveWhatsappNumber);

const commerceMutationGuard = [
  loadPermissions,
  requirePermission('manageBilling'),
  requireActiveCommercialOnMutation(),
];

router.get(
  '/orders',
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const status = req.query.status as OrderStatus | undefined;
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const result = await listOrders(orgId, {
      status,
      search,
      page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
      whatsappNumberId: req.activeWhatsappNumberId,
    });
    sendSuccess(res, result);
  })
);

router.get(
  '/orders/:id',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const order = await getOrder(orgId, paramId(req), req.activeWhatsappNumberId);
    if (!order) throw new AppError(404, 'Order not found');
    sendSuccess(res, order);
  })
);

const statusSchema = z.object({
  status: z.nativeEnum(OrderStatus),
  statusNote: z.string().optional(),
  notifyContact: z.boolean().optional(),
  body: z.string().optional(),
});

router.patch(
  '/orders/:id/status',
  ...commerceMutationGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const orderId = paramId(req);
    const data = statusSchema.parse(req.body);

    const order = await updateOrderStatus(
      orgId,
      orderId,
      data.status,
      data.statusNote,
      req.activeWhatsappNumberId
    );
    if (!order) throw new AppError(404, 'Order not found');

    let notified = false;
    if (data.notifyContact && order.contactId) {
      try {
        const contact = await prisma.contact.findUnique({
          where: { id: order.contactId },
          select: { phone: true },
        });
        if (contact?.phone) {
          if (!order.whatsappNumberId) throw new AppError(409, 'Order has unresolved WhatsApp number ownership');
          const { whatsappNumber, accessToken } = await getWhatsappContextById(
            orgId,
            order.whatsappNumberId
          );
          const payload = buildOrderStatusPayload(contact.phone, {
            referenceId: order.referenceId,
            body: data.body || orderStatusCustomerMessage(data.status, order.referenceId),
            status: data.status,
            description: data.statusNote,
          });
          await MetaWhatsAppService.sendMessage(
            whatsappNumber.phoneNumberId,
            accessToken,
            payload,
            {
              whatsappNumberId: whatsappNumber.id,
              isOnBizApp: Boolean(whatsappNumber.isOnBizApp),
            }
          );
          notified = true;
        }
      } catch (err) {
        if (err instanceof AppError) throw err;
        logError(err, {
          source: 'api',
          action: 'Order status notify failed',
          orderId,
          organizationId: orgId,
        });
      }
    }

    sendSuccess(res, { ...order, notified });
  })
);

const paymentStatusSchema = z.object({
  paymentStatus: z.nativeEnum(OrderPaymentStatus),
  notifyContact: z.boolean().optional(),
  body: z.string().optional(),
});

router.patch(
  '/orders/:id/payment-status',
  ...commerceMutationGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const orderId = paramId(req);
    const data = paymentStatusSchema.parse(req.body);

    const order = await updateOrderPaymentStatus(
      orgId,
      orderId,
      data.paymentStatus,
      req.activeWhatsappNumberId
    );
    if (!order) throw new AppError(404, 'Order not found');

    if (data.notifyContact && order.contactId) {
      const contact = await prisma.contact.findUnique({
        where: { id: order.contactId },
        select: { phone: true },
      });
      if (contact?.phone) {
        if (!order.whatsappNumberId) throw new AppError(409, 'Order has unresolved WhatsApp number ownership');
        const { whatsappNumber, accessToken } = await getWhatsappContextById(
          orgId,
          order.whatsappNumberId
        );
        const payload = buildPaymentStatusPayload(contact.phone, {
          referenceId: order.referenceId,
          body: data.body || `Payment update for order ${order.referenceId}`,
          status: data.paymentStatus,
          amountCents: order.totalCents,
          currency: order.currency,
        });
        await MetaWhatsAppService.sendMessage(
          whatsappNumber.phoneNumberId,
          accessToken,
          payload,
          {
            whatsappNumberId: whatsappNumber.id,
            isOnBizApp: Boolean(whatsappNumber.isOnBizApp),
          }
        );
      }
    }

    sendSuccess(res, order);
  })
);

export default router;
