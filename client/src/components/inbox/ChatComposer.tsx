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

export interface PendingAttachment {
  file: File;
  previewUrl?: string;
  type: 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'AUDIO';
}

export type ComposerTab = 'reply' | 'template' | 'interactive';

interface ComposerTabsProps {
  active: ComposerTab;
  replyLocked?: boolean;
  onChange: (tab: ComposerTab) => void;
}

const COMMON_EMOJIS = [
  '😀', '😁', '😂', '🤣', '😊', '😍', '🥰', '😘', '😎', '🤔',
  '👍', '👎', '👏', '🙏', '🔥', '✨', '🎉', '❤️', '💯', '✅',
  '😢', '😭', '😮', '😴', '🤝', '💪', '🙌', '⭐', '📌', '📎',
];

export function ComposerTabs({ active, replyLocked, onChange }: ComposerTabsProps) {
  const tabs: { id: ComposerTab; label: string; locked?: boolean }[] = [
    { id: 'reply', label: 'Reply', locked: replyLocked },
    { id: 'template', label: 'Template' },
    { id: 'interactive', label: 'Interactive', locked: replyLocked },
  ];
  return (
    <div
      className="flex items-center gap-4 border-b border-neutral-100 px-3 pt-1 sm:px-4 dark:border-neutral-800/80"
      role="tablist"
      aria-label="Composer mode"
    >
      {tabs.map((tab) => {
        const selected = active === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={selected}
            disabled={tab.locked}
            onClick={() => onChange(tab.id)}
            className={`relative pb-2 pt-1.5 text-[13px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
              selected ? 'text-whatsapp-600 dark:text-whatsapp-400' : 'text-theme-muted hover:text-theme-fg'
            }`}
          >
            {tab.label}
            {selected && (
              <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-whatsapp-500" />
            )}
          </button>
        );
      })}
    </div>
  );
}

