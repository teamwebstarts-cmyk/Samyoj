import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertCircle,
  Check,
  CheckCheck,
  CheckSquare,
  ChevronDown,
  Clock,
  Copy,
  Info,
  Phone,
  PhoneIncoming,
  PhoneMissed,
  PhoneOff,
  Reply,
  RotateCcw,
  SmilePlus,
  Trash2,
} from 'lucide-react';
import { formatMessageTime, fillTemplateMessageContent, getAutomationDividerLabel, messageHasMedia } from './inboxUtils';
import { computeFixedPopoverPosition, type PopoverCoords } from './inboxPopoverPosition';
import {
  AuthenticatedAudio,
  AuthenticatedDocument,
  AuthenticatedImage,
  AuthenticatedVideo,
} from './AuthenticatedMedia';
import { resolveVisualMediaKind } from './mediaKind';
import InteractiveMessageCard from './InteractiveMessageCard';
import MediaViewer, { type MediaViewerItem } from './MediaViewer';
import { WhatsAppBubble } from './WhatsAppPreview';
import { useGlassTipProps } from './ComposerGlassTip';
import {
  describeUnsupportedMessage,
  isUnsupportedMessageContent,
  unsupportedTypeFromContent,
} from './unsupportedMessage';
import type { Message } from '../../types';
import CallSummaryNote from '../calls/CallSummaryNote';
import { explainWhatsAppSendFailureFromMessage } from '../../utils/whatsappSendFailure';

const ACTION_MENU_WIDTH = 160;
const REACT_MENU_WIDTH = 232;
/** Prefer opening above when this close to the bottom of the thread/viewport. */
const FLIP_NEAR_BOTTOM_PX = 168;

function preferMenuPlacement(anchor: DOMRect): 'above' | 'below' {
  const thread = document.getElementById('inbox-thread');
  if (thread) {
    const threadBottom = thread.getBoundingClientRect().bottom;
    if (threadBottom - anchor.bottom < FLIP_NEAR_BOTTOM_PX) return 'above';
  }
  if (window.innerHeight - anchor.bottom < FLIP_NEAR_BOTTOM_PX) return 'above';
  return 'below';
}

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
  onDelete?: (message: Message) => void;
  /** Enter multi-select mode (optionally starting from this message). */
  onEnterSelectMode?: (message: Message) => void;
  /** WhatsApp-style multi-select mode */
  selectMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (message: Message) => void;
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

/** Collapsed max height (~12×21px LH) — WhatsApp-like band ~220–280px. */
const MSG_COLLAPSE_MAX_PX = 252;

/**
 * Plain-text / caption body with WhatsApp-style Read more / Read less when tall.
 * Per-instance state — expanding one bubble does not expand others.
 */
