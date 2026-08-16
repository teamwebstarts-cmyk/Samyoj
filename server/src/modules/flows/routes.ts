import { Router, Request, Response } from 'express';
import prisma from '../../config/database';
import { authenticate, requireOrg, loadOrgRole, requireOrgRole } from '../../middleware/auth';
import { AppError, sendSuccess, asyncHandler, paramId } from '../../utils/response';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { FLOW_TEMPLATES } from './types';
import { validateFlowGraph } from './validation';
import { getFlowAnalytics } from './analytics';
import { simulateFlow } from './simulate';
import {
  getFlowVersions,
  publishFlowDraft,
  restoreFlowVersion,
  saveFlowDraft,
  saveFlowVersion,
} from './versioning';
import type { FlowNode } from './types';
import { emitProductEvent } from '../platform/events';

const router = Router();
const memberGuard = [authenticate, requireOrg] as const;
const adminGuard = [authenticate, requireOrg, loadOrgRole, requireOrgRole('OWNER', 'ADMIN')] as const;

const nodeTypes = [
  'message', 'buttons', 'list', 'question', 'tag', 'remove_tag', 'handoff', 'ai', 'assign', 'condition', 'end',
  'template', 'delay', 'schedule', 'media', 'webhook', 'ab_split', 'language',
  'set_variable', 'goto_flow', 'goto_step', 'request_callback', 'location', 'contact_card', 'wa_flow',
] as const;

const triggerTypes = [
  'WELCOME', 'KEYWORD', 'ANY_MESSAGE', 'BUSINESS_HOURS', 'OFF_HOURS', 'CONTACT_TAG', 'SEGMENT', 'MISSED_CALL',
  'CAMPAIGN_REPLY', 'CALL_COMPLETED',
] as const;

const intentRouteSchema = z.object({
  keywords: z.array(z.string().min(1)).min(1),
  branchKey: z.string().min(1),
});

const listRowSchema = z.object({
  id: z.string(),
  title: z.string().max(24),
  description: z.string().max(72).optional(),
});

/** Treat blank strings as unset so in-progress flow steps don't fail Zod URL checks. */
function optionalUrl() {
  return z.preprocess(
    (val) => (typeof val === 'string' && val.trim() === '' ? undefined : val),
    z.string().url().optional()
  );
}

const flowNodeSchema = z.object({
  id: z.string().min(1),
  type: z.enum(nodeTypes),
  text: z.string().optional(),
  buttonMode: z.enum(['reply', 'url', 'call']).optional(),
  ctaLabel: z.string().max(20).optional(),
  ctaUrl: optionalUrl(),
  ctaPhone: z.string().max(20).optional(),
  buttons: z.array(z.object({ id: z.string(), title: z.string().max(20) })).max(3).optional(),
  listButtonLabel: z.string().max(20).optional(),
  listSections: z
    .array(z.object({ title: z.string().max(24).optional(), rows: z.array(listRowSchema).max(10) }))
    .max(10)
    .optional(),
  field: z.enum(['name', 'email', 'phone', 'custom']).optional(),
  customField: z.string().optional(),
  prompt: z.string().optional(),
  tag: z.string().optional(),
  conditionType: z
    .enum(['business_hours', 'has_tag', 'language', 'variable_equals', 'variable_contains', 'webhook_ok'])
    .optional(),
  conditionTag: z.string().optional(),
  conditionVariable: z.string().optional(),
  conditionValue: z.string().optional(),
  languageCode: z.string().optional(),
  maxRetries: z.number().int().min(1).max(5).optional(),
  retryMessage: z.string().optional(),
  acceptMedia: z.boolean().optional(),
  intentRoutes: z.array(intentRouteSchema).max(10).optional(),
  splitRatio: z.number().int().min(1).max(99).optional(),
  next: z.string().optional(),
  branches: z.record(z.string()).optional(),
  templateName: z.string().optional(),
  templateLanguage: z.string().optional(),
  mediaUrl: optionalUrl(),
  mediaType: z.enum(['image', 'document', 'video', 'audio']).optional(),
  mediaCaption: z.string().optional(),
  delaySeconds: z.number().int().min(1).max(86400).optional(),
  scheduleAt: z.string().optional(),
  webhookUrl: optionalUrl(),
  webhookMethod: z.enum(['GET', 'POST']).optional(),
  aiBotId: z.string().optional(),
  assignAgentId: z.string().optional(),
  variableName: z.string().optional(),
  variableValue: z.string().optional(),
  targetFlowId: z.string().optional(),
  targetNodeId: z.string().optional(),
  callbackTag: z.string().optional(),
  webhookVariable: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  locationName: z.string().optional(),
  locationAddress: z.string().optional(),
  contactName: z.string().optional(),
  contactPhone: z.string().optional(),
  contactEmail: z.string().optional(),
  waFlowId: z.string().optional(),
  waFlowToken: z.string().optional(),
  waFlowCta: z.string().optional(),
  waFlowScreen: z.string().optional(),
  position: z.object({ x: z.number(), y: z.number() }).optional(),
});

const flowSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  triggerType: z.enum(triggerTypes),
  triggerConfig: z.record(z.unknown()).default({}),
  nodes: z.array(flowNodeSchema).min(1),
  startNodeId: z.string().optional(),
  enabled: z.boolean().default(true),
  priority: z.number().int().min(0).max(100).default(0),
  status: z.enum(['DRAFT', 'PUBLISHED']).optional(),
});

function withLinkedNodes<T extends { nodes: FlowNode[]; startNodeId?: string | null }>(data: T): T {
  return {
    ...data,
    startNodeId: data.startNodeId || data.nodes[0]?.id,
  };
}

function assertValidFlow(data: z.infer<typeof flowSchema>) {
  const result = validateFlowGraph(
    data.nodes,
    data.triggerType,
    data.triggerConfig as Record<string, unknown>,
    data.startNodeId
  );
  if (!result.valid) {
    throw new AppError(400, result.errors.join('; '));
  }
  return result;
}

router.get('/templates', ...memberGuard, asyncHandler(async (_req, res) => {
  sendSuccess(res, { templates: FLOW_TEMPLATES });
}));

router.get('/', ...memberGuard, asyncHandler(async (req, res) => {
  const orgId = req.user!.organizationId!;
  const { search, enabled, page = '1', limit = '10' } = req.query;
  const where: Prisma.FlowWhereInput = { organizationId: orgId };
    if (search) where.name = { contains: search as string, mode: 'insensitive' };
    if (enabled === 'true') {
      where.enabled = true;
      where.status = 'PUBLISHED';
    }
    if (enabled === 'false') {
      where.OR = [{ enabled: false }, { status: 'DRAFT' }];
    }

  const pageNum = parseInt(page as string);
  const limitNum = parseInt(limit as string);

  const [flows, total, active, paused] = await Promise.all([
    prisma.flow.findMany({
      where,
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
    }),
    prisma.flow.count({ where }),
    prisma.flow.count({ where: { organizationId: orgId, enabled: true, status: 'PUBLISHED' } }),
    prisma.flow.count({
      where: {
        organizationId: orgId,
        NOT: { enabled: true, status: 'PUBLISHED' },
      },
    }),
  ]);

  sendSuccess(res, {
    flows,
    total,
    page: pageNum,
    limit: limitNum,
    summary: { total: active + paused, active, paused },
  });
}));

router.post('/validate', ...memberGuard, asyncHandler(async (req, res) => {
  const data = withLinkedNodes(flowSchema.parse(req.body));
  const result = validateFlowGraph(
    data.nodes,
    data.triggerType,
    data.triggerConfig as Record<string, unknown>,
    data.startNodeId
  );
  sendSuccess(res, result);
}));

router.post('/simulate', ...memberGuard, asyncHandler(async (req, res) => {
  const body = z.object({
    triggerType: z.string(),
    triggerConfig: z.record(z.unknown()).default({}),
    nodes: z.array(flowNodeSchema),
    startNodeId: z.string().optional(),
    message: z.string().default('hello'),
    isNewConversation: z.boolean().default(false),
    contactTags: z.array(z.string()).default([]),
  }).parse(req.body);

  const linked = withLinkedNodes(body);
  const result = await simulateFlow({
    organizationId: req.user!.organizationId!,
    ...linked,
  });
  sendSuccess(res, result);
}));

