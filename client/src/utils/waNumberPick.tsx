import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Smartphone } from 'lucide-react';
import AppButton from '../components/ui/AppButton';
import type { WhatsappPhoneOption } from '../services/api';

type PendingPick = {
  phones: WhatsappPhoneOption[];
  confirm: (phone: WhatsappPhoneOption) => Promise<void>;
};

let pending: PendingPick | null = null;
const listeners = new Set<(pick: PendingPick | null) => void>();

export function openWaNumberPick(pick: PendingPick): void {
  pending = pick;
  listeners.forEach((listener) => listener(pending));
}

export function closeWaNumberPick(): void {
  pending = null;
  listeners.forEach((listener) => listener(null));
}

export const CONNECT_NOTICE_KEY = 'samyoj_connect_notice';

export function stashConnectNotice(message: string): void {
  try {
    sessionStorage.setItem(CONNECT_NOTICE_KEY, message);
  } catch {
    /* ignore */
  }
}

export function consumeConnectNotice(): string | null {
  try {
    const value = sessionStorage.getItem(CONNECT_NOTICE_KEY);
    if (value) sessionStorage.removeItem(CONNECT_NOTICE_KEY);
    return value;
  } catch {
    return null;
  }
}

/** In-page picker. Does not replace the page the user was on. */
export function WhatsAppNumberPickHost() {
  const [pick, setPick] = useState<PendingPick | null>(pending);
  const [selectedId, setSelectedId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    listeners.add(setPick);
    return () => {
      listeners.delete(setPick);
    };
  }, []);

  useEffect(() => {
    setSelectedId(pick?.phones[0]?.phoneNumberId || '');
    setError('');
    setSaving(false);
  }, [pick]);

  if (!pick || typeof document === 'undefined') return null;
  const selected = pick.phones.find((phone) => phone.phoneNumberId === selectedId) || pick.phones[0];

  return createPortal(
    <div className="fixed inset-0 z-[95] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-neutral-900/35" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="wa-number-pick-title"
        className="relative w-full max-w-md rounded-t-2xl border border-neutral-200 bg-white p-5 shadow-2xl sm:rounded-2xl"
      >
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-whatsapp-600 text-white">
          <Smartphone className="h-5 w-5" />
        </div>
        <h2 id="wa-number-pick-title" className="mt-3 text-center text-lg font-extrabold text-neutral-900">
          Which number?
        </h2>
        <p className="mt-1 text-center text-[13px] text-neutral-500">
          Facebook did not say which one you finished.
        </p>
        <div className="mt-4 space-y-2">
          {pick.phones.map((phone) => (
            <label
              key={`${phone.wabaId}:${phone.phoneNumberId}`}
              className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-left ${
                selected?.phoneNumberId === phone.phoneNumberId
                  ? 'border-whatsapp-400 bg-emerald-50'
                  : 'border-neutral-200'
              }`}
            >
              <input
                type="radio"
                name="wa-finish-number"
                checked={selected?.phoneNumberId === phone.phoneNumberId}
                onChange={() => setSelectedId(phone.phoneNumberId)}
              />
              <span className="text-[13px] font-semibold text-neutral-900">+{phone.phoneNumber.replace(/^\+/, '')}</span>
            </label>
          ))}
        </div>
        {error ? <p className="mt-3 text-[13px] text-red-600">{error}</p> : null}
        <AppButton
          className="mt-4 w-full"
          loading={saving}
          onClick={() => {
            if (!selected) return;
            setSaving(true);
            setError('');
            void pick
              .confirm(selected)
              .catch((err: unknown) => {
                setSaving(false);
                setError(err instanceof Error ? err.message : 'That number could not connect. Try again.');
              });
          }}
        >
          Connect this number
        </AppButton>
      </div>
    </div>,
    document.body
  );
}