function CollapsibleMessageText({
  children,
  className = '',
  endMeta,
}: {
  children: ReactNode;
  className?: string;
  /** Timestamp / ticks — inline for short text, footer row when collapsed. */
  endMeta?: ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  /** null = not measured yet — keep max-height so tall messages don't flash full height */
  const [overflows, setOverflows] = useState<boolean | null>(null);
  const textRef = useRef<HTMLParagraphElement>(null);

  useLayoutEffect(() => {
    const el = textRef.current;
    if (!el) return;

    const measure = () => {
      setOverflows(el.scrollHeight > MSG_COLLAPSE_MAX_PX + 2);
    };

    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [children]);

  const showToggle = overflows === true;
  const constrain = !expanded && overflows !== false;

  return (
    <div
      className={
        showToggle
          ? 'flex w-full min-w-0 flex-col items-stretch'
          : 'inline-flex max-w-full flex-wrap items-end gap-x-2'
      }
    >
      <div
        className={`relative ${showToggle ? 'min-w-0 w-full' : 'min-w-0 max-w-full'} ${
          constrain ? 'wa-msg-body-collapse' : ''
        }`}
      >
        <p ref={textRef} className={`wa-msg-body whitespace-pre-wrap break-words ${className}`}>
          {children}
        </p>
        {constrain && showToggle ? <div className="wa-msg-body-fade" aria-hidden /> : null}
      </div>
      {showToggle ? (
        <div className="mt-0.5 flex w-full items-end justify-between gap-2">
          <button
            type="button"
            className="wa-msg-read-more shrink-0 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--chat-accent)]/45 focus-visible:ring-offset-1"
            aria-expanded={expanded}
            onClick={(e) => {
              e.stopPropagation();
              setExpanded((v) => !v);
            }}
          >
            {expanded ? 'Read less' : 'Read more'}
          </button>
          {endMeta ? <span className="ml-auto -mb-0.5 shrink-0 whitespace-nowrap">{endMeta}</span> : null}
        </div>
      ) : endMeta ? (
        <span className="ml-auto -mb-0.5 shrink-0 whitespace-nowrap">{endMeta}</span>
      ) : null}
    </div>
  );
}

type TickStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed' | 'ambiguous';

function mapStatus(status: string): TickStatus {
  const normalized = status.toUpperCase();
  if (normalized === 'FAILED') return 'failed';
  if (normalized === 'AMBIGUOUS') return 'ambiguous';
  if (normalized === 'READ') return 'read';
  if (normalized === 'DELIVERED') return 'delivered';
  if (normalized === 'PENDING' || normalized === 'QUEUED') return 'pending';
  return 'sent';
}

export function MessageTicks({ status, className = '' }: { status: TickStatus; className?: string }) {
  if (status === 'failed') {
    return <AlertCircle className={`h-3 w-3 text-red-500 ${className}`} strokeWidth={2.5} />;
  }
  if (status === 'ambiguous') {
    return (
      <AlertCircle
        className={`h-3 w-3 text-amber-500 ${className}`}
        strokeWidth={2.5}
        aria-label="Send status unknown"
      />
    );
  }
  if (status === 'pending') {
    return <Clock className={`h-3 w-3 wa-tick ${className}`} strokeWidth={2.5} aria-label="Pending" />;
  }
  if (status === 'read') {
    return <CheckCheck className={`h-3 w-3 wa-tick-read ${className}`} strokeWidth={2.5} />;
  }
  if (status === 'delivered') {
    return <CheckCheck className={`h-3 w-3 wa-tick ${className}`} strokeWidth={2.5} />;
  }
  return <Check className={`h-3 w-3 wa-tick ${className}`} strokeWidth={2.5} />;
}

function BubbleTail({ outbound }: { outbound: boolean }) {
  return (
    <svg
      viewBox="0 0 8 13"
      className={`absolute bottom-0 h-[13px] w-2 ${
        outbound
          ? '-right-2 text-[color:var(--bubble-sent)]'
          : '-left-2 -scale-x-100 text-[color:var(--bubble-received)]'
      }`}
      aria-hidden="true"
      fill="currentColor"
    >
      <path d="M0 0v13c3.5-1.5 6.5-5 8-9V0H0z" />
    </svg>
  );
}

function formatTemplateLabel(templateName?: string | null) {
  const trimmed = templateName?.trim();
  if (!trimmed) return 'Template';
  return trimmed
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function MediaUnavailable({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center bg-black/[0.04] px-3 py-6 text-[12px] wa-timestamp dark:bg-white/[0.06]">
      {label}
    </div>
  );
}

function renderMediaContent(
  message: Message,
  onMediaClick?: (item: MediaViewerItem) => void,
  audioEndMeta?: ReactNode,
  audioOutbound?: boolean
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
    const kind = resolveVisualMediaKind(message);
    onMediaClick({
      messageId: message.id,
      type: type as MediaViewerItem['type'],
      url,
      filename: message.metadata?.filename,
      mimeType: message.metadata?.mimeType,
      loopMuted: kind === 'gif',
    });
  };

  switch (type) {
    case 'IMAGE': {
      const kind = resolveVisualMediaKind(message);
      if (kind === 'gif') {
        // Rare: image/gif stored as IMAGE — <img> animates natively; keep soft chrome.
        return (
          <AuthenticatedImage
            messageId={message.id}
            alt={message.content || 'GIF'}
            onClick={handleClick}
          />
        );
      }
      return (
        <AuthenticatedImage
          messageId={message.id}
          alt={message.content || (kind === 'sticker' ? 'Sticker' : 'Photo')}
          variant={kind === 'sticker' ? 'sticker' : 'image'}
          onClick={kind === 'sticker' ? undefined : handleClick}
        />
      );
    }
    case 'VIDEO': {
      const kind = resolveVisualMediaKind(message);
      return (
        <AuthenticatedVideo
          messageId={message.id}
          variant={kind === 'gif' ? 'gif' : 'video'}
          onClick={handleClick}
        />
      );
    }
    case 'AUDIO':
      return (
        <AuthenticatedAudio
          messageId={message.id}
          endMeta={audioEndMeta}
          outbound={audioOutbound}
        />
      );
    case 'DOCUMENT':
      return (
        <AuthenticatedDocument
          messageId={message.id}
          filename={message.metadata?.filename || message.content || 'Document'}
          mimeType={message.metadata?.mimeType}
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
  onDelete,
  onEnterSelectMode,
  selectMode = false,
  selected = false,
  onToggleSelect,
  retrying,
  highlightQuery,
  isActiveMatch,
  animateEnter = false,
}: MessageBubbleProps) {
  const tipFor = useGlassTipProps();
  const [localViewer, setLocalViewer] = useState<MediaViewerItem | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reactOpen, setReactOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<PopoverCoords | null>(null);
  const [reactPos, setReactPos] = useState<PopoverCoords | null>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const menuPanelRef = useRef<HTMLDivElement>(null);
  const reactPanelRef = useRef<HTMLDivElement>(null);
  const activeRing = isActiveMatch ? 'ring-2 ring-amber-400/90 dark:ring-amber-500/70' : '';
  const isOutbound = message.direction === 'OUTBOUND';
  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const enterClass =
    animateEnter && !reducedMotion ? 'inbox-bubble-enter motion-reduce:animate-none' : '';
  const type = message.type?.toUpperCase();
  const templateBody =
    type === 'TEMPLATE'
      ? fillTemplateMessageContent(message.content, message.metadata?.templateParams)
      : message.content;
  const isSticker = Boolean(message.metadata?.isSticker);
  const isCallEvent = Boolean(message.metadata?.isCallEvent) || message.content === '[call]';
  const isCallSummary = Boolean(message.metadata?.isCallSummary);
  const isMediaMessage = ['IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT'].includes(type);
  const isInteractive = type === 'INTERACTIVE';
  const isContactCard = type === 'CONTACTS';
  const isLocation = type === 'LOCATION';
  const isUnsupported = isUnsupportedMessageContent(message.content, message.metadata);
  const buttons = message.metadata?.buttons;
  const isButtonReply = message.metadata?.isButtonReply;
  const isAutomation = isOutbound && Boolean(getAutomationDividerLabel(message.metadata));
  const isBizAppEcho = isOutbound && message.metadata?.source === 'biz_app';
  const templateLabel =
    type === 'TEMPLATE' && message.metadata?.templateName
      ? formatTemplateLabel(message.metadata.templateName)
      : null;
  const tickStatus = mapStatus(message.status);
  const isFailed = isOutbound && tickStatus === 'failed';
  const isAmbiguous = isOutbound && tickStatus === 'ambiguous';
  const sendFailure = isFailed ? explainWhatsAppSendFailureFromMessage(message) : null;
  const canRetryFailed = Boolean(isFailed && onRetry && sendFailure?.retryHelps !== false);
  const time = grouping.last ? formatMessageTime(message.createdAt) : undefined;
  const replyPreview = message.metadata?.replyPreview;
  const reactions = message.metadata?.reactions || [];

  const openMedia = onOpenMedia || setLocalViewer;

  const closeMenus = () => {
    setMenuOpen(false);
    setReactOpen(false);
  };

  useLayoutEffect(() => {
    if (!menuOpen || !menuBtnRef.current) {
      setMenuPos(null);
      return;
    }
    const place = () => {
      const anchor = menuBtnRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      const height = menuPanelRef.current?.offsetHeight ?? 148;
      setMenuPos(
        computeFixedPopoverPosition(
          rect,
          { width: ACTION_MENU_WIDTH, height },
          { prefer: preferMenuPlacement(rect), gap: 6 }
        )
      );
    };
    place();
    const raf = requestAnimationFrame(place);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [menuOpen, isFailed, onReply, onReact, onRetry, onDelete, onEnterSelectMode]);

  useLayoutEffect(() => {
    if (!reactOpen || !menuBtnRef.current) {
      setReactPos(null);
      return;
    }
    const place = () => {
      const anchor = menuBtnRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      const height = reactPanelRef.current?.offsetHeight ?? 48;
      setReactPos(
        computeFixedPopoverPosition(
          rect,
          { width: REACT_MENU_WIDTH, height },
          { prefer: preferMenuPlacement(rect), gap: 6 }
        )
      );
    };
    place();
    const raf = requestAnimationFrame(place);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [reactOpen]);

  useEffect(() => {
    if (!menuOpen && !reactOpen) return;
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menuBtnRef.current?.contains(target)) return;
      if (menuPanelRef.current?.contains(target)) return;
      if (reactPanelRef.current?.contains(target)) return;
      closeMenus();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenus();
    };
    // Auto-dismiss when the thread scrolls (popup is portaled, so it won't move with scroll).
    const onScroll = () => closeMenus();
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [menuOpen, reactOpen]);

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(templateBody || '');
    } catch {
      /* ignore */
    }
    closeMenus();
  };

  const quoteStrip = replyPreview ? (
    <div className="mb-1.5 rounded-md border-l-[3px] border-chat-accent bg-black/[0.06] px-2 py-1 dark:bg-white/10">
      <p className="line-clamp-2 text-[12px] leading-snug text-chat-timestamp">
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
            {...tipFor(r.from)}
          >
            {r.emoji}
          </span>
        ))}
      </div>
    ) : null;

  const portaledMenu =
    menuOpen && menuPos
      ? createPortal(
          <div
            ref={menuPanelRef}
            role="menu"
            style={{ top: menuPos.top, left: menuPos.left, width: ACTION_MENU_WIDTH }}
            className="fixed z-[80] overflow-hidden rounded-xl border border-theme-border bg-theme-surface py-1 shadow-panel"
          >
            {onReply && (
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12.5px] hover:bg-theme-subtle"
                onClick={() => {
                  onReply(message);
                  closeMenus();
                }}
              >
                <Reply className="h-3.5 w-3.5" /> Reply
              </button>
            )}
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12.5px] hover:bg-theme-subtle"
              onClick={() => void copyText()}
            >
              <Copy className="h-3.5 w-3.5" /> Copy
            </button>
            {onReact && (
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12.5px] hover:bg-theme-subtle"
                onClick={() => {
                  setMenuOpen(false);
                  setReactOpen(true);
                }}
              >
                <SmilePlus className="h-3.5 w-3.5" /> React
              </button>
            )}
            {canRetryFailed && (
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12.5px] text-red-600 hover:bg-theme-subtle"
                onClick={() => {
                  onRetry?.(message);
                  closeMenus();
                }}
              >
                <RotateCcw className="h-3.5 w-3.5" /> Retry
              </button>
            )}
            {onEnterSelectMode && (
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12.5px] hover:bg-theme-subtle"
                onClick={() => {
                  onEnterSelectMode(message);
                  closeMenus();
                }}
              >
                <CheckSquare className="h-3.5 w-3.5" /> Select messages
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12.5px] text-red-600 hover:bg-theme-subtle"
                onClick={() => {
                  onDelete(message);
                  closeMenus();
                }}
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
            )}
          </div>,
          document.body
        )
      : null;

  const portaledReact =
    reactOpen && onReact && reactPos
      ? createPortal(
          <div
            ref={reactPanelRef}
            role="menu"
            aria-label="Quick reactions"
            style={{ top: reactPos.top, left: reactPos.left }}
            className="fixed z-[80] flex gap-1 rounded-full border border-theme-border bg-theme-surface px-2 py-1.5 shadow-panel"
          >
            {QUICK_REACTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-full text-[16px] hover:bg-theme-subtle"
                onClick={() => {
                  onReact(message, emoji);
                  closeMenus();
                }}
              >
                {emoji}
              </button>
            ))}
          </div>,
          document.body
        )
      : null;

  const actionMenu = selectMode ? null : (
    <div
      className={`absolute top-1 z-10 ${isOutbound ? 'right-1' : 'left-1'} ${
        menuOpen || reactOpen ? 'opacity-100' : 'opacity-0 group-hover/bubble:opacity-100 focus-within:opacity-100'
      } transition-opacity`}
    >
      <button
        ref={menuBtnRef}
        type="button"
        aria-label="Message options"
        aria-expanded={menuOpen || reactOpen}
        aria-haspopup="menu"
        className="flex h-5 w-5 items-center justify-center rounded-md bg-black/10 text-chat-text backdrop-blur-[2px] hover:bg-black/15 dark:bg-white/15 dark:hover:bg-white/25"
        onClick={(e) => {
          e.stopPropagation();
          if (menuOpen || reactOpen) {
            closeMenus();
          } else {
            setReactOpen(false);
            setMenuOpen(true);
          }
        }}
      >
        <ChevronDown className="h-3 w-3" strokeWidth={2.5} />
      </button>
      {portaledMenu}
      {portaledReact}
    </div>
  );

  const bubbleShellProps = selectMode
    ? {
        className: `group/bubble relative ${enterClass}`,
        onClick: (e: React.MouseEvent) => {
          e.preventDefault();
          e.stopPropagation();
          onToggleSelect?.(message);
        },
      }
    : {
        className: `group/bubble relative ${enterClass}`,
      };

  const selectCheck = selectMode ? (
    <button
      type="button"
      aria-label={selected ? 'Deselect message' : 'Select message'}
      aria-pressed={selected}
      onClick={(e) => {
        e.stopPropagation();
        onToggleSelect?.(message);
      }}
      className={`mb-1 flex h-6 w-6 shrink-0 items-center justify-center self-center ${
        isOutbound ? 'order-2' : ''
      }`}
    >
      <span
        className={`flex h-5 w-5 items-center justify-center rounded-full border-2 transition ${
          selected
            ? 'border-whatsapp-500 bg-whatsapp-500 text-white'
            : 'border-theme-muted bg-theme-surface/80'
        }`}
      >
        {selected ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
    </span>
    </button>
  ) : null;

  // Automation runs use a centered DateDivider-style pill in ChatThread — avoid
  // duplicating "AI Bot" here. Keep a subtle "You · time" only for agent outbound.
  const senderHeader =
    isOutbound && grouping.first && !isAutomation ? (
      <p className="mb-0.5 text-[11px] font-semibold leading-none wa-accent-text">
        You{time ? ` · ${time}` : ''}
      </p>
  ) : null;

  const wrapperAlign = isOutbound ? 'justify-end' : 'justify-start';
  // Keep sender/receiver sides intact in select mode — only the checkbox moves.
  const rowClass = `flex items-end gap-2 ${wrapperAlign}`;
  /** Size to content; cap against the thread — never `min-w-0` (that collapsed short texts to 1 letter wide). */
  const bubbleMaxClass = 'w-fit max-w-[min(100%,75%)] sm:max-w-[min(100%,65%)]';

  if (isCallSummary) {
    return <CallSummaryCard message={message} />;
  }

  if (isCallEvent) {
    return <CallEventPill message={message} />;
  }

  if (isInteractive || (buttons && buttons.length > 0) || isButtonReply) {
    return (
      <div className={rowClass} data-message-id={message.id}>
        {selectCheck}
        <div {...bubbleShellProps} className={`${bubbleMaxClass} ${bubbleShellProps.className}`}>
          <div className={`relative rounded-lg ${activeRing}`}>
            {actionMenu}
            {/* Button replies nest reply-to inside the Selected option card (WA-style); skip outer strip. */}
            {!isButtonReply && quoteStrip}
          <InteractiveMessageCard
            body={message.content}
            buttons={buttons}
            direction={isOutbound ? 'outbound' : 'inbound'}
            time={time ?? formatMessageTime(message.createdAt)}
            status={isOutbound ? tickStatus : undefined}
            isButtonReply={isButtonReply}
              replyPreview={isButtonReply ? replyPreview : undefined}
            metadata={message.metadata}
          />
            {reactionChips}
          </div>
        </div>
      </div>
    );
  }

  if (isContactCard) {
    const contact = message.metadata?.contacts?.[0];
    return (
      <div className={rowClass} data-message-id={message.id}>
        {selectCheck}
        <div
          {...bubbleShellProps}
          className={`${bubbleMaxClass} ${bubbleShellProps.className}`}
        >
          <div className={`relative rounded-lg ${activeRing}`}>
            {actionMenu}
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
      </div>
    );
  }

  if (isLocation) {
    const loc = message.metadata?.location;
    return (
      <div className={rowClass} data-message-id={message.id}>
        {selectCheck}
        <div
          {...bubbleShellProps}
          className={`${bubbleMaxClass} ${bubbleShellProps.className}`}
        >
          <div className={`relative rounded-lg ${activeRing}`}>
            {actionMenu}
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
      </div>
    );
  }

  const bubbleTone = isOutbound
    ? isFailed
      ? 'wa-bubble-failed'
      : 'wa-bubble-sent'
    : 'wa-bubble-received';

  const radius = [
    'rounded-[8px]',
    grouping.last ? (isOutbound ? 'rounded-br-[2px]' : 'rounded-bl-[2px]') : '',
    !grouping.first ? (isOutbound ? 'rounded-tr-[6px]' : 'rounded-tl-[6px]') : '',
  ].join(' ');

  const metaRow = (onImage = false) =>
    time || isOutbound ? (
      <span
        className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap ${
          onImage ? 'text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.6)]' : 'wa-timestamp'
        }`}
      >
        {time && <span className="text-[10.5px] tabular-nums whitespace-nowrap">{time}</span>}
        {isOutbound && <MessageTicks status={tickStatus} className={onImage ? '[&_svg]:drop-shadow' : ''} />}
      </span>
    ) : null;

  const mediaContent = isMediaMessage
    ? renderMediaContent(
        message,
        openMedia,
        type === 'AUDIO' ? metaRow() : undefined,
        isOutbound
      )
    : null;
  let caption: string | undefined;
  if (isMediaMessage && message.content) {
    const filename = message.metadata?.filename?.trim();
    const body = message.content.trim();
    const placeholders = new Set(['[image]', '[video]', '[audio]', '[voice]', '[document]', '[sticker]']);
    const isFilenameOnly =
      Boolean(filename && body === filename) ||
      /^voice-note-\d+\.(webm|ogg|opus|mp3|m4a|wav)$/i.test(body) ||
      // Older outbound rows stored the raw upload name as content with no real caption.
      (['IMAGE', 'VIDEO', 'AUDIO'].includes(type || '') &&
        !message.metadata?.caption &&
        /\.(png|jpe?g|gif|webp|bmp|svg|mp4|mov|webm|ogg|mp3|m4a|aac|pdf)$/i.test(body));
    if (placeholders.has(body.toLowerCase()) || isFilenameOnly) {
      caption = undefined;
    } else if (type === 'DOCUMENT' && filename && body === filename) {
      caption = undefined;
    } else {
      caption = message.content;
    }
  }

  if (isUnsupported) {
    const kind =
      message.metadata?.unsupportedType ||
      unsupportedTypeFromContent(message.content) ||
      'unsupported';
    const { title, detail } = describeUnsupportedMessage(kind);
    return (
      <div className={rowClass} data-message-id={message.id}>
        {selectCheck}
        <div
          {...bubbleShellProps}
          className={`w-fit max-w-[min(100%,85%)] sm:max-w-[min(100%,75%)] ${bubbleShellProps.className}`}
        >
          <div className={`relative ${activeRing}`}>
            {actionMenu}
            {quoteStrip}
            <div
              className={`relative overflow-hidden shadow-[0_1px_1px_rgba(11,20,26,0.10)] wa-msg-font ${bubbleTone} ${radius}`}
            >
              {grouping.last && <BubbleTail outbound={isOutbound} />}
              <div className="flex gap-2.5 px-3 py-2.5">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                  <Info className="h-4 w-4" strokeWidth={2} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-chat-text">{title}</p>
                  <p className="mt-0.5 text-[11.5px] leading-snug text-chat-timestamp">{detail}</p>
                  <p className="mt-1.5 text-[10.5px] text-chat-timestamp/90">
                    Customer sent this in WhatsApp. Meta Cloud API does not expose it to businesses.
                  </p>
                  {(time || isOutbound) && (
                    <div className="mt-1.5 flex justify-end">{metaRow()}</div>
                  )}
                </div>
              </div>
            </div>
            {reactionChips}
          </div>
        </div>
      </div>
    );
  }

  if (mediaContent) {
    const isVisual = type === 'IMAGE' || type === 'VIDEO';
    return (
      <>
        <div className={rowClass} data-message-id={message.id}>
          {selectCheck}
          <div
            {...bubbleShellProps}
            className={`${
              isSticker ? 'w-fit shrink-0' : isVisual ? 'w-fit max-w-full' : bubbleMaxClass
            } ${bubbleShellProps.className}`}
          >
            <div
              className={`relative ${
                isSticker
                  ? 'w-fit shrink-0'
                  : isVisual
                    ? 'w-[min(100%,280px)] min-w-[min(100%,200px)]'
                    : ''
              }`}
            >
              {actionMenu}
              <div
                className={`relative wa-msg-font ${
                  isSticker
                    ? 'overflow-visible bg-transparent shadow-none rounded-xl p-0'
                    : `overflow-hidden shadow-[0_1px_1px_rgba(11,20,26,0.12)] ${bubbleTone} ${radius} ${
                        isVisual ? 'p-1' : 'p-1.5'
                      }`
                } ${activeRing}`}
              >
                {!isSticker && grouping.last && <BubbleTail outbound={isOutbound} />}
                {quoteStrip}
                <div
                  className={`relative ${
                    isSticker ? 'overflow-visible' : 'overflow-hidden rounded-[10px]'
                  }`}
                >
                {mediaContent}
                  {!isSticker && isVisual && (time || isOutbound) && (
                  <span className="pointer-events-none absolute bottom-1.5 right-1.5 rounded-full bg-black/45 px-1.5 py-0.5 backdrop-blur-[2px]">
                    {metaRow(true)}
                  </span>
                )}
              </div>
                {caption && !isSticker && (
                  <CollapsibleMessageText className="px-1.5 pb-1 pt-1.5">
                  {highlightText(caption, highlightQuery)}
                  </CollapsibleMessageText>
              )}
                {!isVisual && !isSticker && type !== 'AUDIO' && (time || isOutbound) && (
                  <div className="flex justify-end px-1 pb-0.5 whitespace-nowrap">{metaRow()}</div>
              )}
            </div>
              {reactionChips}
            <FailedRetryRow
              show={isFailed}
              retrying={retrying}
              explanation={sendFailure}
              onRetry={canRetryFailed ? () => onRetry?.(message) : undefined}
            />
            <AmbiguousStatusRow show={isAmbiguous} />
            </div>
          </div>
        </div>
        {!onOpenMedia && (
          <MediaViewer item={localViewer} onClose={() => setLocalViewer(null)} />
        )}
      </>
    );
  }

  return (
    <div className={rowClass} data-message-id={message.id}>
      {selectCheck}
      <div
        {...bubbleShellProps}
        className={`${bubbleMaxClass} ${bubbleShellProps.className}`}
      >
        <div className="relative">
          {actionMenu}
          <div
            className={`relative px-3 py-2 shadow-[0_1px_1px_rgba(11,20,26,0.10)] wa-msg-font ${bubbleTone} ${radius} ${activeRing}`}
        >
          {grouping.last && <BubbleTail outbound={isOutbound} />}
            {senderHeader}
            {templateLabel ? (
              <p className="mb-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-chat-timestamp">
                Template · {templateLabel}
              </p>
            ) : null}
            {isBizAppEcho ? (
              <p className="mb-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-sky-700 dark:text-sky-300">
                Sent from phone
              </p>
            ) : null}
            {quoteStrip}
            <CollapsibleMessageText endMeta={metaRow()}>
              {highlightText(templateBody, highlightQuery)}
            </CollapsibleMessageText>
          </div>
          {reactionChips}
          <FailedRetryRow
            show={isFailed}
            retrying={retrying}
            explanation={sendFailure}
            onRetry={canRetryFailed ? () => onRetry?.(message) : undefined}
          />
          <AmbiguousStatusRow show={isAmbiguous} />
        </div>
      </div>
    </div>
  );
}

function AmbiguousStatusRow({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div className="mt-1 flex items-center justify-end">
      <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">
        Send status unknown
      </span>
    </div>
  );
}

function FailedRetryRow({
  show,
  retrying,
  onRetry,
  explanation,
}: {
  show: boolean;
  retrying?: boolean;
  onRetry?: () => void;
  explanation: ReturnType<typeof explainWhatsAppSendFailureFromMessage> | null;
}) {
  if (!show) return null;
  return (
    <div className="mt-1 flex max-w-[min(100%,280px)] flex-col items-end gap-1">
      <p className="text-right text-[11px] font-semibold text-red-600 dark:text-red-400">
        {explanation?.title || 'Failed'}
      </p>
      {explanation?.body ? (
        <p className="text-right text-[11px] leading-snug text-red-700/90 dark:text-red-300/90">
          {explanation.body}
        </p>
      ) : null}
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          disabled={retrying}
          className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-700 ring-1 ring-red-200/70 transition hover:bg-red-100 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/60 focus-visible:ring-offset-1 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-500/30"
        >
          <RotateCcw className={`h-3 w-3 ${retrying ? 'animate-spin' : ''}`} strokeWidth={2.5} />
          Retry
        </button>
      ) : null}
    </div>
  );
}

export function DateDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center py-3" role="separator">
      <span className="rounded-full bg-chat-bubble-received/95 px-3.5 py-1 text-[11.5px] font-semibold tracking-wide text-chat-timestamp shadow-[0_1px_1px_rgba(11,20,26,0.06)]">
        {label}
      </span>
    </div>
  );
}

function CallSummaryCard({ message }: { message: Message }) {
  return (
    <CallSummaryNote
      variant="thread"
      summary={message.content}
      time={formatMessageTime(message.createdAt)}
      messageId={message.id}
    />
  );
}

function CallEventPill({ message }: { message: Message }) {
  const meta = message.metadata;
  const tone = meta?.callTone || (meta?.callStatus === 'COMPLETED' ? 'completed' : 'missed');
  const label =
    message.content && message.content !== '[call]'
      ? message.content
      : tone === 'completed'
        ? 'Voice call'
        : 'Missed voice call';
  const time = formatMessageTime(message.createdAt);
  const Icon =
    tone === 'completed'
      ? message.direction === 'INBOUND'
        ? PhoneIncoming
        : Phone
      : tone === 'failed'
        ? PhoneOff
        : PhoneMissed;

  const color =
    tone === 'completed'
      ? 'text-emerald-700 dark:text-emerald-400'
      : tone === 'failed'
        ? 'text-amber-700 dark:text-amber-400'
        : 'text-red-600 dark:text-red-400';

  return (
    <div
      className="flex items-center justify-center py-2.5"
      role="status"
      data-message-id={message.id}
    >
      <span
        className={`inline-flex max-w-[min(100%,320px)] items-center gap-1.5 rounded-full bg-chat-bubble-received/95 px-3 py-1 text-[11.5px] font-semibold tracking-wide shadow-[0_1px_1px_rgba(11,20,26,0.06)] ${color}`}
      >
        <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} />
        <span className="truncate">{label}</span>
        {time ? <span className="font-medium text-chat-timestamp/80">· {time}</span> : null}
      </span>
    </div>
  );
}
