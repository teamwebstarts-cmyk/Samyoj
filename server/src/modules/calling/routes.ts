import { Router, Request, Response } from 'express';
import prisma from '../../config/database';
import { authenticate, requireOrg } from '../../middleware/auth';
import { AppError, sendSuccess, asyncHandler } from '../../utils/response';
import { MetaWhatsAppService } from '../whatsapp/meta.service';
import {
  isCallingConfigured,
  MetaCallingService,
  CALLING_ENABLE_HINTS,
} from './meta-calling.service';
import { endCallSession, getActiveSessionCount } from './call-session.manager';
import { isAzureOpenAIConfigured } from '../ai/azure-openai.service';
import { isDeepgramConfigured } from './deepgram.stt';
import { isGoogleTtsConfigured } from './google-tts.service';
import { config } from '../../config';

const router = Router();

router.get(
  '/status',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const number = await prisma.whatsappNumber.findFirst({
      where: { organizationId: orgId, isActive: true },
    });

    let callingSettings: Record<string, unknown> | null = null;
    if (number) {
      try {
        const accessToken = MetaWhatsAppService.decryptToken(number.accessToken);
        callingSettings = await MetaCallingService.getCallingSettings(
          number.phoneNumberId,
          accessToken
        );
      } catch {
        callingSettings = null;
      }
    }

    sendSuccess(res, {
      configured: isCallingConfigured() && isAzureOpenAIConfigured(),
      deepgram: isDeepgramConfigured(),
      googleTts: isGoogleTtsConfigured(),
      azureOpenAI: isAzureOpenAIConfigured(),
      aiAutoAnswer: config.calling.aiAutoAnswer,
      activeCalls: getActiveSessionCount(),
      whatsappConnected: Boolean(number),
      phoneNumber: number?.phoneNumber ?? null,
      callingSettings,
      callingEnabled: MetaCallingService.isCallingEnabled(callingSettings),
      enableHints: MetaCallingService.isCallingEnabled(callingSettings) ? [] : CALLING_ENABLE_HINTS,
      voiceReady:
        Boolean(number) &&
        isCallingConfigured() &&
        isAzureOpenAIConfigured() &&
        MetaCallingService.isCallingEnabled(callingSettings),
    });
  })
);

router.post(
  '/enable',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const number = await prisma.whatsappNumber.findFirst({
      where: { organizationId: orgId, isActive: true },
    });
    if (!number) throw new AppError(400, 'Connect a WhatsApp number first');

    const accessToken = MetaWhatsAppService.decryptToken(number.accessToken);
    try {
      await MetaCallingService.enableCalling(number.phoneNumberId, accessToken);
    } catch (err) {
      if (err instanceof AppError && err.code === 'CALLING_PREREQUISITES') {
        return res.status(err.statusCode).json({
          success: false,
          error: {
            message: err.message,
            code: err.code,
            hints: CALLING_ENABLE_HINTS,
          },
        });
      }
      throw err;
    }
    const settings = await MetaCallingService.getCallingSettings(number.phoneNumberId, accessToken);

    sendSuccess(res, { enabled: true, settings });
  })
);

router.get(
  '/',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const limit = Math.min(Number(req.query.limit) || 50, 100);

    const calls = await prisma.call.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        contact: { select: { id: true, name: true, phone: true } },
        aiBot: { select: { id: true, name: true } },
      },
    });

    sendSuccess(res, calls);
  })
);

router.get(
  '/:id',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const id = String(req.params.id);
    const call = await prisma.call.findFirst({
      where: { id, organizationId: orgId },
      include: {
        contact: true,
        conversation: { select: { id: true, status: true } },
        aiBot: { select: { id: true, name: true } },
      },
    });
    if (!call) throw new AppError(404, 'Call not found');
    sendSuccess(res, call);
  })
);

router.post(
  '/:id/terminate',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const id = String(req.params.id);
    const call = await prisma.call.findFirst({
      where: { id, organizationId: orgId },
      include: { whatsappNumber: true },
    });
    if (!call) throw new AppError(404, 'Call not found');

    const accessToken = MetaWhatsAppService.decryptToken(call.whatsappNumber.accessToken);
    await endCallSession(call.metaCallId, 'agent_terminate');

    try {
      await MetaCallingService.terminate(
        call.whatsappNumber.phoneNumberId,
        accessToken,
        call.metaCallId
      );
    } catch {
      // may already be terminated
    }

    await prisma.call.update({
      where: { id: call.id },
      data: { status: 'TERMINATED', endedAt: new Date() },
    });

    sendSuccess(res, { terminated: true });
  })
);

export default router;
