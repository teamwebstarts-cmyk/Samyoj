import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../../config/database';
import { authenticate, requireOrg } from '../../middleware/auth';
import { loadPermissions, requirePermission } from '../../middleware/permissions';
import { sendSuccess, asyncHandler, AppError } from '../../utils/response';
import { isRazorpayConfigured } from './razorpay.service';
import { config } from '../../config';
import { requireActiveCommercialOnMutation } from '../../middleware/plan-guard';

const router = Router();

router.post(
  '/payment-link',
  authenticate,
  requireOrg,
  loadPermissions,
  requirePermission('manageBilling'),
  requireActiveCommercialOnMutation(),
  asyncHandler(async (req: Request, res: Response) => {
    if (!isRazorpayConfigured()) {
      throw new AppError(400, 'Razorpay is not configured');
    }

    const data = z
      .object({
        amountPaise: z.number().int().min(100),
        description: z.string().min(1).max(200),
        customerName: z.string().optional(),
        customerPhone: z.string().optional(),
        customerEmail: z.string().email().optional(),
      })
      .parse(req.body);

    const orgId = req.user!.organizationId!;
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { companyName: true },
    });

    const auth = Buffer.from(`${config.razorpay.keyId}:${config.razorpay.keySecret}`).toString('base64');

    const resLink = await fetch('https://api.razorpay.com/v1/payment_links', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: data.amountPaise,
        currency: 'INR',
        description: data.description,
        customer: {
          name: data.customerName,
          contact: data.customerPhone,
          email: data.customerEmail,
        },
        notes: {
          organizationId: orgId,
          company: org?.companyName,
        },
      }),
    });

    if (!resLink.ok) {
      const err = await resLink.text();
      throw new AppError(502, `Razorpay payment link failed: ${err.slice(0, 200)}`);
    }

    const link = (await resLink.json()) as { id: string; short_url: string; status: string };

    sendSuccess(res, {
      id: link.id,
      url: link.short_url,
      status: link.status,
    });
  })
);

export default router;
