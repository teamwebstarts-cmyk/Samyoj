import { useEffect, useId, useState } from 'react';
import { Clock3, MessageCircle, User } from 'lucide-react';
import AppInput from '../ui/AppInput';
import { toastError } from '../../utils/toast';
import SlideOver, { SlideOverFooter } from '../ui/SlideOver';
import { PHONE_PLACEHOLDER, validatePhone } from '../../utils/phone';

interface NewChatSlideOverProps {
  open: boolean;
  onClose: () => void;
  onStart: (phone: string, name?: string) => Promise<void>;
}

export default function NewChatSlideOver({ open, onClose, onStart }: NewChatSlideOverProps) {
  const phoneId = useId();
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setPhone('');
    setName('');
    setPhoneError(null);
  };

  // Fresh form on each open; avoid clearing mid-exit animation when closing.
  useEffect(() => {
    if (!open) return;
    reset();
    setSaving(false);
  }, [open]);

  const handlePhoneChange = (value: string) => {
    // Keep digits only in the field; the + prefix is visual affordance only.
    const digits = value.replace(/\D/g, '');
    setPhone(digits);
    if (phoneError) setPhoneError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = validatePhone(phone);
    if (!result.ok) {
      setPhoneError(result.error);
      toastError(result.error);
      return;
    }

    setSaving(true);
    try {
      await onStart(result.phone, name.trim() || undefined);
      reset();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message || 'Could not start chat';
      toastError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title="New chat"
      subtitle="Start a conversation with a customer"
      icon={MessageCircle}
      accent="emerald"
      footer={
        <SlideOverFooter onCancel={onClose} submitLabel="Start chat" loading={saving} />
      }
    >
      <form id="slideover-form" onSubmit={handleSubmit} className="new-chat-form space-y-5">
        <div className="new-chat-form__item space-y-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <label htmlFor={phoneId} className="text-label text-theme-secondary">
              Phone number
            </label>
            <span className="text-caption text-theme-muted">Required</span>
          </div>

          <div className="relative">
            <span
              className="pointer-events-none absolute inset-y-0 left-0 z-[1] flex w-11 items-center justify-center border-r border-theme-border/80 text-[15px] font-semibold leading-none text-whatsapp-600 dark:text-whatsapp-400"
              aria-hidden
            >
              +
            </span>
            <input
              id={phoneId}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              required
              value={phone}
              onChange={(e) => handlePhoneChange(e.target.value)}
              placeholder={PHONE_PLACEHOLDER}
              aria-invalid={phoneError ? true : undefined}
              aria-describedby={`${phoneId}-hint${phoneError ? ` ${phoneId}-error` : ''}`}
              className={`h-11 w-full rounded-xl border bg-theme-surface pl-[3.25rem] pr-3.5 text-body tabular-nums text-theme-fg shadow-input transition placeholder:text-theme-muted focus:border-slate-400 focus:outline-none focus:shadow-input-focus disabled:opacity-60 dark:focus:border-slate-500 ${
                phoneError
                  ? 'border-red-300 focus:border-red-500 focus:shadow-[0_0_0_4px_rgba(239,68,68,0.12)] dark:border-red-500/40'
                  : 'border-theme-border'
              }`}
            />
          </div>

          <p id={`${phoneId}-hint`} className="text-caption leading-relaxed text-theme-muted">
            Country code + number — type digits only (e.g. {PHONE_PLACEHOLDER})
          </p>
          {phoneError && (
            <p id={`${phoneId}-error`} className="text-caption font-medium text-red-600 dark:text-red-400">
              {phoneError}
            </p>
          )}
        </div>

        <div className="new-chat-form__item">
          <AppInput
            label="Contact name"
            hint="Optional"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="How should we show them?"
            autoComplete="name"
            icon={<User className="h-4 w-4" />}
          />
        </div>

        <div
          className="new-chat-form__item new-chat-callout rounded-2xl border border-theme-border/80 bg-theme-subtle/55 px-3.5 py-3.5 backdrop-blur-[6px] dark:bg-theme-subtle/40"
          role="note"
        >
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-whatsapp-500/10 text-whatsapp-700 ring-1 ring-whatsapp-500/15 dark:bg-whatsapp-500/15 dark:text-whatsapp-300 dark:ring-whatsapp-400/20">
              <Clock3 className="h-4 w-4" strokeWidth={2.1} />
            </span>
            <div className="min-w-0 space-y-1">
              <p className="text-[13px] font-semibold tracking-tight text-theme-fg">
                24-hour messaging window
              </p>
              <p className="text-[12.5px] leading-relaxed text-theme-secondary">
                If the customer hasn&apos;t messaged you recently, free-text replies may be blocked.
                Use an approved template when the window is closed.
              </p>
            </div>
          </div>
        </div>
      </form>
    </SlideOver>
  );
}
