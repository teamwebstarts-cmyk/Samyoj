import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Inbox,
  Link2,
  LogOut,
  MoreHorizontal,
  Settings2,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import AppButton from '../ui/AppButton';
import { toastError, toastSuccess } from '../../utils/toast';
import { billingApi, whatsappApi } from '../../services/api';
import { isWaOAuthMessage, startWhatsAppOAuth } from '../../utils/whatsappOAuth';
import { useWhatsAppNumber } from '../../contexts/WhatsAppNumberContext';
import { formatPhoneDisplay } from '../../utils/formatPhone';
import type { BillingUsage } from '../../types';
import WhatsAppGlyph from './icons/WhatsAppGlyph';
import IconWell from './icons/IconWell';

interface WhatsappNumberRow {
  id: string;
  phoneNumber: string;
  isActive: boolean;
}

type QualityTone = 'GREEN' | 'YELLOW' | 'RED' | null;

function parseNumbers(data: unknown): WhatsappNumberRow[] {
  if (Array.isArray(data)) return data as WhatsappNumberRow[];
  if (data && typeof data === 'object' && Array.isArray((data as { numbers?: unknown }).numbers)) {
    return (data as { numbers: WhatsappNumberRow[] }).numbers;
  }
  return [];
}

function pickConnectUrl(payload: unknown): string {
  if (payload && typeof payload === 'object' && typeof (payload as { url?: unknown }).url === 'string') {
    return (payload as { url: string }).url;
  }
  return '';
}

function normalizeQuality(rating: string | null): QualityTone {
  const r = (rating || '').toUpperCase();
  if (r === 'GREEN' || r === 'YELLOW' || r === 'RED') return r;
  return null;
}

function qualityMeta(tone: QualityTone) {
  if (tone === 'GREEN') {
    return {
      label: 'Quality good',
      className: 'border-emerald-200/80 bg-emerald-50 text-emerald-800',
      hint: null as string | null,
    };
  }
  if (tone === 'YELLOW') {
    return {
      label: 'Quality warning',
      className: 'border-amber-200/80 bg-amber-50 text-amber-900',
      hint: 'Template quality or response rates need attention.',
    };
  }
  if (tone === 'RED') {
    return {
      label: 'Quality limited',
      className: 'border-rose-200/80 bg-rose-50 text-rose-900',
      hint: 'Sending may be throttled until quality improves.',
    };
  }
  return null;
}

