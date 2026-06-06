import type { MessageMediaMetadata } from '../media/download.service';

interface ParsedInboundMessage {
  content: string;
  metadata?: MessageMediaMetadata;
}

export function parseInboundMessage(msg: Record<string, unknown>): ParsedInboundMessage {
  const msgType = (msg.type as string | undefined)?.toLowerCase() || 'text';

  if (msgType === 'text') {
    return { content: (msg.text as { body?: string } | undefined)?.body || '' };
  }

  if (msgType === 'button') {
    return { content: (msg.button as { text?: string } | undefined)?.text || '' };
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