router.get('/:id', ...memberGuard, asyncHandler(async (req, res) => {
  const flow = await prisma.flow.findFirst({
    where: { id: paramId(req), organizationId: req.user!.organizationId! },
  });
  if (!flow) throw new AppError(404, 'Flow not found');
  sendSuccess(res, flow);
}));

router.get('/:id/analytics', ...memberGuard, asyncHandler(async (req, res) => {
  const analytics = await getFlowAnalytics(paramId(req), req.user!.organizationId!);
  if (!analytics) throw new AppError(404, 'Flow not found');
  sendSuccess(res, analytics);
}));

router.get('/:id/versions', ...memberGuard, asyncHandler(async (req, res) => {
  const versions = await getFlowVersions(paramId(req), req.user!.organizationId!);
  if (!versions) throw new AppError(404, 'Flow not found');
  sendSuccess(res, { versions });
}));

router.post('/:id/duplicate', ...adminGuard, asyncHandler(async (req, res) => {
  const source = await prisma.flow.findFirst({
    where: { id: paramId(req), organizationId: req.user!.organizationId! },
  });
  if (!source) throw new AppError(404, 'Flow not found');

  const flow = await prisma.flow.create({
    data: {
      organizationId: req.user!.organizationId!,
      name: `${source.name} (copy)`,
      description: source.description,
      triggerType: source.triggerType,
      triggerConfig: source.triggerConfig as Prisma.InputJsonValue,
      nodes: source.nodes as Prisma.InputJsonValue,
      startNodeId: source.startNodeId,
      enabled: false,
      priority: source.priority,
      status: 'DRAFT',
    },
  });
  sendSuccess(res, flow, 201);
}));

router.post('/:id/publish', ...adminGuard, asyncHandler(async (req, res) => {
  const note = (req.body as { note?: string }).note;
  const version = await publishFlowDraft(paramId(req), req.user!.organizationId!, note);
  if (!version) throw new AppError(400, 'No draft to publish');
  emitProductEvent({
    organizationId: req.user!.organizationId!,
    name: 'FLOW_PUBLISHED',
  });
  sendSuccess(res, { version });
}));

router.post('/:id/restore/:version', ...adminGuard, asyncHandler(async (req, res) => {
  const version = parseInt(String(req.params.version));
  const restored = await restoreFlowVersion(paramId(req), req.user!.organizationId!, version);
  if (!restored) throw new AppError(404, 'Version not found');
  sendSuccess(res, { restored: true, version });
}));

router.post('/', ...adminGuard, asyncHandler(async (req, res) => {
  const data = withLinkedNodes(flowSchema.parse(req.body));
  assertValidFlow(data);

  const flow = await prisma.flow.create({
    data: {
      organizationId: req.user!.organizationId!,
      name: data.name,
      description: data.description,
      triggerType: data.triggerType,
      triggerConfig: data.triggerConfig as Prisma.InputJsonValue,
      nodes: data.nodes as Prisma.InputJsonValue,
      startNodeId: data.startNodeId,
      enabled: data.enabled,
      priority: data.priority,
      status: data.status || 'PUBLISHED',
    },
  });

  await saveFlowVersion(flow.id, data.nodes, data.triggerType, data.triggerConfig as Record<string, unknown>, 'Initial version');
  if (flow.status === 'PUBLISHED') {
    emitProductEvent({
      organizationId: req.user!.organizationId!,
      name: 'FLOW_PUBLISHED',
    });
  }
  sendSuccess(res, flow, 201);
}));

router.post('/from-template/:templateId', ...adminGuard, asyncHandler(async (req, res) => {
  const templateId = req.params.templateId as string;
  const template = FLOW_TEMPLATES.find((t) => t.id === templateId);
  if (!template) throw new AppError(404, 'Template not found');

  const flow = await prisma.flow.create({
    data: {
      organizationId: req.user!.organizationId!,
      name: template.name,
      description: template.description,
      triggerType: template.triggerType,
      triggerConfig: template.triggerConfig as Prisma.InputJsonValue,
      nodes: template.nodes as unknown as Prisma.InputJsonValue,
      enabled: false,
      status: 'DRAFT',
    },
  });
  sendSuccess(res, flow, 201);
}));

