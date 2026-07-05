import { useMemo, useRef, useState } from 'react';
import { FileText, Image, IndianRupee, LayoutTemplate, Lock, Paperclip, Send, X, Zap } from 'lucide-react';
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
  disabled?: boolean;
  disabledReason?: string;
  onTemplateClick?: () => void;
  cannedReplies?: CannedReply[];
  onPaymentLink?: () => void;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ChatComposer({
  value,
  onChange,
  onSubmit,
  onAttach,
  attachment,
  onRemoveAttachment,
  sending,
  disabled,
  disabledReason = 'Messaging unavailable',
  onTemplateClick,
  cannedReplies = [],
  onPaymentLink,
}: ChatComposerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const isDisabled = disabled || sending;
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
      className="bg-theme-surface/95 px-3 py-3 backdrop-blur-md sm:px-4"
    >
      {attachment && (
        <div className="mb-2.5 flex items-center gap-2.5 rounded-2xl border border-neutral-200/70 bg-neutral-50/90 p-2.5 shadow-sm dark:border-neutral-700/60 dark:bg-neutral-800/40">
          {attachment.previewUrl && attachment.type === 'IMAGE' ? (
            <img
              src={attachment.previewUrl}
              alt="Preview"
              className="h-14 w-14 shrink-0 rounded-lg object-cover"
            />
          ) : (
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-[#e9edef] text-[#008069]">
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

      <div
        className={`relative flex items-end gap-2 rounded-2xl border p-1.5 shadow-input ring-1 transition-all duration-150 ${
          isDisabled
            ? 'border-theme-border bg-theme-subtle ring-theme-border'
            : 'border-neutral-200/80 bg-white ring-neutral-100 focus-within:border-whatsapp-500/40 focus-within:ring-whatsapp-500/15 dark:border-neutral-700/60 dark:bg-neutral-900/60 dark:ring-neutral-800'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileSelect}
        />

        <div className="relative">
          <button
            type="button"
            disabled={isDisabled}
            onClick={() => setAttachMenuOpen((v) => !v)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-neutral-500 transition hover:bg-neutral-200/50 hover:text-neutral-700 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Attach file"
          >
            <Paperclip size={20} strokeWidth={2} />
          </button>

          {attachMenuOpen && !isDisabled && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setAttachMenuOpen(false)} />
              <div className="absolute bottom-full left-0 z-20 mb-2 w-44 overflow-hidden rounded-xl border border-theme-border bg-theme-surface py-1 shadow-panel">
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
                  onClick={() => openFilePicker('.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,application/pdf,application/msword')}
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
              </div>
            </>
          )}
        </div>

        {filteredReplies.length > 0 && (
          <div className="absolute bottom-full left-14 right-2 z-20 mb-2 max-h-48 overflow-y-auto rounded-xl border border-theme-border bg-theme-surface py-1 shadow-panel">
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

        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={
            isDisabled
              ? disabledReason
              : attachment
                ? 'Add a caption (optional)...'
                : 'Type a message...'
          }
          disabled={isDisabled}
          className="min-h-[44px] flex-1 rounded-xl border-0 bg-transparent px-3 py-2.5 text-[14px] text-theme-fg placeholder:text-theme-muted focus:outline-none disabled:cursor-not-allowed disabled:text-theme-muted"
        />
        {onTemplateClick ? (
          <button
            type="button"
            onClick={onTemplateClick}
            className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 px-3 text-white shadow-[0_4px_14px_rgba(245,158,11,0.35)] transition hover:from-amber-600 hover:to-orange-700"
          >
            <LayoutTemplate size={16} strokeWidth={2.25} />
            <span className="hidden text-[12px] font-bold sm:inline">Template</span>
          </button>
        ) : (
          <button
            type="submit"
            disabled={isDisabled || !canSend}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl btn-primary shadow-[0_4px_14px_rgba(37,211,102,0.35)] transition disabled:cursor-not-allowed disabled:from-neutral-300 disabled:to-neutral-400 disabled:shadow-none disabled:opacity-50"
            aria-label="Send message"
          >
            {sending ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : disabled ? (
              <Lock size={16} strokeWidth={2.25} />
            ) : (
              <Send size={18} strokeWidth={2.25} />
            )}
          </button>
        )}
      </div>
    </form>
  );
}
