import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ExternalLink, Key, Settings2 } from 'lucide-react';
import AppButton from '../ui/AppButton';
import AppInput from '../ui/AppInput';
import { ModalCallout, ModalSection } from '../ui/modalUi';
import { whatsappApi } from '../../services/api';
import type { OrgMetaSettings } from '../../types';
import { toastError, toastSuccess } from '../../utils/toast';

interface MetaAppConfigModalProps {
  open: boolean;
  onClose: () => void;
  initial?: OrgMetaSettings;
  onSaved: (config: OrgMetaSettings) => void;
}

export default function MetaAppConfigModal({
  open,
  onClose,
  initial,
  onSaved,
}: MetaAppConfigModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [appId, setAppId] = useState('');
  const [appSecret, setAppSecret] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAppId(initial?.appId || '');
    setAppSecret('');
  }, [open, initial?.appId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appId.trim()) {
      toastError('Meta App ID is required');
      return;
    }
    if (!initial?.hasAppSecret && !appSecret.trim()) {
      toastError('Meta App Secret is required');
      return;
    }

    setSaving(true);
    try {
      const { data } = await whatsappApi.updateMetaConfig({
        appId: appId.trim(),
        ...(appSecret.trim() ? { appSecret: appSecret.trim() } : {}),
      });
      onSaved(data.data);
      toastSuccess('Meta app credentials saved');
      onClose();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
          ?.error?.message || 'Failed to save Meta app credentials';
      toastError(msg);
    } finally {
      setSaving(false);
    }
  };

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center p-4 sm:items-center" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-black/45 backdrop-blur-[6px] dark:bg-black/65"
        onClick={onClose}
        aria-label="Close dialog"
      />

      <div
        ref={dialogRef}
        className="relative w-full max-w-[480px] overflow-hidden rounded-[1.35rem] border border-theme-border bg-theme-surface shadow-[0_24px_80px_rgba(15,23,42,0.18)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="meta-config-title"
      >
        <div className="h-0.5 bg-gradient-to-r from-whatsapp-600 to-emerald-700" />

        <form onSubmit={(e) => void handleSave(e)} className="p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-whatsapp-600 to-emerald-700 text-white shadow-[0_4px_14px_rgba(37,211,102,0.3)]">
              <Settings2 className="h-5 w-5" strokeWidth={2.25} />
            </div>
            <div className="min-w-0 flex-1">
              <h2 id="meta-config-title" className="text-lg font-extrabold tracking-tight text-theme-fg">
                Configure Meta App
              </h2>
              <p className="mt-1 text-[13px] font-medium leading-relaxed text-theme-secondary">
                Connect your own Meta developer app for WhatsApp Cloud API.
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-5">
            <ModalCallout
              icon={Key}
              accent="emerald"
              title="Your Meta developer credentials"
              description="Create an app at developers.facebook.com, add the WhatsApp product, and paste the App ID and App Secret here."
            />

            <ModalSection step={1} title="App credentials" subtitle="From your Meta app dashboard">
              <AppInput
                label="Meta App ID"
                placeholder="e.g. 452611265899178"
                value={appId}
                onChange={(e) => setAppId(e.target.value)}
                required
              />
              <AppInput
                label="Meta App Secret"
                type="password"
                placeholder={initial?.hasAppSecret ? '•••••••• (saved — leave blank to keep)' : 'Your app secret'}
                value={appSecret}
                onChange={(e) => setAppSecret(e.target.value)}
                required={!initial?.hasAppSecret}
              />
            </ModalSection>

            <a
              href="https://developers.facebook.com/apps/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-whatsapp-700 hover:underline dark:text-whatsapp-400"
            >
              Open Meta Developer Console
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>

          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AppButton type="button" variant="secondary" onClick={onClose} disabled={saving}>
              Cancel
            </AppButton>
            <AppButton type="submit" loading={saving}>
              Save credentials
            </AppButton>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
