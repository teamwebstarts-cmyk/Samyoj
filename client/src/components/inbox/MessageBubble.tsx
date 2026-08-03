import { useState, type ReactNode } from 'react';
import { AlertCircle, Check, CheckCheck, RotateCcw } from 'lucide-react';
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

export interface BubbleGrouping {
  /** First bubble of a consecutive same-sender run. */
  first: boolean;
  /** Last bubble of a consecutive same-sender run — gets the tail + timestamp. */
  last: boolean;
}

interface MessageBubbleProps {
  message: Message;
  grouping?: BubbleGrouping;
  onOpenMedia?: (item: MediaViewerItem) => void;
  onRetry?: (message: Message) => void;
  retrying?: boolean;
  /** Case-insensitive search term — matched text gets an amber highlight. */
  highlightQuery?: string;
  /** True for the currently-navigated search match — draws a ring. */
  isActiveMatch?: boolean;
}

/** Wraps case-insensitive matches of `query` in amber <mark> elements. */
function highlightText(text: string, query?: string): ReactNode {
  if (!query) return text;
  const lower = text.toLowerCase();
  const needle = query.toLowerCase();
  if (!needle) return text;
  const parts: ReactNode[] = [];
  let cursor = 0;
  let key = 0;
  for (;;) {
    const idx = lower.indexOf(needle, cursor);
    if (idx === -1) {
      parts.push(text.slice(cursor));
      break;
    }
    if (idx > cursor) parts.push(text.slice(cursor, idx));
    parts.push(
      <mark
        key={key++}
        className="rounded-[3px] bg-amber-300/80 px-0.5 text-inherit dark:bg-amber-500/50"
      >
        {text.slice(idx, idx + needle.length)}
      </mark>
    );
    cursor = idx + needle.length;
  }
  return parts;
}

type TickStatus = 'sent' | 'delivered' | 'read' | 'failed';

function mapStatus(status: string): TickStatus {
  const normalized = status.toUpperCase();
  if (normalized === 'FAILED') return 'failed';
  if (normalized === 'READ') return 'read';
  if (normalized === 'DELIVERED') return 'delivered';
  return 'sent';
}

export function MessageTicks({ status, className = '' }: { status: TickStatus; className?: string }) {
  if (status === 'failed') {
    return <AlertCircle className={`h-3 w-3 text-red-500 ${className}`} strokeWidth={2.5} />;
  }
  if (status === 'read') {
    return <CheckCheck className={`h-3 w-3 text-[#53bdeb] ${className}`} strokeWidth={2.5} />;
  }
  if (status === 'delivered') {
    return <CheckCheck className={`h-3 w-3 text-[#8696a0] ${className}`} strokeWidth={2.5} />;
  }
  return <Check className={`h-3 w-3 text-[#8696a0] ${className}`} strokeWidth={2.5} />;
}

function BubbleTail({ outbound }: { outbound: boolean }) {
  return (
    <svg
      viewBox="0 0 8 13"
      className={`absolute bottom-0 h-[13px] w-2 ${
        outbound ? '-right-2 text-[#D9FDD3]' : '-left-2 -scale-x-100 text-white dark:text-neutral-900'
      }`}
      aria-hidden="true"
      fill="currentColor"
    >
      <path d="M0 0v13c3.5-1.5 6.5-5 8-9V0H0z" />
    </svg>
  );
}

