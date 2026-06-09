import { useState } from 'react';
import { formatMessageTime, getAutomationSourceLabel, messageHasMedia } from './inboxUtils';
import {
  AuthenticatedAudio,
  AuthenticatedDocument,
  AuthenticatedImage,
  AuthenticatedVideo,
} from './AuthenticatedMedia';
import InteractiveMessageCard from './InteractiveMessageCard';
import MediaViewer, { type MediaViewerItem } from './MediaViewer';
import { WhatsAppBubble } from './WhatsAppPreview';
import type { Message } from '../../types';

interface MessageBubbleProps {
  message: Message;
  onOpenMedia?: (item: MediaViewerItem) => void;
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

function renderMediaContent(
  message: Message,
  onMediaClick?: (item: MediaViewerItem) => void
) {
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

  const handleClick = (url: string) => {
    if (!onMediaClick || !type) return;
    onMediaClick({
      messageId: message.id,
      type: type as MediaViewerItem['type'],
      url,
      filename: message.metadata?.filename,
    });
  };

  switch (type) {
    case 'IMAGE':
      return (
        <AuthenticatedImage
          messageId={message.id}
          alt={message.content || 'Photo'}
          onClick={handleClick}
        />
      );
    case 'VIDEO':
      return <AuthenticatedVideo messageId={message.id} onClick={handleClick} />;
    case 'AUDIO':
      return <AuthenticatedAudio messageId={message.id} />;
    case 'DOCUMENT':
      return (
        <AuthenticatedDocument
          messageId={message.id}
          filename={message.metadata?.filename || message.content || 'Document'}
          onClick={handleClick}
        />
      );
    default:
      return null;
  }
}

export default function MessageBubble({ message, onOpenMedia }: MessageBubbleProps) {
  const [localViewer, setLocalViewer] = useState<MediaViewerItem | null>(null);
  const isOutbound = message.direction === 'OUTBOUND';
  const type = message.type?.toUpperCase();
  const isMediaMessage = ['IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT'].includes(type);
  const isInteractive = type === 'INTERACTIVE';
  const buttons = message.metadata?.buttons;
  const isButtonReply = message.metadata?.isButtonReply;
  const automationLabel = isOutbound ? getAutomationSourceLabel(message.metadata) : null;

  const openMedia = onOpenMedia || setLocalViewer;

  const sourceBadge = automationLabel ? (
    <span className="mb-1 inline-flex rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-800">
      {automationLabel}
    </span>
  ) : null;

  if (isInteractive || (buttons && buttons.length > 0)) {
    return (
      <div>
        {sourceBadge}
        <InteractiveMessageCard
          body={message.content}
          buttons={buttons}
          direction={isOutbound ? 'outbound' : 'inbound'}
          time={formatMessageTime(message.createdAt)}
          status={isOutbound ? mapStatus(message.status) : undefined}
          isButtonReply={isButtonReply}
        />
      </div>
    );
  }

  const mediaContent = isMediaMessage ? renderMediaContent(message, openMedia) : null;
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
      <>
        <WhatsAppBubble
          direction={isOutbound ? 'outbound' : 'inbound'}
          content={caption}
          time={formatMessageTime(message.createdAt)}
          status={isOutbound ? mapStatus(message.status) : undefined}
        >
          {mediaContent}
        </WhatsAppBubble>
        {!onOpenMedia && (
          <MediaViewer item={localViewer} onClose={() => setLocalViewer(null)} />
        )}
      </>
    );
  }

  return (
    <div>
      {sourceBadge}
      <WhatsAppBubble
        direction={isOutbound ? 'outbound' : 'inbound'}
        content={message.content}
        time={formatMessageTime(message.createdAt)}
        status={isOutbound ? mapStatus(message.status) : undefined}
      />
    </div>
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
