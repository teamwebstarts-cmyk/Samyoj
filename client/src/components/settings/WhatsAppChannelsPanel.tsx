import { Link } from 'react-router-dom';
import { Cloud, Copy, Smartphone, LogOut, Plus, CheckCircle2, AlertTriangle, RefreshCw, Info } from 'lucide-react';
import AppButton from '../ui/AppButton';
import { SettingsTabSkeleton } from './SettingsSkeleton';
import WhatsAppGlyph from '../dashboard/icons/WhatsAppGlyph';
import type { WhatsappNumberOption } from '../../contexts/WhatsAppNumberContext';
import { formatPhoneDisplay } from '../../utils/phone';

interface WhatsAppChannelsPanelProps {
  numbers: WhatsappNumberOption[];
  disconnectedNumbers?: WhatsappNumberOption[];
  activeNumberId: string | null;
  numberLimit: number | 'unlimited' | null;
  planName: string | null;
  loading?: boolean;
  connecting: boolean;
  onConnect: () => void;
  onDisconnect: (number: WhatsappNumberOption) => void;
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
  disconnectedNumbers = [],
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
    <div className="space-y-3">
      {numbers.length > 0 ? (
        <section className="settings-channel-card settings-channel-card--whatsapp">
          {numbers.map((number) => {
            const isPrimary = number.id === activeNumberId;
            const coexLabel = coexistenceBadge(number);
            const keepAlive = showKeepAliveReminder(number);
            const offboarded =
              number.coexistenceStatus === 'offboarded' ||
              number.coexistenceStatus === 'partner_removed';
            return (
              <div key={number.id}>
                <div className="settings-channel-card__header">
                  <div className="settings-channel-card__identity">
                    <span className="settings-channel-card__brand settings-channel-card__brand--whatsapp">
                      <WhatsAppGlyph className="h-[19px] w-[19px]" />
                    </span>
                    <div className="min-w-0">
                      <div className="settings-channel-card__title-row">
                        <h2>WhatsApp</h2>
                        <span className="settings-channel-status"><i /> Connected</span>
                      </div>
                      <p>Business messaging via WhatsApp Cloud API.</p>
                    </div>
                  </div>
                  <div className="settings-channel-card__actions">
                    <button type="button" className="settings-channel-action settings-channel-action--danger" onClick={() => onDisconnect(number)} disabled={disconnectingId !== null || !canEdit}>
                      <LogOut className="h-3 w-3" /> Disconnect
                    </button>
                  </div>
                </div>

                <div className="settings-channel-meta-grid">
                  <div><small>Phone number</small><b>{formatPhoneDisplay(number.phoneNumber)} <Copy className="inline h-3 w-3 text-slate-400" /></b></div>
                  <div><small>Provider</small><b><Cloud className="inline h-3 w-3 text-sky-500" /> Meta Cloud API</b></div>
                  <div><small>Status</small><b><i className="settings-channel-live-dot" /> Live</b><span>Sending & receiving messages</span></div>
                </div>

                <div className={`settings-channel-health ${offboarded ? 'settings-channel-health--warning' : ''}`}>
                  {offboarded ? <AlertTriangle /> : <CheckCircle2 />}
                  <span><b>{offboarded ? 'Connection needs attention' : 'Connection healthy'}</b><small>{offboarded ? 'Reconnect to restore phone + API sync.' : 'Last checked just now'}</small></span>
                  <button type="button" onClick={onConnect} disabled={connecting || !canEdit}><RefreshCw /> Reconnect</button>
                </div>
                {coexLabel ? (
                  <p className="settings-channel-footnote inline-flex items-center gap-1">
                    {coexLabel}
                    {keepAlive && !offboarded ? (
                      <Info
                        className="h-3.5 w-3.5 text-neutral-400"
                        aria-hidden
                        title="Open the WhatsApp Business app about every 13 days so this link stays active."
                      />
                    ) : null}
                    {number.coexistenceStatus === 'sync_needed' ||
                    (number.isOnBizApp &&
                      number.historySyncProgress == null &&
                      number.createdAt &&
                      Date.now() - new Date(number.createdAt).getTime() > 24 * 60 * 60 * 1000) ? (
                      <Info
                        className="h-3.5 w-3.5 text-amber-500"
                        aria-hidden
                        title="Older chats did not finish syncing. In the WhatsApp Business app, disconnect Business platform, wait 15 minutes, then connect again."
                      />
                    ) : null}
                  </p>
                ) : null}
                {isPrimary && numbers.length > 1 ? <p className="settings-channel-footnote">ⓘ Active number · {quotaLine}</p> : null}
              </div>
            );
          })}
        </section>
      ) : null}
      {numbers.length > 0 ? (
        <div className="settings-channel-card__footer">
          <span>{quotaLine}</span>
          {canConnectMore ? <button type="button" onClick={onConnect} disabled={connecting}><Plus /> Add number</button> : atLimit && canEdit ? <Link to="/billing">Upgrade plan</Link> : null}
        </div>
      ) : null}
      {disconnectedNumbers.length > 0 ? (
        <div className={`${numbers.length > 0 ? 'mt-2.5' : ''} space-y-2.5`}>
          {disconnectedNumbers.map((number) => (
            <div
              key={number.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-amber-200/80 bg-amber-50/70 px-3.5 py-3 ring-1 ring-amber-100/80 dark:border-amber-900/40 dark:bg-amber-950/25 dark:ring-amber-900/30"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-800 dark:text-amber-300">
                  <Smartphone className="h-[18px] w-[18px]" strokeWidth={2.25} />
                </div>
                <div className="min-w-0">
                  <p className="truncate font-bold text-[14px] text-theme-fg">
                    {formatPhoneDisplay(number.phoneNumber)}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold text-amber-800 dark:text-amber-300">
                    <AlertTriangle className="h-3 w-3 shrink-0" />
                    Disconnected — reconnect to send and receive
                  </p>
                </div>
              </div>
              <AppButton
                size="sm"
                icon={<Plus className="h-3.5 w-3.5" />}
                onClick={onConnect}
                loading={connecting}
                disabled={connecting || !canEdit || !canConnect}
                className="shrink-0"
              >
                Reconnect
              </AppButton>
            </div>
          ))}
        </div>
      ) : null}
      {numbers.length === 0 && disconnectedNumbers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-whatsapp-500/30 bg-gradient-to-b from-whatsapp-500/[0.05] to-transparent px-4 py-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-whatsapp-500 to-emerald-600 text-white">
            <Smartphone className="h-5 w-5" strokeWidth={2.25} />
          </div>
          <p className="mt-3 text-[14px] font-semibold text-theme-fg">No number connected</p>
          <p className="mt-1 text-[12px] text-theme-secondary">
            Sign in with Facebook and pick your business line.
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
      ) : null}
    </div>
  );
}
