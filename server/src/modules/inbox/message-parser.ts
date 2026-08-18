import type { MessageMediaMetadata } from '../media/download.service';
import { describeUnsupportedType } from './unsupported-message';

export interface ParsedInboundMessage {
  content: string;
  replyToMetaId?: string;
  reaction?: { messageId: string; emoji: string };
  buttonReplyId?: string;
  waFlowResponse?: Record<string, unknown>;
  referral?: Record<string, unknown>;
  orderPayload?: {
    catalogId: string;
    productItems: Array<{
      product_retailer_id: string;
      quantity: number;
      item_price?: number;
      currency?: string;
    }>;
    text?: string;
  };
  callPermissionStatus?: string;
  location?: { latitude: number; longitude: number; name?: string; address?: string };
  contacts?: Array<{ name: string; phone: string; email?: string }>;
  metadata?: MessageMediaMetadata & {
    isSticker?: boolean;
    isUnsupported?: boolean;
    unsupportedType?: string;
    metaErrorCode?: number;
    metaErrorTitle?: string;
  };
}

function parseInboundContent(msg: Record<string, unknown>): ParsedInboundMessage {
  const msgType = (msg.type as string | undefined)?.toLowerCase() || 'text';

  if (msgType === 'unsupported') {
    const unsupported = msg.unsupported as { type?: string } | undefined;
    const errors = msg.errors as
      | Array<{ code?: number; title?: string; message?: string; error_data?: { details?: string } }>
      | undefined;
    const firstErr = errors?.[0];
    const unsupportedType = unsupported?.type || undefined;
    const described = describeUnsupportedType(unsupportedType);
    return {
      content: described.content,
      metadata: {
        isUnsupported: true,
        unsupportedType: unsupportedType || 'unknown',
        metaErrorCode: firstErr?.code,
        metaErrorTitle: firstErr?.title || firstErr?.message,
      },
    };
  }

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

  if (msgType === 'location') {
    const location = msg.location as
      | { latitude?: number; longitude?: number; name?: string; address?: string }
      | undefined;
    if (
      typeof location?.latitude === 'number' &&
      typeof location?.longitude === 'number' &&
      Number.isFinite(location.latitude) &&
      Number.isFinite(location.longitude)
    ) {
      const label = location.name || location.address || 'Shared location';
      return {
        content: label,
        location: {
          latitude: location.latitude,
          longitude: location.longitude,
          name: location.name,
          address: location.address,
        },
        metadata: {
          location: {
            latitude: location.latitude,
            longitude: location.longitude,
            name: location.name,
            address: location.address,
          },
        } as ParsedInboundMessage['metadata'],
      };
    }
  }

  if (msgType === 'contacts') {
    const raw = (msg.contacts as Array<Record<string, unknown>> | undefined) || [];
    const contacts = raw
      .map((c) => {
        const nameObj = c.name as { formatted_name?: string; first_name?: string } | undefined;
        const phones = c.phones as Array<{ phone?: string; wa_id?: string }> | undefined;
        const emails = c.emails as Array<{ email?: string }> | undefined;
        const name = nameObj?.formatted_name || nameObj?.first_name || 'Contact';
        const phone = phones?.[0]?.phone || phones?.[0]?.wa_id || '';
        const email = emails?.[0]?.email;
        return { name, phone, ...(email ? { email } : {}) };
      })
      .filter((c) => c.name);
    if (contacts.length) {
      return {
        content: contacts.map((c) => c.name).join(', '),
        contacts,
        metadata: { contacts } as ParsedInboundMessage['metadata'],
      };
    }
  }

  if (msgType === 'interactive') {
    const interactive = msg.interactive as
      | {
          type?: string;
          button_reply?: { id?: string; title?: string };
          list_reply?: { id?: string; title?: string };
          nfm_reply?: { response_json?: string; body?: string; name?: string };
          body?: { text?: string };
          call_permission_response?: { status?: string };
        }
      | undefined;

    if (interactive?.type === 'nfm_reply' && interactive.nfm_reply) {
      let waFlowResponse: Record<string, unknown> = {};
      try {
        waFlowResponse = JSON.parse(interactive.nfm_reply.response_json || '{}') as Record<
          string,
          unknown
        >;
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

    if (interactive?.type === 'call_permission_request') {
      return {
        content: interactive.body?.text || 'Call permission requested',
        callPermissionStatus: 'pending',
      };
    }

    if (interactive?.type === 'call_permission_response' && interactive.call_permission_response) {
      const status = interactive.call_permission_response.status || 'unknown';
      return {
        content: status === 'granted' ? 'Call permission granted' : 'Call permission denied',
        callPermissionStatus: status,
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

    return {
      content: 'Interactive message',
      metadata: {
        isUnsupported: true,
        unsupportedType: interactive?.type || 'interactive',
      },
    };
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
    // Prefer real caption; never put the filename in content (Inbox would show it under the media).
    const content =
      caption ||
      (msgType === 'sticker'
        ? '[sticker]'
        : msgType === 'image'
          ? '[image]'
          : msgType === 'video'
            ? '[video]'
            : msgType === 'audio'
              ? '[audio]'
              : filename || '[document]');

    if (!media?.id) {
      return { content: content || `${msgType} (unavailable)` };
    }

    return {
      content,
      metadata: {
        mediaId: media.id,
        mimeType: media.mime_type,
        filename,
        caption: caption || undefined,
        ...(msgType === 'sticker' ? { isSticker: true } : {}),
        ...((media.mime_type || '').toLowerCase().includes('gif') ||
        (filename || '').toLowerCase().endsWith('.gif')
          ? { isGif: true }
          : {}),
      },
    };
  }

  const described = describeUnsupportedType(msgType);
  return {
    content: described.content,
    metadata: {
      isUnsupported: true,
      unsupportedType: msgType,
    },
  };
}

export function parseInboundMessage(msg: Record<string, unknown>): ParsedInboundMessage {
  const parsed = parseInboundContent(msg);
  const replyToMetaId = (msg.context as { id?: string } | undefined)?.id;
  return replyToMetaId ? { ...parsed, replyToMetaId } : parsed;
}
