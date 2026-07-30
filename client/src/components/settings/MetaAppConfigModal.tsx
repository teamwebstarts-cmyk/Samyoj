import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Check,
  Copy,
  ExternalLink,
  Key,
  Link2,
  Settings2,
  Smartphone,
} from 'lucide-react';
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
  /** Optional: after credentials are ready, start Facebook OAuth connect */
  onRequestConnect?: () => void;
}

function QuickLinkButton({
  href,
  label,
  description,
}: {
  href: string;
  label: string;
  description: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-start gap-2.5 rounded-xl border border-theme-border bg-theme-subtle/40 px-3 py-2.5 transition hover:border-whatsapp-300 hover:bg-emerald-50/70 dark:hover:border-whatsapp-700 dark:hover:bg-emerald-950/30"
    >
      <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-theme-muted group-hover:text-whatsapp-700 dark:group-hover:text-whatsapp-400" />
      <span className="min-w-0">
        <span className="block text-[12px] font-extrabold text-theme-fg group-hover:text-whatsapp-800 dark:group-hover:text-whatsapp-300">
          {label}
        </span>
        <span className="mt-0.5 block text-[11px] font-medium leading-snug text-theme-secondary">
          {description}
        </span>
      </span>
    </a>
  );
}

export default function MetaAppConfigModal({
  open,
  onClose,
  initial,
  onSaved,
  onRequestConnect,
}: MetaAppConfigModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [appId, setAppId] = useState('');
  const [appSecret, setAppSecret] = useState('');
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const redirectUri = useMemo(
    () =>
      typeof window !== 'undefined'
        ? `${window.location.origin}/settings/whatsapp/callback`
        : 'http://localhost:3000/settings/whatsapp/callback',
    [],
  );

  const trimmedAppId = appId.trim();
  const appIdLooksValid = /^\d{10,20}$/.test(trimmedAppId);
  const appDashboardBase = appIdLooksValid
    ? `https://developers.facebook.com/apps/${trimmedAppId}`
    : 'https://developers.facebook.com/apps';

  useEffect(() => {
    if (!open) return;
    setAppId(initial?.appId || '');
    setAppSecret('');
    setCopied(false);
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

  const copyRedirectUri = async () => {
    try {
      await navigator.clipboard.writeText(redirectUri);
      setCopied(true);
      toastSuccess('OAuth redirect URI copied');
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toastError('Could not copy. Select the URI and copy manually.');
    }
  };

  const handleSave = async (e: React.FormEvent, connectAfter = false) => {
    e.preventDefault();
    if (!trimmedAppId) {
      toastError('Meta App ID is required');
      return;
    }
    if (!/^\d+$/.test(trimmedAppId)) {
      toastError('Meta App ID must be numbers only (copy it from Meta → Settings → Basic)');
      return;
    }
    if (!appIdLooksValid) {
      toastError('That App ID looks too short. Copy the full App ID from Meta Settings → Basic.');
      return;
    }
    if (!initial?.hasAppSecret && !appSecret.trim()) {
      toastError('Meta App Secret is required');
      return;
    }

    setSaving(true);
    try {
      const { data } = await whatsappApi.updateMetaConfig({
        appId: trimmedAppId,
        ...(appSecret.trim() ? { appSecret: appSecret.trim() } : {}),
      });
      onSaved(data.data);
      toastSuccess('Meta app credentials saved');
      if (connectAfter && onRequestConnect) {
        onClose();
        onRequestConnect();
        return;
      }
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
        className="relative max-h-[min(92vh,760px)] w-full max-w-[560px] overflow-y-auto overflow-x-hidden rounded-[1.35rem] border border-theme-border bg-theme-surface shadow-[0_24px_80px_rgba(15,23,42,0.18)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="meta-config-title"
      >
        <div className="h-0.5 bg-gradient-to-r from-whatsapp-600 to-emerald-700" />

        <form onSubmit={(e) => void handleSave(e, false)} className="p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-whatsapp-600 to-emerald-700 text-white shadow-[0_4px_14px_rgba(37,211,102,0.3)]">
              <Settings2 className="h-5 w-5" strokeWidth={2.25} />
            </div>
            <div className="min-w-0 flex-1">
              <h2 id="meta-config-title" className="text-lg font-extrabold tracking-tight text-theme-fg">
                Configure Meta App
              </h2>
              <p className="mt-1 text-[13px] font-medium leading-relaxed text-theme-secondary">
                Enter credentials here, or open Meta links below to find / set them up — then connect WhatsApp.
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-5">
            <ModalCallout
              icon={Key}
              accent="emerald"
              title="Two ways to set this up"
              description="Paste App ID + App Secret in this popup, or open Meta Developer Console with the buttons below, copy values from Settings → Basic, then come back and save."
            />

            <ModalSection step={1} title="Quick links (Meta)" subtitle="Opens in a new tab — nothing is removed from your Meta app">
              <div className="grid gap-2 sm:grid-cols-2">
                <QuickLinkButton
                  href="https://developers.facebook.com/apps/"
                  label="My Meta Apps"
                  description="Pick or create your app"
                />
                <QuickLinkButton
                  href={`${appDashboardBase}/settings/basic/`}
                  label="App ID & Secret"
                  description="Settings → Basic (copy both)"
                />
                <QuickLinkButton
                  href={`${appDashboardBase}/fb-login/settings/`}
                  label="OAuth redirect URIs"
                  description="Facebook Login → add callback URI"
                />
                <QuickLinkButton
                  href={`${appDashboardBase}/whatsapp-business/wa-settings/`}
                  label="WhatsApp setup"
                  description="Test number & API access"
                />
                <QuickLinkButton
                  href="https://business.facebook.com/"
                  label="Meta Business Suite"
                  description="Business portfolio & account quality"
                />
                <QuickLinkButton
                  href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started"
                  label="Cloud API docs"
                  description="Official Meta get-started guide"
                />
              </div>
            </ModalSection>

            <ModalSection step={2} title="OAuth redirect URI" subtitle="Must match exactly in Meta Facebook Login settings">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <code className="block flex-1 break-all rounded-xl border border-theme-border bg-theme-subtle/60 px-3 py-2.5 font-mono text-[11px] font-semibold text-theme-fg">
                  {redirectUri}
                </code>
                <AppButton
                  type="button"
                  variant="secondary"
                  size="sm"
                  icon={copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  onClick={() => void copyRedirectUri()}
                >
                  {copied ? 'Copied' : 'Copy URI'}
                </AppButton>
              </div>
              <p className="text-[11px] font-medium text-theme-muted">
                Meta path: App → Facebook Login → Settings → Valid OAuth Redirect URIs → paste → Save.
              </p>
            </ModalSection>

            <ModalSection step={3} title="App credentials" subtitle="From Meta App → Settings → Basic (use Copy icon)">
              <AppInput
                label="Meta App ID"
                placeholder="e.g. 452611265899178"
                value={appId}
                onChange={(e) => setAppId(e.target.value.replace(/\s/g, ''))}
                required
              />
              {trimmedAppId && !appIdLooksValid && (
                <p className="text-[12px] font-semibold text-amber-700 dark:text-amber-400">
                  App ID should be 10–20 digits only. Re-copy from Meta Settings → Basic.
                </p>
              )}
              <AppInput
                label="Meta App Secret"
                type="password"
                placeholder={initial?.hasAppSecret ? '•••••••• (saved — leave blank to keep)' : 'Your app secret'}
                value={appSecret}
                onChange={(e) => setAppSecret(e.target.value)}
                required={!initial?.hasAppSecret}
              />
            </ModalSection>
          </div>

          <div className="mt-6 flex flex-col gap-2">
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <AppButton type="button" variant="secondary" onClick={onClose} disabled={saving}>
                Cancel
              </AppButton>
              <AppButton type="submit" loading={saving} disabled={saving}>
                Save credentials
              </AppButton>
            </div>

            {onRequestConnect && (
              <AppButton
                type="button"
                variant="secondary"
                className="w-full"
                icon={<Smartphone className="h-4 w-4" />}
                disabled={saving}
                onClick={(e) => void handleSave(e, true)}
              >
                Save &amp; Connect WhatsApp (Facebook login)
              </AppButton>
            )}

            {initial?.configured && onRequestConnect && (
              <AppButton
                type="button"
                className="w-full"
                icon={<Link2 className="h-4 w-4" />}
                disabled={saving}
                onClick={() => {
                  onClose();
                  onRequestConnect();
                }}
              >
                Credentials already saved — Connect via Facebook
              </AppButton>
            )}
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