export default function WhatsAppConnectGuide() {
  const { activeNumber, refreshNumbers } = useWhatsAppNumber();
  const [connectUrl, setConnectUrl] = useState('');
  const [number, setNumber] = useState<WhatsappNumberRow | null>(null);
  const [qualityRating, setQualityRating] = useState<string | null>(null);
  const [webhookSubscribed, setWebhookSubscribed] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [enablingIncoming, setEnablingIncoming] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const loadConnectUrl = async () => {
    try {
      const redirectUri = `${window.location.origin}/settings/whatsapp/callback`;
      const urlRes = await whatsappApi.connectUrl(redirectUri);
      setConnectUrl(pickConnectUrl(urlRes.data?.data));
    } catch {
      setConnectUrl('');
    }
  };

  const load = useCallback(() => {
    setLoading(true);
    setLoadError(false);
    const preferredId = activeNumber?.id ?? null;

    Promise.all([
      whatsappApi.numbers(),
      loadConnectUrl(),
      billingApi.usage().catch(() => null),
      whatsappApi.webhookStatus().catch(() => null),
    ])
      .then(([numbersRes, , usageRes, webhookRes]) => {
        const numbers = parseNumbers(numbersRes.data?.data);
        const preferred =
          (preferredId && numbers.find((n) => n.id === preferredId)) ||
          numbers.find((n) => n.isActive) ||
          numbers[0] ||
          null;
        setNumber(preferred);
        setLoadError(false);

        if (usageRes && preferred) {
          const usage = usageRes.data?.data as BillingUsage | undefined;
          const ratings = usage?.qualityRatings || [];
          const preferredDigits = preferred.phoneNumber.replace(/\D/g, '');
          const match = ratings.find(
            (r) => r.phoneNumber.replace(/\D/g, '') === preferredDigits
          );
          setQualityRating(match?.qualityRating ?? null);
        } else {
          setQualityRating(null);
        }

        if (webhookRes?.data?.data && typeof webhookRes.data.data === 'object') {
          const status = webhookRes.data.data as { subscribed?: boolean };
          setWebhookSubscribed(Boolean(status.subscribed));
        } else {
          setWebhookSubscribed(null);
        }
      })
      .catch(() => {
        setNumber(null);
        setConnectUrl('');
        setQualityRating(null);
        setWebhookSubscribed(null);
        setLoadError(true);
        toastError('Could not load WhatsApp connection status.');
      })
      .finally(() => setLoading(false));
  }, [activeNumber?.id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (!isWaOAuthMessage(event.data)) return;
      setConnecting(false);
      if (event.data.status === 'success') {
        toastSuccess(event.data.message || 'WhatsApp connected');
        void refreshNumbers({ silent: true });
        load();
        return;
      }
      if (event.data.status === 'cancel') {
        toastSuccess(event.data.message || 'Connection cancelled — you are still signed in.');
        return;
      }
      toastError(event.data.message || 'WhatsApp connection failed');
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [load, refreshNumbers]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const handleConnect = () => {
    const start = (url: string) => {
      setConnecting(true);
      const { mode, popup } = startWhatsAppOAuth(url);
      if (mode === 'redirect') return;
      const poll = window.setInterval(() => {
        if (popup && popup.closed) {
          window.clearInterval(poll);
          setConnecting(false);
        }
      }, 500);
    };

    if (connectUrl) {
      start(connectUrl);
      return;
    }

    void (async () => {
      try {
        const redirectUri = `${window.location.origin}/settings/whatsapp/callback`;
        const { data } = await whatsappApi.connectUrl(redirectUri);
        const url = pickConnectUrl(data?.data);
        if (!url) {
          toastError('Could not start WhatsApp connection. Please try again.');
          return;
        }
        setConnectUrl(url);
        start(url);
      } catch {
        toastError('Could not start WhatsApp connection. Please try again.');
      }
    })();
  };

  const handleEnableIncoming = async () => {
    setEnablingIncoming(true);
    setMenuOpen(false);
    try {
      const { data } = await whatsappApi.setupWebhook();
      const payload = data?.data as { callbackUrl?: string; subscribed?: boolean } | undefined;
      if (payload?.subscribed || payload?.callbackUrl) {
        toastSuccess('Incoming messages are now enabled.');
        setWebhookSubscribed(true);
      } else {
        toastSuccess('WhatsApp is linked. You can send messages now.');
      }
      load();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
          ?.error?.message || 'Could not enable incoming messages.';
      toastError(msg);
    } finally {
      setEnablingIncoming(false);
    }
  };

  const handleDisconnect = async () => {
    if (!number) return;
    const confirmed = window.confirm(
      'Disconnect WhatsApp? New messages will stop until you connect again.'
    );
    if (!confirmed) return;

    setDisconnecting(true);
    setMenuOpen(false);
    try {
      await whatsappApi.disconnect(number.id);
      setNumber(null);
      setQualityRating(null);
      setWebhookSubscribed(null);
      await refreshNumbers({ silent: true });
      await loadConnectUrl();
      toastSuccess('WhatsApp disconnected');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
          ?.error?.message || 'Failed to disconnect WhatsApp.';
      toastError(msg);
    } finally {
      setDisconnecting(false);
    }
  };

  if (loading) {
    return (
      <section aria-label="WhatsApp connection">
        <div className="dashboard-card h-[88px] animate-pulse rounded-2xl" />
      </section>
    );
  }

  if (loadError) {
    return (
      <section aria-label="WhatsApp connection">
        <div className="dashboard-card flex flex-col gap-3 rounded-2xl border-amber-100 bg-amber-50/40 p-3.5 sm:flex-row sm:items-center sm:justify-between sm:p-4">
          <div className="flex items-start gap-3">
            <IconWell accent="amber" size="lg" round>
              <AlertCircle className="h-5 w-5" strokeWidth={2} />
            </IconWell>
            <div>
              <h2 className="text-[14px] font-bold text-neutral-900">Couldn&apos;t load connection</h2>
              <p className="mt-0.5 text-[12.5px] text-neutral-600">
                Check your network, then retry. Metrics below may still load separately.
              </p>
            </div>
          </div>
          <AppButton type="button" className="shrink-0" onClick={() => load()}>
            Retry
          </AppButton>
        </div>
      </section>
    );
  }

  if (number) {
    const phone = formatPhoneDisplay(number.phoneNumber);
    const quality = normalizeQuality(qualityRating);
    const qMeta = qualityMeta(quality);
    const incomingOn = webhookSubscribed === true;
    const incomingOff = webhookSubscribed === false;
    const needsAction = incomingOff || quality === 'YELLOW' || quality === 'RED';

    const cardClass = incomingOff
      ? 'border-amber-200/90 bg-gradient-to-r from-amber-50/80 via-white to-white'
      : quality === 'RED'
        ? 'border-rose-100/90 bg-gradient-to-r from-rose-50/50 via-white to-white'
        : quality === 'YELLOW'
          ? 'border-amber-100/90 bg-gradient-to-r from-amber-50/40 via-white to-white'
          : 'border-emerald-100/90 bg-gradient-to-r from-emerald-50/50 via-white to-white';

    let statusLine: string;
    if (incomingOff) {
      statusLine = 'Connected · Customer replies are not reaching Inbox yet';
    } else if (incomingOn && qMeta?.hint) {
      statusLine = `Live · ${qMeta.hint}`;
    } else if (incomingOn) {
      statusLine = 'Live · Sending & receiving on this number';
    } else {
      statusLine = 'Connected · WhatsApp Business Cloud API';
    }

    return (
      <section aria-label="WhatsApp connection">
        <div
          className={`dashboard-card flex flex-col gap-3 rounded-2xl p-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-4 ${cardClass}`}
        >
          <div className="flex min-w-0 items-start gap-3 sm:items-center">
            <div className="relative shrink-0">
              <IconWell accent="whatsapp" size="lg" round>
                <WhatsAppGlyph className="h-5 w-5 sm:h-[22px] sm:w-[22px]" />
              </IconWell>
              {incomingOn && !needsAction && (
                <span
                  className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white bg-emerald-500 text-white"
                  aria-hidden
                >
                  <CheckCircle2 className="h-2.5 w-2.5" strokeWidth={3} />
                </span>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <h2 className="truncate text-[14px] font-extrabold tracking-tight text-neutral-900 sm:text-[15px]">
                  {phone}
                </h2>
                {incomingOn && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200/80 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-800">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
                    Live
                  </span>
                )}
                {incomingOff && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-200/80 bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-900">
                    <Inbox className="h-3 w-3" strokeWidth={2.4} />
                    Inbox offline
                  </span>
                )}
                {qMeta && quality !== 'GREEN' && (
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wide ${qMeta.className}`}
                  >
                    {qMeta.label}
                  </span>
                )}
                {qMeta && quality === 'GREEN' && incomingOn && (
                  <span
                    className={`hidden items-center rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wide sm:inline-flex ${qMeta.className}`}
                  >
                    {qMeta.label}
                  </span>
                )}
              </div>

              <p className="mt-0.5 text-[12px] font-medium leading-snug text-neutral-500 sm:text-[12.5px]">
                {statusLine}
                {incomingOff && (
                  <>
                    {' '}
                    <Link
                      to="/settings?tab=whatsapp"
                      className="font-semibold text-whatsapp-700 hover:underline"
                    >
                      Details
                    </Link>
                  </>
                )}
                {(quality === 'YELLOW' || quality === 'RED') && !incomingOff && (
                  <>
                    {' '}
                    <Link to="/billing" className="font-semibold text-whatsapp-700 hover:underline">
                      View usage
                    </Link>
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="relative flex w-full shrink-0 flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap sm:justify-end">
            {incomingOff && (
              <AppButton
                type="button"
                className="min-h-9 flex-1 sm:flex-none sm:min-h-10"
                icon={<Inbox className="h-4 w-4" />}
                onClick={() => void handleEnableIncoming()}
                loading={enablingIncoming}
                disabled={enablingIncoming || disconnecting}
              >
                Enable incoming
              </AppButton>
            )}

            <Link
              to="/settings?tab=whatsapp"
              className={[
                'inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl border bg-white px-3.5 text-[12.5px] font-semibold transition sm:h-10 sm:flex-none sm:px-4 sm:text-[13px]',
                incomingOff
                  ? 'border-neutral-200 text-neutral-700 hover:bg-neutral-50'
                  : 'border-neutral-200 text-neutral-700 hover:bg-neutral-50',
              ].join(' ')}
            >
              <Settings2 className="hidden h-3.5 w-3.5 sm:block" />
              Manage
            </Link>

            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-neutral-200 bg-white text-neutral-600 transition hover:bg-neutral-50 sm:h-10 sm:w-10"
              aria-label="Connection options"
              aria-expanded={menuOpen}
              aria-haspopup="menu"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>

            {menuOpen && (
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-10 cursor-default"
                  aria-label="Close menu"
                  onClick={() => setMenuOpen(false)}
                />
                <div
                  role="menu"
                  className="absolute right-0 top-full z-20 mt-1.5 min-w-[180px] rounded-xl border border-neutral-200 bg-white p-1 shadow-lg"
                >
                  {incomingOff && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => void handleEnableIncoming()}
                      disabled={enablingIncoming}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] font-semibold text-neutral-800 transition hover:bg-neutral-50 disabled:opacity-50"
                    >
                      <Inbox className="h-3.5 w-3.5 text-whatsapp-600" />
                      Enable incoming
                    </button>
                  )}
                  <Link
                    to="/settings?tab=whatsapp"
                    role="menuitem"
                    onClick={() => setMenuOpen(false)}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] font-semibold text-neutral-800 transition hover:bg-neutral-50"
                  >
                    <Settings2 className="h-3.5 w-3.5" />
                    Connection settings
                  </Link>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => void handleDisconnect()}
                    disabled={disconnecting}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-50"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    Disconnect
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section aria-label="WhatsApp connection">
      <div className="dashboard-card rounded-2xl border border-neutral-100/90 bg-white p-3.5 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="flex gap-3">
            <IconWell accent="whatsapp" size="lg" round>
              <WhatsAppGlyph className="h-5 w-5 sm:h-[22px] sm:w-[22px]" />
            </IconWell>
            <div>
              <h2 className="text-[14px] font-bold text-neutral-900 sm:text-[15px]">
                Connect WhatsApp to go live
              </h2>
              <p className="mt-0.5 text-[12.5px] text-neutral-600 sm:text-[13px]">
                Sign in with Facebook and choose your business number — takes about a minute.
              </p>
            </div>
          </div>
          <AppButton
            className="shrink-0"
            icon={<Link2 className="h-4 w-4" />}
            onClick={handleConnect}
            disabled={connecting}
            loading={connecting}
          >
            Connect WhatsApp
          </AppButton>
        </div>
      </div>
    </section>
  );
}
