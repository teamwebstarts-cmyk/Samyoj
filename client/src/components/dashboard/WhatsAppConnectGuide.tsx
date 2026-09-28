import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Inbox,
  Link2,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import AppButton from '../ui/AppButton';
import { toastError, toastSuccess } from '../../utils/toast';
import { billingApi, whatsappApi } from '../../services/api';
import { useWhatsAppConnectPicker } from '../../hooks/useWhatsAppConnectPicker';
import { useWhatsAppNumber } from '../../contexts/WhatsAppNumberContext';
import { formatPhoneDisplay } from '../../utils/formatPhone';
import type { BillingUsage } from '../../types';
import WhatsAppGlyph from './icons/WhatsAppGlyph';
import IconWell from './icons/IconWell';
import { parseWhatsappNumbersPayload } from '../../utils/whatsappWorkspace';
import { whatsappNotConnectedCopy } from '../../utils/whatsappConnectionCopy';
import WhatsAppConnectModeModal from '../whatsapp/WhatsAppConnectModeModal';
import ChannelHeroActions from './ChannelHeroActions';
import ChannelHeroLead, { ChannelHeroConnectedBadge } from './ChannelHeroLead';
import type { MetricsPeriod } from '../../utils/metricsPeriod';
import WhatsAppHeroArt from './WhatsAppHeroArt';
interface WhatsappNumberRow {
  id: string;
  phoneNumber: string;
  isActive: boolean;
}

type QualityTone = 'GREEN' | 'YELLOW' | 'RED' | null;

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
  period: MetricsPeriod;
  onPeriodChange: (period: MetricsPeriod) => void;
}

