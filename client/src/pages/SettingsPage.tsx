import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Building2,
  Smartphone,
  Clock,
  Plug,
  Palette,
  Shield,
  SlidersHorizontal,
  PhoneOff,
} from 'lucide-react';
import PageShell from '../components/ui/PageShell';
import SegmentedControl from '../components/ui/SegmentedControl';
import { TabTransition } from '../components/ui/TabTransition';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { useAuth } from '../contexts/AuthContext';
import { settingsApi, whatsappApi } from '../services/api';
import type {
  WhatsappNumber,
  CampaignSettings,
  BusinessHoursSettings,
  WebhookStatus,
  WebhookHealth,
} from '../types';
import { toastError, toastSuccess } from '../utils/toast';
import { formatPhoneDisplay } from '../utils/phone';
import { startWhatsAppOAuth, subscribeWaOAuthResult } from '../utils/whatsappOAuth';

// Subcomponents
import BusinessProfilePanel from '../components/settings/BusinessProfilePanel';
import WhatsAppChannelsPanel from '../components/settings/WhatsAppChannelsPanel';
import HoursAndInboxPanel from '../components/settings/HoursAndInboxPanel';
import IntegrationsPanel from '../components/settings/IntegrationsPanel';
import AppearanceSettingsPanel from '../components/settings/AppearanceSettingsPanel';
import SecuritySettingsPanel from '../components/settings/SecuritySettingsPanel';
import AdminUiTogglesPanel from '../components/settings/AdminUiTogglesPanel';

type SettingsTab =
  | 'profile'
  | 'whatsapp'
  | 'inbox'
  | 'integrations'
  | 'appearance'
  | 'security'
  | 'admin';

const DEFAULT_CAMPAIGN_SETTINGS: CampaignSettings = {
  dailySendLimit: 1000,
  dailyBudgetInr: 5000,
  batchSize: 50,
  batchDelayMs: 1000,
  mapFirstBodyVariableToName: true,
};

const DEFAULT_BUSINESS_HOURS: BusinessHoursSettings = {
  startHour: 9,
  endHour: 18,
  days: [1, 2, 3, 4, 5],
  timezone: 'Asia/Kolkata',
};

