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
  MessageCircle,
  BadgeCheck,
} from 'lucide-react';
import PageShell from '../components/ui/PageShell';
import { TabTransition } from '../components/ui/TabTransition';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { useAuth } from '../contexts/AuthContext';
import { useWhatsAppNumber } from '../contexts/WhatsAppNumberContext';
import { settingsApi, whatsappApi, billingApi, facebookApi, instagramApi } from '../services/api';
import type {
  BusinessHoursSettings,
  WebhookStatus,
} from '../types';
import { toastError, toastSuccess } from '../utils/toast';
import { formatPhoneDisplay } from '../utils/phone';
import { whatsappDisconnectDialogCopy } from '../utils/whatsappDisconnectCopy';
import { facebookLoginHttpsBlockedReason } from '../utils/facebookLoginHttps';
import { useWhatsAppConnectPicker } from '../hooks/useWhatsAppConnectPicker';

// Subcomponents
import SettingsHero from '../components/settings/SettingsHero';
import SettingsSidebar, { type SettingsNavItem } from '../components/settings/SettingsSidebar';
import SettingsSkeleton from '../components/settings/SettingsSkeleton';
import BusinessProfilePanel from '../components/settings/BusinessProfilePanel';
import WhatsAppChannelsPanel from '../components/settings/WhatsAppChannelsPanel';
import FacebookPagePanel, { type FacebookPageSummary } from '../components/settings/FacebookPagePanel';
import InstagramPagePanel, { type InstagramAccountSummary } from '../components/settings/InstagramPagePanel';
import MetaPreviewMockPanel from '../components/settings/MetaPreviewMockPanel';
import HoursAndInboxPanel from '../components/settings/HoursAndInboxPanel';
import IntegrationsPanel from '../components/settings/IntegrationsPanel';
import TeamSecurityPanel from '../components/team/TeamSecurityPanel';
import WhatsAppButtonBuilder from '../components/settings/WhatsAppButtonBuilder';
import OfficialCheckCard from '../components/settings/OfficialCheckCard';
import WhatsAppConnectModeModal from '../components/whatsapp/WhatsAppConnectModeModal';
import EntitlementNotice, { quotaUpgradeMessage } from '../components/billing/EntitlementNotice';
import { useEntitlements } from '../hooks/useEntitlements';
import { getErrorMessage } from '../utils/errors';

type SettingsTab =
  | 'profile'
  | 'channels'
  | 'green-tick'
  | 'website-button'
  | 'inbox'
  | 'integrations'
  | 'security';

const SETTINGS_TAB_IDS: SettingsTab[] = [
  'profile',
  'channels',
  'green-tick',
  'website-button',
  'inbox',
  'integrations',
  'security',
];

const DEFAULT_BUSINESS_HOURS: BusinessHoursSettings = {
  startHour: 9,
  endHour: 18,
  days: [1, 2, 3, 4, 5],
  timezone: 'Asia/Kolkata',
  awayMessageEnabled: false,
  awayMessage: 'Thanks for reaching out! We are currently closed. Our team will get back to you during business hours.',
};