export default function WhatsAppConnectGuide({
  onStatusChange,
  period,
  onPeriodChange,
}: WhatsAppConnectGuideProps) {
  const { activeNumber, disconnectedNumbers } = useWhatsAppNumber();
  const [number, setNumber] = useState<WhatsappNumberRow | null>(null);
  const [qualityRating, setQualityRating] = useState<string | null>(null);
  const [webhookSubscribed, setWebhookSubscribed] = useState<boolean | null>(null);
  const [webhookCheckFailed, setWebhookCheckFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [enablingIncoming, setEnablingIncoming] = useState(false);

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
    ])
      .then(([numbersRes, usageResult]) => {
        const numbers = parseWhatsappNumbersPayload(numbersRes.data?.data).numbers;
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

        emitStatus(preferred, null, true);
        setLoading(false);

        if (!preferred) {
          setWebhookSubscribed(null);
          setWebhookCheckFailed(false);
          return;
        }

        void whatsappApi
          .webhookStatus()
          .then((r) => {
            const status = r.data?.data as
              | { subscribed?: boolean | null; statusCheckFailed?: boolean }
              | undefined;
            if (!status || typeof status !== 'object') {
              setWebhookCheckFailed(true);
              setWebhookSubscribed(null);
              emitStatus(preferred, null, true);
              return;
            }
            setWebhookCheckFailed(Boolean(status.statusCheckFailed));
            const subscribed = status.statusCheckFailed
              ? null
              : typeof status.subscribed === 'boolean'
                ? status.subscribed
                : null;
            setWebhookSubscribed(subscribed);
            emitStatus(preferred, subscribed, true);
          })
          .catch(() => {
            setWebhookCheckFailed(true);
            setWebhookSubscribed(null);
            emitStatus(preferred, null, true);
          });
      })
      .catch(() => {
        setNumber(null);
        setQualityRating(null);
        setWebhookSubscribed(null);
        setWebhookCheckFailed(false);
        setLoadError(true);
        emitStatus(null, null, true);
        toastError('Could not load WhatsApp connection status.');
        setLoading(false);
      });
  }, [activeNumber?.id, emitStatus]);

  const {
    pickerOpen,
    openPicker,
    closePicker,
    connectStandard,
    connectCoexistence,
    connecting,
  } = useWhatsAppConnectPicker({
    returnPath: '/',
    onConnected: () => {
      load();
    },
  });

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

  if (loading) {
    return (
      <section aria-label="WhatsApp connection">
        <div className="dashboard-card relative flex h-[150px] items-center justify-between overflow-hidden rounded-[22px] border border-emerald-100/80 bg-emerald-50/30 p-[var(--card-pad)]">
          <div className="flex items-center gap-3">
            <span className="h-12 w-12 rounded-2xl bg-emerald-100/70" />
            <span><span className="block h-4 w-36 rounded bg-emerald-100/70" /><span className="mt-2 block h-3 w-52 rounded bg-emerald-100/50" /></span>
          </div>
          <div className="wa3d-loading-art animate-pulse" aria-hidden>
            <span className="wa3d-loading-art__mini wa3d-loading-art__mini--top" />
            <span className="wa3d-loading-art__mini wa3d-loading-art__mini--left" />
            <span className="wa3d-loading-art__cube" />
            <span className="wa3d-loading-art__mini wa3d-loading-art__mini--right" />
          </div>
          <span className="relative z-10 h-10 w-40 rounded-lg bg-white/80" />
        </div>
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
      statusLine = 'Customer replies are not reaching Inbox yet';
    } else if (incomingUnknown) {
      statusLine = 'WhatsApp is busy. Wait a minute, then refresh.';
    } else if (incomingOn && qMeta?.hint) {
      statusLine = qMeta.hint;
    } else if (incomingOn) {
      statusLine = 'Sending & receiving on this number';
    } else {
      statusLine = 'WhatsApp Business Cloud API';
    }

    return (
      <section
        aria-label="WhatsApp connection"
        className="relative z-10"
      >
        <div
          className={`dashboard-card dashboard-channel-hero dashboard-connection-hero dashboard-channel-hero-layout relative overflow-hidden rounded-[22px] px-4 py-4 sm:px-7 sm:py-5 ${cardClass}`}
        >
          <ChannelHeroLead
            icon={
              <div className="relative">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[#25D366] to-[#128C7E] text-white shadow-[0_10px_22px_rgba(37,211,102,0.35)]">
                  <WhatsAppGlyph className="h-6 w-6" />
                </span>
                {incomingOn && !needsAction && (
                  <span
                    className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-white bg-emerald-500 text-white"
                    aria-hidden
                  >
                    <CheckCircle2 className="h-2 w-2" strokeWidth={3} />
                  </span>
                )}
              </div>
            }
            title="WhatsApp"
            badge={
              <>
                <ChannelHeroConnectedBadge />
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
                    Please wait
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
              </>
            }
            nameLine={<span className="truncate">{phone}</span>}
            description={
              <>
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
              </>
            }
          />

          <ChannelHeroActions
            manageHref="/settings?tab=whatsapp"
            period={period}
            onPeriodChange={onPeriodChange}
            beforeManage={
              incomingOff ? (
                <AppButton
                  type="button"
                  size="sm"
                  className="!h-9 !min-h-9 shrink-0 px-3 text-[12px] sm:!h-[37px] sm:!min-h-[37px] sm:px-3.5 sm:text-[12.5px]"
                  icon={<Inbox className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
                  onClick={() => void handleEnableIncoming()}
                  loading={enablingIncoming}
                  disabled={enablingIncoming}
                >
                  <span className="sm:hidden">Enable</span>
                  <span className="hidden sm:inline">Enable incoming</span>
                </AppButton>
              ) : null
            }
          />
          <WhatsAppHeroArt />
        </div>
      </section>
    );
  }

  const disconnectedCopy = whatsappNotConnectedCopy(disconnectedNumbers);

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
                {disconnectedCopy.disconnected
                  ? disconnectedCopy.title
                  : 'Connect WhatsApp'}
              </h2>
              <p className="mt-0.5 text-[12.5px] text-neutral-600 sm:text-[13px]">
                {disconnectedCopy.disconnected
                  ? disconnectedCopy.description
                  : 'Sign in with Facebook and choose your business number — takes about a minute.'}
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
            {disconnectedCopy.cta}
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
