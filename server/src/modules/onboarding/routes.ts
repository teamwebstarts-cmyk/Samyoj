import { Router, Request, Response } from 'express';
import prisma from '../../config/database';
import { authenticate, requireOrg, requireAdminOnMutation } from '../../middleware/auth';
import { sendSuccess, asyncHandler, AppError } from '../../utils/response';
import { getOrgReadiness } from './readiness';

const ALLOWED_ONBOARDING_STEPS = new Set([
  'connect_whatsapp',
  'approve_template',
  'send_test_message',
  'import_contacts',
]);

const router = Router();

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  href?: string;
}

router.get(
  '/readiness',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const readiness = await getOrgReadiness(req.user!.organizationId!);
    sendSuccess(res, readiness);
  })
);

router.get(
  '/status',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;

    const [whatsappNumbers, contacts, teamMembers, testMessage, campaignsWithTemplate] =
      await Promise.all([
        prisma.whatsappNumber.count({ where: { organizationId: orgId, isActive: true } }),
        prisma.contact.count({ where: { organizationId: orgId } }),
        prisma.organizationUser.count({ where: { organizationId: orgId } }),
        prisma.message.count({
          where: {
            direction: 'OUTBOUND',
            conversation: { organizationId: orgId },
          },
        }),
        prisma.campaign.count({
          where: { organizationId: orgId, templateName: { not: '' } },
        }),
      ]);

    const hasTemplateSignal = campaignsWithTemplate > 0;

    const steps: OnboardingStep[] = [
      {
        id: 'connect_whatsapp',
        title: 'Connect WhatsApp',
        description: 'Link your WhatsApp Business number via Meta Embedded Signup',
        completed: whatsappNumbers > 0,
        href: '/settings?tab=whatsapp',
      },
      {
        id: 'approve_template',
        title: 'Add a message template',
        description: 'Create a template in Templates or use one in a campaign',
        completed: hasTemplateSignal,
        href: '/templates',
      },
      {
        id: 'send_test_message',
        title: 'Send a test message',
        description: 'Send your first outbound message to verify the connection',
        completed: testMessage > 0,
        href: '/inbox',
      },
      {
        id: 'import_contacts',
        title: 'Add contacts',
        description: 'Import or create at least one contact',
        completed: contacts > 0,
        href: '/contacts',
      },
    ];

    const completedCount = steps.filter((s) => s.completed).length;
    const progress = Math.round((completedCount / steps.length) * 100);
    const isReady = whatsappNumbers > 0 && testMessage > 0;

    sendSuccess(res, {
      steps,
      progress,
      isReady,
      completedCount,
      totalSteps: steps.length,
      stats: {
        whatsappNumbers,
        templateCount: campaignsWithTemplate,
        contacts,
        teamMembers,
        testMessage,
        approvedTemplate: campaignsWithTemplate,
      },
    });
  })
);

router.post(
  '/complete-step',
  authenticate,
  requireOrg,
  requireAdminOnMutation,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const { stepId } = req.body as { stepId: string };
    if (!stepId || !ALLOWED_ONBOARDING_STEPS.has(stepId)) {
      throw new AppError(400, 'Unknown onboarding step');
    }

    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    const settings = (org?.settings as Record<string, unknown>) || {};
    const onboarding = (settings.onboarding as Record<string, unknown>) || {};
    onboarding[stepId] = { completedAt: new Date().toISOString() };

    await prisma.organization.update({
      where: { id: orgId },
      data: { settings: { ...settings, onboarding } as object },
    });

    sendSuccess(res, { stepId, completed: true });
  })
);

export default router;
