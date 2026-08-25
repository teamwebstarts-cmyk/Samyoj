import prisma from '../../config/database';
import { AppError } from '../../utils/response';
import { normalizePhone } from '../../utils/phone';
import { deliverOutboundMessage } from '../messages/send.service';
import { getActiveWhatsappNumberCredentials } from '../whatsapp/context';
import { hasAuditableCampaignConsent } from '../contacts/consent';
import type { FlowNode } from '../flows/types';
import { linkFlowNodes } from '../flows/link-nodes';
import { syncButtonNode } from '../flows/branch-resolve';
import { findFirstOutboundPreviewNode } from '../flows/preview-send';

export async function sendAutomationTestToPhone(params: {
  organizationId: string;
  whatsappNumberId: string;
  automationId: string;
  phone: string;
}): Promise<{ messageId: string }> {
  const automation = await prisma.automation.findFirst({
    where: {
      id: params.automationId,
      organizationId: params.organizationId,
      whatsappNumberId: params.whatsappNumberId,
    },
  });
  if (!automation) throw new AppError(404, 'Automation not found');

  const normalized = normalizePhone(params.phone);
  const contact = await prisma.contact.findUnique({
    where: {
      organizationId_whatsappNumberId_normalizedPhone: {
        organizationId: params.organizationId,
        whatsappNumberId: params.whatsappNumberId,
        normalizedPhone: normalized,
      },
    },
  });
  if (!contact) {
    throw new AppError(400, 'Add this phone as a contact on this WhatsApp number before sending a test');
  }

  const config = (automation.config || {}) as Record<string, unknown>;
  const content =
    (config.response as string) ||
    (config.message as string) ||
    (config.duringHoursMessage as string) ||
    (config.outsideHoursMessage as string);
  if (!content?.trim()) {
    throw new AppError(400, 'This auto-reply has no message to send');
  }

  const buttons = Array.isArray(config.buttons)
    ? (config.buttons as Array<{ id: string; title: string }>).filter((b) => b.id && b.title)
    : undefined;

  return sendTestOutbound({
    organizationId: params.organizationId,
    whatsappNumberId: params.whatsappNumberId,
    contactId: contact.id,
    phone: contact.phone,
    content: content.trim(),
    buttons: buttons?.length ? buttons.slice(0, 3) : undefined,
    metadata: { source: 'automation_test', automationId: automation.id, automationName: automation.name },
  });
}

export async function sendFlowTestToPhone(params: {
  organizationId: string;
  whatsappNumberId: string;
  flowId: string;
  phone: string;
  nodes?: FlowNode[];
  startNodeId?: string | null;
}): Promise<{ messageId: string; previewNodeId: string }> {
  const flow = await prisma.flow.findFirst({
    where: {
      id: params.flowId,
      organizationId: params.organizationId,
      whatsappNumberId: params.whatsappNumberId,
    },
  });
  if (!flow) throw new AppError(404, 'Flow not found');

  const normalized = normalizePhone(params.phone);
  const contact = await prisma.contact.findUnique({
    where: {
      organizationId_whatsappNumberId_normalizedPhone: {
        organizationId: params.organizationId,
        whatsappNumberId: params.whatsappNumberId,
        normalizedPhone: normalized,
      },
    },
  });
  if (!contact) {
    throw new AppError(400, 'Add this phone as a contact on this WhatsApp number before sending a test');
  }

  const rawNodes = (params.nodes ?? (flow.draftNodes ?? flow.nodes)) as FlowNode[];
  const linked = linkFlowNodes(rawNodes.map(syncButtonNode));
  const preview = findFirstOutboundPreviewNode(linked, params.startNodeId ?? flow.startNodeId);
  if (!preview) {
    throw new AppError(400, 'No sendable step found in this flow — add a message, buttons, or question step first');
  }

  const result = await sendTestOutbound({
    organizationId: params.organizationId,
    whatsappNumberId: params.whatsappNumberId,
    contactId: contact.id,
    phone: contact.phone,
    content: preview.content,
    buttons: preview.buttons,
    metadata: {
      source: 'flow_test',
      flowId: flow.id,
      flowName: flow.name,
      previewNodeId: preview.nodeId,
    },
  });

  return { ...result, previewNodeId: preview.nodeId };
}

async function sendTestOutbound(params: {
  organizationId: string;
  whatsappNumberId: string;
  contactId: string;
  phone: string;
  content: string;
  buttons?: Array<{ id: string; title: string }>;
  metadata: Record<string, unknown>;
}): Promise<{ messageId: string }> {
  const credentials = await getActiveWhatsappNumberCredentials(
    params.organizationId,
    params.whatsappNumberId
  );

  const contact = await prisma.contact.findUnique({
    where: { id: params.contactId },
    select: {
      optedIn: true,
      consentSource: true,
      consentAt: true,
      optOutAt: true,
    },
  });
  if (!contact || !hasAuditableCampaignConsent(contact)) {
    throw new AppError(
      400,
      'Test sends require an existing opted-in contact with recorded consent on this number'
    );
  }

  let conversation = await prisma.conversation.findFirst({
    where: {
      organizationId: params.organizationId,
      whatsappNumberId: credentials.whatsappNumberId,
      contactId: params.contactId,
    },
    select: { id: true },
  });
  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        organizationId: params.organizationId,
        whatsappNumberId: credentials.whatsappNumberId,
        contactId: params.contactId,
        status: 'OPEN',
        botActive: true,
      },
      select: { id: true },
    });
  }

  const hasButtons = Boolean(params.buttons?.length);
  const message = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      direction: 'OUTBOUND',
      type: hasButtons ? 'INTERACTIVE' : 'TEXT',
      content: params.content,
      status: 'PENDING',
      metadata: params.metadata as object,
    },
  });

  await deliverOutboundMessage({
    organizationId: params.organizationId,
    whatsappNumberId: credentials.whatsappNumberId,
    messageId: message.id,
    to: params.phone,
    content: params.content,
    type: hasButtons ? 'INTERACTIVE' : 'TEXT',
    buttons: params.buttons,
    interactive: hasButtons
      ? { mode: 'reply', body: params.content, buttons: params.buttons! }
      : undefined,
  });

  return { messageId: message.id };
}
