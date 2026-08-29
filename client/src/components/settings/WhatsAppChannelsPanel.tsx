import { Link } from 'react-router-dom';
import { Smartphone, LogOut, Plus, CheckCircle2, AlertTriangle } from 'lucide-react';
import SettingsPanel from './SettingsPanel';
import OfficialCheckCard from './OfficialCheckCard';
import AppButton from '../ui/AppButton';
import { SettingsTabSkeleton } from './SettingsSkeleton';
import MetaPolicyDeadlinesCard from '../whatsapp/MetaPolicyDeadlinesCard';
import MetaPaymentCallout from '../whatsapp/MetaPaymentCallout';
import type { WhatsappNumberOption } from '../../contexts/WhatsAppNumberContext';
import { formatPhoneDisplay } from '../../utils/phone';

interface WhatsAppChannelsPanelProps {
  numbers: WhatsappNumberOption[];
  activeNumberId: string | null;
  numberLimit: number | 'unlimited' | null;
  planName: string | null;
  loading?: boolean;
  connecting: boolean;
  onConnect: () => void;
  onDisconnect: (id: string, phone: string) => void;
  disconnectingId: string | null;
  canEdit: boolean;
  canConnect?: boolean;
}

function limitLabel(limit: number | 'unlimited' | null): string {
  if (limit === 'unlimited') return 'Unlimited';
  if (typeof limit === 'number') return String(limit);
  return '—';
}

function coexistenceBadge(number: WhatsappNumberOption): string | null {
  if (!number.isOnBizApp && number.coexistenceStatus !== 'active') return null;
  if (number.coexistenceStatus === 'offboarded' || number.coexistenceStatus === 'partner_removed') {
    return 'Coexistence paused';
  }
  return 'Business app + Cloud API';
}

function showKeepAliveReminder(number: WhatsappNumberOption): boolean {
  return Boolean(
    number.isOnBizApp &&
      number.coexistenceStatus !== 'offboarded' &&
      number.coexistenceStatus !== 'partner_removed'
  );
}

