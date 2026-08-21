import { useState } from 'react';
import {
  Smartphone,
  CheckCircle,
  AlertCircle,
  Activity,
  LogOut,
  Plus,
  RefreshCw,
  Sliders,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import SettingsPanel from './SettingsPanel';
import SettingsStatusPill from './SettingsStatusPill';
import AppButton from '../ui/AppButton';
import AppInput from '../ui/AppInput';
import type {
  WhatsappNumber,
  CampaignSettings,
  WebhookStatus,
  WebhookHealth,
} from '../../types';
import { formatPhoneDisplay } from '../../utils/phone';

interface WhatsAppChannelsPanelProps {
  numbers: WhatsappNumber[];
  connecting: boolean;
  onConnect: () => void;
  onDisconnect: (id: string, phone: string) => void;
  disconnectingId: string | null;
  webhookStatus: WebhookStatus | null;
  webhookHealth: WebhookHealth | null;
  onRefreshWebhook: () => void;
  refreshingWebhook: boolean;
  campaignSettings: CampaignSettings;
  onSaveCampaignSettings: (settings: CampaignSettings) => Promise<void>;
  savingCampaigns: boolean;
  canEdit: boolean;
}

export default function WhatsAppChannelsPanel({
  numbers,
  connecting,
  onConnect,
  onDisconnect,
  disconnectingId,
  webhookStatus,
  webhookHealth,
  onRefreshWebhook,
  refreshingWebhook,
  campaignSettings,
  onSaveCampaignSettings,
  savingCampaigns,
  canEdit,
}: WhatsAppChannelsPanelProps) {
  const [localCampaigns, setLocalCampaigns] = useState<CampaignSettings>(campaignSettings);

  const handleSaveThrottling = async () => {
    await onSaveCampaignSettings(localCampaigns);
  };

  return (
    <div className="space-y-5">
      {/* Top Status Cards */}
      <div className="grid gap-3 sm:grid-cols-2">
        <SettingsStatusPill
          label="WhatsApp Phone Line"
          active={numbers.length > 0}
          icon={Smartphone}
          activeLabel={`${numbers.length} ${numbers.length === 1 ? 'Number' : 'Numbers'} Connected`}
          inactiveLabel="No Number Connected"
        />
        <SettingsStatusPill
          label="Live Inbound Sync"
          active={Boolean(webhookStatus?.subscribed)}
          icon={Activity}
          activeLabel="Sync Active · Receiving"
          inactiveLabel="Sync Inactive"
        />
      </div>

      {/* Connected WhatsApp Numbers */}
      <SettingsPanel
        title="WhatsApp Phone Numbers"
        description="Official WhatsApp Business API numbers connected to your workspace."
        icon={Smartphone}
        accent="emerald"
        footer={
          numbers.length > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[12px] font-medium text-theme-muted">
                Meta Cloud API verified and encrypted.
              </p>
              <AppButton
                variant="secondary"
                size="sm"
                icon={<Plus className="h-4 w-4" />}
                onClick={onConnect}
                disabled={connecting || !canEdit}
                loading={connecting}
              >
                Connect another number
              </AppButton>
            </div>
          ) : undefined
        }
      >
        {numbers.length > 0 ? (
          <div className="space-y-3">
            {numbers.map((number) => (
              <div
                key={number.id}
                className="flex flex-col gap-4 rounded-2xl border border-emerald-200/80 bg-gradient-to-r from-emerald-50/90 via-emerald-50/30 to-theme-surface p-4 ring-1 ring-emerald-100 dark:border-emerald-800/40 dark:from-emerald-950/30 dark:ring-emerald-900/40 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-3.5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-theme-surface text-whatsapp-600 shadow-sm ring-1 ring-emerald-100 dark:ring-emerald-800/50">
                    <CheckCircle size={22} strokeWidth={2.25} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-extrabold text-theme-fg text-[15px]">
                        {formatPhoneDisplay(number.phoneNumber)}
                      </p>
                      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100/90 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200">
                        <ShieldCheck className="h-3 w-3" />
                        Meta Official API
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-[12px] font-semibold text-whatsapp-700 dark:text-whatsapp-400">
                      <span>Connected · Active</span>
                      <span className="text-theme-border">•</span>
                      <span className="text-emerald-700 dark:text-emerald-300 font-medium">
                        🟢 High Quality Tier
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <AppButton
                    variant="danger"
                    size="sm"
                    icon={<LogOut className="h-4 w-4" />}
                    onClick={() => onDisconnect(number.id, number.phoneNumber)}
                    loading={disconnectingId === number.id}
                    disabled={disconnectingId !== null || !canEdit}
                  >
                    Disconnect
                  </AppButton>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-theme-border bg-theme-subtle/40 px-4 py-10 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-whatsapp-500 to-whatsapp-600 text-white shadow-[0_4px_14px_rgba(37,211,102,0.35)]">
              <Smartphone className="h-6 w-6" strokeWidth={2.25} />
            </div>
            <p className="mt-4 text-[14px] font-semibold text-theme-fg">
              No WhatsApp number connected yet
            </p>
            <p className="mt-1 text-[13px] font-medium text-theme-secondary">
              Connect your business number via Meta Embedded Signup to start sending and receiving messages.
            </p>
            <AppButton
              className="mt-5"
              onClick={onConnect}
              disabled={connecting || !canEdit}
              loading={connecting}
              icon={<Zap className="h-4 w-4" />}
            >
              Connect WhatsApp Business API
            </AppButton>
            <p className="mt-3 text-[11px] font-medium text-theme-muted">
              Fast, secure onboarding through Facebook Login with Meta authorization.
            </p>
          </div>
        )}
      </SettingsPanel>

      {/* Live Inbound Sync Health */}
      <SettingsPanel
        title="Live Inbound Message Sync"
        description="Monitors real-time delivery and incoming message health from Meta servers."
        icon={Activity}
        accent="sky"
        footer={
          webhookStatus?.connected ? (
            <div className="flex items-center justify-between gap-3">
              <p className="text-[12px] font-medium text-theme-muted">
                Sync refreshes automatically on every inbound event.
              </p>
              <AppButton
                variant="secondary"
                size="sm"
                icon={<RefreshCw className={`h-3.5 w-3.5 ${refreshingWebhook ? 'animate-spin' : ''}`} />}
                onClick={onRefreshWebhook}
                disabled={refreshingWebhook || !canEdit}
                loading={refreshingWebhook}
              >
                Refresh connection sync
              </AppButton>
            </div>
          ) : undefined
        }
      >
        {webhookStatus?.connected ? (
          <div className="space-y-4 text-[13px]">
            <div
              className={`flex items-start gap-3 rounded-2xl p-4 ring-1 ${
                webhookStatus.subscribed
                  ? 'bg-emerald-50/90 ring-emerald-100 dark:bg-emerald-950/30 dark:ring-emerald-900/40'
                  : 'bg-amber-50/90 ring-amber-100 dark:bg-amber-950/30 dark:ring-amber-900/40'
              }`}
            >
              {webhookStatus.subscribed ? (
                <>
                  <CheckCircle size={19} className="mt-0.5 shrink-0 text-whatsapp-600 dark:text-whatsapp-400" />
                  <div>
                    <p className="font-extrabold text-emerald-900 dark:text-emerald-200">
                      Live Inbound Sync is Active
                    </p>
                    <p className="mt-0.5 font-medium text-emerald-800/90 dark:text-emerald-300/90">
                      Customer messages arrive instantly in your Inbox and trigger configured automations.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <AlertCircle size={19} className="mt-0.5 shrink-0 text-amber-600" />
                  <div>
                    <p className="font-extrabold text-amber-900 dark:text-amber-200">
                      Inbound Sync Needs Attention
                    </p>
                    <p className="mt-0.5 font-medium text-amber-800/90 dark:text-amber-300/90">
                      Customer messages may not arrive. Tap Refresh connection sync below to reactivate.
                    </p>
                  </div>
                </>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-theme-border bg-theme-subtle/50 p-4">
                <p className="text-[11px] font-bold uppercase tracking-wide text-theme-muted">
                  Message Processing Volume
                </p>
                <p className="mt-2 text-[13px] font-bold text-theme-fg">
                  {webhookHealth && webhookHealth.totalReceived > 0
                    ? `${webhookHealth.totalReceived.toLocaleString()} inbound messages processed`
                    : 'Awaiting first customer message'}
                </p>
                {webhookHealth?.lastReceivedAt && (
                  <p className="mt-1 text-[11px] text-theme-muted">
                    Last received: {new Date(webhookHealth.lastReceivedAt).toLocaleString()}
                  </p>
                )}
              </div>

              <div className="rounded-2xl border border-theme-border bg-theme-subtle/50 p-4">
                <p className="text-[11px] font-bold uppercase tracking-wide text-theme-muted">
                  Meta Quality & Sync Health
                </p>
                <p className="mt-2 text-[13px] font-bold text-emerald-600 dark:text-emerald-400">
                  {webhookHealth?.totalErrors && webhookHealth.totalErrors > 0
                    ? `${webhookHealth.totalErrors} temporary sync retries logged`
                    : '100% Operational · No sync errors'}
                </p>
                {webhookHealth?.lastError && (
                  <p className="mt-1 text-[11px] text-amber-600 truncate">
                    Notice: {webhookHealth.lastError}
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-theme-border bg-theme-subtle/40 px-4 py-8 text-center">
            <p className="text-[13px] font-medium text-theme-secondary">
              Connect a WhatsApp number above to activate live message sync.
            </p>
          </div>
        )}
      </SettingsPanel>

      {/* Sending Throttling & Velocity */}
      <SettingsPanel
        title="Channel Sending Velocity & Guardrails"
        description="Control dispatch limits and rate throttling for WhatsApp message safety."
        icon={Sliders}
        accent="violet"
        footer={
          canEdit ? (
            <div className="flex items-center justify-between gap-3">
              <p className="text-[12px] font-medium text-theme-muted">
                Safe sending rates protect your Meta phone number quality score.
              </p>
              <AppButton loading={savingCampaigns} onClick={handleSaveThrottling}>
                Save velocity limits
              </AppButton>
            </div>
          ) : undefined
        }
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <AppInput
            id="daily-send-limit"
            label="Daily send limit (recipients)"
            type="number"
            min={1}
            value={String(localCampaigns.dailySendLimit)}
            onChange={(e) =>
              setLocalCampaigns((prev: CampaignSettings) => ({
                ...prev,
                dailySendLimit: parseInt(e.target.value, 10) || 1,
              }))
            }
            disabled={!canEdit}
          />

          <AppInput
            id="batch-size"
            label="Batch group size"
            type="number"
            min={1}
            value={String(localCampaigns.batchSize)}
            onChange={(e) =>
              setLocalCampaigns((prev: CampaignSettings) => ({
                ...prev,
                batchSize: parseInt(e.target.value, 10) || 1,
              }))
            }
            disabled={!canEdit}
          />

          <AppInput
            id="batch-delay"
            label="Pause between batches (seconds)"
            type="number"
            min={0}
            value={String(Math.round(localCampaigns.batchDelayMs / 1000))}
            onChange={(e) =>
              setLocalCampaigns((prev: CampaignSettings) => ({
                ...prev,
                batchDelayMs: (parseInt(e.target.value, 10) || 0) * 1000,
              }))
            }
            disabled={!canEdit}
          />
        </div>

        <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-theme-border bg-theme-subtle/40 px-4 py-3.5">
          <input
            type="checkbox"
            checked={localCampaigns.mapFirstBodyVariableToName !== false}
            onChange={(e) =>
              setLocalCampaigns((prev: CampaignSettings) => ({
                ...prev,
                mapFirstBodyVariableToName: e.target.checked,
              }))
            }
            disabled={!canEdit}
            className="mt-0.5 h-4 w-4 rounded border-theme-border text-emerald-600 focus:ring-emerald-500/30"
          />
          <div>
            <p className="text-[13px] font-semibold text-theme-fg">
              Auto-fill first template variable {'{{1}}'} with contact name
            </p>
            <p className="text-[11px] font-medium text-theme-muted">
              Templates with {'{{1}}'} personalize automatically at send time without manual contact mapping.
            </p>
          </div>
        </label>
      </SettingsPanel>
    </div>
  );
}
