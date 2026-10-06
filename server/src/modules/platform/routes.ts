import { Router, type Request, type Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import prisma from '../../config/database';
import { isSmtpConfigured } from '../../services/email.service';
import { decrypt } from '../../utils/crypto';
import { AppError, asyncHandler, sendSuccess } from '../../utils/response';
import {
  consumePlatformAccountThrottle,
  platformAuthLoginLimiter,
} from '../auth/rate-limit';
import { verifyTotp } from '../team/totp';
import { loadOrCreatePendingTotpEnrollment } from './mfa-enrollment';
import {
  isPlatformMfaRequired,
  resolvePlatformPasswordLogin,
} from './mfa-policy';
import {
  loadPlatformSession,
  requirePlatformRouteAccess,
  requireSessionBoundPlatformMutation,
} from './middleware';
import { requirePlatformPermission } from './rbac';
import {
  clearPlatformSessionCookies,
  hashPlatformToken,
  randomOpaqueToken,
  requirePlatformMutationOrigin,
  setPlatformCsrfCookie,
  setPlatformSessionCookies,
} from './security';
import {
  authenticatedPlatformSessionExpiry,
  createPlatformSession,
  platformSessionToken,
  revokePlatformSession,
  rotatePlatformCsrf,
} from './session';
import { getPlatformOrg, getPlatformOverview, listPlatformOrgs, patchPlatformOrgAi, patchPlatformOrgBilling, patchPlatformOrgFlags } from './orgs';
import {
  getPlatformSettings,
  getSubscriptionEnforcement,
  patchPlatformSettings,
  putSubscriptionEnforcement,
} from './settings';
import {
  createAdminLibraryTemplate,
  deleteAdminLibraryTemplate,
  listAdminLibraryTemplates,
  patchAdminLibraryTemplate,
  type LibraryTemplateWriteInput,
} from '../templates/catalog-store';
import { listPlatformAudit, listPlatformErrors } from './errors';
import { listOutreachQueues, sendOrgOutreach } from './outreach';
import {
  createPlatformOperator,
  listPlatformOperators,
  listPlatformSessions,
  patchPlatformOperator,
  revokeManagedPlatformSession,
} from './operators';
import { ACTIVATION_STAGES } from './stage';

const router = Router();

const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(128),
  totpCode: z.string().regex(/^\d{6}$/).optional(),
});

const totpSchema = z.object({
  code: z.string().regex(/^\d{6}$/),
});

let dummyPasswordHash: Promise<string> | undefined;

function getDummyPasswordHash(): Promise<string> {
  dummyPasswordHash ??= bcrypt.hash('not-a-valid-platform-password', 12);
  return dummyPasswordHash;
}

function publicOperator(operator: {
  id: string;
  email: string;
  role: string;
  mfaEnabledAt: Date | null;
}) {
  return {
    id: operator.id,
    email: operator.email,
    role: operator.role,
    mfaEnabled: Boolean(operator.mfaEnabledAt),
  };
}

router.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

// Origin validation includes login. Session-bound CSRF covers every mutation
// except the exact pre-session login endpoint.
router.use(requirePlatformMutationOrigin);
router.use(requireSessionBoundPlatformMutation);
// Exact pre-MFA auth exemptions are declared in this guard. Every other path
// requires a fully MFA-verified session before route matching or RBAC.
router.use(requirePlatformRouteAccess);

