import type { MessageMediaMetadata } from '../media/download.service';

interface ParsedInboundMessage {
  content: string;
  buttonReplyId?: string;
  waFlowResponse?: Record<string, unknown>;
  metadata?: MessageMediaMetadata;
}

export function parseInboundMessage(msg: Record<string, unknown>): ParsedInboundMessage {
  const msgType = (msg.type as string | undefined)?.toLowerCase() || 'text';

  if (msgType === 'text') {
    return { content: (msg.text as { body?: string } | undefined)?.body || '' };
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
      return {
        content: interactive.nfm_reply.body || 'Form submitted',
        waFlowResponse,
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
      },
    };
  }

  return { content: `[${msgType}]` };
}
