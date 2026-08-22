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
  Settings2,
} from 'lucide-react';
import PageShell from '../components/ui/PageShell';
import { TabTransition } from '../components/ui/TabTransition';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { useAuth } from '../contexts/AuthContext';
import { settingsApi, whatsappApi } from '../services/api';
import type {
  WhatsappNumber,
  BusinessHoursSettings,
  WebhookStatus,
} from '../types';
import { toastError, toastSuccess } from '../utils/toast';
import { formatPhoneDisplay } from '../utils/phone';
import { startWhatsAppOAuth, subscribeWaOAuthResult } from '../utils/whatsappOAuth';

// Subcomponents
import SettingsHero from '../components/settings/SettingsHero';
import SettingsSidebar, { type SettingsNavItem } from '../components/settings/SettingsSidebar';
import SettingsSkeleton from '../components/settings/SettingsSkeleton';
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

const DEFAULT_BUSINESS_HOURS: BusinessHoursSettings = {
  startHour: 9,
  endHour: 18,
  days: [1, 2, 3, 4, 5],
  timezone: 'Asia/Kolkata',
};

const TAB_DEFS: Array<SettingsNavItem & { id: SettingsTab }> = [
  { id: 'profile', label: 'Business profile', icon: Building2, group: 'Workspace' },
  { id: 'appearance', label: 'Appearance', icon: Palette, group: 'Workspace' },
  { id: 'whatsapp', label: 'WhatsApp', icon: Smartphone, group: 'Channels' },
  { id: 'inbox', label: 'Hours & replies', icon: Clock, group: 'Channels' },
  { id: 'security', label: 'Security & 2FA', icon: Shield, group: 'Advanced' },
  { id: 'integrations', label: 'APIs & webhooks', icon: Plug, group: 'Advanced' },
];

const ADMIN_TAB: SettingsNavItem & { id: SettingsTab } = {
  id: 'admin',
  label: 'Admin controls',
  icon: SlidersHorizontal,
  group: 'Advanced',
};

function resolveLegacyTab(raw: string | null): SettingsTab | null {
  switch (raw) {
    case 'general':
    case 'setup':
      return 'profile';
    case 'campaigns':
      return 'whatsapp';
    case 'automation':
    case 'ai':
      return 'inbox';
    default:
      return null;
  }
}

export default function SettingsPage() {
  const { orgRole, organization, twoFactorEnabled } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);

  const isOwnerOrAdmin = orgRole === 'OWNER' || orgRole === 'ADMIN';

  const hiddenTabs = useMemo(() => {
    if (isOwnerOrAdmin) return [] as string[];
    const settings = organization?.settings as Record<string, unknown> | undefined;
    const toggles = settings?.uiToggles as { hiddenSettingsTabs?: unknown } | undefined;
    return Array.isArray(toggles?.hiddenSettingsTabs) ? (toggles!.hiddenSettingsTabs as string[]) : [];
  }, [organization, isOwnerOrAdmin]);

  const tabs = useMemo<SettingsNavItem[]>(
    () => [...TAB_DEFS, ...(isOwnerOrAdmin ? [ADMIN_TAB] : [])].filter((t) => !hiddenTabs.includes(t.id)),
    [isOwnerOrAdmin, hiddenTabs]
  );

  // Active Tab
  const activeTab = useMemo<SettingsTab>(() => {
    const raw = searchParams.get('tab');
    const legacy = resolveLegacyTab(raw);
    const candidate = (
      legacy ||
      (['profile', 'whatsapp', 'inbox', 'integrations', 'appearance', 'security', 'admin'].includes(raw || '')
        ? (raw as SettingsTab)
        : null)
    ) as SettingsTab | null;
    if (candidate && tabs.some((t) => t.id === candidate)) return candidate;
    return (tabs[0]?.id ?? 'profile') as SettingsTab;
  }, [searchParams, tabs]);

  const setActiveTab = (tab: SettingsTab) => {
    setSearchParams({ tab }, { replace: true });
  };

  // WhatsApp State
  const [numbers, setNumbers] = useState<WhatsappNumber[]>([]);
  const [connecting, setConnecting] = useState(false);
  const [disconnectTarget, setDisconnectTarget] = useState<{ id: string; phone: string } | null>(null);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const [webhookStatus, setWebhookStatus] = useState<WebhookStatus | null>(null);

  // Business Hours
  const [businessHours, setBusinessHours] = useState<BusinessHoursSettings>(DEFAULT_BUSINESS_HOURS);
  const [savingHours, setSavingHours] = useState(false);

  // Initial Data Fetch
  const loadData = () => {
    setLoading(true);
    Promise.allSettled([
      settingsApi.get(),
      whatsappApi.numbers(),
      whatsappApi.webhookStatus(),
    ])
      .then(([settingsRes, numbersRes, webhookRes]) => {
        if (settingsRes.status === 'fulfilled') {
          const s = settingsRes.value.data.data;
          if (s.businessHours) setBusinessHours(s.businessHours);
        }
        if (numbersRes.status === 'fulfilled') {
          setNumbers(numbersRes.value.data.data.numbers || []);
        }
        if (webhookRes.status === 'fulfilled') {
          setWebhookStatus(webhookRes.value.data.data);
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
      toastSuccess('Operating hours saved');
    } catch {
      toastError('Could not save operating hours');
    } finally {
      setSavingHours(false);
    }
  };

  const syncActive = Boolean(webhookStatus?.subscribed);

  const heroStats = useMemo(
    () => [
      {
        label: 'WhatsApp numbers',
        value: loading ? '—' : numbers.length,
        tone: numbers.length > 0 ? ('connected' as const) : ('total' as const),
      },
      {
        label: 'Inbound sync',
        value: loading ? '—' : syncActive ? 'Active' : 'Off',
        tone: syncActive ? ('connected' as const) : ('hours' as const),
      },
      {
        label: 'Two-factor login',
        value: twoFactorEnabled ? 'On' : 'Off',
        tone: twoFactorEnabled ? ('secure' as const) : ('hours' as const),
      },
    ],
    [loading, numbers.length, syncActive, twoFactorEnabled]
  );

  return (
    <PageShell>
      <div className="min-w-0 space-y-4 sm:space-y-5">
        {loading ? (
          <SettingsSkeleton />
        ) : (
          <>
            <SettingsHero
              badge="Settings"
              badgeIcon={Settings2}
              title="Workspace settings"
              description="Business profile, WhatsApp numbers, hours, and account security."
              stats={heroStats}
            />

            <div className="flex flex-col gap-5 lg:flex-row lg:gap-8">
              <SettingsSidebar
                tabs={tabs}
                activeTab={activeTab}
                onTabChange={(id) => setActiveTab(id as SettingsTab)}
              />

              <div className="min-w-0 flex-1 lg:max-w-4xl">
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
              </div>
            </div>
          </>
        )}
      </div>

      {/* Disconnect confirmation */}
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