export default function SettingsPage() {
  const { orgRole, organization } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);

  // Active Tab
  const activeTab = useMemo<SettingsTab>(() => {
    const raw = searchParams.get('tab');
    if (
      raw === 'profile' ||
      raw === 'whatsapp' ||
      raw === 'inbox' ||
      raw === 'integrations' ||
      raw === 'appearance' ||
      raw === 'security' ||
      raw === 'admin'
    ) {
      return raw;
    }
    // Backward compatibility mappings
    if (raw === 'general') return 'appearance';
    if (raw === 'automation') return 'inbox';
    if (raw === 'campaigns') return 'whatsapp';
    if (raw === 'ai') return 'inbox';
    if (raw === 'setup') return 'profile';
    return 'profile';
  }, [searchParams]);

  const setActiveTab = (tab: SettingsTab) => {
    setSearchParams({ tab }, { replace: true });
  };

  const isOwnerOrAdmin = orgRole === 'OWNER' || orgRole === 'ADMIN';

  // WhatsApp State
  const [numbers, setNumbers] = useState<WhatsappNumber[]>([]);
  const [connecting, setConnecting] = useState(false);
  const [disconnectTarget, setDisconnectTarget] = useState<{ id: string; phone: string } | null>(null);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const [webhookStatus, setWebhookStatus] = useState<WebhookStatus | null>(null);
  const [webhookHealth, setWebhookHealth] = useState<WebhookHealth | null>(null);
  const [refreshingWebhook, setRefreshingWebhook] = useState(false);

  // Business Hours & Campaign Settings
  const [businessHours, setBusinessHours] = useState<BusinessHoursSettings>(DEFAULT_BUSINESS_HOURS);
  const [savingHours, setSavingHours] = useState(false);
  const [campaignSettings, setCampaignSettings] = useState<CampaignSettings>(DEFAULT_CAMPAIGN_SETTINGS);
  const [savingCampaigns, setSavingCampaigns] = useState(false);

  // Initial Data Fetch
  const loadData = () => {
    setLoading(true);
    Promise.allSettled([
      settingsApi.get(),
      whatsappApi.numbers(),
      whatsappApi.webhookStatus(),
      whatsappApi.webhookHealth().catch(() => null),
    ])
      .then(([settingsRes, numbersRes, webhookRes, healthRes]) => {
        if (settingsRes.status === 'fulfilled') {
          const s = settingsRes.value.data.data;
          if (s.businessHours) setBusinessHours(s.businessHours);
          if (s.campaigns) setCampaignSettings(s.campaigns);
        }
        if (numbersRes.status === 'fulfilled') {
          setNumbers(numbersRes.value.data.data.numbers || []);
        }
        if (webhookRes.status === 'fulfilled') {
          setWebhookStatus(webhookRes.value.data.data);
        }
        if (healthRes.status === 'fulfilled' && healthRes.value?.data?.data) {
          setWebhookHealth(healthRes.value.data.data);
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, [organization?.id]);

  // Handle WhatsApp Connect
  const handleConnect = async () => {
    if (!isOwnerOrAdmin) return;
    setConnecting(true);
    try {
      const redirectUri = `${window.location.origin}/settings/whatsapp/callback`;
      const { data } = await whatsappApi.connectUrl(redirectUri);
      const url = data.data.url;
      const { mode, popup } = startWhatsAppOAuth(url, { returnPath: '/settings?tab=whatsapp' });
      if (mode === 'popup' && popup) {
        const unsubscribe = subscribeWaOAuthResult(() => {
          setConnecting(false);
          loadData();
        });
        const timer = setInterval(() => {
          if (popup.closed) {
            clearInterval(timer);
            unsubscribe();
            setConnecting(false);
            loadData();
          }
        }, 1000);
      }
    } catch {
      toastError('Could not start WhatsApp connection');
      setConnecting(false);
    }
  };

  // Handle WhatsApp Disconnect
  const confirmDisconnect = async () => {
    if (!disconnectTarget) return;
    setDisconnectingId(disconnectTarget.id);
    try {
      await whatsappApi.disconnect(disconnectTarget.id);
      toastSuccess('WhatsApp number disconnected');
      setDisconnectTarget(null);
      loadData();
    } catch {
      toastError('Failed to disconnect number');
    } finally {
      setDisconnectingId(null);
    }
  };

  // Handle Webhook Diagnostic Refresh
  const handleRefreshWebhook = async () => {
    setRefreshingWebhook(true);
    try {
      await whatsappApi.setupWebhook();
      const [statusRes, healthRes] = await Promise.all([
        whatsappApi.webhookStatus(),
        whatsappApi.webhookHealth().catch(() => null),
      ]);
      setWebhookStatus(statusRes.data.data);
      if (healthRes?.data?.data) setWebhookHealth(healthRes.data.data);
      toastSuccess('Live connection sync refreshed successfully');
    } catch {
      toastError('Failed to refresh connection sync');
    } finally {
      setRefreshingWebhook(false);
    }
  };

  // Handle Business Hours Save
  const handleSaveBusinessHours = async (hours: {
    startHour: number;
    endHour: number;
    days: number[];
  }) => {
    setSavingHours(true);
    try {
      await settingsApi.updateBusinessHours(hours);
      setBusinessHours((prev: BusinessHoursSettings) => ({ ...prev, ...hours }));
      toastSuccess('Operating hours updated successfully');
    } catch {
      toastError('Failed to update operating hours');
    } finally {
      setSavingHours(false);
    }
  };

  // Handle Campaign Throttling Save
  const handleSaveCampaignSettings = async (settings: CampaignSettings) => {
    setSavingCampaigns(true);
    try {
      await settingsApi.updateCampaigns(settings);
      setCampaignSettings(settings);
      toastSuccess('Velocity limits updated successfully');
    } catch {
      toastError('Failed to update velocity limits');
    } finally {
      setSavingCampaigns(false);
    }
  };

  // Tab definitions for SegmentedControl
  const tabOptions = [
    {
      value: 'profile',
      label: 'Business Profile',
      icon: Building2,
    },
    {
      value: 'whatsapp',
      label: 'WhatsApp Channels',
      icon: Smartphone,
    },
    {
      value: 'inbox',
      label: 'Hours & Inbox',
      icon: Clock,
    },
    {
      value: 'integrations',
      label: 'Developer APIs',
      icon: Plug,
    },
    {
      value: 'appearance',
      label: 'Appearance',
      icon: Palette,
    },
    {
      value: 'security',
      label: 'Security & 2FA',
      icon: Shield,
    },
    ...(isOwnerOrAdmin
      ? [
          {
            value: 'admin',
            label: 'Admin Toggles',
            icon: SlidersHorizontal,
          },
        ]
      : []),
  ];

  return (
    <PageShell>
      {/* Sleek, lightweight Header */}
      <div className="mb-5">
        <h1 className="text-xl font-bold tracking-tight text-theme-fg sm:text-2xl">
          Settings & Workspace Configuration
        </h1>
        <p className="mt-1 text-[13px] font-medium text-theme-secondary">
          Manage your official business profile, WhatsApp channels, operating hours, and developer APIs.
        </p>
      </div>

      {/* Stationary Top Tab Navigation Bar */}
      <div className="mb-6 overflow-x-auto pb-1">
        <SegmentedControl
          embedded
          value={activeTab}
          onChange={(val) => setActiveTab(val as SettingsTab)}
          options={tabOptions}
          ariaLabel="Settings sections"
        />
      </div>

      {/* Active Panel Content */}
      <div className="max-w-5xl">
        {loading ? (
          <div className="space-y-4">
            <div className="h-24 animate-pulse rounded-2xl bg-theme-subtle/60" />
            <div className="h-72 animate-pulse rounded-2xl bg-theme-subtle/60" />
          </div>
        ) : (
          <>
            <TabTransition tabKey={activeTab}>
            {activeTab === 'profile' && (
              <BusinessProfilePanel canEdit={isOwnerOrAdmin} onSaved={loadData} />
            )}

            {activeTab === 'whatsapp' && (
              <WhatsAppChannelsPanel
                numbers={numbers}
                connecting={connecting}
                onConnect={handleConnect}
                onDisconnect={(id, phone) => setDisconnectTarget({ id, phone })}
                disconnectingId={disconnectingId}
                webhookStatus={webhookStatus}
                webhookHealth={webhookHealth}
                onRefreshWebhook={handleRefreshWebhook}
                refreshingWebhook={refreshingWebhook}
                campaignSettings={campaignSettings}
                onSaveCampaignSettings={handleSaveCampaignSettings}
                savingCampaigns={savingCampaigns}
                canEdit={isOwnerOrAdmin}
              />
            )}

            {activeTab === 'inbox' && (
              <HoursAndInboxPanel
                businessHours={businessHours}
                onSaveBusinessHours={handleSaveBusinessHours}
                savingHours={savingHours}
                canEdit={isOwnerOrAdmin}
              />
            )}

            {activeTab === 'integrations' && <IntegrationsPanel />}

            {activeTab === 'appearance' && <AppearanceSettingsPanel />}

            {activeTab === 'security' && <SecuritySettingsPanel />}

            {activeTab === 'admin' && isOwnerOrAdmin && <AdminUiTogglesPanel />}
            </TabTransition>
          </>
        )}
      </div>

      {/* Disconnect Safety Confirmation Modal */}
      <ConfirmDialog
        open={Boolean(disconnectTarget)}
        onClose={() => setDisconnectTarget(null)}
        onConfirm={confirmDisconnect}
        title="Disconnect WhatsApp number?"
        description="You're about to disconnect this phone line from your workspace."
        highlight={disconnectTarget ? formatPhoneDisplay(disconnectTarget.phone) : undefined}
        details={[
          'Incoming messages on this number will stop until reconnected',
          'All existing chats, contacts, and customer history remain saved',
        ]}
        confirmLabel="Disconnect number"
        cancelLabel="Keep connected"
        variant="danger"
        icon={PhoneOff}
        loading={Boolean(disconnectingId)}
      />
    </PageShell>
  );
}
