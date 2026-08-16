import { User } from 'lucide-react';
import AppInput from '../ui/AppInput';
import AppTextarea from '../ui/AppTextarea';
import { messagingConsent } from '../../utils/plainLanguage';
import { PHONE_HINT, PHONE_PLACEHOLDER } from '../../utils/phone';
import type { ContactFormValues } from './contactForm';

interface ContactFieldsFormProps {
  form: ContactFormValues;
  onChange: (next: ContactFormValues) => void;
  /** Inbox uses a + prefix field; Contacts uses a plain input; edit hides phone. */
  phoneMode: 'plain' | 'inbox' | 'hidden';
  phoneError?: string | null;
  phoneHint?: string;
  phoneId?: string;
  phoneDisabled?: boolean;
}

/** Shared optional person fields for Contacts Add and Inbox New chat. */
export default function ContactFieldsForm({
  form,
  onChange,
  phoneMode,
  phoneError,
  phoneHint,
  phoneId = 'contact-phone',
  phoneDisabled = false,
}: ContactFieldsFormProps) {
  const set = (patch: Partial<ContactFormValues>) => onChange({ ...form, ...patch });

  return (
    <>
      {phoneMode === 'plain' && (
        <AppInput
          id={phoneId}
          label="Phone"
          placeholder={PHONE_PLACEHOLDER}
          value={form.phone}
          onChange={(e) => set({ phone: e.target.value })}
          required
          disabled={phoneDisabled}
          hint={phoneHint ?? (phoneDisabled ? 'Phone cannot be changed' : PHONE_HINT)}
          inputMode="tel"
        />
      )}

      {phoneMode === 'inbox' && (
        <div className="space-y-1.5">
          <label htmlFor={phoneId} className="text-label text-theme-secondary">
            Phone number
          </label>
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
              value={form.phone}
              onChange={(e) => set({ phone: e.target.value.replace(/\D/g, '') })}
              placeholder={PHONE_PLACEHOLDER}
              aria-invalid={phoneError ? true : undefined}
              aria-describedby={phoneError ? `${phoneId}-error` : undefined}
              className={`h-11 w-full rounded-xl border bg-theme-surface pl-[3.25rem] pr-3.5 text-body tabular-nums text-theme-fg shadow-input transition placeholder:text-theme-muted focus:border-slate-400 focus:outline-none focus:shadow-input-focus disabled:opacity-60 dark:focus:border-slate-500 ${
                phoneError
                  ? 'border-red-300 focus:border-red-500 focus:shadow-[0_0_0_4px_rgba(239,68,68,0.12)] dark:border-red-500/40'
                  : 'border-theme-border'
              }`}
            />
          </div>
          {phoneError ? (
            <p id={`${phoneId}-error`} className="text-caption font-medium text-red-600 dark:text-red-400">
              {phoneError}
            </p>
          ) : (
            <p className="text-caption text-theme-muted">{phoneHint ?? PHONE_HINT}</p>
          )}
        </div>
      )}

      <AppInput
        id="contact-name"
        label="Name"
        placeholder="Customer name"
        value={form.name}
        onChange={(e) => set({ name: e.target.value })}
        autoComplete="name"
        icon={<User className="h-4 w-4" />}
      />
      <AppInput
        id="contact-email"
        label="Email"
        placeholder="customer@example.com"
        type="email"
        value={form.email}
        onChange={(e) => set({ email: e.target.value })}
      />
      <AppInput
        id="contact-tags"
        label="Tags"
        hint="Comma separated"
        placeholder="vip, lead"
        value={form.tags}
        onChange={(e) => set({ tags: e.target.value })}
      />
      <AppTextarea
        id="contact-notes"
        label="Notes"
        placeholder="Internal notes about this contact..."
        value={form.notes}
        onChange={(e) => set({ notes: e.target.value })}
        rows={3}
      />
      <AppTextarea
        id="contact-custom-attributes"
        label="Custom fields"
        hint="Used in templates as {{order_id}}. One per line: key=value"
        placeholder={'order_id=ORD-1042\ncity=Mumbai'}
        value={form.customAttributes}
        onChange={(e) => set({ customAttributes: e.target.value })}
        rows={3}
        className="font-mono text-[13px]"
      />
      <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-theme-border bg-theme-subtle/40 px-4 py-3.5">
        <input
          type="checkbox"
          checked={form.optedIn}
          onChange={(e) => set({ optedIn: e.target.checked })}
          className="h-4 w-4 rounded border-theme-border text-emerald-600 focus:ring-emerald-500/30"
        />
        <div>
          <p className="text-[13px] font-semibold text-theme-fg">{messagingConsent.allowCampaignMessages}</p>
          <p className="text-[11px] font-medium text-theme-muted">{messagingConsent.allowCampaignHint}</p>
        </div>
      </label>
    </>
  );
}
