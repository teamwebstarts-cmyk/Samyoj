import { useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import {
  FileText,
  Image,
  Mic,
  Paperclip,
  Pause,
  Play,
  SendHorizontal,
  Smile,
  Sparkles,
  Square,
  X,
  Zap,
} from 'lucide-react';
import type { CannedReply } from '../../types';
import { VOICE_MAX_SECONDS } from './mediaLimits';
import { emitChatNotice } from './chatNoticeBus';
import { composerTipProps, useInboxGlassTip } from './ComposerGlassTip';
import { META_DM_LIMITS } from './metaMessagingLimits';

function useMinWidth(minPx: number) {
  const [matches, setMatches] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(`(min-width: ${minPx}px)`).matches
  );
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${minPx}px)`);
    const update = () => setMatches(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, [minPx]);
  return matches;
}

export interface PendingAttachment {
  file: File;
  previewUrl?: string;
  type: 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'AUDIO';
}

export type { ComposerTab } from './ComposerModeHeader';

const COMMON_EMOJIS = [
  '😀', '😁', '😂', '🤣', '😊', '😍', '🥰', '😘', '😎', '🤔',
  '👍', '👎', '👏', '🙏', '🔥', '✨', '🎉', '❤️', '💯', '✅',
  '😢', '😭', '😮', '😴', '🤝', '💪', '🙌', '⭐', '📌', '📎',
];

/** Portaled popover so menus aren't clipped by overflow-x-auto / backdrop-blur ancestors. */
function ComposerPortalMenu({
  open,
  anchorRef,
  align = 'left',
  widthClass,
  onClose,
  children,
}: {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  align?: 'left' | 'right';
  widthClass: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }
    const el = anchorRef.current;
    if (!el) return;
    const place = () => {
      const r = el.getBoundingClientRect();
      const gap = 8;
      const left = align === 'right' ? r.right : r.left;
      setCoords({ top: r.top - gap, left });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, anchorRef, align]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[180]"
        aria-hidden
        onMouseDown={(e) => {
          e.preventDefault();
          onClose();
        }}
      />
      <div
        role="menu"
        className={`fixed z-[190] ${widthClass} -translate-y-full overflow-hidden rounded-xl border border-theme-border bg-theme-surface py-1 shadow-panel ${
          align === 'right' ? '-translate-x-full' : ''
        }`}
        style={{
          top: coords?.top ?? 0,
          left: coords?.left ?? 0,
          visibility: coords ? 'visible' : 'hidden',
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </>,
    document.body
  );
}

interface ChatComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (e: FormEvent) => void;
  /**
   * Send message then mark conversation CLOSED.
   * Wired from InboxPage via onStatusChange('CLOSED') after a successful send.
   */
  onSendAndClose?: (e: FormEvent) => void;
  onAttach?: (file: File) => void;
  attachment?: PendingAttachment | null;
  onRemoveAttachment?: () => void;
  canSendMessages?: boolean;
  /** Shown on hover when the composer is blocked (Facebook / Instagram window). */
  blockedReason?: string;
  /** Kept for template/interactive parents; reply composer no longer locks on this. */
  sending: boolean;
  cannedReplies?: CannedReply[];
  onInteractive?: () => void;
  onOpenTemplate?: () => void;
  /** Conversation id for in-chat media-limit notices. */
  conversationId?: string;
  /** Optional ref for keyboard shortcut focus. */
  inputRef?: RefObject<HTMLTextAreaElement>;
  replyToPreview?: string | null;
  onClearReply?: () => void;
  contactName?: string | null;
  agentName?: string | null;
  platform?: 'whatsapp' | 'facebook' | 'instagram';
  attachCapabilities?: {
    photo?: boolean;
    video?: boolean;
    pdf?: boolean;
    voice?: boolean;
  };
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function closeAllMenus(
  setters: Array<(v: boolean) => void>
) {
  setters.forEach((set) => set(false));
}

/** Skeleton shown while the service window state is loading (tri-state). */
export function ComposerSkeleton() {
  return (
    <div className="border-t border-neutral-100 bg-theme-surface/95 px-3 py-3 sm:px-4 dark:border-neutral-800/80">
      <div className="mb-2 flex gap-4">
        <div className="inbox-skeleton-shimmer h-4 w-12 rounded" />
        <div className="inbox-skeleton-shimmer h-4 w-16 rounded" />
        <div className="inbox-skeleton-shimmer h-4 w-20 rounded" />
      </div>
      <div className="inbox-skeleton-shimmer h-[72px] w-full rounded-2xl" />
    </div>
  );
}

export default function ChatComposer({
  value,
  onChange,
  onSubmit,
  onSendAndClose,
  onAttach,
  attachment,
  onRemoveAttachment,
  canSendMessages = true,
  blockedReason,
  sending: _sending,
  cannedReplies = [],
  onInteractive,
  conversationId,
  inputRef,
  replyToPreview,
  onClearReply,
  contactName,
  agentName,
  platform = 'whatsapp',
  attachCapabilities,
}: ChatComposerProps) {
  const attach = {
    photo: attachCapabilities?.photo ?? true,
    video: attachCapabilities?.video ?? true,
    pdf: attachCapabilities?.pdf ?? true,
    voice: attachCapabilities?.voice ?? true,
  };
  const showAttachMenu = Boolean(onAttach && (attach.photo || attach.video || attach.pdf));
  // `sending` intentionally unused for locking — optimistic send clears draft and
  // shows PENDING on the bubble; keeping the Send spinner made WhatsApp UX feel broken.
  void _sending;

  const { onShowTip, onHideTip } = useInboxGlassTip();
  const tipFor = (label: string) => composerTipProps(label, onShowTip, onHideTip);
  const accent = platform === 'facebook'
    ? {
        border: 'border-[#1877F2]',
        text: 'text-[#1877F2]',
        primary: 'bg-[#1877F2] text-white shadow-[0_4px_14px_rgba(24,119,242,0.28)] hover:brightness-105',
      }
    : platform === 'instagram'
      ? {
          border: 'border-[#E4405F]',
          text: 'text-[#d6335a]',
          primary: 'bg-[#E4405F] text-white shadow-[0_4px_14px_rgba(228,64,95,0.28)] hover:brightness-105',
        }
      : {
          border: 'border-whatsapp-500',
          text: 'text-whatsapp-700 dark:text-whatsapp-400',
          primary: 'bg-gradient-to-br from-whatsapp-500 to-whatsapp-600 text-white shadow-[0_4px_14px_rgba(37,211,102,0.35)] hover:brightness-105',
        };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const localTextareaRef = useRef<HTMLTextAreaElement>(null);
  const textareaRef = inputRef ?? localTextareaRef;
  const attachBtnMobileRef = useRef<HTMLButtonElement>(null);
  const attachBtnDesktopRef = useRef<HTMLButtonElement>(null);
  const emojiBtnRef = useRef<HTMLButtonElement>(null);
  const isMdUp = useMinWidth(768);
  const attachMenuAnchorRef = isMdUp ? attachBtnDesktopRef : attachBtnMobileRef;
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [sendAnim, setSendAnim] = useState<'punch' | 'shake' | null>(null);
  const [shortcutIndex, setShortcutIndex] = useState(0);
  const [recording, setRecording] = useState(false);
  const [recordSecs, setRecordSecs] = useState(0);
  const [levels, setLevels] = useState<number[]>(() => Array.from({ length: 28 }, () => 0.12));
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<number | null>(null);
  const recordSecsRef = useRef(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const levelRafRef = useRef<number | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const canRecord =
    typeof window !== 'undefined' &&
    typeof MediaRecorder !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia;
  const showVoice = Boolean(onAttach && attach.voice && canRecord);
  const isMetaDm = platform === 'facebook' || platform === 'instagram';
  const canSend = canSendMessages && Boolean(value.trim() || attachment);
  const blockedHint = canSendMessages
    ? ''
    : blockedReason ||
      (platform === 'instagram'
        ? 'Blocked until they message you again. Instagram has no template to reopen this chat.'
        : platform === 'facebook'
          ? 'Blocked until they message your Page again. The 24-hour window is closed.'
          : 'Sending is blocked until the customer messages again.');
  const isVoiceAttachment =
    attachment?.type === 'AUDIO' &&
    (attachment.file.name.startsWith('voice-note-') || attachment.file.type.startsWith('audio/'));

  const stopLevelMeter = () => {
    if (levelRafRef.current) {
      cancelAnimationFrame(levelRafRef.current);
      levelRafRef.current = null;
    }
    analyserRef.current = null;
    if (audioCtxRef.current) {
      void audioCtxRef.current.close().catch(() => undefined);
      audioCtxRef.current = null;
    }
    setLevels(Array.from({ length: 28 }, () => 0.12));
  };

  const startLevelMeter = (stream: MediaStream) => {
    stopLevelMeter();
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.75;
      source.connect(analyser);
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
      const data = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
        const node = analyserRef.current;
        if (!node) return;
        node.getByteFrequencyData(data);
        const next: number[] = [];
        const step = Math.max(1, Math.floor(data.length / 28));
        for (let i = 0; i < 28; i += 1) {
          const v = data[Math.min(data.length - 1, i * step)] / 255;
          next.push(0.1 + v * 0.9);
        }
        setLevels(next);
        levelRafRef.current = requestAnimationFrame(tick);
      };
      levelRafRef.current = requestAnimationFrame(tick);
    } catch {
      /* analyser optional */
    }
  };

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 144)}px`;
  }, [value, textareaRef]);

  // Slash menu is open only while the draft is exactly a slash command (`/`, `/thanks`, …).
  // Empty drafts or normal text must never keep the picker visible.
  const shortcutMatch = value.match(/^\/([a-z0-9_-]*)$/i);
  const filteredReplies = useMemo(() => {
    if (!shortcutMatch) return [];
    const q = shortcutMatch[1].toLowerCase();
    const list = q
      ? cannedReplies.filter((r) => r.shortcut.startsWith(q) || r.title.toLowerCase().includes(q))
      : cannedReplies;
    return list.slice(0, 8);
  }, [cannedReplies, shortcutMatch]);

  const slashMenuOpen = filteredReplies.length > 0;

  useEffect(() => {
    setShortcutIndex(0);
  }, [filteredReplies.length, shortcutMatch?.[1]]);

  /** Open slash picker by ensuring draft is a slash command; close by clearing a slash-only draft. */
  const toggleSlashMenu = () => {
    if (shortcutMatch) {
      onChange('');
      setShortcutIndex(0);
    } else {
      // Empty → `/`; normal text → `/text`; invalid `/…` draft → reset to `/`.
      onChange(!value || value.startsWith('/') ? '/' : `/${value}`);
    }
    setAttachMenuOpen(false);
    setEmojiOpen(false);
    textareaRef.current?.focus();
  };

  useEffect(
    () => () => {
      if (recordTimerRef.current) window.clearInterval(recordTimerRef.current);
      stopLevelMeter();
      mediaRecorderRef.current?.stop();
      previewAudioRef.current?.pause();
    },
    []
  );

  useEffect(() => {
    setPreviewPlaying(false);
    previewAudioRef.current?.pause();
    if (previewAudioRef.current) previewAudioRef.current.currentTime = 0;
  }, [attachment?.previewUrl, attachment?.file.name]);

  const stopRecording = (cancel = false) => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;
    recorder.onstop = () => {
      if (recordTimerRef.current) {
        window.clearInterval(recordTimerRef.current);
        recordTimerRef.current = null;
      }
      stopLevelMeter();
      setRecording(false);
      setRecordSecs(0);
      recordSecsRef.current = 0;
      mediaRecorderRef.current = null;
      if (cancel || !onAttach) {
        recordChunksRef.current = [];
        return;
      }
      const blob = new Blob(recordChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
      recordChunksRef.current = [];
      if (blob.size < 200) return;
      const ext = blob.type.includes('ogg') ? 'ogg' : 'webm';
      const file = new File([blob], `voice-note-${Date.now()}.${ext}`, {
        type: blob.type || 'audio/webm',
      });
      onAttach(file);
    };
    if (recorder.state !== 'inactive') recorder.stop();
    recorder.stream.getTracks().forEach((t) => t.stop());
  };

  const startRecording = async () => {
    if (!canRecord || !onAttach || recording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      const mime = MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')
        ? 'audio/ogg;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : undefined;
      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      recordChunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) recordChunksRef.current.push(ev.data);
      };
      mediaRecorderRef.current = recorder;
      startLevelMeter(stream);
      recorder.start(200);
      setRecording(true);
      setRecordSecs(0);
      recordSecsRef.current = 0;
      recordTimerRef.current = window.setInterval(() => {
        recordSecsRef.current += 1;
        const next = recordSecsRef.current;
        setRecordSecs(next);
        if (next >= VOICE_MAX_SECONDS) {
          if (recordTimerRef.current) {
            window.clearInterval(recordTimerRef.current);
            recordTimerRef.current = null;
          }
          if (conversationId) {
            emitChatNotice(conversationId, {
              kind: 'media-limit',
              message: 'Voice notes max 2 minutes',
              tone: 'amber',
              icon: 'star',
            });
          }
          stopRecording(false);
        }
      }, 1000);
    } catch {
      /* mic permission denied */
    }
  };

  const togglePreviewPlayback = () => {
    const url = attachment?.previewUrl;
    if (!url || attachment?.type !== 'AUDIO') return;
    let audio = previewAudioRef.current;
    if (!audio || audio.src !== url) {
      audio?.pause();
      audio = new Audio(url);
      previewAudioRef.current = audio;
      audio.onended = () => setPreviewPlaying(false);
      audio.onpause = () => setPreviewPlaying(false);
      audio.onplay = () => setPreviewPlaying(true);
    }
    if (audio.paused) {
      void audio.play().then(() => setPreviewPlaying(true)).catch(() => setPreviewPlaying(false));
    } else {
      audio.pause();
      setPreviewPlaying(false);
    }
  };

  // Esc closes popovers from anywhere in the composer.
  useEffect(() => {
    if (!attachMenuOpen && !emojiOpen && !slashMenuOpen) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (shortcutMatch) {
        onChange('');
        setShortcutIndex(0);
      }
      closeAllMenus([setAttachMenuOpen, setEmojiOpen]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [attachMenuOpen, emojiOpen, slashMenuOpen, shortcutMatch, onChange]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onAttach) onAttach(file);
    setAttachMenuOpen(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const openFilePicker = (accept: string) => {
    setAttachMenuOpen(false);
    setEmojiOpen(false);
    // Defer until portaled menu/backdrop unmounts so the native picker isn't blocked.
    window.setTimeout(() => {
      if (fileInputRef.current) {
        fileInputRef.current.accept = accept;
        fileInputRef.current.click();
      }
    }, 0);
  };

  const insertEmoji = (emoji: string) => {
    const el = textareaRef.current;
    if (!el) {
      onChange(value + emoji);
      return;
    }
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const next = value.slice(0, start) + emoji + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + emoji.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const applyCanned = (reply: CannedReply) => {
    let content = reply.content;
    if (contactName) {
      content = content.replace(/\{\{\s*(name|contact\.name)\s*\}\}/gi, contactName);
    }
    if (agentName) {
      content = content.replace(/\{\{\s*(agent|agent\.name|my\.name)\s*\}\}/gi, agentName);
    }
    onChange(content);
    setShortcutIndex(0);
    textareaRef.current?.focus();
  };

  const triggerSend = (e: FormEvent | KeyboardEvent, closeAfter = false) => {
    if (!canSend) {
      setSendAnim('shake');
      window.setTimeout(() => setSendAnim(null), 280);
      return;
    }
    setSendAnim('punch');
    window.setTimeout(() => setSendAnim(null), 180);
    if (closeAfter && onSendAndClose) {
      onSendAndClose(e as FormEvent);
    } else {
      onSubmit(e as FormEvent);
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (filteredReplies.length > 0 && (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === 'Tab')) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setShortcutIndex((i) => (i + 1) % filteredReplies.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setShortcutIndex((i) => (i - 1 + filteredReplies.length) % filteredReplies.length);
        return;
      }
      if ((e.key === 'Enter' || e.key === 'Tab') && !e.shiftKey) {
        e.preventDefault();
        applyCanned(filteredReplies[shortcutIndex] ?? filteredReplies[0]);
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      triggerSend(e);
    }
    if (e.key === 'Escape') {
      if (shortcutMatch) {
        onChange('');
        setShortcutIndex(0);
      }
      closeAllMenus([setEmojiOpen, setAttachMenuOpen]);
    }
  };

  const toolBtn =
    'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-800 disabled:opacity-40 dark:hover:bg-neutral-800 dark:hover:text-neutral-200';

  const sendBtnClass = (extra = '') =>
    `inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition disabled:cursor-not-allowed disabled:from-neutral-300 disabled:to-neutral-400 disabled:shadow-none ${extra}`;

  const menuItem =
    'flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[13px] text-theme-secondary hover:bg-theme-subtle';

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        triggerSend(e);
      }}
      className="relative z-20 border-t border-neutral-100 bg-theme-surface/95 px-2 py-2 backdrop-blur-md sm:px-3 sm:py-2.5 md:px-4 dark:border-neutral-800/80"
    >
      {replyToPreview && (
        <div className={`mb-2 flex items-start gap-2 rounded-xl border-l-4 ${accent.border} bg-neutral-50/90 px-2.5 py-2 dark:bg-neutral-900/50`}>
          <div className="min-w-0 flex-1">
            <p className={`text-[11px] font-bold ${accent.text}`}>Replying</p>
            <p className="truncate text-[12px] text-theme-muted">{replyToPreview}</p>
          </div>
          <button
            type="button"
            onClick={onClearReply}
            className={toolBtn}
            aria-label="Cancel reply"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {attachment && (
        <div className="mb-2 flex items-center gap-2.5 rounded-2xl border border-neutral-200/70 bg-neutral-50/90 p-2.5 shadow-sm dark:border-neutral-700/60 dark:bg-neutral-800/40">
          {attachment.previewUrl && attachment.type === 'IMAGE' ? (
            <img
              src={attachment.previewUrl}
              alt="Preview"
              className="h-14 w-14 shrink-0 rounded-lg object-cover"
            />
          ) : isVoiceAttachment ? (
            <button
              type="button"
              onClick={togglePreviewPlayback}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-whatsapp-500 text-white shadow-sm transition hover:brightness-105"
              aria-label={previewPlaying ? 'Pause voice note' : 'Play voice note'}
            >
              {previewPlaying ? (
                <Pause className="h-5 w-5" fill="currentColor" />
              ) : (
                <Play className="h-5 w-5 translate-x-0.5" fill="currentColor" />
              )}
            </button>
          ) : (
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-chat-bubble-received text-chat-accent dark:bg-neutral-800">
              {attachment.type === 'VIDEO' ? <Image className="h-6 w-6" /> : <FileText className="h-6 w-6" />}
            </div>
          )}
          <div className="min-w-0 flex-1">
            {isVoiceAttachment ? (
              <>
                <p className="text-[13px] font-semibold text-theme-fg">Voice note</p>
                <p className="text-[11px] text-theme-muted">
                  {formatFileSize(attachment.file.size)} · tap play to listen, then send
                </p>
                <div className="mt-1.5 flex h-7 items-end gap-[2px]">
                  {Array.from({ length: 24 }).map((_, i) => {
                    const h = 20 + ((i * 37) % 60);
                    return (
                      <span
                        key={i}
                        className={`w-[3px] rounded-full ${previewPlaying ? 'bg-whatsapp-500' : 'bg-whatsapp-500/45'}`}
                        style={{ height: `${h}%` }}
                      />
                    );
                  })}
                </div>
              </>
            ) : (
              <>
                <p className="truncate text-[13px] font-medium text-theme-fg">{attachment.file.name}</p>
                <p className="text-[11px] text-theme-muted">{formatFileSize(attachment.file.size)}</p>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              previewAudioRef.current?.pause();
              setPreviewPlaying(false);
              onRemoveAttachment?.();
            }}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-neutral-500 transition hover:bg-neutral-200/60"
            aria-label="Remove attachment"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {recording && (
        <div className="mb-2 flex items-center gap-2.5 rounded-xl border border-red-200/80 bg-red-50/90 px-3 py-2.5 dark:border-red-900/40 dark:bg-red-950/40">
          <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-red-500" />
          <div className="flex h-8 min-w-0 flex-1 items-end gap-[2px] px-1" aria-hidden>
            {levels.map((level, i) => (
              <span
                key={i}
                className="w-[3px] rounded-full bg-red-500/80 transition-[height] duration-75"
                style={{ height: `${Math.max(12, Math.round(level * 100))}%` }}
              />
            ))}
          </div>
          <span className="shrink-0 text-[12.5px] font-semibold tabular-nums text-red-700 dark:text-red-300">
            {Math.floor(recordSecs / 60)}:{String(recordSecs % 60).padStart(2, '0')}
            <span className="ml-1 font-normal opacity-70">/ 2:00</span>
          </span>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              className={toolBtn}
              aria-label="Cancel recording"
              onClick={() => stopRecording(true)}
            >
              <X size={14} />
            </button>
            <button
              type="button"
              className="inline-flex h-8 items-center gap-1 rounded-lg bg-red-600 px-2.5 text-[12px] font-bold text-white"
              onClick={() => stopRecording(false)}
            >
              <Square size={12} fill="currentColor" />
              Stop
            </button>
          </div>
        </div>
      )}

      <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect} />

      {slashMenuOpen && (
        <div className="absolute bottom-full left-3 right-3 z-40 mb-2 max-h-60 overflow-hidden rounded-xl border border-theme-border bg-theme-surface/98 shadow-[0_8px_30px_rgba(0,0,0,0.12)] backdrop-blur-md sm:left-4 sm:right-4">
          <div className="flex items-center justify-between border-b border-theme-border/60 bg-theme-subtle/50 px-3 py-1.5 text-[11px] font-semibold text-theme-muted">
            <span className="flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-amber-500" />
              Quick Replies ({filteredReplies.length})
            </span>
            <span className="text-[10px] opacity-75">↑↓ navigate · ↵ / Tab select · Esc close</span>
          </div>
          <div className="max-h-52 overflow-y-auto py-1">
            {filteredReplies.map((reply, i) => (
              <button
                key={reply.id}
                type="button"
                onClick={() => applyCanned(reply)}
                className={`flex w-full items-start gap-2.5 px-3 py-2 text-left transition ${
                  i === shortcutIndex
                    ? 'bg-whatsapp-50 text-whatsapp-900 dark:bg-whatsapp-950/50 dark:text-whatsapp-100'
                    : 'hover:bg-theme-subtle text-theme-fg'
                }`}
              >
                <span className="mt-0.5 inline-flex items-center justify-center rounded-md bg-amber-100 px-1.5 py-0.5 text-[10.5px] font-bold text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                  /{reply.shortcut}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[12.5px] font-semibold truncate">{reply.title}</span>
                  <span className="block truncate text-[11px] text-theme-muted">{reply.content}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {emojiOpen && (
        <ComposerPortalMenu
          open={emojiOpen}
          anchorRef={emojiBtnRef}
          align="left"
          widthClass="w-[280px]"
          onClose={() => setEmojiOpen(false)}
        >
          <div className="grid grid-cols-6 gap-1 p-2">
            {COMMON_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-[18px] transition hover:bg-theme-subtle"
                onClick={() => {
                  insertEmoji(emoji);
                  setEmojiOpen(false);
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
        </ComposerPortalMenu>
      )}

      {showAttachMenu ? (
      <ComposerPortalMenu
        open={attachMenuOpen}
        anchorRef={attachMenuAnchorRef}
        align="left"
        widthClass="w-48"
        onClose={() => setAttachMenuOpen(false)}
      >
        {attach.photo ? (
        <button
          type="button"
          role="menuitem"
          onClick={() => openFilePicker('image/png,image/jpeg,.png,.jpg,.jpeg')}
          className={menuItem}
        >
          <Image size={16} className="text-chat-accent" />
          Photo
        </button>
        ) : null}
        {attach.video ? (
        <button
          type="button"
          role="menuitem"
          onClick={() => openFilePicker('video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm')}
          className={menuItem}
        >
          <Image size={16} className="text-chat-accent" />
          Video
        </button>
        ) : null}
        {attach.pdf ? (
        <button
          type="button"
          role="menuitem"
          onClick={() => openFilePicker('application/pdf,.pdf')}
          className={menuItem}
        >
          <FileText size={16} className="text-chat-accent" />
          PDF
        </button>
        ) : null}
        {onInteractive && (
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setAttachMenuOpen(false);
              onInteractive();
            }}
            className={menuItem}
          >
            <Sparkles size={16} className="text-violet-600" />
            Interactive
          </button>
        )}
      </ComposerPortalMenu>
      ) : null}

      <div className={`relative flex items-end gap-1.5 md:block ${canSendMessages ? '' : 'cursor-not-allowed'}`}>
        {!canSendMessages ? (
          <div
            className="absolute inset-0 z-30 cursor-not-allowed"
            role="note"
            aria-label={blockedHint}
            {...tipFor(blockedHint)}
          />
        ) : null}
        {showAttachMenu ? (
        <button
          ref={attachBtnMobileRef}
          type="button"
          className={`${toolBtn} md:hidden`}
          aria-label="Attach"
          aria-expanded={attachMenuOpen}
          disabled={!canSendMessages}
          {...tipFor('Attach')}
          onClick={(e) => {
            e.stopPropagation();
            onHideTip();
            setAttachMenuOpen((v) => !v);
            setEmojiOpen(false);
          }}
        >
          <Paperclip size={20} strokeWidth={2} />
        </button>
        ) : null}

        <div className="min-w-0 flex-1 rounded-3xl border border-chat-input-border bg-chat-input-bg ring-1 ring-chat-input-border/40 transition focus-within:border-slate-400/70 focus-within:ring-slate-400/15 md:rounded-2xl dark:focus-within:border-slate-500/60 dark:focus-within:ring-slate-500/15">
          <textarea
            ref={textareaRef}
            rows={1}
            value={value}
            disabled={!canSendMessages}
            maxLength={isMetaDm ? META_DM_LIMITS.TEXT_CHARS : undefined}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={attachment ? 'Add a caption (optional)...' : 'Type a message...'}
            className="max-h-36 min-h-[38px] w-full resize-none border-0 bg-transparent px-3 pb-1.5 pt-2 text-[14px] leading-snug text-theme-fg placeholder:text-theme-muted focus:outline-none md:min-h-[40px] md:px-3.5 md:pb-1 md:pt-2.5"
          />

          <div className="hidden items-center gap-0.5 px-2 pb-2 pt-0.5 md:flex">
            <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <button
                ref={emojiBtnRef}
                type="button"
                className={toolBtn}
                aria-label="Emoji"
                aria-expanded={emojiOpen}
                disabled={!canSendMessages}
                {...tipFor('Emoji')}
                onClick={() => {
                  setEmojiOpen((v) => !v);
                  setAttachMenuOpen(false);
                }}
              >
                <Smile size={18} strokeWidth={2} />
              </button>

              <div className="relative">
                {showAttachMenu ? (
                <button
                  ref={attachBtnDesktopRef}
                  type="button"
                  className={toolBtn}
                  aria-label="Attach"
                  aria-expanded={attachMenuOpen}
                  disabled={!canSendMessages}
                  {...tipFor('Attach')}
                  onClick={(e) => {
                    e.stopPropagation();
                    onHideTip();
                    setAttachMenuOpen((v) => !v);
                    setEmojiOpen(false);
                  }}
                >
                  <Paperclip size={18} strokeWidth={2} />
                </button>
                ) : null}
              </div>

              <button
                type="button"
                className={toolBtn}
                aria-label="Quick replies"
                aria-expanded={slashMenuOpen}
                disabled={!canSendMessages || cannedReplies.length === 0 || recording}
                {...tipFor('Quick replies · also in Details')}
                onClick={toggleSlashMenu}
              >
                <Zap size={16} strokeWidth={2} />
              </button>
              {showVoice && (
                <button
                  type="button"
                  className={`${toolBtn} ${recording ? 'text-red-600' : ''}`}
                  aria-label={recording ? 'Stop recording' : 'Voice note'}
                  disabled={!canSendMessages}
                  {...tipFor(recording ? 'Stop' : 'Voice note')}
                  onClick={() => (recording ? stopRecording(false) : void startRecording())}
                >
                  <Mic size={18} strokeWidth={2} />
                </button>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-1.5 pl-1">
              <button
                type="button"
                className={`${toolBtn} text-[13px] font-semibold text-neutral-400 hover:text-neutral-700 dark:text-neutral-500 dark:hover:text-neutral-200`}
                aria-label="Quick replies"
                aria-expanded={slashMenuOpen}
                disabled={!canSendMessages || recording || cannedReplies.length === 0}
                {...tipFor('Type / for quick replies')}
                onClick={toggleSlashMenu}
              >
                /
              </button>

              <button
                type="submit"
                disabled={!canSend}
                aria-label="Send"
                {...tipFor('Send')}
                className={sendBtnClass(
                  `${accent.primary} ${
                    sendAnim === 'punch' ? 'inbox-send-punch' : sendAnim === 'shake' ? 'inbox-send-shake' : ''
                  }`
                )}
              >
                <SendHorizontal size={18} strokeWidth={2.25} />
              </button>
            </div>
          </div>
        </div>

        {!recording && (
          <div className="flex shrink-0 md:hidden">
            {canSend ? (
              <button
                type="submit"
                disabled={!canSend}
                aria-label="Send"
                {...tipFor('Send')}
                className={sendBtnClass(
                  `${accent.primary} ${
                    sendAnim === 'punch' ? 'inbox-send-punch' : sendAnim === 'shake' ? 'inbox-send-shake' : ''
                  }`
                )}
              >
                <SendHorizontal size={18} strokeWidth={2.25} />
              </button>
            ) : showVoice ? (
              <button
                type="button"
                className={sendBtnClass(
                  'bg-neutral-200 text-neutral-600 hover:bg-neutral-300 dark:bg-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-600'
                )}
                aria-label="Voice note"
                {...tipFor('Voice note')}
                onClick={() => void startRecording()}
              >
                <Mic size={18} strokeWidth={2} />
              </button>
            ) : null}
          </div>
        )}
      </div>
    </form>
  );
}