router.post(
  '/auth/login',
  platformAuthLoginLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const data = loginSchema.parse(req.body);
    const email = data.email.toLowerCase().trim();

    if (
      !(await consumePlatformAccountThrottle(
        `platform-login:${email}`,
        8,
        15 * 60
      ))
    ) {
      throw new AppError(
        429,
        'Too many platform login attempts. Try again in 15 minutes.'
      );
    }

    const operator = await prisma.platformOperator.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        role: true,
        totpSecretEncrypted: true,
        mfaEnabledAt: true,
        disabledAt: true,
      },
    });

    const passwordHash = operator?.passwordHash ?? (await getDummyPasswordHash());
    const passwordValid = await bcrypt.compare(data.password, passwordHash);
    if (!operator || !passwordValid || operator.disabledAt) {
      clearPlatformSessionCookies(res);
      throw new AppError(401, 'Invalid platform credentials');
    }

    const mfaRequired = isPlatformMfaRequired();
    const totpValid =
      mfaRequired && data.totpCode && operator.totpSecretEncrypted
        ? verifyTotp(decrypt(operator.totpSecretEncrypted), data.totpCode)
        : false;
    const outcome = resolvePlatformPasswordLogin({
      mfaRequired,
      mfaEnabledAt: operator.mfaEnabledAt,
      totpSecretEncrypted: operator.totpSecretEncrypted,
      totpCode: data.totpCode,
      totpValid,
    });

    if (outcome.status === 'AUTHENTICATED') {
      const session = await createPlatformSession(operator.id, true);
      setPlatformSessionCookies(
        res,
        session.sessionToken,
        session.csrfToken,
        session.expiresAt
      );
      sendSuccess(res, {
        state: 'AUTHENTICATED',
        operator: publicOperator(operator),
        csrfToken: session.csrfToken,
      });
      return;
    }

    if (outcome.status === 'MFA_ENROLLMENT_REQUIRED') {
      const enrollment = await loadOrCreatePendingTotpEnrollment({
        operatorId: operator.id,
        email: operator.email,
        totpSecretEncrypted: operator.totpSecretEncrypted,
        mfaEnabledAt: operator.mfaEnabledAt,
      });

      const session = await createPlatformSession(operator.id, false);
      setPlatformSessionCookies(
        res,
        session.sessionToken,
        session.csrfToken,
        session.expiresAt
      );

      sendSuccess(res, {
        state: 'MFA_ENROLLMENT_REQUIRED',
        operator: publicOperator(operator),
        enrollment,
        csrfToken: session.csrfToken,
      });
      return;
    }

    if (outcome.status === 'INVALID_CONFIG') {
      clearPlatformSessionCookies(res);
      throw new AppError(403, 'Platform MFA configuration is invalid');
    }

    if (outcome.status === 'INVALID_MFA') {
      clearPlatformSessionCookies(res);
      throw new AppError(401, 'Invalid platform credentials or MFA code');
    }

    clearPlatformSessionCookies(res);
    sendSuccess(res, { state: 'MFA_REQUIRED' });
  })
);

router.post(
  '/auth/mfa/enroll',
  asyncHandler(async (req: Request, res: Response) => {
    const { code } = totpSchema.parse(req.body);
    const operator = await prisma.platformOperator.findUnique({
      where: { id: req.platformOperator!.id },
      select: {
        id: true,
        email: true,
        role: true,
        totpSecretEncrypted: true,
        mfaEnabledAt: true,
      },
    });

    if (!operator) throw new AppError(401, 'Platform operator not found');
    if (operator.mfaEnabledAt) {
      throw new AppError(409, 'Platform MFA is already enrolled');
    }
    if (!operator.totpSecretEncrypted) {
      throw new AppError(400, 'Start platform login before MFA enrollment');
    }
    if (!verifyTotp(decrypt(operator.totpSecretEncrypted), code)) {
      throw new AppError(400, 'Invalid MFA verification code');
    }

    const now = new Date();
    const expiresAt = authenticatedPlatformSessionExpiry(now);
    const csrfToken = randomOpaqueToken();

    await prisma.$transaction([
      prisma.platformOperator.update({
        where: { id: operator.id },
        data: { mfaEnabledAt: now },
      }),
      prisma.platformSession.update({
        where: { id: req.platformSession!.id },
        data: {
          mfaVerifiedAt: now,
          expiresAt,
          csrfTokenHash: hashPlatformToken(csrfToken),
        },
      }),
      prisma.platformAuditLog.create({
        data: {
          operatorId: operator.id,
          action: 'PLATFORM_MFA_ENROLLED',
          targetType: 'PlatformOperator',
          targetId: operator.id,
          afterState: { mfaEnabled: true },
        },
      }),
    ]);

    const sessionToken = platformSessionToken(req);
    if (!sessionToken) {
      throw new AppError(401, 'Platform authentication required');
    }
    setPlatformSessionCookies(res, sessionToken, csrfToken, expiresAt);

    sendSuccess(res, {
      state: 'AUTHENTICATED',
      operator: {
        ...publicOperator(operator),
        mfaEnabled: true,
      },
      csrfToken,
    });
  })
);

router.post(
  '/auth/mfa/reset-enrollment',
  asyncHandler(async (req: Request, res: Response) => {
    const operator = await prisma.platformOperator.findUnique({
      where: { id: req.platformOperator!.id },
      select: {
        id: true,
        email: true,
        totpSecretEncrypted: true,
        mfaEnabledAt: true,
      },
    });
    if (!operator) throw new AppError(401, 'Platform operator not found');

    const enrollment = await loadOrCreatePendingTotpEnrollment({
      operatorId: operator.id,
      email: operator.email,
      totpSecretEncrypted: operator.totpSecretEncrypted,
      mfaEnabledAt: operator.mfaEnabledAt,
      rotate: true,
    });

    sendSuccess(res, {
      state: 'MFA_ENROLLMENT_REQUIRED',
      enrollment,
    });
  })
);

