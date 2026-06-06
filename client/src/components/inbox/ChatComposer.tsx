import { Lock, Send } from 'lucide-react';

interface ChatComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  sending: boolean;
  disabled?: boolean;
  disabledReason?: string;
}

export default function ChatComposer({
  value,
  onChange,
  onSubmit,
  sending,
  disabled,
  disabledReason = 'Messaging unavailable',
}: ChatComposerProps) {
  const isDisabled = disabled || sending;

  return (
    <form
      onSubmit={onSubmit}
      className="border-t border-neutral-200/70 bg-white/95 px-2 py-2.5 backdrop-blur-md sm:px-3 sm:py-3"
    >
      <div
        className={`flex items-end gap-2 rounded-2xl border p-1.5 shadow-input ring-1 transition ${
          isDisabled
            ? 'border-neutral-200/60 bg-neutral-100/80 ring-neutral-100'
            : 'border-neutral-200/80 bg-neutral-50/80 ring-white/80'
        }`}
      >
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={isDisabled ? disabledReason : 'Type a message...'}
          disabled={isDisabled}
          className="min-h-[44px] flex-1 rounded-xl border-0 bg-transparent px-3 py-2.5 text-[14px] text-neutral-900 placeholder:text-neutral-400 focus:outline-none disabled:cursor-not-allowed disabled:text-neutral-500"
        />
        <button
          type="submit"
          disabled={isDisabled || !value.trim()}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-whatsapp-500 to-whatsapp-600 text-white shadow-[0_4px_14px_rgba(37,211,102,0.35)] transition hover:from-whatsapp-600 hover:to-whatsapp-700 disabled:cursor-not-allowed disabled:from-neutral-300 disabled:to-neutral-400 disabled:shadow-none"
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
      </div>
    </form>
  );
}
