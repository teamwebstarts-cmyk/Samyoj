import { formatMessageTime, messageHasMedia } from './inboxUtils';
import {
  AuthenticatedAudio,
  AuthenticatedDocument,
  AuthenticatedImage,
  AuthenticatedVideo,
} from './AuthenticatedMedia';
import { WhatsAppBubble } from './WhatsAppPreview';
import type { Message } from '../../types';

interface MessageBubbleProps {
  message: Message;
}

function mapStatus(status: string): 'sent' | 'delivered' | 'read' | 'failed' {
  const normalized = status.toUpperCase();
  if (normalized === 'FAILED') return 'failed';
  if (normalized === 'READ') return 'read';
  if (normalized === 'DELIVERED') return 'delivered';
  return 'sent';
}

function MediaUnavailable({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center bg-[#f0f2f5] px-3 py-6 text-[12px] text-[#667781]">
      {label}
    </div>
  );
}

function renderMediaContent(message: Message) {
  const type = message.type?.toUpperCase();
  const hasMedia = messageHasMedia(message);

  if (!hasMedia) {
    if (type === 'IMAGE') return <MediaUnavailable label="Photo unavailable" />;
    if (type === 'VIDEO') return <MediaUnavailable label="Video unavailable" />;
    if (type === 'AUDIO') return <MediaUnavailable label="Voice message unavailable" />;
    if (type === 'DOCUMENT') {
      return (
        <MediaUnavailable label={message.metadata?.filename || message.content || 'Document unavailable'} />
      );
    }
    return null;
  }

  switch (type) {
    case 'IMAGE':
      return <AuthenticatedImage messageId={message.id} alt={message.content || 'Photo'} />;
    case 'VIDEO':
      return <AuthenticatedVideo messageId={message.id} />;
    case 'AUDIO':
      return <AuthenticatedAudio messageId={message.id} />;
    case 'DOCUMENT':
      return (
        <AuthenticatedDocument
          messageId={message.id}
          filename={message.metadata?.filename || message.content || 'Document'}
        />
      );
    default:
      return null;
  }
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isOutbound = message.direction === 'OUTBOUND';
  const type = message.type?.toUpperCase();
  const isMediaMessage = ['IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT'].includes(type);
  const mediaContent = isMediaMessage ? renderMediaContent(message) : null;
  let caption: string | undefined;
  if (isMediaMessage && message.content) {
    if (type === 'DOCUMENT' && message.content === message.metadata?.filename) {
      caption = undefined;
    } else {
      caption = message.content;
    }
  }

  if (mediaContent) {
    return (
      <WhatsAppBubble
        direction={isOutbound ? 'outbound' : 'inbound'}
        content={caption}
        time={formatMessageTime(message.createdAt)}
        status={isOutbound ? mapStatus(message.status) : undefined}
      >
        {mediaContent}
      </WhatsAppBubble>
    );
  }

  return (
    <WhatsAppBubble
      direction={isOutbound ? 'outbound' : 'inbound'}
      content={message.content}
      time={formatMessageTime(message.createdAt)}
      status={isOutbound ? mapStatus(message.status) : undefined}
    />
  );
}

export function DateDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center py-2">
      <span className="rounded-lg bg-[#ffffffdd] px-3 py-1 text-[11px] font-medium text-[#54656f] shadow-[0_1px_0.5px_rgba(11,20,26,0.13)]">
        {label}
      </span>
    </div>
  );
}
