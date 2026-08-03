import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type RefObject } from 'react';
import {
  ChevronDown,
  FileText,
  Image,
  IndianRupee,
  Mic,
  Paperclip,
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
  /** Kept for template/interactive parents; reply composer no longer locks on this. */
  sending: boolean;
  cannedReplies?: CannedReply[];
  onPaymentLink?: () => void;
  onInteractive?: () => void;
  onOpenTemplate?: () => void;
  /** Conversation id for in-chat media-limit notices. */
  conversationId?: string;
  /** Optional ref for keyboard shortcut focus. */
  inputRef?: RefObject<HTMLTextAreaElement>;
  replyToPreview?: string | null;
  onClearReply?: () => void;
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
  sending: _sending,
  cannedReplies = [],
  onPaymentLink,
  onInteractive,
  conversationId,
  inputRef,
  replyToPreview,
  onClearReply,
}: ChatComposerProps) {
  // `sending` intentionally unused for locking — optimistic send clears draft and
  // shows PENDING on the bubble; keeping the Send spinner made WhatsApp UX feel broken.
  void _sending;

  const { onShowTip, onHideTip } = useInboxGlassTip();
  const tipFor = (label: string) => composerTipProps(label, onShowTip, onHideTip);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const localTextareaRef = useRef<HTMLTextAreaElement>(null);
  const textareaRef = inputRef ?? localTextareaRef;
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [sendMenuOpen, setSendMenuOpen] = useState(false);
  const [sendAnim, setSendAnim] = useState<'punch' | 'shake' | null>(null);
  const [shortcutIndex, setShortcutIndex] = useState(0);
  const [recording, setRecording] = useState(false);
  const [recordSecs, setRecordSecs] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<number | null>(null);
  const recordSecsRef = useRef(0);
  const canRecord =
    typeof window !== 'undefined' &&
    typeof MediaRecorder !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia;
  const canSend = Boolean(value.trim() || attachment);

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
    setSendMenuOpen(false);
    textareaRef.current?.focus();
  };

  useEffect(
    () => () => {
      if (recordTimerRef.current) window.clearInterval(recordTimerRef.current);
      mediaRecorderRef.current?.stop();
    },
    []
  );

  // Esc closes popovers from anywhere in the composer.
  useEffect(() => {
    if (!attachMenuOpen && !emojiOpen && !slashMenuOpen && !sendMenuOpen) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (shortcutMatch) {
        onChange('');
        setShortcutIndex(0);
      }
      closeAllMenus([setAttachMenuOpen, setEmojiOpen, setSendMenuOpen]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [attachMenuOpen, emojiOpen, slashMenuOpen, sendMenuOpen, shortcutMatch, onChange]);

  const stopRecording = (cancel = false) => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;
    recorder.onstop = () => {
      if (recordTimerRef.current) {
        window.clearInterval(recordTimerRef.current);
        recordTimerRef.current = null;
      }
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
      const file = new File([blob], `voice-note-${Date.now()}.${ext}`, { type: blob.type || 'audio/webm' });
      onAttach(file);
    };
    recorder.stop();
    recorder.stream.getTracks().forEach((t) => t.stop());
  };

  const startRecording = async () => {
    if (!canRecord || !onAttach || recording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')
          ? 'audio/ogg;codecs=opus'
          : undefined;
      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      recordChunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) recordChunksRef.current.push(ev.data);
      };
      mediaRecorderRef.current = recorder;
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onAttach) onAttach(file);
    setAttachMenuOpen(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const openFilePicker = (accept: string) => {
    setAttachMenuOpen(false);
    setEmojiOpen(false);
    setSendMenuOpen(false);
    // Defer click so menu/overlay unmounts before the native picker opens
    // (avoids the fixed inset-0 backdrop swallowing the interaction).
    requestAnimationFrame(() => {
      if (fileInputRef.current) {
        fileInputRef.current.accept = accept;
        fileInputRef.current.click();
      }
    });
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
    onChange(reply.content);
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
    setSendMenuOpen(false);
    if (closeAfter && onSendAndClose) {
      onSendAndClose(e as FormEvent);
    } else {
      onSubmit(e as FormEvent);
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (filteredReplies.length > 0 && (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter')) {
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
      if (e.key === 'Enter' && !e.shiftKey) {
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
      closeAllMenus([setEmojiOpen, setAttachMenuOpen, setSendMenuOpen]);
    }
  };

  const toolBtn =
    'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-800 disabled:opacity-40 dark:hover:bg-neutral-800 dark:hover:text-neutral-200';

  const menuPanel =
    'absolute bottom-full z-40 mb-2 overflow-hidden rounded-xl border border-theme-border bg-theme-surface py-1 shadow-panel';
  const menuItem =
    'flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[13px] text-theme-secondary hover:bg-theme-subtle';

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        triggerSend(e);
      }}
      className="relative z-20 border-t border-neutral-100 bg-theme-surface/95 px-3 py-2.5 backdrop-blur-md sm:px-4 dark:border-neutral-800/80"
    >
      {replyToPreview && (
        <div className="mb-2 flex items-start gap-2 rounded-xl border-l-4 border-whatsapp-500 bg-neutral-50/90 px-2.5 py-2 dark:bg-neutral-900/50">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold text-whatsapp-700 dark:text-whatsapp-400">Replying</p>
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
          ) : (
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-chat-bubble-received text-chat-accent dark:bg-neutral-800">
              {attachment.type === 'VIDEO' ? <Image className="h-6 w-6" /> : <FileText className="h-6 w-6" />}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-theme-fg">{attachment.file.name}</p>
            <p className="text-[11px] text-theme-muted">{formatFileSize(attachment.file.size)}</p>
          </div>
          <button
            type="button"
            onClick={onRemoveAttachment}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-neutral-500 transition hover:bg-neutral-200/60"
            aria-label="Remove attachment"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {recording && (
        <div className="mb-2 flex items-center gap-2 rounded-xl border border-red-200/80 bg-red-50/90 px-3 py-2 dark:border-red-900/40 dark:bg-red-950/40">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
          <span className="text-[12.5px] font-semibold tabular-nums text-red-700 dark:text-red-300">
            Recording {Math.floor(recordSecs / 60)}:{String(recordSecs % 60).padStart(2, '0')}
            <span className="ml-1 font-normal opacity-70">/ 2:00</span>
          </span>
          <div className="ml-auto flex items-center gap-1">
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
        <div className="absolute bottom-full left-3 right-3 z-40 mb-2 max-h-48 overflow-y-auto rounded-xl border border-theme-border bg-theme-surface py-1 shadow-panel sm:left-4 sm:right-4">
          {filteredReplies.map((reply, i) => (
            <button
              key={reply.id}
              type="button"
              onClick={() => applyCanned(reply)}
              className={`flex w-full items-start gap-2 px-3 py-2 text-left transition ${
                i === shortcutIndex ? 'bg-theme-subtle' : 'hover:bg-theme-subtle'
              }`}
            >
              <Zap className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-600" />
              <span className="min-w-0">
                <span className="block text-[12px] font-bold text-theme-fg">/{reply.shortcut}</span>
                <span className="block truncate text-[11px] text-theme-muted">{reply.title}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      {emojiOpen && (
        <>
          {/* Backdrop sits below menus (z-30) so Photo/PDF shortcuts outside stay usable once closed;
              while open it only dismisses this popover. */}
          <div
            className="fixed inset-0 z-30"
            aria-hidden
            onMouseDown={(e) => {
              e.preventDefault();
              setEmojiOpen(false);
            }}
          />
          <div
            className="absolute bottom-full left-3 z-40 mb-2 grid w-[280px] grid-cols-6 gap-1 rounded-xl border border-theme-border bg-theme-surface p-2 shadow-panel sm:left-4"
            onMouseDown={(e) => e.stopPropagation()}
          >
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
        </>
      )}

      <div className="rounded-2xl border border-chat-input-border bg-chat-input-bg ring-1 ring-chat-input-border/40 transition focus-within:border-slate-400/70 focus-within:ring-slate-400/15 dark:focus-within:border-slate-500/60 dark:focus-within:ring-slate-500/15">
        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={attachment ? 'Add a caption (optional)...' : 'Type a message...'}
          className="max-h-36 min-h-[40px] w-full resize-none border-0 bg-transparent px-3.5 pb-1 pt-2.5 text-[14px] leading-snug text-theme-fg placeholder:text-theme-muted focus:outline-none"
        />

        <div className="flex items-center gap-0.5 px-2 pb-2 pt-0.5">
          <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto">
            <button
              type="button"
              className={toolBtn}
              aria-label="Emoji"
              aria-expanded={emojiOpen}
              {...tipFor('Emoji')}
              onClick={() => {
                setEmojiOpen((v) => !v);
                setAttachMenuOpen(false);
                setSendMenuOpen(false);
              }}
            >
              <Smile size={18} strokeWidth={2} />
            </button>

            <div className="relative">
              <button
                type="button"
                className={toolBtn}
                aria-label="Attach"
                aria-expanded={attachMenuOpen}
                {...tipFor('Attach')}
                onClick={(e) => {
                  e.stopPropagation();
                  onHideTip();
                  setAttachMenuOpen((v) => !v);
                  setEmojiOpen(false);
                  setSendMenuOpen(false);
                }}
              >
                <Paperclip size={18} strokeWidth={2} />
              </button>
              {attachMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-30"
                    aria-hidden
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setAttachMenuOpen(false);
                    }}
                  />
                  <div
                    className={`${menuPanel} left-0 w-48`}
                    role="menu"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => openFilePicker('image/*')}
                      className={menuItem}
                    >
                      <Image size={16} className="text-chat-accent" />
                      Photo
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => openFilePicker('video/*')}
                      className={menuItem}
                    >
                      <Image size={16} className="text-chat-accent" />
                      Video
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => openFilePicker('application/pdf,.pdf')}
                      className={menuItem}
                    >
                      <FileText size={16} className="text-chat-accent" />
                      PDF
                    </button>
                    {onPaymentLink && (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setAttachMenuOpen(false);
                          onPaymentLink();
                        }}
                        className={menuItem}
                      >
                        <IndianRupee size={16} className="text-chat-accent" />
                        Payment link
                      </button>
                    )}
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
                  </div>
                </>
              )}
            </div>

            <button
              type="button"
              className={toolBtn}
              aria-label="Photo"
              {...tipFor('Photo')}
              onClick={() => openFilePicker('image/*')}
            >
              <Image size={18} strokeWidth={2} />
            </button>
            <button
              type="button"
              className={toolBtn}
              aria-label="PDF"
              {...tipFor('PDF')}
              onClick={() => openFilePicker('application/pdf,.pdf')}
            >
              <FileText size={18} strokeWidth={2} />
            </button>
            <button
              type="button"
              className={toolBtn}
              aria-label="Quick replies"
              aria-expanded={slashMenuOpen}
              disabled={cannedReplies.length === 0 || recording}
              {...tipFor('Quick replies · also in Details')}
              onClick={toggleSlashMenu}
            >
              <Zap size={16} strokeWidth={2} />
            </button>
            {canRecord && (
              <button
                type="button"
                className={`${toolBtn} ${recording ? 'text-red-600' : ''}`}
                aria-label={recording ? 'Stop recording' : 'Voice note'}
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
              disabled={recording || cannedReplies.length === 0}
              {...tipFor('Type / for quick replies')}
              onClick={toggleSlashMenu}
            >
              /
            </button>

            <div className="relative flex rounded-xl shadow-[0_4px_14px_rgba(37,211,102,0.35)]">
              <button
                type="submit"
                disabled={!canSend}
                aria-label="Send"
                {...tipFor('Send')}
                className={`inline-flex h-9 items-center gap-1.5 rounded-l-xl bg-gradient-to-br from-whatsapp-500 to-whatsapp-600 px-3.5 text-[13px] font-bold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:from-neutral-300 disabled:to-neutral-400 disabled:shadow-none ${
                  sendAnim === 'punch' ? 'inbox-send-punch' : sendAnim === 'shake' ? 'inbox-send-shake' : ''
                }`}
              >
                <SendHorizontal size={15} strokeWidth={2.25} />
                Send
              </button>
              <button
                type="button"
                aria-label="Send options"
                aria-expanded={sendMenuOpen}
                disabled={!canSend}
                {...tipFor('Send options')}
                onClick={(e) => {
                  e.stopPropagation();
                  onHideTip();
                  setSendMenuOpen((v) => !v);
                  setAttachMenuOpen(false);
                  setEmojiOpen(false);
                }}
                className="inline-flex h-9 w-8 items-center justify-center rounded-r-xl border-l border-white/25 bg-gradient-to-br from-whatsapp-500 to-whatsapp-600 text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:from-neutral-300 disabled:to-neutral-400"
              >
                <ChevronDown size={14} strokeWidth={2.5} />
              </button>
              {sendMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-30"
                    aria-hidden
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setSendMenuOpen(false);
                    }}
                  />
                  <div
                    className={`${menuPanel} right-0 w-52`}
                    role="menu"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      role="menuitem"
                      className="flex w-full px-3 py-2 text-left text-[13px] font-medium text-theme-fg hover:bg-theme-subtle"
                      onClick={(e) => triggerSend(e)}
                    >
                      Send
                    </button>
                    {/* Closes the conversation after a successful outbound send — useful for one-and-done replies. */}
                    {onSendAndClose && (
                      <button
                        type="button"
                        role="menuitem"
                        disabled={!canSend}
                        className="flex w-full px-3 py-2 text-left text-[13px] font-medium text-theme-fg hover:bg-theme-subtle disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={(e) => triggerSend(e, true)}
                      >
                        Send &amp; mark done
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
