import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Building2,
  Smartphone,
  Clock,
  Shield,
  PhoneCall,
  Webhook,
  PhoneOff,
  Settings2,
  Download,
} from 'lucide-react';
import PageShell from '../components/ui/PageShell';
import { TabTransition } from '../components/ui/TabTransition';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { useAuth } from '../contexts/AuthContext';
import { useWhatsAppNumber } from '../contexts/WhatsAppNumberContext';
import { settingsApi, whatsappApi, billingApi } from '../services/api';
import type {
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
import SecuritySettingsPanel from '../components/settings/SecuritySettingsPanel';

type SettingsTab =
  | 'profile'
  | 'whatsapp'
  | 'inbox'
  | 'integrations'
  | 'security';

const DEFAULT_BUSINESS_HOURS: BusinessHoursSettings = {
  startHour: 9,
  endHour: 18,
  days: [1, 2, 3, 4, 5],
  timezone: 'Asia/Kolkata',
};

const TAB_DEFS: Array<SettingsNavItem & { id: SettingsTab }> = [
  {
    id: 'profile',
    label: 'Business profile',
    hint: 'Name, industry & contacts',
    icon: Building2,
  },
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    hint: 'Connect business numbers',
    icon: Smartphone,
  },
  {
    id: 'inbox',
    label: 'Business hours',
    hint: 'When team is open',
    icon: Clock,
  },
  {
    id: 'security',
    label: 'Security',
    hint: 'Password',
    icon: Shield,
  },
  {
    id: 'integrations',
    label: 'Data & export',
    hint: 'Contacts CSV & backup',
    icon: Download,
  },
];

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
    case 'appearance':
      return 'profile';
    default:
      return null;
  }
}

export default function SettingsPage() {
  const { orgRole, organization } = useAuth();
  const { numbers, activeNumber, refreshNumbers, loading: numbersLoading, resolved: numbersResolved } = useWhatsAppNumber();
  const [searchParams, setSearchParams] = useSearchParams();
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [numberLimit, setNumberLimit] = useState<number | 'unlimited' | null>(null);
  const [planName, setPlanName] = useState<string | null>(null);

  const isOwnerOrAdmin = orgRole === 'OWNER' || orgRole === 'ADMIN';

  const hiddenTabs = useMemo(() => {
    if (isOwnerOrAdmin) return [] as string[];
    const settings = organization?.settings as Record<string, unknown> | undefined;
    const toggles = settings?.uiToggles as { hiddenSettingsTabs?: unknown } | undefined;
    return Array.isArray(toggles?.hiddenSettingsTabs) ? (toggles!.hiddenSettingsTabs as string[]) : [];
  }, [organization, isOwnerOrAdmin]);

  const tabs = useMemo<SettingsNavItem[]>(
    () =>
      TAB_DEFS.filter(
        (t) => !hiddenTabs.includes(t.id) && (t.id !== 'integrations' || isOwnerOrAdmin)
      ),
    [hiddenTabs, isOwnerOrAdmin]
  );

  // Active Tab
  const activeTab = useMemo<SettingsTab>(() => {
    const raw = searchParams.get('tab');
    const legacy = resolveLegacyTab(raw);
    const candidate = (
      legacy ||
      (['profile', 'whatsapp', 'inbox', 'integrations', 'security'].includes(raw || '')
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
  const [connecting, setConnecting] = useState(false);
  const [disconnectTarget, setDisconnectTarget] = useState<{ id: string; phone: string } | null>(null);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const [webhookStatus, setWebhookStatus] = useState<WebhookStatus | null>(null);

  // Business Hours
  const [businessHours, setBusinessHours] = useState<BusinessHoursSettings>(DEFAULT_BUSINESS_HOURS);
  const [savingHours, setSavingHours] = useState(false);

  // Initial Data Fetch
  const loadData = (options?: { silent?: boolean }) => {
    if (options?.silent) setRefreshing(true);
    else setInitialLoading(true);
    Promise.allSettled([
      settingsApi.get(),
      billingApi.get(),
      whatsappApi.webhookStatus(),
      refreshNumbers({ silent: true }),
    ])
      .then(([settingsRes, billingRes, webhookRes]) => {
        if (settingsRes.status === 'fulfilled') {
          const s = settingsRes.value.data.data;
          if (s.businessHours) setBusinessHours(s.businessHours);
        }
        if (billingRes.status === 'fulfilled') {
          const plan = billingRes.value.data.data.currentPlan;
          setNumberLimit(plan?.waNumbers ?? null);
          setPlanName(plan?.name ?? null);
        }
        if (webhookRes.status === 'fulfilled') {
          setWebhookStatus(webhookRes.value.data.data);
        }
      })
      .finally(() => {
        setInitialLoading(false);
        setRefreshing(false);
      });
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
          void refreshNumbers();
          loadData({ silent: true });
        });
        const timer = setInterval(() => {
          if (popup.closed) {
            clearInterval(timer);
            unsubscribe();
            setConnecting(false);
            void refreshNumbers();
            loadData({ silent: true });
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
      await refreshNumbers();
      loadData({ silent: true });
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
    timezone?: string;
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
        value: initialLoading || refreshing ? '—' : numbers.length,
        tone: numbers.length > 0 ? ('connected' as const) : ('total' as const),
        icon: PhoneCall,
      },
      {
        label: 'Inbound sync',
        value: initialLoading || refreshing ? '—' : syncActive ? 'Active' : 'Off',
        tone: syncActive ? ('connected' as const) : ('hours' as const),
        icon: Webhook,
      },
    ],
    [initialLoading, refreshing, numbers.length, syncActive]
  );

  return (
    <PageShell>
      <div className="min-w-0 space-y-4 sm:space-y-5">
        {initialLoading ? (
          <SettingsSkeleton />
        ) : (
          <>
            <SettingsHero
              badge="Settings"
              badgeIcon={Settings2}
              title="Workspace settings"
              description="Business profile, WhatsApp numbers, and business hours."
              stats={heroStats}
              loading={refreshing}
            />

            <div className="flex flex-col gap-5 lg:flex-row lg:gap-8">
              <SettingsSidebar
                tabs={tabs}
                activeTab={activeTab}
                onTabChange={(id) => setActiveTab(id as SettingsTab)}
              />

              <div className="min-w-0 flex-1">
                <TabTransition tabKey={activeTab}>
                  {activeTab === 'profile' && (
                    <BusinessProfilePanel
                      canEdit={isOwnerOrAdmin}
                      onSaved={() => loadData({ silent: true })}
                    />
                  )}

                  {activeTab === 'whatsapp' && (
                    <WhatsAppChannelsPanel
                      numbers={numbers}
                      activeNumberId={activeNumber?.id ?? null}
                      numberLimit={numberLimit}
                      planName={planName}
                      loading={!numbersResolved || numbersLoading}
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

                  {activeTab === 'integrations' && isOwnerOrAdmin && (
                    <IntegrationsPanel showDeveloperTools />
                  )}

                  {activeTab === 'security' && <SecuritySettingsPanel />}
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