export default function WhatsAppChannelsPanel({
  numbers,
  activeNumberId,
  numberLimit,
  planName,
  loading = false,
  connecting,
  onConnect,
  onDisconnect,
  disconnectingId,
  canEdit,
  canConnect = true,
}: WhatsAppChannelsPanelProps) {
  const atLimit =
    numberLimit !== null &&
    numberLimit !== 'unlimited' &&
    numbers.length >= numberLimit;
  const canConnectMore = canEdit && canConnect && !atLimit;

  if (loading) return <SettingsTabSkeleton variant="compact" />;

  const quotaLine =
    numberLimit === null
      ? `${numbers.length} connected`
      : numberLimit === 'unlimited'
        ? `${numbers.length} connected · unlimited on ${planName || 'your plan'}`
        : `${numbers.length} of ${numberLimit} on ${planName || 'your plan'}`;

  return (
    <div className="space-y-4">
    <MetaPolicyDeadlinesCard />
    {numbers.length > 0 ? <MetaPaymentCallout showWhenConnected /> : null}
    <OfficialCheckCard
      activeNumber={numbers.find((number) => number.id === activeNumberId) || numbers[0] || null}
    />
    <SettingsPanel
      title="WhatsApp numbers"
      description="Business lines linked to this workspace."
      icon={Smartphone}
      footer={
        numbers.length > 0 ? (
          <div className="flex w-full flex-wrap items-center justify-between gap-3">
            <p className="text-[12px] font-medium text-theme-muted">{quotaLine}</p>
            {canConnectMore ? (
              <AppButton
                variant="secondary"
                size="sm"
                icon={<Plus className="h-4 w-4" />}
                onClick={onConnect}
                disabled={connecting}
                loading={connecting}
              >
                Add number
              </AppButton>
            ) : atLimit && canEdit ? (
              <Link
                to="/billing"
                className="shrink-0 text-[12px] font-semibold text-whatsapp-700 hover:underline dark:text-whatsapp-400"
              >
                Upgrade plan
              </Link>
            ) : null}
          </div>
        ) : undefined
      }
    >
      {numbers.length > 0 ? (
        <div className="space-y-2.5">
          {numbers.map((number) => {
            const isPrimary = number.id === activeNumberId;
            const coexLabel = coexistenceBadge(number);
            const keepAlive = showKeepAliveReminder(number);
            const offboarded =
              number.coexistenceStatus === 'offboarded' ||
              number.coexistenceStatus === 'partner_removed';
            return (
              <div
                key={number.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200/70 bg-gradient-to-r from-emerald-50/80 via-whatsapp-500/[0.04] to-theme-surface px-3.5 py-3 ring-1 ring-emerald-100/80 dark:border-emerald-900/40 dark:from-emerald-950/25 dark:ring-emerald-900/30"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-whatsapp-500 to-emerald-600 text-white">
                    <Smartphone className="h-[18px] w-[18px]" strokeWidth={2.25} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-bold text-[14px] text-theme-fg">
                        {formatPhoneDisplay(number.phoneNumber)}
                      </p>
                      {isPrimary && numbers.length > 1 && (
                        <span className="shrink-0 rounded bg-whatsapp-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-whatsapp-700 dark:text-whatsapp-300">
                          Active
                        </span>
                      )}
                      {coexLabel ? (
                        <span className="shrink-0 rounded bg-sky-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-sky-800 dark:text-sky-300">
                          {coexLabel}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                      <CheckCircle2 className="h-3 w-3 shrink-0" />
                      Connected · Meta Cloud API
                    </p>
                    {keepAlive && !offboarded ? (
                      <p className="mt-1 flex items-start gap-1 text-[11px] text-amber-800 dark:text-amber-300">
                        <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                        Open WhatsApp Business app at least every ~13 days to keep coexistence active.
                      </p>
                    ) : null}
                    {offboarded ? (
                      <p className="mt-1 text-[11px] font-medium text-amber-800 dark:text-amber-300">
                        Coexistence ended — open the Business app or reconnect to restore phone + API sync.
                      </p>
                    ) : null}
                    {typeof number.historySyncProgress === 'number' && number.historySyncProgress < 100 ? (
                      <p className="mt-0.5 text-[10px] text-theme-muted">
                        History sync {number.historySyncProgress}% — past chats are importing into Inbox
                      </p>
                    ) : null}
                  </div>
                </div>
                <AppButton
                  variant="danger"
                  size="sm"
                  icon={<LogOut className="h-3.5 w-3.5" />}
                  onClick={() => onDisconnect(number.id, number.phoneNumber)}
                  loading={disconnectingId === number.id}
                  disabled={disconnectingId !== null || !canEdit}
                  className="shrink-0"
                >
                  Disconnect
                </AppButton>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-whatsapp-500/30 bg-gradient-to-b from-whatsapp-500/[0.05] to-transparent px-4 py-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-whatsapp-500 to-emerald-600 text-white">
            <Smartphone className="h-5 w-5" strokeWidth={2.25} />
          </div>
          <p className="mt-3 text-[14px] font-semibold text-theme-fg">No number connected</p>
          <p className="mt-1 text-[12px] text-theme-secondary">
            Choose standard Cloud API or connect your existing Business app number.
          </p>
          {numberLimit !== null && (
            <p className="mt-1.5 text-[11px] text-theme-muted">
              Plan includes {limitLabel(numberLimit)} number{numberLimit === 1 ? '' : 's'}.
            </p>
          )}
          <div className="mt-4 flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
            <AppButton
              onClick={onConnect}
              disabled={connecting || !canEdit || !canConnect}
              loading={connecting}
              icon={<Plus className="h-4 w-4" />}
            >
              Connect WhatsApp
            </AppButton>
          </div>
        </div>
      )}
    </SettingsPanel>
    </div>
  );
}