router.get(
  '/auth/csrf',
  loadPlatformSession,
  asyncHandler(async (req: Request, res: Response) => {
    const rotated = await rotatePlatformCsrf(
      req.platformSession!.id,
      req.platformSession!.expiresAt
    );
    setPlatformCsrfCookie(res, rotated.csrfToken, rotated.expiresAt);
    sendSuccess(res, { csrfToken: rotated.csrfToken });
  })
);

router.get(
  '/auth/me',
  asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, {
      operator: publicOperator(req.platformOperator!),
    });
  })
);

router.post(
  '/auth/logout',
  asyncHandler(async (req: Request, res: Response) => {
    await revokePlatformSession(req.platformSession!.id);
    clearPlatformSessionCookies(res);
    sendSuccess(res, { message: 'Logged out' });
  })
);

const reasonSchema = z.string().trim().min(8).max(500);
const orgIdParam = z.string().uuid();

router.get(
  '/overview',
  requirePlatformPermission('platform.read'),
  asyncHandler(async (_req: Request, res: Response) => {
    sendSuccess(res, await getPlatformOverview());
  })
);

router.get(
  '/orgs',
  requirePlatformPermission('organization.read'),
  asyncHandler(async (req: Request, res: Response) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : undefined;
    const rawStage = typeof req.query.stage === 'string' ? req.query.stage : undefined;
    const stage = ACTIVATION_STAGES.includes(rawStage as (typeof ACTIVATION_STAGES)[number])
      ? (rawStage as (typeof ACTIVATION_STAGES)[number])
      : undefined;
    const page = Number(req.query.page || 1);
    sendSuccess(
      res,
      await listPlatformOrgs({
        q: q || undefined,
        stage,
        page,
      })
    );
  })
);

router.get(
  '/orgs/:id',
  requirePlatformPermission('organization.read'),
  asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await getPlatformOrg(orgIdParam.parse(req.params.id)));
  })
);

router.get(
  '/orgs/:id/ai',
  requirePlatformPermission('organization.read'),
  asyncHandler(async (req: Request, res: Response) => {
    const detail = await getPlatformOrg(orgIdParam.parse(req.params.id));
    sendSuccess(res, detail.ai);
  })
);

router.patch(
  '/orgs/:id/ai',
  requirePlatformPermission('organization.write'),
  asyncHandler(async (req: Request, res: Response) => {
    const body = z
      .object({
        reason: reasonSchema,
        monthlyTokenLimit: z.number().int().min(0).max(1_000_000_000).nullable().optional(),
        chatEnabled: z.boolean().optional(),
        callingEnabled: z.boolean().optional(),
        customChatCreditsIncluded: z.number().int().min(0).max(1_000_000_000).optional(),
        customCallingMinutesIncluded: z.number().int().min(0).max(1_000_000).optional(),
        grantChatAddon: z.number().int().min(0).max(100_000_000).optional(),
        grantCallingAddon: z.number().int().min(0).max(1_000_000).optional(),
      })
      .parse(req.body);
    sendSuccess(
      res,
      await patchPlatformOrgAi({
        organizationId: orgIdParam.parse(req.params.id),
        operatorId: req.platformOperator!.id,
        ...body,
      })
    );
  })
);

router.patch(
  '/orgs/:id/flags',
  requirePlatformPermission('organization.write'),
  asyncHandler(async (req: Request, res: Response) => {
    const body = z
      .object({
        reason: reasonSchema,
        flag: z.string().min(1).max(64),
        enabled: z.boolean(),
        dailyMessageCap: z.number().int().min(1).max(100_000).nullable().optional(),
      })
      .parse(req.body);
    sendSuccess(
      res,
      await patchPlatformOrgFlags({
        organizationId: orgIdParam.parse(req.params.id),
        operatorId: req.platformOperator!.id,
        ...body,
      })
    );
  })
);

