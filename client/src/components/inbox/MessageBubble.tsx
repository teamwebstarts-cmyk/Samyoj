import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  AlertCircle,
  Check,
  CheckCheck,
  Clock,
  Copy,
  MoreVertical,
  Reply,
  RotateCcw,
  SmilePlus,
} from 'lucide-react';
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
  onReply?: (message: Message) => void;
  onReact?: (message: Message, emoji: string) => void;
  retrying?: boolean;
  /** Case-insensitive search term — matched text gets an amber highlight. */
  highlightQuery?: string;
  /** True for the currently-navigated search match — draws a ring. */
  isActiveMatch?: boolean;
  /** When true, play the enter fade/slide (fresh insert only — not initial history). */
  animateEnter?: boolean;
}

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

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

type TickStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';

function mapStatus(status: string): TickStatus {
  const normalized = status.toUpperCase();
  if (normalized === 'FAILED') return 'failed';
  if (normalized === 'READ') return 'read';
  if (normalized === 'DELIVERED') return 'delivered';
  if (normalized === 'PENDING' || normalized === 'QUEUED') return 'pending';
  return 'sent';
}

export function MessageTicks({ status, className = '' }: { status: TickStatus; className?: string }) {
  if (status === 'failed') {
    return <AlertCircle className={`h-3 w-3 text-red-500 ${className}`} strokeWidth={2.5} />;
  }
  if (status === 'pending') {
    return <Clock className={`h-3 w-3 text-[#8696a0] ${className}`} strokeWidth={2.5} aria-label="Pending" />;
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
        outbound
          ? '-right-2 text-[#D9FDD3] dark:text-[#005c4b]'
          : '-left-2 -scale-x-100 text-white dark:text-neutral-900'
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
          sizeLabel={
            typeof message.metadata?.size === 'number'
              ? message.metadata.size < 1024 * 1024
                ? `${(message.metadata.size / 1024).toFixed(1)} KB`
                : `${(message.metadata.size / (1024 * 1024)).toFixed(1)} MB`
              : undefined
          }
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
  onReply,
  onReact,
  retrying,
  highlightQuery,
  isActiveMatch,
  animateEnter = false,
}: MessageBubbleProps) {
  const [localViewer, setLocalViewer] = useState<MediaViewerItem | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reactOpen, setReactOpen] = useState(false);
  const longPressTimer = useRef<number | null>(null);
  const activeRing = isActiveMatch ? 'ring-2 ring-amber-400/90 dark:ring-amber-500/70' : '';
  const isOutbound = message.direction === 'OUTBOUND';
  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const enterClass =
    animateEnter && !reducedMotion ? 'inbox-bubble-enter motion-reduce:animate-none' : '';
  const type = message.type?.toUpperCase();
  const isSticker = Boolean(message.metadata?.isSticker);
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
  const replyPreview = message.metadata?.replyPreview;
  const reactions = message.metadata?.reactions || [];

  const openMedia = onOpenMedia || setLocalViewer;

  const clearLongPress = () => {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  useEffect(() => () => clearLongPress(), []);

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(message.content || '');
    } catch {
      /* ignore */
    }
    setMenuOpen(false);
  };

  const quoteStrip = replyPreview ? (
    <div className="mb-1.5 rounded-md border-l-[3px] border-[#008069] bg-black/[0.06] px-2 py-1 dark:bg-white/10">
      <p className="line-clamp-2 text-[12px] leading-snug text-[#54656f] dark:text-neutral-300">
        {replyPreview}
      </p>
    </div>
  ) : null;

  const reactionChips =
    reactions.length > 0 ? (
      <div className={`mt-0.5 flex flex-wrap gap-1 ${isOutbound ? 'justify-end' : 'justify-start'}`}>
        {reactions.map((r, i) => (
          <span
            key={`${r.emoji}-${r.from}-${i}`}
            className="inline-flex items-center rounded-full border border-neutral-200/80 bg-white px-1.5 py-0.5 text-[12px] shadow-sm dark:border-neutral-700 dark:bg-neutral-900"
            title={r.from}
          >
            {r.emoji}
          </span>
        ))}
      </div>
    ) : null;

  const actionMenu = (
    <div
      className={`absolute top-0 z-10 ${isOutbound ? 'left-0 -translate-x-full pr-1' : 'right-0 translate-x-full pl-1'} ${
        menuOpen || reactOpen ? 'opacity-100' : 'opacity-0 group-hover/bubble:opacity-100 focus-within:opacity-100'
      } transition-opacity`}
    >
      <div className="relative">
        <button
          type="button"
          aria-label="Message actions"
          className="flex h-7 w-7 items-center justify-center rounded-full bg-theme-surface/95 text-theme-muted shadow-sm ring-1 ring-theme-border hover:text-theme-fg"
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen((v) => !v);
            setReactOpen(false);
          }}
        >
          <MoreVertical className="h-3.5 w-3.5" />
        </button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
            <div className="absolute top-8 z-20 w-40 overflow-hidden rounded-xl border border-theme-border bg-theme-surface py-1 shadow-panel">
              {onReply && (
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12.5px] hover:bg-theme-subtle"
                  onClick={() => {
                    onReply(message);
                    setMenuOpen(false);
                  }}
                >
                  <Reply className="h-3.5 w-3.5" /> Reply
                </button>
              )}
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12.5px] hover:bg-theme-subtle"
                onClick={() => void copyText()}
              >
                <Copy className="h-3.5 w-3.5" /> Copy
              </button>
              {onReact && (
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12.5px] hover:bg-theme-subtle"
                  onClick={() => {
                    setReactOpen(true);
                    setMenuOpen(false);
                  }}
                >
                  <SmilePlus className="h-3.5 w-3.5" /> React
                </button>
              )}
              {isFailed && onRetry && (
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12.5px] text-red-600 hover:bg-theme-subtle"
                  onClick={() => {
                    onRetry(message);
                    setMenuOpen(false);
                  }}
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Retry
                </button>
              )}
            </div>
          </>
        )}
        {reactOpen && onReact && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setReactOpen(false)} />
            <div className="absolute top-8 z-20 flex gap-1 rounded-full border border-theme-border bg-theme-surface px-2 py-1.5 shadow-panel">
              {QUICK_REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-[16px] hover:bg-theme-subtle"
                  onClick={() => {
                    onReact(message, emoji);
                    setReactOpen(false);
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );

  const bubbleShellProps = {
    className: `group/bubble relative ${enterClass}`,
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault();
      setMenuOpen(true);
    },
    onTouchStart: () => {
      clearLongPress();
      longPressTimer.current = window.setTimeout(() => setMenuOpen(true), 450);
    },
    onTouchEnd: clearLongPress,
    onTouchMove: clearLongPress,
  };

  const sourceBadge = automationLabel ? (
    <span className="mb-1 inline-flex rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-800 dark:bg-violet-950/50 dark:text-violet-300">
      {automationLabel}
    </span>
  ) : null;

  const outboundSenderLabel = isOutbound
    ? automationLabel
      ? automationLabel.startsWith('Flow:')
        ? 'AI Bot'
        : automationLabel.startsWith('Quick reply:') || automationLabel.startsWith('Auto:')
          ? 'AI Bot'
          : automationLabel
      : 'You'
    : null;

  const senderHeader =
    isOutbound && grouping.first ? (
      <p className="mb-0.5 text-[11px] font-semibold leading-none text-[#008069] dark:text-emerald-300">
        {outboundSenderLabel}
        {time ? ` · ${time}` : ''}
      </p>
    ) : null;

  const wrapperAlign = isOutbound ? 'justify-end' : 'justify-start';

  if (isInteractive || (buttons && buttons.length > 0)) {
    return (
      <div {...bubbleShellProps} className={`flex ${wrapperAlign} ${bubbleShellProps.className}`} data-message-id={message.id}>
        <div className={`relative max-w-[85%] rounded-[14px] sm:max-w-[65%] ${activeRing}`}>
          {actionMenu}
          {sourceBadge}
          {quoteStrip}
          <InteractiveMessageCard
            body={message.content}
            buttons={buttons}
            direction={isOutbound ? 'outbound' : 'inbound'}
            time={time ?? formatMessageTime(message.createdAt)}
            status={isOutbound ? tickStatus : undefined}
            isButtonReply={isButtonReply}
            metadata={message.metadata}
          />
          {reactionChips}
        </div>
      </div>
    );
  }

  if (isContactCard) {
    const contact = message.metadata?.contacts?.[0];
    return (
      <div
        {...bubbleShellProps}
        className={`flex ${wrapperAlign} ${bubbleShellProps.className}`}
        data-message-id={message.id}
      >
        <div className={`relative max-w-[85%] rounded-[14px] sm:max-w-[65%] ${activeRing}`}>
          {actionMenu}
          {sourceBadge}
          {quoteStrip}
          <WhatsAppBubble
            direction={isOutbound ? 'outbound' : 'inbound'}
            time={time ?? formatMessageTime(message.createdAt)}
            status={isOutbound ? tickStatus : undefined}
          >
            <div className="rounded-lg bg-white px-3 py-2.5 shadow-sm dark:bg-neutral-900">
              <p className="text-[13px] font-bold text-neutral-800 dark:text-neutral-100">
                {contact?.name || message.content || 'Contact'}
              </p>
              {contact?.phone && (
                <p className="mt-0.5 text-[12px] text-neutral-500">{contact.phone}</p>
              )}
              {contact?.email && <p className="text-[11px] text-neutral-400">{contact.email}</p>}
            </div>
          </WhatsAppBubble>
          {reactionChips}
        </div>
      </div>
    );
  }

  if (isLocation) {
    const loc = message.metadata?.location;
    return (
      <div
        {...bubbleShellProps}
        className={`flex ${wrapperAlign} ${bubbleShellProps.className}`}
        data-message-id={message.id}
      >
        <div className={`relative max-w-[85%] rounded-[14px] sm:max-w-[65%] ${activeRing}`}>
          {actionMenu}
          {sourceBadge}
          {quoteStrip}
          <WhatsAppBubble
            direction={isOutbound ? 'outbound' : 'inbound'}
            content={message.content}
            time={time ?? formatMessageTime(message.createdAt)}
            status={isOutbound ? tickStatus : undefined}
          >
            <div className="overflow-hidden rounded-lg bg-white shadow-sm dark:bg-neutral-900">
              <div className="px-2.5 py-2">
                <p className="text-[12px] font-semibold text-neutral-800 dark:text-neutral-100">
                  {loc?.name || 'Location'}
                </p>
                {loc?.address && <p className="text-[10px] text-neutral-500">{loc.address}</p>}
              </div>
            </div>
          </WhatsAppBubble>
          {reactionChips}
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
        <div
          {...bubbleShellProps}
          className={`flex ${wrapperAlign} ${bubbleShellProps.className}`}
          data-message-id={message.id}
        >
          <div className={`relative max-w-[85%] sm:max-w-[65%] ${isSticker ? 'max-w-[160px]' : ''}`}>
            {actionMenu}
            {sourceBadge}
            <div
              className={`relative overflow-hidden text-[#111b21] shadow-[0_1px_1px_rgba(11,20,26,0.12)] dark:text-neutral-100 ${
                isSticker ? 'bg-transparent shadow-none' : bubbleTone
              } ${isSticker ? 'rounded-xl' : radius} ${activeRing} ${
                isSticker ? 'p-0' : isVisual ? 'p-1' : 'p-1.5'
              }`}
            >
              {!isSticker && grouping.last && <BubbleTail outbound={isOutbound} />}
              {quoteStrip}
              <div className={`relative overflow-hidden ${isSticker ? '' : 'rounded-[10px]'}`}>
                {mediaContent}
                {!isSticker && isVisual && (time || isOutbound) && (
                  <span className="pointer-events-none absolute bottom-1.5 right-1.5 rounded-full bg-black/45 px-1.5 py-0.5 backdrop-blur-[2px]">
                    {metaRow(true)}
                  </span>
                )}
              </div>
              {caption && !isSticker && (
                <p className="whitespace-pre-wrap break-words px-1.5 pb-1 pt-1.5 text-[14px] leading-snug">
                  {highlightText(caption, highlightQuery)}
                </p>
              )}
              {!isVisual && !isSticker && (time || isOutbound) && (
                <div className="flex justify-end px-1 pb-0.5">{metaRow()}</div>
              )}
            </div>
            {reactionChips}
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
    <div
      {...bubbleShellProps}
      className={`flex ${wrapperAlign} ${bubbleShellProps.className}`}
      data-message-id={message.id}
    >
      <div className="relative max-w-[85%] sm:max-w-[65%]">
        {actionMenu}
        {sourceBadge}
        <div
          className={`relative px-3 py-2 text-[#111b21] shadow-[0_1px_1px_rgba(11,20,26,0.10)] dark:text-neutral-100 ${bubbleTone} ${radius} ${activeRing}`}
        >
          {grouping.last && <BubbleTail outbound={isOutbound} />}
          {senderHeader}
          {quoteStrip}
          <div className="flex flex-wrap items-end gap-x-2">
            <p className="whitespace-pre-wrap break-words text-[14px] leading-snug">
              {highlightText(message.content, highlightQuery)}
            </p>
            <span className="ml-auto -mb-0.5">{metaRow()}</span>
          </div>
        </div>
        {reactionChips}
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
        className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-700 ring-1 ring-red-200/70 transition hover:bg-red-100 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/60 focus-visible:ring-offset-1 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-500/30"
      >
        <RotateCcw className={`h-3 w-3 ${retrying ? 'animate-spin' : ''}`} strokeWidth={2.5} />
        Retry
      </button>
    </div>
  );
}

export function DateDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center py-3" role="separator">
      <span className="rounded-full bg-[#e9edef]/95 px-3.5 py-1 text-[11.5px] font-semibold tracking-wide text-[#54656f] shadow-[0_1px_1px_rgba(11,20,26,0.06)] dark:bg-neutral-800/90 dark:text-neutral-300">
        {label}
      </span>
    </div>
  );
}