function MediaUnavailable({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center bg-[#f0f2f5] px-3 py-6 text-[12px] text-[#667781] dark:bg-neutral-800 dark:text-neutral-400">
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
        <MediaUnavailable
          label={message.metadata?.filename || message.content || 'Document unavailable'}
        />
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

export default function MessageBubble({
  message,
  grouping = { first: true, last: true },
  onOpenMedia,
  onRetry,
  retrying,
  highlightQuery,
  isActiveMatch,
}: MessageBubbleProps) {
  const [localViewer, setLocalViewer] = useState<MediaViewerItem | null>(null);
  const activeRing = isActiveMatch ? 'ring-2 ring-amber-400/90 dark:ring-amber-500/70' : '';
  const isOutbound = message.direction === 'OUTBOUND';
  const type = message.type?.toUpperCase();
  const isMediaMessage = ['IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT'].includes(type);
  const isInteractive = type === 'INTERACTIVE';
  const isContactCard = type === 'CONTACTS';
  const isLocation = type === 'LOCATION';
  const buttons = message.metadata?.buttons;
  const isButtonReply = message.metadata?.isButtonReply;
  const automationLabel = isOutbound ? getAutomationSourceLabel(message.metadata) : null;
  const tickStatus = mapStatus(message.status);
  const isFailed = isOutbound && tickStatus === 'failed';
  const time = grouping.last ? formatMessageTime(message.createdAt) : undefined;

  const openMedia = onOpenMedia || setLocalViewer;

  const sourceBadge = automationLabel ? (
    <span className="mb-1 inline-flex rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-800 dark:bg-violet-950/50 dark:text-violet-300">
      {automationLabel}
    </span>
  ) : null;

  const wrapperAlign = isOutbound ? 'justify-end' : 'justify-start';

  if (isInteractive || (buttons && buttons.length > 0)) {
    return (
      <div className={`flex ${wrapperAlign}`} data-message-id={message.id}>
        <div className={`rounded-[14px] ${activeRing}`}>
          {sourceBadge}
          <InteractiveMessageCard
            body={message.content}
            buttons={buttons}
            direction={isOutbound ? 'outbound' : 'inbound'}
            time={time ?? formatMessageTime(message.createdAt)}
            status={isOutbound ? tickStatus : undefined}
            isButtonReply={isButtonReply}
            metadata={message.metadata}
          />
        </div>
      </div>
    );
  }

  if (isContactCard) {
    const contact = message.metadata?.contacts?.[0];
    return (
      <div className={`flex ${wrapperAlign}`} data-message-id={message.id}>
        <div className={`rounded-[14px] ${activeRing}`}>
          {sourceBadge}
          <WhatsAppBubble
            direction={isOutbound ? 'outbound' : 'inbound'}
            time={time ?? formatMessageTime(message.createdAt)}
            status={isOutbound ? tickStatus : undefined}
          >
            <div className="rounded-lg bg-white px-3 py-2.5 shadow-sm">
              <p className="text-[13px] font-bold text-neutral-800">
                {contact?.name || message.content || 'Contact'}
              </p>
              {contact?.phone && (
                <p className="mt-0.5 text-[12px] text-neutral-500">{contact.phone}</p>
              )}
              {contact?.email && <p className="text-[11px] text-neutral-400">{contact.email}</p>}
            </div>
          </WhatsAppBubble>
        </div>
      </div>
    );
  }

  if (isLocation) {
    const loc = message.metadata?.location;
    return (
      <div className={`flex ${wrapperAlign}`} data-message-id={message.id}>
        <div className={`rounded-[14px] ${activeRing}`}>
          {sourceBadge}
          <WhatsAppBubble
            direction={isOutbound ? 'outbound' : 'inbound'}
            content={message.content}
            time={time ?? formatMessageTime(message.createdAt)}
            status={isOutbound ? tickStatus : undefined}
          >
            <div className="overflow-hidden rounded-lg bg-white shadow-sm">
              <div className="px-2.5 py-2">
                <p className="text-[12px] font-semibold text-neutral-800">
                  {loc?.name || 'Location'}
                </p>
                {loc?.address && <p className="text-[10px] text-neutral-500">{loc.address}</p>}
              </div>
            </div>
          </WhatsAppBubble>
        </div>
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

  const bubbleTone = isOutbound
    ? isFailed
      ? 'bg-[#ffeaea] dark:bg-red-950/50'
      : 'bg-[#D9FDD3] dark:bg-[#005c4b]'
    : 'bg-white ring-1 ring-neutral-200/90 dark:bg-neutral-900 dark:ring-neutral-700/60';

  const radius = [
    'rounded-[14px]',
    grouping.last ? (isOutbound ? 'rounded-br-[4px]' : 'rounded-bl-[4px]') : '',
    !grouping.first ? (isOutbound ? 'rounded-tr-[6px]' : 'rounded-tl-[6px]') : '',
  ].join(' ');

  const metaRow = (onImage = false) =>
    time || isOutbound ? (
      <span
        className={`inline-flex shrink-0 items-center gap-1 ${
          onImage ? 'text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.6)]' : 'text-[#667781] dark:text-neutral-400'
        }`}
      >
        {time && <span className="text-[10.5px] tabular-nums">{time}</span>}
        {isOutbound && <MessageTicks status={tickStatus} className={onImage ? '[&_svg]:drop-shadow' : ''} />}
      </span>
    ) : null;

  if (mediaContent) {
    const isVisual = type === 'IMAGE' || type === 'VIDEO';
    return (
      <>
        <div className={`flex ${wrapperAlign}`} data-message-id={message.id}>
          <div className="max-w-[85%] sm:max-w-[65%]">
            {sourceBadge}
            <div
              className={`relative overflow-hidden text-[#111b21] shadow-[0_1px_1px_rgba(11,20,26,0.12)] dark:text-neutral-100 ${bubbleTone} ${radius} ${activeRing} ${
                isVisual ? 'p-1' : 'p-1.5'
              }`}
            >
              {grouping.last && <BubbleTail outbound={isOutbound} />}
              <div className="relative overflow-hidden rounded-[10px]">
                {mediaContent}
                {isVisual && (time || isOutbound) && (
                  <span className="pointer-events-none absolute bottom-1.5 right-1.5 rounded-full bg-black/45 px-1.5 py-0.5 backdrop-blur-[2px]">
                    {metaRow(true)}
                  </span>
                )}
              </div>
              {caption && (
                <p className="whitespace-pre-wrap break-words px-1.5 pb-1 pt-1.5 text-[14px] leading-snug">
                  {highlightText(caption, highlightQuery)}
                </p>
              )}
              {!isVisual && (time || isOutbound) && (
                <div className="flex justify-end px-1 pb-0.5">{metaRow()}</div>
              )}
            </div>
            <FailedRetryRow
              show={isFailed}
              retrying={retrying}
              onRetry={() => onRetry?.(message)}
            />
          </div>
        </div>
        {!onOpenMedia && (
          <MediaViewer item={localViewer} onClose={() => setLocalViewer(null)} />
        )}
      </>
    );
  }

  return (
    <div className={`flex ${wrapperAlign}`} data-message-id={message.id}>
      <div className="max-w-[85%] sm:max-w-[65%]">
        {sourceBadge}
        <div
          className={`relative px-3 py-2 text-[#111b21] shadow-[0_1px_1px_rgba(11,20,26,0.10)] dark:text-neutral-100 ${bubbleTone} ${radius} ${activeRing}`}
        >
          {grouping.last && <BubbleTail outbound={isOutbound} />}
          <div className="flex flex-wrap items-end gap-x-2">
            <p className="whitespace-pre-wrap break-words text-[14px] leading-snug">
              {highlightText(message.content, highlightQuery)}
            </p>
            <span className="ml-auto -mb-0.5">{metaRow()}</span>
          </div>
        </div>
        <FailedRetryRow show={isFailed} retrying={retrying} onRetry={() => onRetry?.(message)} />
      </div>
    </div>
  );
}

function FailedRetryRow({
  show,
  retrying,
  onRetry,
}: {
  show: boolean;
  retrying?: boolean;
  onRetry: () => void;
}) {
  if (!show) return null;
  return (
    <div className="mt-1 flex items-center justify-end gap-1.5">
      <span className="text-[11px] font-semibold text-red-600 dark:text-red-400">Failed</span>
      <button
        type="button"
        onClick={onRetry}
        disabled={retrying}
        className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-700 ring-1 ring-red-200/70 transition hover:bg-red-100 disabled:opacity-60 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-500/30"
      >
        <RotateCcw className={`h-3 w-3 ${retrying ? 'animate-spin' : ''}`} strokeWidth={2.5} />
        Retry
      </button>
    </div>
  );
}

export function DateDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-3" role="separator">
      <span className="h-px flex-1 bg-neutral-200/90 dark:bg-neutral-700/60" />
      <span className="shrink-0 text-[11px] font-semibold tracking-wide text-[#54656f] dark:text-neutral-400">
        {label}
      </span>
      <span className="h-px flex-1 bg-neutral-200/90 dark:bg-neutral-700/60" />
    </div>
  );
}