router.patch(
  '/orgs/:id/billing',
  requirePlatformPermission('organization.write'),
  asyncHandler(async (req: Request, res: Response) => {
    const body = z
      .object({
        reason: reasonSchema,
        plan: z.enum(['launch', 'starter', 'growth', 'pro', 'enterprise']).optional(),
        planExpiresAt: z.string().datetime().nullable().optional(),
        subscriptionStatus: z
          .enum([
            'trial',
            'active',
            'complimentary',
            'grace',
            'trial_expired',
            'expired',
            'past_due',
            'locked',
            'cancelled',
          ])
          .optional(),
      })
      .parse(req.body);
    sendSuccess(
      res,
      await patchPlatformOrgBilling({
        organizationId: orgIdParam.parse(req.params.id),
        operatorId: req.platformOperator!.id,
        reason: body.reason,
        plan: body.plan,
        planExpiresAt:
          body.planExpiresAt === undefined
            ? undefined
            : body.planExpiresAt
              ? new Date(body.planExpiresAt)
              : null,
        subscriptionStatus: body.subscriptionStatus,
      })
    );
  })
);

router.get(
  '/errors',
  requirePlatformPermission('errors.read'),
  asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(
      res,
      await listPlatformErrors({
        organizationId:
          typeof req.query.organizationId === 'string'
            ? orgIdParam.parse(req.query.organizationId)
            : undefined,
        days: req.query.days ? Number(req.query.days) : undefined,
      })
    );
  })
);

router.get(
  '/outreach',
  requirePlatformPermission('outreach.send'),
  asyncHandler(async (_req: Request, res: Response) => {
    sendSuccess(res, await listOutreachQueues());
  })
);

router.get(
  '/orgs/:id/outreach',
  requirePlatformPermission('organization.read'),
  asyncHandler(async (req: Request, res: Response) => {
    const organizationId = orgIdParam.parse(req.params.id);
    const rows = await prisma.outreachLog.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: 40,
      select: {
        id: true,
        templateId: true,
        channel: true,
        status: true,
        errorCode: true,
        sentAt: true,
        createdAt: true,
      },
    });
    sendSuccess(res, { smtpConfigured: isSmtpConfigured(), rows });
  })
);

router.post(
  '/orgs/:id/outreach',
  requirePlatformPermission('outreach.send'),
  asyncHandler(async (req: Request, res: Response) => {
    const body = z
      .object({
        reason: reasonSchema,
        templateId: z.string().min(1).max(64),
        channel: z.literal('email').optional(),
      })
      .strict()
      .parse(req.body);
    sendSuccess(
      res,
      await sendOrgOutreach({
        organizationId: orgIdParam.parse(req.params.id),
        operatorId: req.platformOperator!.id,
        templateId: body.templateId,
        reason: body.reason,
      })
    );
  })
);

router.get(
  '/operators',
  requirePlatformPermission('operators.manage'),
  asyncHandler(async (_req: Request, res: Response) => {
    sendSuccess(res, { operators: await listPlatformOperators() });
  })
);

router.post(
  '/operators',
  requirePlatformPermission('operators.manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const body = z
      .object({
        reason: reasonSchema,
        email: z.string().email().max(255),
        password: z.string().min(8).max(128),
        role: z.enum(['SUPER_ADMIN', 'SUPPORT', 'ANALYST']),
      })
      .parse(req.body);
    sendSuccess(
      res,
      await createPlatformOperator({
        actorId: req.platformOperator!.id,
        ...body,
      }),
      201
    );
  })
);

router.patch(
  '/operators/:id',
  requirePlatformPermission('operators.manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const body = z
      .object({
        reason: reasonSchema,
        role: z.enum(['SUPER_ADMIN', 'SUPPORT', 'ANALYST']).optional(),
        disabled: z.boolean().optional(),
      })
      .parse(req.body);
    sendSuccess(
      res,
      await patchPlatformOperator({
        actorId: req.platformOperator!.id,
        operatorId: z.string().uuid().parse(req.params.id),
        ...body,
      })
    );
  })
);

router.get(
  '/sessions',
  requirePlatformPermission('sessions.manage'),
  asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(
      res,
      {
        sessions: await listPlatformSessions({
          actorId: req.platformOperator!.id,
          actorRole: req.platformOperator!.role,
          currentSessionId: req.platformSession!.id,
        }),
      }
    );
  })
);

router.delete(
  '/sessions/:id',
  requirePlatformPermission('sessions.manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const body = z.object({ reason: reasonSchema }).parse(req.body ?? {});
    sendSuccess(
      res,
      await revokeManagedPlatformSession({
        actorId: req.platformOperator!.id,
        actorRole: req.platformOperator!.role,
        sessionId: z.string().uuid().parse(req.params.id),
        currentSessionId: req.platformSession!.id,
        reason: body.reason,
      })
    );
  })
);