const updateFlowSchema = flowSchema.partial().extend({
  saveAsDraft: z.boolean().optional(),
});

router.patch('/:id', ...adminGuard, asyncHandler(async (req, res) => {
  const id = paramId(req);
  const existing = await prisma.flow.findFirst({
    where: { id, organizationId: req.user!.organizationId! },
  });
  if (!existing) throw new AppError(404, 'Flow not found');

  const data = updateFlowSchema.parse(req.body);

  if (data.saveAsDraft && data.nodes) {
    await saveFlowDraft(id, req.user!.organizationId!, {
      nodes: data.nodes,
      triggerType: data.triggerType,
      triggerConfig: data.triggerConfig as Record<string, unknown>,
      startNodeId: data.startNodeId ?? data.nodes[0]?.id,
    });
    const updated = await prisma.flow.findUnique({ where: { id } });
    sendSuccess(res, updated);
    return;
  }

  const merged = withLinkedNodes({
    name: data.name ?? existing.name,
    triggerType: data.triggerType ?? existing.triggerType,
    triggerConfig: (data.triggerConfig ?? existing.triggerConfig) as Record<string, unknown>,
    nodes: (data.nodes ?? existing.nodes) as FlowNode[],
    startNodeId: data.startNodeId ?? existing.startNodeId,
  });

  if (data.nodes) {
    assertValidFlow({
      name: merged.name,
      triggerType: merged.triggerType as never,
      triggerConfig: merged.triggerConfig,
      nodes: merged.nodes,
      startNodeId: merged.startNodeId ?? undefined,
      enabled: data.enabled ?? existing.enabled,
      priority: data.priority ?? existing.priority,
    });
  }

  const flow = await prisma.flow.update({
    where: { id },
    data: {
      name: data.name,
      description: data.description,
      triggerType: data.triggerType,
      triggerConfig: data.triggerConfig ? (data.triggerConfig as Prisma.InputJsonValue) : undefined,
      nodes: data.nodes ? (data.nodes as unknown as Prisma.InputJsonValue) : undefined,
      startNodeId: data.nodes ? (data.startNodeId ?? merged.startNodeId) : data.startNodeId,
      enabled: data.enabled,
      priority: data.priority,
      status: data.status,
    },
  });

  if (data.nodes && data.status !== 'DRAFT') {
    await saveFlowVersion(id, data.nodes, flow.triggerType, flow.triggerConfig as Record<string, unknown>);
  }

  sendSuccess(res, flow);
}));

router.post('/:id/schedule', ...adminGuard, asyncHandler(async (req, res) => {
  const orgId = req.user!.organizationId!;
  const flowId = paramId(req);
  const { conversationId, delaySeconds = 60 } = req.body as { conversationId?: string; delaySeconds?: number };

  if (!conversationId) throw new AppError(400, 'conversationId is required');

  const flow = await prisma.flow.findFirst({ where: { id: flowId, organizationId: orgId, enabled: true } });
  if (!flow) throw new AppError(404, 'Flow not found');

  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, organizationId: orgId },
    include: { contact: true, whatsappNumber: true },
  });
  if (!conversation?.contact || !conversation.whatsappNumber) {
    throw new AppError(404, 'Conversation not found');
  }

  const { scheduleFlowStart } = await import('./engine');
  await scheduleFlowStart({
    organizationId: orgId,
    flowId,
    conversationId,
    contactId: conversation.contactId,
    contactPhone: conversation.contact.phone,
    phoneNumberId: conversation.whatsappNumber.phoneNumberId,
    encryptedToken: conversation.whatsappNumber.accessToken,
    delayMs: Math.min(Math.max(Number(delaySeconds) * 1000, 1000), 7 * 86400000),
  });

  sendSuccess(res, { scheduled: true, delaySeconds: Number(delaySeconds) });
}));

router.delete('/:id', ...adminGuard, asyncHandler(async (req, res) => {
  await prisma.flow.deleteMany({
    where: { id: paramId(req), organizationId: req.user!.organizationId! },
  });
  sendSuccess(res, { deleted: true });
}));

export default router;
