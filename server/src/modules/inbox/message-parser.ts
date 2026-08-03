import type { MessageMediaMetadata } from '../media/download.service';

export interface ParsedInboundMessage {
  content: string;
  replyToMetaId?: string;
  reaction?: { messageId: string; emoji: string };
  buttonReplyId?: string;
  waFlowResponse?: Record<string, unknown>;
  referral?: Record<string, unknown>;
  orderPayload?: {
    catalogId: string;
    productItems: Array<{ product_retailer_id: string; quantity: number; item_price?: number; currency?: string }>;
    text?: string;
  };
  metadata?: MessageMediaMetadata & { isSticker?: boolean };
}

function parseInboundContent(msg: Record<string, unknown>): ParsedInboundMessage {
  const msgType = (msg.type as string | undefined)?.toLowerCase() || 'text';

  if (msgType === 'reaction') {
    const reaction = msg.reaction as { message_id?: string; emoji?: string } | undefined;
    return {
      content: reaction?.emoji || '',
      ...(reaction?.message_id
        ? { reaction: { messageId: reaction.message_id, emoji: reaction.emoji || '' } }
        : {}),
    };
  }

  if (msgType === 'text') {
    const textBody = (msg.text as { body?: string } | undefined)?.body || '';
    const referral = msg.referral as Record<string, unknown> | undefined;
    return {
      content: textBody,
      ...(referral ? { referral } : {}),
    };
  }

  if (msgType === 'button') {
    const button = msg.button as { text?: string; payload?: string } | undefined;
    return {
      content: button?.text || '',
      buttonReplyId: button?.payload,
    };
  }

  if (msgType === 'interactive') {
    const interactive = msg.interactive as
      | {
          type?: string;
          button_reply?: { id?: string; title?: string };
          list_reply?: { id?: string; title?: string };
          nfm_reply?: { response_json?: string; body?: string; name?: string };
        }
      | undefined;

    if (interactive?.type === 'nfm_reply' && interactive.nfm_reply) {
      let waFlowResponse: Record<string, unknown> = {};
      try {
        waFlowResponse = JSON.parse(interactive.nfm_reply.response_json || '{}') as Record<string, unknown>;
      } catch {
        waFlowResponse = {};
      }
      const flowToken =
        (interactive.nfm_reply as { flow_token?: string }).flow_token ||
        (waFlowResponse.flow_token as string | undefined);
      return {
        content: interactive.nfm_reply.body || 'Form submitted',
        waFlowResponse: {
          ...waFlowResponse,
          ...(flowToken ? { flow_token: flowToken } : {}),
          nfm_name: interactive.nfm_reply.name,
        },
      };
    }

    if (interactive?.button_reply) {
      return {
        content: interactive.button_reply.title || '',
        buttonReplyId: interactive.button_reply.id,
      };
    }

    if (interactive?.list_reply) {
      return {
        content: interactive.list_reply.title || '',
        buttonReplyId: interactive.list_reply.id,
      };
    }
  }

  if (msgType === 'order') {
    const order = msg.order as
      | {
          catalog_id?: string;
          product_items?: Array<{
            product_retailer_id: string;
            quantity: number;
            item_price?: number;
            currency?: string;
          }>;
          text?: string;
        }
      | undefined;

    if (order?.catalog_id && order.product_items?.length) {
      const itemSummary = order.product_items
        .map((i) => `${i.product_retailer_id} x${i.quantity}`)
        .join(', ');
      return {
        content: order.text || `Order: ${itemSummary}`,
        orderPayload: {
          catalogId: order.catalog_id,
          productItems: order.product_items,
          text: order.text,
        },
      };
    }
  }

  const mediaTypes = ['image', 'video', 'audio', 'document', 'sticker'];
  if (mediaTypes.includes(msgType)) {
    const media = msg[msgType] as
      | {
          id?: string;
          mime_type?: string;
          filename?: string;
          caption?: string;
        }
      | undefined;

    const caption = media?.caption?.trim() || '';
    const filename = media?.filename?.trim();
    const content = caption || filename || '';

    if (!media?.id) {
      return { content: content || `[${msgType}]` };
    }

    return {
      content,
      metadata: {
        mediaId: media.id,
        mimeType: media.mime_type,
        filename,
        caption: caption || undefined,
        ...(msgType === 'sticker' ? { isSticker: true } : {}),
      },
    };
  }

  return { content: `[${msgType}]` };
}

export function parseInboundMessage(msg: Record<string, unknown>): ParsedInboundMessage {
  const parsed = parseInboundContent(msg);
  const replyToMetaId = (msg.context as { id?: string } | undefined)?.id;
  return replyToMetaId ? { ...parsed, replyToMetaId } : parsed;
}