interface ChatComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (e: FormEvent) => void;
  onAttach?: (file: File) => void;
  attachment?: PendingAttachment | null;
  onRemoveAttachment?: () => void;
  sending: boolean;
  cannedReplies?: CannedReply[];
  onPaymentLink?: () => void;
  onInteractive?: () => void;
  onOpenTemplate?: () => void;
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
  onAttach,
  attachment,
  onRemoveAttachment,
  sending,
  cannedReplies = [],
  onPaymentLink,
  onInteractive,
  inputRef,
  replyToPreview,
  onClearReply,
}: ChatComposerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const localTextareaRef = useRef<HTMLTextAreaElement>(null);
  const textareaRef = inputRef ?? localTextareaRef;
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [cannedOpen, setCannedOpen] = useState(false);
  const [sendMenuOpen, setSendMenuOpen] = useState(false);
  const [sendAnim, setSendAnim] = useState<'punch' | 'shake' | null>(null);
  const [shortcutIndex, setShortcutIndex] = useState(0);
  const [recording, setRecording] = useState(false);
  const [recordSecs, setRecordSecs] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<number | null>(null);
  const canRecord =
    typeof window !== 'undefined' &&
    typeof MediaRecorder !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia;
  const wasSendingRef = useRef(false);
  const canSend = Boolean(value.trim() || attachment);

  useEffect(() => {
    if (wasSendingRef.current && !sending) {
      setSendAnim('punch');
      const t = setTimeout(() => setSendAnim(null), 180);
      return () => clearTimeout(t);
    }
    wasSendingRef.current = sending;
    return undefined;
  }, [sending]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 144)}px`;
  }, [value, textareaRef]);

  const shortcutMatch = value.match(/^\/([a-z0-9_-]*)$/i);
  const filteredReplies = useMemo(() => {
    if (!shortcutMatch && !cannedOpen) return [];
    const q = shortcutMatch ? shortcutMatch[1].toLowerCase() : '';
    const list = q
      ? cannedReplies.filter((r) => r.shortcut.startsWith(q) || r.title.toLowerCase().includes(q))
      : cannedReplies;
    return list.slice(0, 8);
  }, [cannedReplies, shortcutMatch, cannedOpen]);

  useEffect(() => {
    setShortcutIndex(0);
  }, [filteredReplies.length, value]);

  useEffect(
    () => () => {
      if (recordTimerRef.current) window.clearInterval(recordTimerRef.current);
      mediaRecorderRef.current?.stop();
    },
    []
  );

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
    if (!canRecord || !onAttach || sending) return;
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
      recordTimerRef.current = window.setInterval(() => setRecordSecs((s) => s + 1), 1000);
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
    if (fileInputRef.current) {
      fileInputRef.current.accept = accept;
      fileInputRef.current.click();
    }
    setAttachMenuOpen(false);
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
    setCannedOpen(false);
    textareaRef.current?.focus();
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
      if (canSend && !sending) {
        onSubmit(e as unknown as FormEvent);
      }
    }
    if (e.key === 'Escape') {
      setEmojiOpen(false);
      setAttachMenuOpen(false);
      setCannedOpen(false);
      setSendMenuOpen(false);
    }
  };

  const toolBtn =
    'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-800 disabled:opacity-40 dark:hover:bg-neutral-800 dark:hover:text-neutral-200';

  return (
    <form
      onSubmit={onSubmit}
      className="relative border-t border-neutral-100 bg-theme-surface/95 px-3 py-2.5 backdrop-blur-md sm:px-4 dark:border-neutral-800/80"
    >
      {replyToPreview && (
        <div className="mb-2 flex items-start gap-2 rounded-xl border-l-4 border-whatsapp-500 bg-neutral-50/90 px-2.5 py-2 dark:bg-neutral-900/50">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold text-whatsapp-700 dark:text-whatsapp-400">Replying</p>
            <p className="truncate text-[12px] text-theme-muted">{replyToPreview}</p>
          </div>
          <button type="button" onClick={onClearReply} className={toolBtn} aria-label="Cancel reply">
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
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-[#e9edef] text-[#008069] dark:bg-neutral-800">
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

      {(filteredReplies.length > 0 || cannedOpen) && filteredReplies.length > 0 && (
        <div className="absolute bottom-full left-3 right-3 z-20 mb-2 max-h-48 overflow-y-auto rounded-xl border border-theme-border bg-theme-surface py-1 shadow-panel sm:left-4 sm:right-4">
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
          <div className="fixed inset-0 z-10" onClick={() => setEmojiOpen(false)} />
          <div className="absolute bottom-full left-3 z-20 mb-2 grid w-[280px] grid-cols-6 gap-1 rounded-xl border border-theme-border bg-theme-surface p-2 shadow-panel sm:left-4">
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

      <div className="rounded-2xl border border-neutral-200/80 bg-white ring-1 ring-neutral-100 transition focus-within:border-whatsapp-500/40 focus-within:ring-whatsapp-500/15 dark:border-neutral-700/60 dark:bg-neutral-900/60 dark:ring-neutral-800">
        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={attachment ? 'Add a caption (optional)...' : 'Type a message...'}
          disabled={sending}
          className="max-h-36 min-h-[40px] w-full resize-none border-0 bg-transparent px-3.5 pb-1 pt-2.5 text-[14px] leading-snug text-theme-fg placeholder:text-theme-muted focus:outline-none disabled:cursor-not-allowed disabled:text-theme-muted"
        />

        <div className="flex items-center gap-0.5 px-2 pb-2 pt-0.5">
          <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto">
            <button
              type="button"
              className={toolBtn}
              aria-label="Emoji"
              aria-expanded={emojiOpen}
              disabled={sending}
              onClick={() => {
                setEmojiOpen((v) => !v);
                setAttachMenuOpen(false);
              }}
            >
              <Smile size={18} strokeWidth={2} />
            </button>

            <div className="relative">
              <button
                type="button"
                className={toolBtn}
                aria-label="Attach"
                disabled={sending}
                onClick={() => {
                  setAttachMenuOpen((v) => !v);
                  setEmojiOpen(false);
                }}
              >
                <Paperclip size={18} strokeWidth={2} />
              </button>
              {attachMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setAttachMenuOpen(false)} />
                  <div className="absolute bottom-full left-0 z-20 mb-2 w-48 overflow-hidden rounded-xl border border-theme-border bg-theme-surface py-1 shadow-panel">
                    <button
                      type="button"
                      onClick={() => openFilePicker('image/*')}
                      className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[13px] text-theme-secondary hover:bg-theme-subtle"
                    >
                      <Image size={16} className="text-[#008069]" />
                      Photo
                    </button>
                    <button
                      type="button"
                      onClick={() => openFilePicker('video/*')}
                      className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[13px] text-theme-secondary hover:bg-theme-subtle"
                    >
                      <Image size={16} className="text-[#008069]" />
                      Video
                    </button>
                    <button
                      type="button"
                      onClick={() => openFilePicker('application/pdf,.pdf')}
                      className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[13px] text-theme-secondary hover:bg-theme-subtle"
                    >
                      <FileText size={16} className="text-[#008069]" />
                      PDF document
                    </button>
                    {onPaymentLink && (
                      <button
                        type="button"
                        onClick={() => {
                          setAttachMenuOpen(false);
                          onPaymentLink();
                        }}
                        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[13px] text-theme-secondary hover:bg-theme-subtle"
                      >
                        <IndianRupee size={16} className="text-[#008069]" />
                        Payment link
                      </button>
                    )}
                    {onInteractive && (
                      <button
                        type="button"
                        onClick={() => {
                          setAttachMenuOpen(false);
                          onInteractive();
                        }}
                        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[13px] text-theme-secondary hover:bg-theme-subtle"
                      >
                        <Sparkles size={16} className="text-violet-600" />
                        Interactive message
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
              disabled={sending}
              onClick={() => openFilePicker('image/*')}
            >
              <Image size={18} strokeWidth={2} />
            </button>
            <button
              type="button"
              className={toolBtn}
              aria-label="PDF document"
              disabled={sending}
              onClick={() => openFilePicker('application/pdf,.pdf')}
            >
              <FileText size={18} strokeWidth={2} />
            </button>
            <button
              type="button"
              className={`${toolBtn} border border-neutral-200/80 dark:border-neutral-700/60`}
              aria-label="Quick replies"
              disabled={sending || cannedReplies.length === 0 || recording}
              onClick={() => {
                setCannedOpen((v) => !v);
                if (!value.startsWith('/')) onChange('/');
                textareaRef.current?.focus();
              }}
            >
              <Zap size={16} strokeWidth={2.25} />
            </button>
            {canRecord && (
              <button
                type="button"
                className={`${toolBtn} ${recording ? 'text-red-600' : ''}`}
                aria-label={recording ? 'Recording…' : 'Voice note'}
                disabled={sending}
                onClick={() => (recording ? stopRecording(false) : void startRecording())}
              >
                <Mic size={18} strokeWidth={2} />
              </button>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1.5 pl-1">
            <button
              type="button"
              className={`${toolBtn} border border-neutral-200/80 font-semibold dark:border-neutral-700/60`}
              aria-label="Slash commands"
              disabled={sending}
              onClick={() => {
                onChange(value.startsWith('/') ? value : `/${value}`);
                setCannedOpen(true);
                textareaRef.current?.focus();
              }}
            >
              /
            </button>

            <div className="relative flex overflow-hidden rounded-xl shadow-[0_4px_14px_rgba(37,211,102,0.35)]">
              <button
                type="submit"
                disabled={sending || !canSend}
                className={`inline-flex h-9 items-center gap-1.5 bg-gradient-to-br from-whatsapp-500 to-whatsapp-600 px-3.5 text-[13px] font-bold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:from-neutral-300 disabled:to-neutral-400 disabled:shadow-none ${
                  sendAnim === 'punch' ? 'inbox-send-punch' : sendAnim === 'shake' ? 'inbox-send-shake' : ''
                }`}
              >
                {sending ? (
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                ) : (
                  <SendHorizontal size={15} strokeWidth={2.25} />
                )}
                Send
              </button>
              <button
                type="button"
                disabled={sending}
                aria-label="Send options"
                aria-expanded={sendMenuOpen}
                onClick={() => setSendMenuOpen((v) => !v)}
                className="inline-flex h-9 w-8 items-center justify-center border-l border-white/25 bg-gradient-to-br from-whatsapp-500 to-whatsapp-600 text-white transition hover:brightness-105 disabled:opacity-50"
              >
                <ChevronDown size={14} strokeWidth={2.5} />
              </button>
              {sendMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setSendMenuOpen(false)} />
                  <div className="absolute bottom-full right-0 z-20 mb-2 w-44 overflow-hidden rounded-xl border border-theme-border bg-theme-surface py-1 shadow-panel">
                    <button
                      type="submit"
                      className="flex w-full px-3 py-2 text-left text-[13px] font-medium text-theme-fg hover:bg-theme-subtle"
                      onClick={() => setSendMenuOpen(false)}
                    >
                      Send now
                    </button>
                    <button
                      type="button"
                      disabled
                      title="Coming soon"
                      className="flex w-full cursor-not-allowed px-3 py-2 text-left text-[13px] text-theme-muted opacity-60"
                    >
                      Send and close
                    </button>
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