const TAB_DEFS: Array<SettingsNavItem & { id: SettingsTab }> = [
  {
    id: 'profile',
    label: 'Business profile',
    hint: 'Name, industry & contacts',
    icon: Building2,
  },
  {
    id: 'channels',
    label: 'Channels',
    hint: 'WhatsApp, Facebook, Instagram',
    icon: Smartphone,
  },
  {
    id: 'green-tick',
    label: 'Official check',
    hint: 'Green tick prep with Meta',
    icon: BadgeCheck,
  },
  {
    id: 'website-button',
    label: 'Website WhatsApp button',
    hint: 'Embed on your site',
    icon: MessageCircle,
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
    case 'whatsapp':
    case 'facebook':
    case 'instagram':
      return 'channels';
    case 'official-check':
      return 'green-tick';
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
  const { entitlements, loading: entitlementsLoading } = useEntitlements();
  const { numbers, disconnectedNumbers, activeNumber, refreshNumbers, loading: numbersLoading, resolved: numbersResolved } = useWhatsAppNumber();
  const [searchParams, setSearchParams] = useSearchParams();
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [numberLimit, setNumberLimit] = useState<number | 'unlimited' | null>(null);
  const [planName, setPlanName] = useState<string | null>(null);

  const isOwnerOrAdmin = orgRole === 'OWNER' || orgRole === 'ADMIN';
  const canConnectWhatsApp =
    !isOwnerOrAdmin
      ? false
      : entitlementsLoading || !entitlements
        ? true
        : entitlements.canUseFeature('whatsapp') && entitlements.canAddToQuota('waNumbers');
  const whatsappGateMessage =
    !entitlementsLoading && entitlements && !entitlements.canUseFeature('whatsapp')
      ? 'WhatsApp connection is unavailable while your plan is locked.'
      : entitlements && !entitlements.canAddToQuota('waNumbers')
        ? quotaUpgradeMessage('waNumbers')
        : null;
  const canUseIntegrations =
    entitlementsLoading || !entitlements || entitlements.canUseFeature('integrations');
  const integrationsGateMessage =
    !entitlementsLoading && entitlements && !entitlements.canUseFeature('integrations')
      ? 'Developer integrations are not included on your current plan.'
      : null;

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
      (SETTINGS_TAB_IDS.includes((raw || '') as SettingsTab) ? (raw as SettingsTab) : null)
    ) as SettingsTab | null;
    if (candidate && tabs.some((t) => t.id === candidate)) return candidate;
    if (searchParams.get('resetPassword') === '1' && tabs.some((t) => t.id === 'security')) {
      return 'security';
    }
    return (tabs[0]?.id ?? 'profile') as SettingsTab;
  }, [searchParams, tabs]);

  const setActiveTab = (tab: SettingsTab) => {
    setSearchParams({ tab }, { replace: true });
  };

  // WhatsApp State
  const [disconnectTarget, setDisconnectTarget] = useState<{
    id: string;
    phone: string;
    isOnBizApp?: boolean;
    coexistenceStatus?: string | null;
  } | null>(null);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const [webhookStatus, setWebhookStatus] = useState<WebhookStatus | null>(null);

  // Facebook Page (Phase 1 Lead Ads)
  const [facebookPage, setFacebookPage] = useState<FacebookPageSummary | null>(null);
  const [facebookLoading, setFacebookLoading] = useState(false);
  const [facebookConnecting, setFacebookConnecting] = useState(false);
  const [facebookDisconnecting, setFacebookDisconnecting] = useState(false);

  const [instagramAccount, setInstagramAccount] = useState<InstagramAccountSummary | null>(null);
  const [instagramLoading, setInstagramLoading] = useState(false);
  const [instagramConnecting, setInstagramConnecting] = useState(false);
  const [instagramDisconnecting, setInstagramDisconnecting] = useState(false);

  const refreshFacebookPage = () => {
    setFacebookLoading(true);
    return facebookApi
      .page()
      .then((res) => {
        const page = res.data.data.page;
        setFacebookPage(
          page
            ? { channelId: page.channelId, pageId: page.pageId, name: page.name }
            : null
        );
      })
      .catch(() => {
        /* keep prior */
      })
      .finally(() => setFacebookLoading(false));
  };

  const connectFacebookPage = async () => {
    if (!isOwnerOrAdmin) return;
    const blocked = facebookLoginHttpsBlockedReason(
      window.location,
      typeof import.meta.env.VITE_CODESPACE_HTTPS_ORIGIN === 'string'
        ? import.meta.env.VITE_CODESPACE_HTTPS_ORIGIN
        : '',
      'Facebook Page',
    );
    if (blocked) {
      toastError(blocked);
      return;
    }
    setFacebookConnecting(true);
    try {
      sessionStorage.setItem('fb_connect_return', `${window.location.pathname}${window.location.search}`);
      const redirectUri = `${window.location.origin}/settings/facebook/callback`;
      const { data } = await facebookApi.connectUrl(redirectUri);
      const launch = data.data as { url?: string };
      if (!launch?.url) throw new Error('Connect URL missing');
      window.location.assign(launch.url);
    } catch (err) {
      toastError(getErrorMessage(err) || 'Could not start Facebook Page connect');
      setFacebookConnecting(false);
    }
  };

  const disconnectFacebookPage = async () => {
    if (!facebookPage || !isOwnerOrAdmin) return;
    setFacebookDisconnecting(true);
    try {
      await facebookApi.disconnect(facebookPage.channelId);
      setFacebookPage(null);
      toastSuccess('Facebook Page disconnected');
    } catch (err) {
      toastError(getErrorMessage(err) || 'Could not disconnect Page');
    } finally {
      setFacebookDisconnecting(false);
    }
  };

  const refreshInstagramAccount = () => {
    setInstagramLoading(true);
    return instagramApi
      .account()
      .then((res) => {
        const account = res.data.data.account;
        setInstagramAccount(
          account
            ? { channelId: account.channelId, igUserId: account.igUserId, username: account.username }
            : null
        );
      })
      .catch(() => {
        /* keep prior */
      })
      .finally(() => setInstagramLoading(false));
  };

  const connectInstagramAccount = async () => {
    if (!isOwnerOrAdmin) return;
    setInstagramConnecting(true);
    try {
      const { data } = await instagramApi.connect();
      const saved = data.data;
      setInstagramAccount({
        channelId: saved.channelId,
        igUserId: saved.igUserId,
        username: saved.username,
      });
      toastSuccess('Instagram connected');
    } catch (err) {
      toastError(getErrorMessage(err) || 'Could not connect Instagram');
    } finally {
      setInstagramConnecting(false);
    }
  };

  const disconnectInstagramAccount = async () => {
    if (!instagramAccount || !isOwnerOrAdmin) return;
    setInstagramDisconnecting(true);
    try {
      await instagramApi.disconnect();
      setInstagramAccount(null);
      toastSuccess('Instagram disconnected');
    } catch (err) {
      toastError(getErrorMessage(err) || 'Could not disconnect Instagram');
    } finally {
      setInstagramDisconnecting(false);
    }
  };

  // Business Hours
  const [businessHours, setBusinessHours] = useState<BusinessHoursSettings>(DEFAULT_BUSINESS_HOURS);
  const [savingHours, setSavingHours] = useState(false);

  // Initial Data Fetch
  const loadData = (options?: { silent?: boolean }) => {
    setLoadError(null);
    if (options?.silent) setRefreshing(true);
    else setInitialLoading(true);
    Promise.allSettled([
      settingsApi.get(),
      billingApi.get(),
      whatsappApi.webhookStatus(),
      refreshNumbers({ silent: true }),
      refreshFacebookPage(),
      refreshInstagramAccount(),
    ])
      .then(([settingsRes, billingRes, webhookRes, numbersRes]) => {
        if (
          [settingsRes, billingRes, webhookRes, numbersRes].some(
            (result) => result.status === 'rejected'
          )
        ) {
          setLoadError('Some workspace settings could not be loaded. Retry before saving changes.');
        }
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

  const {
    pickerOpen,
    openPicker,
    closePicker,
    connectStandard,
    connectCoexistence,
    connecting,
  } = useWhatsAppConnectPicker({
    returnPath: '/settings?tab=whatsapp',
    onConnected: () => {
      void refreshNumbers();
      loadData({ silent: true });
    },
  });

  const handleConnect = () => {
    if (!isOwnerOrAdmin || !canConnectWhatsApp) return;
    openPicker();
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
    awayMessageEnabled?: boolean;
    awayMessage?: string;
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

  const disconnectDialogCopy = useMemo(
    () => whatsappDisconnectDialogCopy(disconnectTarget),
    [disconnectTarget]
  );

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
  const entitlementNumberLimit =
    entitlements?.quotas.waNumbers.limit === 'custom'
      ? numberLimit
      : entitlements?.quotas.waNumbers.limit ?? numberLimit;
  const entitlementPlanName = entitlements?.planName || planName;

  return (
    <PageShell>
      <div className="min-w-0 space-y-4 sm:space-y-5">
        {initialLoading ? (
          <SettingsSkeleton />
        ) : (
          <>
            {loadError && (
              <div
                role="alert"
                className="flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900"
              >
                <span>{loadError}</span>
                <button
                  type="button"
                  className="font-semibold underline underline-offset-2"
                  onClick={() => loadData()}
                >
                  Retry
                </button>
              </div>
            )}
            <SettingsHero
              badge="Settings"
              badgeIcon={Settings2}
              title="Workspace settings"
              description="Business profile, connected channels, and business hours."
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

                  {activeTab === 'channels' && (
                    <div className="space-y-6">
                      {whatsappGateMessage && (
                        <EntitlementNotice
                          message={whatsappGateMessage}
                          upgradePlan={
                            entitlements?.isLocked
                              ? 'growth'
                              : entitlements?.getUpgradePlan('waNumbers')
                          }
                        />
                      )}
                      <WhatsAppChannelsPanel
                        numbers={numbers}
                        disconnectedNumbers={disconnectedNumbers}
                        activeNumberId={activeNumber?.id ?? null}
                        numberLimit={entitlementNumberLimit}
                        planName={entitlementPlanName}
                        loading={!numbersResolved || numbersLoading}
                        connecting={connecting}
                        onConnect={handleConnect}
                        onDisconnect={(number) =>
                          setDisconnectTarget({
                            id: number.id,
                            phone: number.phoneNumber,
                            isOnBizApp: number.isOnBizApp,
                            coexistenceStatus: number.coexistenceStatus,
                          })
                        }
                        disconnectingId={disconnectingId}
                        canEdit={isOwnerOrAdmin}
                        canConnect={canConnectWhatsApp}
                      />
                      <FacebookPagePanel
                        page={facebookPage}
                        loading={facebookLoading && !facebookPage}
                        connecting={facebookConnecting}
                        disconnecting={facebookDisconnecting}
                        onConnect={() => void connectFacebookPage()}
                        onDisconnect={() => void disconnectFacebookPage()}
                        canEdit={isOwnerOrAdmin}
                      />
                      <InstagramPagePanel
                        account={instagramAccount}
                        loading={instagramLoading && !instagramAccount}
                        connecting={instagramConnecting}
                        disconnecting={instagramDisconnecting}
                        onConnect={() => void connectInstagramAccount()}
                        onDisconnect={() => void disconnectInstagramAccount()}
                        canEdit={isOwnerOrAdmin}
                      />
                      <MetaPreviewMockPanel />
                    </div>
                  )}

                  {activeTab === 'green-tick' && <OfficialCheckCard />}

                  {activeTab === 'website-button' && <WhatsAppButtonBuilder />}

                  {activeTab === 'inbox' && (
                    <HoursAndInboxPanel
                      businessHours={businessHours}
                      onSaveBusinessHours={handleSaveBusinessHours}
                      savingHours={savingHours}
                      canEdit={isOwnerOrAdmin && !loadError}
                    />
                  )}

                  {activeTab === 'integrations' && isOwnerOrAdmin && (
                    <>
                      {integrationsGateMessage && (
                        <EntitlementNotice className="mb-4" message={integrationsGateMessage} upgradePlan="growth" />
                      )}
                      <IntegrationsPanel showDeveloperTools={canUseIntegrations} />
                    </>
                  )}

                  {activeTab === 'security' && <TeamSecurityPanel />}
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
        description={disconnectDialogCopy.description}
        highlight={disconnectTarget ? formatPhoneDisplay(disconnectTarget.phone) : undefined}
        details={disconnectDialogCopy.details}
        confirmLabel="Disconnect number"
        cancelLabel="Keep connected"
        variant="danger"
        icon={PhoneOff}
        loading={Boolean(disconnectingId)}
      />

      <WhatsAppConnectModeModal
        open={pickerOpen}
        onClose={closePicker}
        onConnectStandard={connectStandard}
        onConnectCoexistence={connectCoexistence}
        connecting={connecting}
      />
    </PageShell>
  );
}
