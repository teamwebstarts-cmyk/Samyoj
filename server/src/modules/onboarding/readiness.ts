import prisma from '../../config/database';
import { getOrgProfile } from '../settings/org-profile';

export interface ReadinessCheck {
  id: string;
  label: string;
  completed: boolean;
  href?: string;
}

export async function getOrgReadiness(organizationId: string) {
  const [
    whatsappCount,
    templateCount,
    contactCount,
    teamCount,
    org,
    profilePayload,
  ] = await Promise.all([
    prisma.whatsappNumber.count({ where: { organizationId, isActive: true } }),
    prisma.campaign.count({
      where: {
        organizationId,
        templateName: { not: '' },
      },
    }),
    prisma.contact.count({ where: { organizationId } }),
    prisma.organizationUser.count({ where: { organizationId } }),
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { settings: true, companyName: true },
    }),
    getOrgProfile(organizationId),
  ]);

  const settings = (org?.settings as Record<string, unknown>) || {};
  const businessHours = settings.businessHours as { days?: number[] } | undefined;
  const hasBusinessHours = Boolean(businessHours?.days?.length);

  const approvedTemplates = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { settings: true },
  });
  const alerts = ((approvedTemplates?.settings as Record<string, unknown>)?.alerts || {}) as Record<string, unknown>;
  const hasTemplate =
    templateCount > 0 ||
    Boolean((alerts.templateCount as number) > 0) ||
    whatsappCount > 0;

  const profileComplete = profilePayload.completeness.isComplete;

  const checks: ReadinessCheck[] = [
    {
      id: 'whatsapp',
      label: 'WhatsApp connected',
      completed: whatsappCount > 0,
      href: '/settings?tab=whatsapp',
    },
    {
      id: 'profile',
      label: 'Business profile complete',
      completed: profileComplete,
      href: '/settings?tab=profile',
    },
    {
      id: 'template',
      label: 'At least 1 template or campaign',
      completed: hasTemplate,
      href: '/templates',
    },
    {
      id: 'contact',
      label: 'At least 1 contact',
      completed: contactCount > 0,
      href: '/contacts',
    },
    {
      id: 'team',
      label: 'At least 1 team member',
      completed: teamCount >= 1,
      href: '/team',
    },
    {
      id: 'hours',
      label: 'Business hours configured',
      completed: hasBusinessHours,
      href: '/settings?tab=automation',
    },
  ];

  const completedCount = checks.filter((c) => c.completed).length;
  const progress = Math.round((completedCount / checks.length) * 100);

  return {
    checks,
    completedCount,
    totalChecks: checks.length,
    progress,
    isReady: completedCount === checks.length,
  };
}
