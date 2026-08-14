import prisma from '../../config/database';
import logger from '../../utils/logger';
import { parseActiveFlow } from '../flows/flow-state';

export interface NfmReplyPayload {
  flow_token?: string;
  response_json?: string;
  body?: string;
  name?: string;
}

export interface NfmWebhookBody {
  entry?: Array<{
    changes?: Array<{
      value?: {
        messages?: Array<{
          from?: string;
          interactive?: {
            type?: string;
            nfm_reply?: NfmReplyPayload;
          };
        }>;
        metadata?: { phone_number_id?: string };
      };
    }>;
  }>;
  // Direct payload for testing
  nfm_reply?: NfmReplyPayload;
  flow_token?: string;
  response_json?: string;
}

function parseNfmReply(body: NfmWebhookBody): {
  flowToken?: string;
  waFlowResponse: Record<string, unknown>;
  contactPhone?: string;
  phoneNumberId?: string;
} | null {
  if (body.nfm_reply || body.flow_token || body.response_json) {
    const reply = body.nfm_reply || body;
    let waFlowResponse: Record<string, unknown> = {};
    try {
      waFlowResponse = JSON.parse(reply.response_json || '{}') as Record<string, unknown>;
    } catch {
      waFlowResponse = {};
    }
    const flowToken =
      (reply.flow_token as string | undefined) ||
      (waFlowResponse.flow_token as string | undefined);
    return { flowToken, waFlowResponse, contactPhone: undefined, phoneNumberId: undefined };
  }

  for (const entry of body.entry || []) {
    for (const change of entry.changes || []) {
      const value = change.value;
      const phoneNumberId = value?.metadata?.phone_number_id;
      for (const msg of value?.messages || []) {
        const nfm = msg.interactive?.nfm_reply;
        if (!nfm) continue;
        let waFlowResponse: Record<string, unknown> = {};
        try {
          waFlowResponse = JSON.parse(nfm.response_json || '{}') as Record<string, unknown>;
        } catch {
          waFlowResponse = {};
        }
        const flowToken =
          nfm.flow_token ||
          (waFlowResponse.flow_token as string | undefined);
        return {
          flowToken,
          waFlowResponse,
          contactPhone: msg.from,
          phoneNumberId,
        };
      }
    }
  }

  return null;
}

function conversationIdFromToken(flowToken?: string): string | null {
  if (!flowToken) return null;
  const parts = flowToken.split(':');
  return parts[0] || null;
}

export async function handleNfmReply(body: NfmWebhookBody): Promise<{
  handled: boolean;
  conversationId?: string;
  flowAssetId?: string;
}> {
  const parsed = parseNfmReply(body);
  if (!parsed) return { handled: false };

  const { flowToken, waFlowResponse, contactPhone, phoneNumberId } = parsed;
  const conversationId = conversationIdFromToken(flowToken);

  let flowAssetId: string | undefined;
  const metaFlowId = (waFlowResponse.flow_id || waFlowResponse.flowId) as string | undefined;
  if (metaFlowId) {
    const asset = await prisma.flowAsset.findFirst({
      where: { metaFlowId },
      select: { id: true },
    });
    if (asset) flowAssetId = asset.id;
  }

  if (!conversationId) {
    logger.info('NFM reply received without resolvable conversation', {
      source: 'flows-assets',
      flowToken,
      flowAssetId,
    });
    return { handled: true, flowAssetId };
  }

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { contact: true, whatsappNumber: true },
  });

  if (!conversation?.contact || !conversation.whatsappNumber) {
    logger.warn('NFM reply conversation not found', {
      source: 'flows-assets',
      conversationId,
      flowToken,
    });
    return { handled: false, conversationId };
  }

  if (conversation.contact.optedIn === false) {
    logger.info('NFM reply skipped — contact opted out', {
      source: 'flows-assets',
      conversationId,
    });
    return { handled: true, conversationId, flowAssetId };
  }

  const waiting = parseActiveFlow(conversation.botState);
  if (waiting?.waitingFor !== 'wa_flow') {
    logger.info('NFM reply ignored — conversation is not waiting for a form', {
      source: 'flows-assets',
      conversationId,
      waitingFor: waiting?.waitingFor ?? null,
    });
    return { handled: true, conversationId, flowAssetId };
  }

  const { handleInboundAutomations } = await import('../automation/engine');
  await handleInboundAutomations({
    organizationId: conversation.organizationId,
    conversationId: conversation.id,
    contactId: conversation.contactId,
    messageId: `nfm-${Date.now()}`,
    contactPhone: contactPhone || conversation.contact.phone,
    phoneNumberId: phoneNumberId || conversation.whatsappNumber.phoneNumberId,
    encryptedToken: conversation.whatsappNumber.accessToken,
    content: 'Form submitted',
    isNewConversation: false,
    messageType: 'interactive',
    hasMedia: false,
    waFlowResponse,
  });

  logger.info('NFM reply handed off to flow engine', {
    source: 'flows-assets',
    conversationId,
    flowAssetId,
    flowToken,
  });

  return { handled: true, conversationId, flowAssetId };
}
