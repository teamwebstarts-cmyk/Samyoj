import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Inbox,
  Link2,
  LogOut,
  Settings2,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import AppButton from '../ui/AppButton';
import { toastError, toastSuccess } from '../../utils/toast';
import { billingApi, whatsappApi } from '../../services/api';
import { useWhatsAppConnectPicker } from '../../hooks/useWhatsAppConnectPicker';
import WhatsAppConnectModeModal from '../whatsapp/WhatsAppConnectModeModal';
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

export type WhatsAppGuideStatus = {
  connected: boolean;
  incomingEnabled: boolean | null;
  statusReady: boolean;
};

interface WhatsAppConnectGuideProps {
  onStatusChange?: (status: WhatsAppGuideStatus) => void;
}

export default function WhatsAppConnectGuide({ onStatusChange }: WhatsAppConnectGuideProps = {}) {
  const { activeNumber, refreshNumbers } = useWhatsAppNumber();
  const [number, setNumber] = useState<WhatsappNumberRow | null>(null);
  const [qualityRating, setQualityRating] = useState<string | null>(null);
  const [webhookSubscribed, setWebhookSubscribed] = useState<boolean | null>(null);
  const [webhookCheckFailed, setWebhookCheckFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [enablingIncoming, setEnablingIncoming] = useState(false);

  const loadRef = useRef<() => void>(() => {});

  const {
    pickerOpen,
    openPicker,
    closePicker,
    connectStandard,
    connectCoexistence,
    connecting,
  } = useWhatsAppConnectPicker({
    onConnected: () => {
      void refreshNumbers({ silent: true });
      loadRef.current();
    },
  });

  const emitStatus = useCallback(
    (
      nextNumber: WhatsappNumberRow | null,
      subscribed: boolean | null,
      ready: boolean
    ) => {
      onStatusChange?.({
        connected: Boolean(nextNumber),
        incomingEnabled: subscribed,
        statusReady: ready,
      });
    },
    [onStatusChange]
  );

  const load = useCallback(() => {
    setLoading(true);
    setLoadError(false);
    const preferredId = activeNumber?.id ?? null;

    Promise.all([
      whatsappApi.numbers(),
      billingApi.usage().then((r) => ({ ok: true as const, r })).catch(() => ({ ok: false as const })),
      whatsappApi.webhookStatus().then((r) => ({ ok: true as const, r })).catch(() => ({ ok: false as const })),
    ])
      .then(([numbersRes, usageResult, webhookResult]) => {
        const numbers = parseNumbers(numbersRes.data?.data);
        const preferred =
          (preferredId && numbers.find((n) => n.id === preferredId)) ||
          numbers.find((n) => n.isActive) ||
          numbers[0] ||
          null;
        setNumber(preferred);
        setLoadError(false);

        if (usageResult.ok && preferred) {
          const usage = usageResult.r.data?.data as BillingUsage | undefined;
          const ratings = usage?.qualityRatings || [];
          const preferredDigits = preferred.phoneNumber.replace(/\D/g, '');
          const match = ratings.find(
            (r) => r.phoneNumber.replace(/\D/g, '') === preferredDigits
          );
          setQualityRating(match?.qualityRating ?? null);
        } else {
          setQualityRating(null);
        }

        if (webhookResult.ok && webhookResult.r.data?.data && typeof webhookResult.r.data.data === 'object') {
          const status = webhookResult.r.data.data as {
            subscribed?: boolean | null;
            statusCheckFailed?: boolean;
          };
          setWebhookCheckFailed(Boolean(status.statusCheckFailed));
          if (status.statusCheckFailed) {
            setWebhookSubscribed(null);
          } else if (typeof status.subscribed === 'boolean') {
            setWebhookSubscribed(status.subscribed);
          } else {
            setWebhookSubscribed(null);
          }
          emitStatus(
            preferred,
            status.statusCheckFailed
              ? null
              : typeof status.subscribed === 'boolean'
                ? status.subscribed
                : null,
            true
          );
        } else {
          setWebhookCheckFailed(Boolean(preferred));
          setWebhookSubscribed(null);
          emitStatus(preferred, null, true);
        }
      })
      .catch(() => {
        setNumber(null);
        setQualityRating(null);
        setWebhookSubscribed(null);
        setWebhookCheckFailed(false);
        setLoadError(true);
        emitStatus(null, null, true);
        toastError('Could not load WhatsApp connection status.');
      })
      .finally(() => setLoading(false));
  }, [activeNumber?.id, emitStatus]);

  loadRef.current = load;

  useEffect(() => {
    load();
  }, [load]);

  const handleEnableIncoming = async () => {
    setEnablingIncoming(true);
    try {
      const { data } = await whatsappApi.setupWebhook();
      const payload = data?.data as { callbackUrl?: string; subscribed?: boolean } | undefined;
      if (payload?.subscribed || payload?.callbackUrl) {
        toastSuccess('Incoming messages are now enabled.');
        setWebhookSubscribed(true);
        setWebhookCheckFailed(false);
        emitStatus(number, true, true);
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
    try {
      await whatsappApi.disconnect(number.id);
      setNumber(null);
      setQualityRating(null);
      setWebhookSubscribed(null);
      setWebhookCheckFailed(false);
      emitStatus(null, null, true);
      await refreshNumbers({ silent: true });
      load();
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
        <div className="dashboard-card flex flex-col gap-[var(--card-gap)] rounded-2xl border-amber-100 bg-amber-50/40 p-[var(--card-pad)] sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <IconWell accent="amber" size="lg">
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
    const incomingOff = webhookSubscribed === false && !webhookCheckFailed;
    const incomingUnknown = webhookCheckFailed || (webhookSubscribed === null && !incomingOff);
    const needsAction = incomingOff || quality === 'YELLOW' || quality === 'RED';

    const cardClass = incomingOff
      ? 'border-rose-200/90 bg-gradient-to-r from-rose-50/70 via-white to-white'
      : incomingUnknown
      ? 'border-amber-200/90 bg-gradient-to-r from-amber-50/80 via-white to-white'
      : quality === 'RED'
        ? 'border-rose-100/90 bg-gradient-to-r from-rose-50/50 via-white to-white'
        : quality === 'YELLOW'
          ? 'border-amber-100/90 bg-gradient-to-r from-amber-50/40 via-white to-white'
          : 'border-emerald-100/90 bg-gradient-to-r from-emerald-50/50 via-white to-white';

    let statusLine: string;
    if (incomingOff) {
      statusLine = 'Connected · Customer replies are not reaching Inbox yet';
    } else if (incomingUnknown) {
      statusLine = "Connected · Couldn't verify incoming status — try Enable incoming or refresh";
    } else if (incomingOn && qMeta?.hint) {
      statusLine = `Live · ${qMeta.hint}`;
    } else if (incomingOn) {
      statusLine = 'Live · Sending & receiving on this number';
    } else {
      statusLine = 'Connected · WhatsApp Business Cloud API';
    }

    return (
      <section
        aria-label="WhatsApp connection"
        className="relative z-10"
      >
        <div
          className={`dashboard-card flex flex-col gap-2 rounded-2xl p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-[var(--card-gap)] sm:p-[var(--card-pad)] ${cardClass}`}
        >
          <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
            <div className="relative shrink-0">
              <IconWell accent="whatsapp" size="md">
                <WhatsAppGlyph className="h-4 w-4 sm:h-[22px] sm:w-[22px]" />
              </IconWell>
              {incomingOn && !needsAction && (
                <span
                  className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-white bg-emerald-500 text-white sm:h-4 sm:w-4"
                  aria-hidden
                >
                  <CheckCircle2 className="h-2 w-2 sm:h-2.5 sm:w-2.5" strokeWidth={3} />
                </span>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
                <h2 className="max-w-[11rem] truncate text-[13px] font-extrabold tracking-tight text-neutral-900 sm:max-w-[14rem] sm:text-[15px] md:max-w-[12rem] lg:max-w-none">
                  {phone}
                </h2>
                {incomingOn && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200/80 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-800">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
                    Live
                  </span>
                )}
                {incomingOff && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-rose-700">
                    <span className="relative flex h-1.5 w-1.5" aria-hidden>
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-70" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-rose-600" />
                    </span>
                    Inbox offline
                  </span>
                )}
                {incomingUnknown && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-200/80 bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-900">
                    Check inbound
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

              <p className="mt-0.5 hidden text-[12.5px] font-medium leading-snug text-neutral-500 sm:block">
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
                {incomingUnknown && (
                  <>
                    {' '}
                    <button
                      type="button"
                      onClick={() => load()}
                      className="font-semibold text-whatsapp-700 hover:underline"
                    >
                      Refresh
                    </button>
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

          <div className="relative z-20 flex w-full shrink-0 items-center gap-1.5 sm:w-auto sm:flex-nowrap sm:justify-end sm:gap-2">
            {(incomingOff || incomingUnknown) && (
              <AppButton
                type="button"
                size="sm"
                className="!h-8 !min-h-8 flex-1 px-2.5 text-[11px] sm:flex-none sm:!h-10 sm:!min-h-10 sm:px-4 sm:text-[13px]"
                icon={<Inbox className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
                onClick={() => void handleEnableIncoming()}
                loading={enablingIncoming}
                disabled={enablingIncoming || disconnecting}
              >
                <span className="sm:hidden">Enable</span>
                <span className="hidden sm:inline">Enable incoming</span>
              </AppButton>
            )}

            <Link
              to="/settings?tab=whatsapp"
              className="inline-flex h-8 min-h-8 flex-1 items-center justify-center gap-1 rounded-lg border border-neutral-200 bg-white px-2.5 text-[11px] font-semibold text-neutral-700 transition hover:bg-neutral-50 sm:h-10 sm:min-h-10 sm:flex-none sm:rounded-xl sm:px-4 sm:text-[13px]"
            >
              <Settings2 className="hidden h-3.5 w-3.5 sm:block" />
              Manage
            </Link>

            <button
              type="button"
              onClick={() => void handleDisconnect()}
              disabled={disconnecting}
              aria-label={disconnecting ? 'Disconnecting' : 'Disconnect'}
              className="inline-flex h-8 min-h-8 items-center justify-center gap-1 rounded-lg border border-rose-200 bg-white px-2 text-[11px] font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-50 sm:h-10 sm:min-h-10 sm:flex-none sm:rounded-xl sm:px-4 sm:text-[13px]"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{disconnecting ? 'Disconnecting…' : 'Disconnect'}</span>
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section aria-label="WhatsApp connection">
      <div className="dashboard-card rounded-2xl border border-neutral-100/90 bg-white p-[var(--card-pad)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="flex gap-3">
            <IconWell accent="whatsapp" size="lg">
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
            onClick={openPicker}
            disabled={connecting}
            loading={connecting}
          >
            Connect WhatsApp
          </AppButton>
        </div>
      </div>

      <WhatsAppConnectModeModal
        open={pickerOpen}
        onClose={closePicker}
        onConnectStandard={connectStandard}
        onConnectCoexistence={connectCoexistence}
        connecting={connecting}
      />
    </section>
  );
}