router.get(
  '/audit',
  requirePlatformPermission('audit.read'),
  asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(
      res,
      await listPlatformAudit({
        organizationId:
          typeof req.query.organizationId === 'string'
            ? orgIdParam.parse(req.query.organizationId)
            : undefined,
        action: typeof req.query.action === 'string' ? req.query.action : undefined,
        page: req.query.page ? Number(req.query.page) : undefined,
      })
    );
  })
);

router.get('/settings', getPlatformSettings);
router.put('/settings', patchPlatformSettings);
router.get('/settings/subscription-enforcement', getSubscriptionEnforcement);
router.put('/settings/subscription-enforcement', putSubscriptionEnforcement);

const catalogButtonSchema = z.object({
  type: z.enum(['URL', 'PHONE_NUMBER', 'COPY_CODE', 'QUICK_REPLY']),
  text: z.string().min(1).max(25),
  url: z.string().max(2000).optional(),
  phone_number: z.string().max(20).optional(),
  example: z.string().max(15).optional(),
});

const libraryTemplateFields = {
  slug: z
    .string()
    .regex(/^[a-z0-9_]{3,64}$/, 'Slug must be lowercase letters, numbers, and underscores'),
  title: z.string().trim().min(1).max(80),
  category: z.enum(['UTILITY', 'MARKETING', 'AUTHENTICATION']),
  tags: z.array(z.string().trim().min(1).max(32)).max(20).default([]),
  icon: z.string().trim().min(1).max(32).default('file'),
  header: z.string().max(60).nullable().optional(),
  mediaFormat: z.enum(['IMAGE', 'VIDEO', 'DOCUMENT']).nullable().optional(),
  body: z.string().min(1).max(1024),
  bodyHi: z.string().min(1).max(1024),
  footer: z.string().max(60).nullable().optional(),
  footerHi: z.string().max(60).nullable().optional(),
  buttons: z.array(catalogButtonSchema).max(10).default([]),
  bodyExamples: z.array(z.string().max(200)).max(10).default([]),
  copy: z.string().max(240).default(''),
  published: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(9999).default(0),
};

router.get(
  '/library-templates',
  requirePlatformPermission('platform.read'),
  asyncHandler(async (_req: Request, res: Response) => {
    sendSuccess(res, { templates: await listAdminLibraryTemplates() });
  })
);

router.post(
  '/library-templates',
  requirePlatformPermission('organization.write'),
  asyncHandler(async (req: Request, res: Response) => {
    const body = z
      .object({
        reason: reasonSchema,
        ...libraryTemplateFields,
      })
      .parse(req.body);
    const { reason, ...data } = body;
    sendSuccess(
      res,
      await createAdminLibraryTemplate({
        actorId: req.platformOperator!.id,
        reason,
        data: data as LibraryTemplateWriteInput,
      }),
      201
    );
  })
);

router.patch(
  '/library-templates/:id',
  requirePlatformPermission('organization.write'),
  asyncHandler(async (req: Request, res: Response) => {
    const body = z
      .object({
        reason: reasonSchema,
        slug: libraryTemplateFields.slug.optional(),
        title: libraryTemplateFields.title.optional(),
        category: libraryTemplateFields.category.optional(),
        tags: libraryTemplateFields.tags.optional(),
        icon: libraryTemplateFields.icon.optional(),
        header: libraryTemplateFields.header,
        mediaFormat: libraryTemplateFields.mediaFormat,
        body: libraryTemplateFields.body.optional(),
        bodyHi: libraryTemplateFields.bodyHi.optional(),
        footer: libraryTemplateFields.footer,
        footerHi: libraryTemplateFields.footerHi,
        buttons: libraryTemplateFields.buttons.optional(),
        bodyExamples: libraryTemplateFields.bodyExamples.optional(),
        copy: libraryTemplateFields.copy.optional(),
        published: libraryTemplateFields.published.optional(),
        sortOrder: libraryTemplateFields.sortOrder.optional(),
      })
      .parse(req.body);
    const { reason, ...data } = body;
    sendSuccess(
      res,
      await patchAdminLibraryTemplate({
        actorId: req.platformOperator!.id,
        reason,
        id: z.string().uuid().parse(req.params.id),
        data: data as Partial<LibraryTemplateWriteInput>,
      })
    );
  })
);

router.delete(
  '/library-templates/:id',
  requirePlatformPermission('organization.write'),
  asyncHandler(async (req: Request, res: Response) => {
    const body = z.object({ reason: reasonSchema }).parse(req.body ?? {});
    sendSuccess(
      res,
      await deleteAdminLibraryTemplate({
        actorId: req.platformOperator!.id,
        reason: body.reason,
        id: z.string().uuid().parse(req.params.id),
      })
    );
  })
);

export default router;

