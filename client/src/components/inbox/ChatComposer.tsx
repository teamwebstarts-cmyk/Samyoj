import { useMemo, useRef, useState } from 'react';
import {
  FileText,
  Image,
  IndianRupee,
  Plus,
  SendHorizontal,
  Smile,
  Sparkles,
  X,
  Zap,
} from 'lucide-react';
import type { CannedReply } from '../../types';

export interface PendingAttachment {
  file: File;
  previewUrl?: string;
  type: 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'AUDIO';
}

interface ChatComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onAttach?: (file: File) => void;
  attachment?: PendingAttachment | null;
  onRemoveAttachment?: () => void;
  sending: boolean;
  cannedReplies?: CannedReply[];
  onPaymentLink?: () => void;
  onInteractive?: () => void;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Skeleton shown while the service window state is loading (tri-state). */
export function ComposerSkeleton() {
  return (
    <div className="flex items-center gap-2.5 border-t border-neutral-100 bg-theme-surface/95 px-3 py-3 sm:px-4 dark:border-neutral-800/80">
      <div className="inbox-skeleton-shimmer h-10 w-10 shrink-0 rounded-full" />
      <div className="inbox-skeleton-shimmer h-11 min-w-0 flex-1 rounded-full" />
      <div className="inbox-skeleton-shimmer h-11 w-11 shrink-0 rounded-full" />
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
}: ChatComposerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const canSend = Boolean(value.trim() || attachment);

  const shortcutMatch = value.match(/^\/([a-z0-9_-]*)$/i);
  const filteredReplies = useMemo(() => {
    if (!shortcutMatch) return [];
    const q = shortcutMatch[1].toLowerCase();
    return cannedReplies.filter((r) => r.shortcut.startsWith(q)).slice(0, 6);
  }, [cannedReplies, shortcutMatch]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onAttach) {
      onAttach(file);
    }
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

  return (
    <form
      onSubmit={onSubmit}
      className="relative border-t border-neutral-100 bg-theme-surface/95 px-3 py-2.5 backdrop-blur-md sm:px-4 dark:border-neutral-800/80"
    >
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
              {attachment.type === 'VIDEO' ? (
                <Image className="h-6 w-6" />
              ) : (
                <FileText className="h-6 w-6" />
              )}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-theme-fg">{attachment.file.name}</p>
            <p className="text-[11px] text-theme-muted">{formatFileSize(attachment.file.size)}</p>
          </div>
          <button
            type="button"
            onClick={onRemoveAttachment}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-neutral-500 transition hover:bg-neutral-200/60 hover:text-neutral-700"
            aria-label="Remove attachment"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect} />

      {filteredReplies.length > 0 && (
        <div className="absolute bottom-full left-14 right-4 z-20 mb-2 max-h-48 overflow-y-auto rounded-xl border border-theme-border bg-theme-surface py-1 shadow-panel">
          {filteredReplies.map((reply) => (
            <button
              key={reply.id}
              type="button"
              onClick={() => onChange(reply.content)}
              className="flex w-full items-start gap-2 px-3 py-2 text-left transition hover:bg-theme-subtle"
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

      <div className="flex items-center gap-2.5">
        <div className="relative">
          <button
            type="button"
            disabled={sending}
            onClick={() => setAttachMenuOpen((v) => !v)}
            aria-label="Attach"
            aria-expanded={attachMenuOpen}
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition disabled:cursor-not-allowed disabled:opacity-40 ${
              attachMenuOpen
                ? 'border-whatsapp-500/50 bg-whatsapp-500/10 text-whatsapp-600'
                : 'border-theme-border bg-theme-surface text-theme-secondary hover:border-whatsapp-500/40 hover:text-whatsapp-600'
            }`}
          >
            <Plus
              size={20}
              strokeWidth={2.25}
              className={`transition-transform ${attachMenuOpen ? 'rotate-45' : ''}`}
            />
          </button>

          {attachMenuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setAttachMenuOpen(false)} />
              <div className="absolute bottom-full left-0 z-20 mb-2 w-48 overflow-hidden rounded-xl border border-theme-border bg-theme-surface py-1 shadow-panel">
                <button
                  type="button"
                  onClick={() => openFilePicker('image/*')}
                  className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[13px] text-theme-secondary transition hover:bg-theme-subtle"
                >
                  <Image size={16} className="text-[#008069]" />
                  Photo
                </button>
                <button
                  type="button"
                  onClick={() => openFilePicker('video/*')}
                  className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[13px] text-theme-secondary transition hover:bg-theme-subtle"
                >
                  <Image size={16} className="text-[#008069]" />
                  Video
                </button>
                <button
                  type="button"
                  onClick={() =>
                    openFilePicker(
                      '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,application/pdf,application/msword'
                    )
                  }
                  className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[13px] text-theme-secondary transition hover:bg-theme-subtle"
                >
                  <FileText size={16} className="text-[#008069]" />
                  Document
                </button>
                {onPaymentLink && (
                  <button
                    type="button"
                    onClick={() => {
                      setAttachMenuOpen(false);
                      onPaymentLink();
                    }}
                    className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[13px] text-theme-secondary transition hover:bg-theme-subtle"
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
                    className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[13px] text-theme-secondary transition hover:bg-theme-subtle"
                  >
                    <Sparkles size={16} className="text-violet-600" />
                    Interactive message
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        <div className="flex min-h-[44px] min-w-0 flex-1 items-center gap-1 rounded-full border border-neutral-200/80 bg-white px-1.5 ring-1 ring-neutral-100 transition focus-within:border-whatsapp-500/40 focus-within:ring-whatsapp-500/15 dark:border-neutral-700/60 dark:bg-neutral-900/60 dark:ring-neutral-800">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-neutral-400">
            <Smile size={20} strokeWidth={2} />
          </span>
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={attachment ? 'Add a caption (optional)...' : 'Type a message...'}
            disabled={sending}
            className="min-w-0 flex-1 border-0 bg-transparent py-2.5 pr-2 text-[14px] text-theme-fg placeholder:text-theme-muted focus:outline-none disabled:cursor-not-allowed disabled:text-theme-muted"
          />
        </div>

        <button
          type="submit"
          disabled={sending || !canSend}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-whatsapp-500 to-whatsapp-600 text-white shadow-[0_4px_14px_rgba(37,211,102,0.35)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:from-neutral-300 disabled:to-neutral-400 disabled:shadow-none disabled:opacity-60"
          aria-label="Send message"
        >
          {sending ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          ) : (
            <SendHorizontal size={18} strokeWidth={2.25} />
          )}
        </button>
      </div>
    </form>
  );
}
