import { Router, Request, Response } from 'express';
import { OrderPaymentStatus, OrderStatus } from '@prisma/client';
import { z } from 'zod';
import prisma from '../../config/database';
import { authenticate, requireOrg } from '../../middleware/auth';
import { AppError, sendSuccess, asyncHandler, paramId } from '../../utils/response';
import { MetaWhatsAppService } from '../whatsapp/meta.service';
import { getWhatsappContextById } from '../whatsapp/context';
import { resolveActiveWhatsappNumber } from '../whatsapp/active-number';
import {
  buildOrderStatusPayload,
  buildPaymentStatusPayload,
  getOrder,
  listOrders,
  updateOrderPaymentStatus,
  updateOrderStatus,
} from './service';

const router = Router();

router.use(authenticate, requireOrg, resolveActiveWhatsappNumber);

router.get(
  '/orders',
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const status = req.query.status as OrderStatus | undefined;
    const result = await listOrders(orgId, {
      status,
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
  authenticate,
  requireOrg,
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
        const payload = buildOrderStatusPayload(contact.phone, {
          referenceId: order.referenceId,
          body: data.body || `Your order ${order.referenceId} status: ${data.status}`,
          status: data.status,
          description: data.statusNote,
        });
        await MetaWhatsAppService.sendMessage(
          whatsappNumber.phoneNumberId,
          accessToken,
          payload
        );
      }
    }

    sendSuccess(res, order);
  })
);

const paymentStatusSchema = z.object({
  paymentStatus: z.nativeEnum(OrderPaymentStatus),
  notifyContact: z.boolean().optional(),
  body: z.string().optional(),
});

router.patch(
  '/orders/:id/payment-status',
  authenticate,
  requireOrg,
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
          payload
        );
      }
    }

    sendSuccess(res, order);
  })
);

export default router;
