import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  Bot,
  CheckCircle,
  CheckCircle2,
  Clock,
  Link2,
  LogOut,
  MessageSquare,
  Plug,
  Palette,
  PhoneOff,
  Send,
  Settings2,
  ShieldCheck,
  Smartphone,
  Store,
  Webhook,
} from 'lucide-react';
import SettingsInsightCards from '../components/settings/SettingsInsightCards';
import SettingsPanel from '../components/settings/SettingsPanel';
import CannedRepliesPanel from '../components/settings/CannedRepliesPanel';
import IntegrationsPanel from '../components/settings/IntegrationsPanel';
import SettingsReadinessBanner from '../components/settings/SettingsReadinessBanner';
import SettingsSidebar from '../components/settings/SettingsSidebar';
import SettingsStat from '../components/settings/SettingsStat';
import SettingsStatusPill from '../components/settings/SettingsStatusPill';
import AppAlert from '../components/ui/AppAlert';
import AppButton from '../components/ui/AppButton';
import AppInput from '../components/ui/AppInput';
import { SettingsLayoutSkeleton } from '../components/ui/ListLayoutSkeleton';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import PageHeader from '../components/ui/PageHeader';
import PageHero from '../components/ui/PageHero';
import PageShell from '../components/ui/PageShell';
// import ThemeToggle from '../components/ui/ThemeToggle';
import AppearanceSettingsPanel from '../components/settings/AppearanceSettingsPanel';
import BusinessProfilePanel from '../components/settings/BusinessProfilePanel';
import TeamSecurityPanel from '../components/team/TeamSecurityPanel';
import { skipOnboardingSetup } from '../components/OnboardingGate';
import { useAuth } from '../contexts/AuthContext';
// import { useTheme } from '../contexts/ThemeContext';
import { useWhatsAppNumber } from '../contexts/WhatsAppNumberContext';
import { aiBotApi, onboardingApi, settingsApi, teamApi, whatsappApi } from '../services/api';
import type { AiUsageSummary, BusinessHours, OrgAiSettings } from '../types';
import type { ReadinessCheck } from '../components/settings/SettingsReadinessBanner';
import { toastError, toastSuccess } from '../utils/toast';
import { formatPhoneDisplay } from '../utils/formatPhone';
import { handleWaOAuthPopupClosed, startWhatsAppOAuth } from '../utils/whatsappOAuth';
import { useWaOAuthPopupListener } from '../hooks/useWaOAuthPopupListener';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type SettingsTab = 'general' | 'profile' | 'whatsapp' | 'automation' | 'ai' | 'campaigns' | 'inbox' | 'integrations' | 'setup';

interface WhatsappNumber {
  id: string;
  phoneNumber: string;
  isActive: boolean;
  createdAt: string;
}

function usageSurfaceRequests(usage: AiUsageSummary, action: string): number {
  const surface = usage.surfaces?.find(
    (row) => row.action === action || (action === 'chat' && row.action === 'chat_bot')
  );
  if (surface) return surface.requests;
  const raw = usage.byAction?.[action] ?? usage.byAction?.[action === 'chat' ? 'chat_bot' : action];
  if (typeof raw === 'number') return raw;
  if (raw && typeof raw === 'object' && 'requests' in raw) return raw.requests;
  return 0;
}

function formatHour(hour: number) {
  const normalized = hour === 24 ? 0 : hour;
  const period = normalized >= 12 ? 'PM' : 'AM';
  const display = normalized % 12 === 0 ? 12 : normalized % 12;
  return `${display}:00 ${period}`;
}

export default function SettingsPage() {
  const { refreshNumbers } = useWhatsAppNumber();
  const { canManageTeam } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab') as SettingsTab | null;
  const [activeTab, setActiveTabState] = useState<SettingsTab>(tabFromUrl || 'general');

  const setActiveTab = (tab: SettingsTab) => {
    setActiveTabState(tab);
    setSearchParams(tab === 'general' ? {} : { tab });
  };

  useEffect(() => {
    if (tabFromUrl && tabFromUrl !== activeTab) {
      setActiveTabState(tabFromUrl);
    }
  }, [tabFromUrl]);
  const [numbers, setNumbers] = useState<WhatsappNumber[]>([]);
  const [connectUrl, setConnectUrl] = useState('');
  const [webhookStatus, setWebhookStatus] = useState<import('../types').WebhookStatus | null>(null);
  const [webhookHealth, setWebhookHealth] = useState<import('../types').WebhookHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const [settingUpWebhook, setSettingUpWebhook] = useState(false);
  const [businessHours, setBusinessHours] = useState<BusinessHours>({
    startHour: 9,
    endHour: 18,
    days: [1, 2, 3, 4, 5],
  });
  const [savingHours, setSavingHours] = useState(false);
  const [aiSettings, setAiSettings] = useState<OrgAiSettings>({ useCustomConfig: false });
  const [aiApiKey, setAiApiKey] = useState('');
  const [aiUsage, setAiUsage] = useState<AiUsageSummary | null>(null);
  const [savingAi, setSavingAi] = useState(false);
  const [campaignSettings, setCampaignSettings] = useState({
    dailySendLimit: 5000,
    dailyBudgetInr: 5000,
    batchSize: 50,
    batchDelayMs: 1000,
    mapFirstBodyVariableToName: true,
  });
  const [savingCampaigns, setSavingCampaigns] = useState(false);
  const [setupMeta, setSetupMeta] = useState({
    hasBusinessHours: false,
    hasAiBot: false,
    teamCount: 1,
  });
  const [disconnectTarget, setDisconnectTarget] = useState<{ id: string; phone: string } | null>(null);
  const [readinessChecks, setReadinessChecks] = useState<ReadinessCheck[]>([]);
  const [readinessMeta, setReadinessMeta] = useState({ completedCount: 0, totalChecks: 6, progress: 0, isReady: false });

  const loadConnectUrl = async () => {
    try {
      const redirectUri = `${window.location.origin}/settings/whatsapp/callback`;
      const { data } = await whatsappApi.connectUrl(redirectUri);
      setConnectUrl(data.data.url);
    } catch {
      setConnectUrl('');
    }
  };

  const load = () => {
    Promise.all([
      whatsappApi.numbers(),
      whatsappApi.webhookStatus(),
      whatsappApi.webhookHealth().catch(() => null),
      settingsApi.get(),
      settingsApi.aiUsage(),
      aiBotApi.list(),
      teamApi.list(),
      onboardingApi.readiness(),
    ])
      .then(async ([numbersRes, webhookRes, healthRes, settingsRes, usageRes, botsRes, teamRes, readinessRes]) => {
        setNumbers(numbersRes.data.data);
        await loadConnectUrl();
        setWebhookStatus(webhookRes.data.data);
        setWebhookHealth(healthRes ? healthRes.data.data : null);
        const hours = settingsRes.data.data.businessHours;
        if (hours) {
          setBusinessHours(hours);
        }
        setSetupMeta({
          hasBusinessHours: Boolean(hours?.days?.length),
          hasAiBot: (botsRes.data.data.bots?.length ?? 0) > 0,
          teamCount: teamRes.data.data.members?.length ?? 1,
        });
        if (settingsRes.data.data.ai) {
          setAiSettings(settingsRes.data.data.ai);
        }
        if (settingsRes.data.data.campaigns) {
          setCampaignSettings((prev) => ({ ...prev, ...settingsRes.data.data.campaigns }));
        }
        setAiUsage(usageRes.data.data);
        const readiness = readinessRes.data.data as {
          checks: ReadinessCheck[];
          completedCount: number;
          totalChecks: number;
          progress: number;
          isReady: boolean;
        };
        setReadinessChecks(readiness.checks || []);
        setReadinessMeta({
          completedCount: readiness.completedCount,
          totalChecks: readiness.totalChecks,
          progress: readiness.progress,
          isReady: readiness.isReady,
        });
      })
      .catch((err: unknown) => {
        const msg =
          (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
            ?.error?.message || 'Failed to load settings.';
        toastError(msg);
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const isReady = readinessMeta.isReady || (numbers.length > 0 && Boolean(webhookStatus?.subscribed));
  const fallbackProgress = useMemo(() => {
    const steps = [
      numbers.length > 0,
      Boolean(webhookStatus?.subscribed),
      setupMeta.hasBusinessHours,
      setupMeta.hasAiBot,
      setupMeta.teamCount > 1,
    ];
    return Math.round((steps.filter(Boolean).length / steps.length) * 100);
  }, [numbers, webhookStatus, setupMeta]);
  const setupProgress = readinessMeta.progress || fallbackProgress;

  const tabs = useMemo(
    () => [
      {
        id: 'profile' as const,
        label: 'Business profile',
        description: 'Name, industry & AI context',
        icon: Store,
        group: 'AI & Brand',
      },
      {
        id: 'general' as const,
        label: 'Appearance',
        description: 'Theme & display',
        icon: Palette,
        group: 'AI & Brand',
      },
      {
        id: 'whatsapp' as const,
        label: 'WhatsApp',
        description: 'Number & messages',
        icon: Smartphone,
        badge: !isReady ? 'Setup' : undefined,
        group: 'Connect',
      },
      {
        id: 'integrations' as const,
        label: 'Integrations',
        description: 'Connect other apps & download your data',
        icon: Plug,
        group: 'Connect',
      },
      {
        id: 'automation' as const,
        label: 'Business hours',
        description: 'When your team is available',
        icon: Clock,
        group: 'Workspace',
      },
      {
        id: 'campaigns' as const,
        label: 'Campaigns',
        description: 'Send limits & speed',
        icon: Send,
        group: 'Workspace',
      },
      {
        id: 'inbox' as const,
        label: 'Inbox tools',
        description: 'Canned replies & labels',
        icon: MessageSquare,
        group: 'Workspace',
      },
      {
        id: 'ai' as const,
        label: 'AI',
        description: 'Smart reply settings',
        icon: Bot,
        group: 'AI & Brand',
      },
      {
        id: 'setup' as const,
        label: 'Getting started',
        description: 'Step-by-step setup',
        icon: ShieldCheck,
        group: 'Account',
      },
    ],
    [isReady],
  );

  const beginWhatsAppOAuth = (url: string) => {
    setConnecting(true);
    const { mode, popup } = startWhatsAppOAuth(url, { returnPath: '/settings?tab=whatsapp' });
    if (mode === 'redirect') return;

    const popupClosedPoll = window.setInterval(() => {
      if (popup && popup.closed) {
        window.clearInterval(popupClosedPoll);
        handleWaOAuthPopupClosed(
          (event) => {
            setConnecting(false);
            if (event.status === 'success') {
              console.info('[wa-oauth] Popup reported success', event.phoneNumber);
              toastSuccess(event.message || 'WhatsApp connected');
              load();
              void refreshNumbers();
              return;
            }
            if (event.status === 'cancel') {
              console.info('[wa-oauth] Popup cancelled');
              toastSuccess(event.message || 'Connection cancelled — you are still signed in.');
              return;
            }
            console.error('[wa-oauth] Popup reported error', event.message);
            toastError(event.message || 'WhatsApp connection failed');
          },
          {
            onClosedWithoutResult: () => {
              setConnecting(false);
              void refreshNumbers();
            },
          }
        );
      }
    }, 500);
  };

  const handleConnect = () => {
    if (!connectUrl) {
      void (async () => {
        try {
          const redirectUri = `${window.location.origin}/settings/whatsapp/callback`;
          const { data } = await whatsappApi.connectUrl(redirectUri);
          const url = data.data.url;
          if (!url) {
            toastError('Could not start WhatsApp connection. Please try again.');
            return;
          }
          setConnectUrl(url);
          beginWhatsAppOAuth(url);
        } catch {
          toastError('Could not start WhatsApp connection. Please try again.');
        }
      })();
      return;
    }
    beginWhatsAppOAuth(connectUrl);
  };

  useWaOAuthPopupListener((event) => {
    setConnecting(false);
    if (event.status === 'success') {
      console.info('[wa-oauth] Popup reported success', event.phoneNumber);
      toastSuccess(event.message || 'WhatsApp connected');
      load();
      void refreshNumbers();
      return;
    }
    if (event.status === 'cancel') {
      console.info('[wa-oauth] Popup cancelled');
      toastSuccess(event.message || 'Connection cancelled — you are still signed in.');
      return;
    }
    console.error('[wa-oauth] Popup reported error', event.message);
    toastError(event.message || 'WhatsApp connection failed');
  });

  const handleDisconnect = async (id: string, phone: string) => {
    setDisconnectTarget({ id, phone });
  };

  const confirmDisconnect = async () => {
    if (!disconnectTarget) return;
    const { id } = disconnectTarget;
    setDisconnectingId(id);
    try {
      await whatsappApi.disconnect(id);
      load();
      await refreshNumbers();
      toastSuccess('WhatsApp disconnected');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
          ?.error?.message || 'Failed to disconnect WhatsApp.';
      toastError(msg);
    } finally {
      setDisconnectingId(null);
      setDisconnectTarget(null);
    }
  };

  const toggleDay = (day: number) => {
    setBusinessHours((prev) => ({
      ...prev,
      days: prev.days.includes(day)
        ? prev.days.filter((d) => d !== day)
        : [...prev.days, day].sort(),
    }));
  };

  const handleSaveBusinessHours = async () => {
    setSavingHours(true);
    try {
      await settingsApi.updateBusinessHours(businessHours);
      toastSuccess('Business hours saved');
    } catch {
      toastError('Failed to save business hours');
    } finally {
      setSavingHours(false);
    }
  };

  const handleSaveCampaigns = async () => {
    setSavingCampaigns(true);
    try {
      await settingsApi.updateCampaigns(campaignSettings);
      toastSuccess('Campaign settings saved');
    } catch {
      toastError('Failed to save campaign settings');
    } finally {
      setSavingCampaigns(false);
    }
  };

  const handleSaveAi = async () => {
    setSavingAi(true);
    try {
      const payload: Record<string, unknown> = {
        brainProvider: aiSettings.brainProvider ?? 'sarvam',
        useCustomConfig: aiSettings.useCustomConfig,
        endpoint: aiSettings.endpoint || '',
        deployment: aiSettings.deployment,
        embeddingDeployment: aiSettings.embeddingDeployment,
        apiVersion: aiSettings.apiVersion,
        monthlyTokenLimit: aiSettings.monthlyTokenLimit,
      };
      if (aiApiKey.trim()) payload.apiKey = aiApiKey.trim();
      const { data } = await settingsApi.updateAi(payload);
      setAiSettings(data.data.ai);
      setAiApiKey('');
      toastSuccess('AI settings saved');
      const usageRes = await settingsApi.aiUsage();
      setAiUsage(usageRes.data.data);
    } catch {
      toastError('Failed to save AI settings');
    } finally {
      setSavingAi(false);
    }
  };

  const handleSetupWebhook = async () => {
    setSettingUpWebhook(true);
    try {
      const { data } = await whatsappApi.setupWebhook();
      const url = data.data.callbackUrl;
      toastSuccess(
        url
          ? 'Incoming messages are now enabled.'
          : 'WhatsApp is linked. You can send campaigns now.',
      );
      load();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
          ?.error?.message || 'Could not enable incoming messages';
      toastError(msg);
    } finally {
      setSettingUpWebhook(false);
    }
  };

  const setupSteps = [
    { text: 'Connect your WhatsApp business number', done: numbers.length > 0 },
    { text: 'Turn on incoming messages', done: Boolean(webhookStatus?.subscribed) },
    { text: 'Set your business hours', done: setupMeta.hasBusinessHours },
    { text: 'Create an AI bot for auto-replies', done: setupMeta.hasAiBot },
    { text: 'Invite your team members', done: setupMeta.teamCount > 1 },
  ];

  if (loading) {
    return (
      <PageShell>
        <PageHeader />
        <SettingsLayoutSkeleton />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        actions={
          !isReady ? (
            <AppButton size="sm" onClick={handleConnect} loading={connecting} disabled={connecting}>
              Connect WhatsApp
            </AppButton>
          ) : (
            <AppButton
              size="sm"
              variant="secondary"
              onClick={() => setActiveTab('whatsapp')}
            >
              Manage connection
            </AppButton>
          )
        }
      />

      <div className="space-y-5 animate-fade-up-delay sm:space-y-6">
        <PageHero
          badge="Settings"
          badgeIcon={Settings2}
          title="Settings"
          description="Connect WhatsApp, set business hours, AI replies, and campaign limits."
          accent="emerald"
          stats={[
            { label: 'Numbers', value: numbers.length, tone: 'text-whatsapp-700 dark:text-whatsapp-400' },
            {
              label: 'Messages',
              value: webhookStatus?.subscribed ? 'On' : 'Off',
              tone: webhookStatus?.subscribed
                ? 'text-whatsapp-700 dark:text-whatsapp-400'
                : 'text-amber-700 dark:text-amber-400',
            },
            {
              label: 'Setup',
              value: `${setupProgress}%`,
              tone: isReady ? 'text-whatsapp-700 dark:text-whatsapp-400' : 'text-theme-secondary',
            },
            {
              label: 'Ready',
              value: isReady ? 'Yes' : 'No',
              tone: isReady ? 'text-whatsapp-700 dark:text-whatsapp-400' : 'text-theme-muted',
            },
          ]}
        />

        <SettingsReadinessBanner
          isReady={isReady}
          setupProgress={setupProgress}
          completedCount={readinessMeta.completedCount}
          totalChecks={readinessMeta.totalChecks}
          checks={readinessChecks}
          onGoToSetup={() => setActiveTab('setup')}
          onConnect={!isReady ? handleConnect : undefined}
          connecting={connecting}
        />

        <SettingsInsightCards />

        <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-6">
          <SettingsSidebar
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={(id) => setActiveTab(id as SettingsTab)}
            isReady={isReady}
          />

          <div className="min-w-0 space-y-5">
            {activeTab === 'profile' && (
              <BusinessProfilePanel canEdit={canManageTeam} onSaved={load} />
            )}

            {activeTab === 'general' && (
              <div className="space-y-5">
                {searchParams.get('resetPassword') === '1' && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] font-semibold text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                    Your account needs a new password. Set one below — other devices will be signed
                    out after the change.
                  </div>
                )}
                <AppearanceSettingsPanel />
                <TeamSecurityPanel />
              </div>
            )}

            {activeTab === 'whatsapp' && (
              <div className="space-y-5">
                <div className="grid gap-3 sm:grid-cols-2">
                  <SettingsStatusPill
                    label="WhatsApp number"
                    active={numbers.length > 0}
                    icon={Smartphone}
                    activeLabel={`${numbers.length} connected`}
                    inactiveLabel="Not connected"
                  />
                  <SettingsStatusPill
                    label="Incoming messages"
                    active={Boolean(webhookStatus?.subscribed)}
                    icon={Webhook}
                    activeLabel="Working"
                    inactiveLabel="Not set up"
                  />
                </div>

                <SettingsPanel
                  title="WhatsApp connection"
                  description="Connect your business number to send and receive messages."
                  icon={Smartphone}
                  accent="emerald"
                >
                  {numbers.length > 0 ? (
                    <div className="space-y-3">
                      {numbers.map((number) => (
                        <div
                          key={number.id}
                          className="flex flex-col gap-3 rounded-2xl border border-emerald-200/80 bg-gradient-to-r from-emerald-50/90 to-theme-surface p-4 ring-1 ring-emerald-100 dark:border-emerald-800/40 dark:from-emerald-950/30 dark:ring-emerald-900/40 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-theme-surface text-whatsapp-600 shadow-sm ring-1 ring-emerald-100 dark:ring-emerald-800/50">
                              <CheckCircle size={20} strokeWidth={2.25} />
                            </div>
                            <div>
                              <p className="font-extrabold text-theme-fg">+{number.phoneNumber}</p>
                              <p className="text-[12px] font-semibold text-whatsapp-700 dark:text-whatsapp-400">
                                Connected · Active
                              </p>
                            </div>
                          </div>
                          <AppButton
                            variant="danger"
                            size="sm"
                            icon={<LogOut className="h-4 w-4" />}
                            onClick={() => handleDisconnect(number.id, number.phoneNumber)}
                            loading={disconnectingId === number.id}
                            disabled={disconnectingId !== null}
                          >
                            Disconnect
                          </AppButton>
                        </div>
                      ))}
                      <AppButton
                        variant="ghost"
                        size="sm"
                        onClick={handleConnect}
                        disabled={connecting}
                      >
                        Reconnect or add another number
                      </AppButton>
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
                        Click below to connect your business number via Facebook.
                      </p>
                      <AppButton
                        className="mt-5"
                        onClick={handleConnect}
                        disabled={connecting}
                        loading={connecting}
                      >
                        Connect WhatsApp
                      </AppButton>
                      <p className="mt-3 text-[11px] font-medium text-theme-muted">
                        After granting permissions, you will return here automatically.
                      </p>
                    </div>
                  )}
                </SettingsPanel>

                <SettingsPanel
                  title="Incoming messages"
                  description="Make sure customer messages arrive in your inbox."
                  icon={Webhook}
                  accent="sky"
                  footer={
                    webhookStatus?.connected ? (
                      <AppButton
                        variant="secondary"
                        size="sm"
                        onClick={handleSetupWebhook}
                        disabled={settingUpWebhook}
                        loading={settingUpWebhook}
                      >
                        {webhookStatus.webhookUrl ? 'Refresh connection' : 'Enable incoming messages'}
                      </AppButton>
                    ) : undefined
                  }
                >
                  {webhookStatus?.connected ? (
                    <div className="space-y-4 text-[13px]">
                      <div
                        className={`flex items-start gap-2.5 rounded-2xl p-4 ring-1 ${
                          webhookStatus.subscribed
                            ? 'bg-emerald-50/90 ring-emerald-100 dark:bg-emerald-950/30 dark:ring-emerald-900/40'
                            : 'bg-amber-50/90 ring-amber-100 dark:bg-amber-950/30 dark:ring-amber-900/40'
                        }`}
                      >
                        {webhookStatus.subscribed ? (
                          <>
                            <CheckCircle size={18} className="mt-0.5 shrink-0 text-whatsapp-600" />
                            <div>
                              <p className="font-extrabold text-emerald-900 dark:text-emerald-200">
                                Incoming messages enabled
                              </p>
                              <p className="mt-0.5 font-medium text-emerald-800/90 dark:text-emerald-300/90">
                                Customer messages will show up in your inbox.
                              </p>
                            </div>
                          </>
                        ) : (
                          <>
                            <AlertCircle size={18} className="mt-0.5 shrink-0 text-amber-600" />
                            <div>
                              <p className="font-extrabold text-amber-900 dark:text-amber-200">
                                Incoming messages not enabled
                              </p>
                              <p className="mt-0.5 font-medium text-amber-800/90 dark:text-amber-300/90">
                                Customer messages won&apos;t arrive until you enable this.
                              </p>
                            </div>
                          </>
                        )}
                      </div>

                      {webhookStatus.webhookUrl ? (
                        <div className="space-y-3">
                          <div className="rounded-2xl border border-theme-border bg-theme-subtle/50 p-4">
                            <p className="text-[11px] font-bold uppercase tracking-wide text-theme-muted">
                              Connection status
                            </p>
                            <p className="mt-2 text-[12px] font-medium text-theme-fg">
                              {webhookHealth && webhookHealth.totalReceived > 0
                                ? `Receiving messages · ${webhookHealth.totalReceived.toLocaleString()} inbound processed`
                                : 'Webhook URL configured. Waiting for the next customer message.'}
                            </p>
                            {webhookHealth?.lastReceivedAt && (
                              <p className="mt-1 text-[11px] text-theme-muted">
                                Last inbound:{' '}
                                {new Date(webhookHealth.lastReceivedAt).toLocaleString()}
                              </p>
                            )}
                          </div>

                          {(webhookHealth?.lastError || (webhookHealth?.totalErrors ?? 0) > 0) && (
                            <div className="rounded-2xl border border-orange-200/80 bg-orange-50/90 p-4 dark:border-orange-900/40 dark:bg-orange-950/30">
                              <p className="text-[11px] font-bold uppercase tracking-wide text-orange-800 dark:text-orange-200">
                                Last inbound error
                              </p>
                              <p className="mt-2 text-[12px] font-medium text-orange-950 dark:text-orange-100">
                                {webhookHealth?.lastError ||
                                  `${webhookHealth?.totalErrors ?? 0} webhook error(s) recorded`}
                              </p>
                              {webhookHealth?.lastFbTraceId && (
                                <p className="mt-1 break-all font-mono text-[10px] text-orange-800/80 dark:text-orange-300/80">
                                  fbtrace: {webhookHealth.lastFbTraceId}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <AppAlert variant="info">
                          Tap the button below to enable incoming messages.
                        </AppAlert>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-theme-border bg-theme-subtle/40 px-4 py-8 text-center">
                      <p className="text-[13px] font-medium text-theme-secondary">
                        Connect WhatsApp first to enable incoming messages.
                      </p>
                    </div>
                  )}
                </SettingsPanel>
              </div>
            )}

            {activeTab === 'automation' && (
              <SettingsPanel
                title="Business hours"
                description="Used for away messages and auto-replies when your team is offline."
                icon={Clock}
                accent="amber"
                footer={
                  <AppButton loading={savingHours} onClick={handleSaveBusinessHours}>
                    Save hours
                  </AppButton>
                }
              >
                <div className="mb-5 overflow-hidden rounded-2xl border border-amber-200/70 bg-gradient-to-r from-amber-50/80 via-white to-orange-50/40 dark:border-amber-900/40 dark:from-amber-950/30 dark:via-theme-surface dark:to-orange-950/10">
                  <div className="h-0.5 bg-gradient-to-r from-amber-500 to-orange-500" />
                  <div className="px-4 py-3.5">
                    <p className="text-[13px] font-extrabold text-amber-900 dark:text-amber-200">
                      {formatHour(businessHours.startHour)} – {formatHour(businessHours.endHour)}
                    </p>
                    <p className="mt-0.5 text-[11px] font-medium text-amber-800/80 dark:text-amber-300/80">
                      {businessHours.days.length} working day{businessHours.days.length === 1 ? '' : 's'} ·
                      outside hours send away messages
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <AppInput
                    label="Open at (hour)"
                    type="number"
                    min={0}
                    max={23}
                    value={String(businessHours.startHour)}
                    onChange={(e) =>
                      setBusinessHours((prev) => ({ ...prev, startHour: Number(e.target.value) }))
                    }
                  />
                  <AppInput
                    label="Close at (hour)"
                    type="number"
                    min={1}
                    max={24}
                    value={String(businessHours.endHour)}
                    onChange={(e) =>
                      setBusinessHours((prev) => ({ ...prev, endHour: Number(e.target.value) }))
                    }
                  />
                </div>

                <div className="mt-5">
                  <p className="mb-3 text-[13px] font-semibold text-theme-fg">Working days</p>
                  <div className="flex flex-wrap gap-2">
                    {DAY_LABELS.map((label, index) => {
                      const selected = businessHours.days.includes(index);
                      return (
                        <button
                          key={label}
                          type="button"
                          onClick={() => toggleDay(index)}
                          className={`min-w-[3.25rem] rounded-xl px-3 py-2.5 text-[12px] font-bold transition ${
                            selected
                              ? 'bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-[0_4px_12px_rgba(245,158,11,0.28)]'
                              : 'bg-theme-subtle text-theme-muted ring-1 ring-theme-border hover:bg-theme-surface hover:text-theme-secondary'
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </SettingsPanel>
            )}

            {activeTab === 'ai' && (
              <SettingsPanel
                title="AI settings"
                description="Control how smart replies work for your business."
                icon={Bot}
                accent="indigo"
                footer={
                  <AppButton loading={savingAi} onClick={handleSaveAi}>
                    Save AI settings
                  </AppButton>
                }
              >
                <div className="mb-5">
                  <p className="mb-2 text-[13px] font-semibold text-theme-fg">Smart reply engine</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {(
                      [
                        {
                          value: 'sarvam',
                          title: 'Sarvam (recommended)',
                          desc: 'India-first, fast & affordable for chat + voice',
                        },
                        {
                          value: 'azure',
                          title: 'Azure OpenAI',
                          desc: 'Legacy option — only if your org needs it',
                        },
                      ] as const
                    ).map((opt) => {
                      const selected = (aiSettings.brainProvider ?? 'sarvam') === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() =>
                            setAiSettings((prev) => ({ ...prev, brainProvider: opt.value }))
                          }
                          className={`rounded-2xl border px-4 py-3 text-left transition ${
                            selected
                              ? 'border-indigo-400/60 bg-indigo-50/60 ring-1 ring-inset ring-indigo-400/30 dark:border-indigo-500/50 dark:bg-indigo-950/30'
                              : 'border-theme-border bg-theme-subtle/40 hover:bg-theme-surface'
                          }`}
                        >
                          <p className="flex items-center gap-2 text-[13px] font-bold text-theme-fg">
                            <span
                              className={`h-3 w-3 rounded-full border-2 ${
                                selected
                                  ? 'border-indigo-500 bg-indigo-500'
                                  : 'border-theme-border'
                              }`}
                            />
                            {opt.title}
                          </p>
                          <p className="mt-1 text-[11px] text-theme-muted">{opt.desc}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <label className="mb-5 flex cursor-pointer items-center gap-3 rounded-2xl border border-theme-border bg-theme-subtle/40 px-4 py-3.5 transition hover:border-indigo-300/50 dark:hover:border-indigo-500/30">
                  <input
                    type="checkbox"
                    checked={Boolean(aiSettings.useCustomConfig)}
                    onChange={(e) =>
                      setAiSettings((prev) => ({ ...prev, useCustomConfig: e.target.checked }))
                    }
                    className="h-4 w-4 rounded border-theme-border text-indigo-600 focus:ring-indigo-500/25"
                  />
                  <div>
                    <p className="text-[13px] font-bold text-theme-fg">
                      Use your own AI service
                    </p>
                    <p className="text-[11px] text-theme-muted">
                      Leave off to use the default service
                    </p>
                  </div>
                </label>

                {aiSettings.useCustomConfig && (
                  <div className="mb-5 grid gap-4 sm:grid-cols-2">
                    <AppInput
                      label="Service URL"
                      placeholder="https://your-ai-service.com"
                      value={aiSettings.endpoint || ''}
                      onChange={(e) => setAiSettings((p) => ({ ...p, endpoint: e.target.value }))}
                    />
                    <AppInput
                      label="API key"
                      type="password"
                      placeholder={aiSettings.hasApiKey ? '•••••••• (saved)' : 'Your API key'}
                      value={aiApiKey}
                      onChange={(e) => setAiApiKey(e.target.value)}
                    />
                    <AppInput
                      label="Chat model"
                      value={aiSettings.deployment || ''}
                      onChange={(e) => setAiSettings((p) => ({ ...p, deployment: e.target.value }))}
                    />
                    <AppInput
                      label="Search model"
                      value={aiSettings.embeddingDeployment || ''}
                      onChange={(e) =>
                        setAiSettings((p) => ({ ...p, embeddingDeployment: e.target.value }))
                      }
                    />
                    <AppInput
                      label="Monthly limit (0 = no limit)"
                      type="number"
                      min={0}
                      value={String(aiSettings.monthlyTokenLimit ?? 0)}
                      onChange={(e) =>
                        setAiSettings((p) => ({
                          ...p,
                          monthlyTokenLimit: parseInt(e.target.value, 10) || 0,
                        }))
                      }
                    />
                  </div>
                )}

                {aiUsage && (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <SettingsStat
                      label="Used this month"
                      value={
                        aiUsage.monthlyTokenLimit
                          ? `${aiUsage.monthTokens} / ${aiUsage.monthlyTokenLimit}`
                          : aiUsage.monthTokens
                      }
                      tone="text-indigo-700 dark:text-indigo-400"
                    />
                    <SettingsStat
                      label="Replies (30 days)"
                      value={aiUsage.totalRequests}
                      tone="text-violet-700 dark:text-violet-400"
                    />
                    <SettingsStat
                      label="Chat usage"
                      value={usageSurfaceRequests(aiUsage, 'chat_bot')}
                      tone="text-sky-700 dark:text-sky-400"
                    />
                    <SettingsStat
                      label="Search usage"
                      value={usageSurfaceRequests(aiUsage, 'embedding')}
                      tone="text-emerald-700 dark:text-emerald-400"
                    />
                  </div>
                )}
              </SettingsPanel>
            )}

            {activeTab === 'campaigns' && (
              <SettingsPanel
                title="Campaign limits"
                description="Control how many messages you send per day and how fast."
                icon={Send}
                accent="rose"
                footer={
                  <AppButton loading={savingCampaigns} onClick={handleSaveCampaigns}>
                    Save campaign settings
                  </AppButton>
                }
              >
                <div className="mb-5 grid gap-3 sm:grid-cols-3">
                  <SettingsStat
                    label="Daily limit"
                    value={campaignSettings.dailySendLimit.toLocaleString()}
                    tone="text-rose-700 dark:text-rose-400"
                  />
                  <SettingsStat
                    label="Batch size"
                    value={campaignSettings.batchSize}
                    tone="text-violet-700 dark:text-violet-400"
                  />
                  <SettingsStat
                    label="Wait between batches"
                    value={`${Math.round(campaignSettings.batchDelayMs / 1000)}s`}
                    tone="text-sky-700 dark:text-sky-400"
                  />
                </div>

                <div className="card-grid-auto">
                  <AppInput
                    id="daily-send-limit"
                    label="Daily send limit"
                    type="number"
                    min={1}
                    value={String(campaignSettings.dailySendLimit)}
                    onChange={(e) =>
                      setCampaignSettings((prev) => ({
                        ...prev,
                        dailySendLimit: parseInt(e.target.value, 10) || 1,
                      }))
                    }
                  />
                  <AppInput
                    id="daily-budget"
                    label="Daily Meta budget (₹)"
                    type="number"
                    min={0}
                    value={String(campaignSettings.dailyBudgetInr ?? 5000)}
                    onChange={(e) =>
                      setCampaignSettings((prev) => ({
                        ...prev,
                        dailyBudgetInr: parseFloat(e.target.value) || 0,
                      }))
                    }
                  />
                  <AppInput
                    id="batch-size"
                    label="Batch size"
                    type="number"
                    min={1}
                    value={String(campaignSettings.batchSize)}
                    onChange={(e) =>
                      setCampaignSettings((prev) => ({
                        ...prev,
                        batchSize: parseInt(e.target.value, 10) || 1,
                      }))
                    }
                  />
                  <AppInput
                    id="batch-delay"
                    label="Wait between batches (seconds)"
                    type="number"
                    min={0}
                    value={String(Math.round(campaignSettings.batchDelayMs / 1000))}
                    onChange={(e) =>
                      setCampaignSettings((prev) => ({
                        ...prev,
                        batchDelayMs: (parseInt(e.target.value, 10) || 0) * 1000,
                      }))
                    }
                  />
                </div>

                <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-theme-border bg-theme-subtle/40 px-4 py-3.5">
                  <input
                    type="checkbox"
                    checked={campaignSettings.mapFirstBodyVariableToName !== false}
                    onChange={(e) =>
                      setCampaignSettings((prev) => ({
                        ...prev,
                        mapFirstBodyVariableToName: e.target.checked,
                      }))
                    }
                    className="mt-0.5 h-4 w-4 rounded border-theme-border text-emerald-600 focus:ring-emerald-500/30"
                  />
                  <div>
                    <p className="text-[13px] font-semibold text-theme-fg">
                      Map the first template variable to the customer name
                    </p>
                    <p className="text-[11px] font-medium text-theme-muted">
                      When you add {'{{1}}'} in a new template, it is filled from the contact name at send time.
                    </p>
                  </div>
                </label>

                <p className="mt-4 text-[12px] font-medium leading-relaxed text-theme-muted">
                  Large campaigns are sent in small groups with a short pause between each group.
                  Smaller groups and longer pauses are safer for big sends.
                </p>
              </SettingsPanel>
            )}

            {activeTab === 'inbox' && (
              <SettingsPanel
                title="Inbox tools"
                description="Saved replies your team can use in conversations."
                icon={MessageSquare}
                accent="violet"
              >
                <CannedRepliesPanel />
              </SettingsPanel>
            )}

            {activeTab === 'integrations' && (
              <SettingsPanel
                title="Integrations & privacy"
                description="Connect other apps and download your data."
                icon={Plug}
                accent="indigo"
              >
                <IntegrationsPanel />
              </SettingsPanel>
            )}

            {activeTab === 'setup' && (
              <SettingsPanel
                title="Getting started"
                description="Follow these steps to set up your WhatsApp workspace."
                icon={ShieldCheck}
                accent="violet"
              >
                <div className="mb-5">
                  <div className="mb-2 flex items-center justify-between text-[12px] font-semibold">
                    <span className="text-theme-secondary">Setup progress</span>
                    <span className="tabular-nums text-theme-fg">{setupProgress}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-theme-subtle">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-violet-500 to-whatsapp-500 transition-all duration-500"
                      style={{ width: `${setupProgress}%` }}
                    />
                  </div>
                </div>

                <ol className="space-y-2">
                  {setupSteps.map((step, index) => (
                    <li
                      key={step.text}
                      className={`flex gap-3 rounded-2xl border px-4 py-3.5 text-[12px] font-medium transition ${
                        step.done
                          ? 'border-emerald-200/80 bg-gradient-to-r from-emerald-50/70 to-teal-50/30 text-emerald-900 dark:border-emerald-800/40 dark:from-emerald-950/30 dark:to-teal-950/10 dark:text-emerald-200'
                          : 'border-theme-border bg-theme-subtle/40 text-theme-secondary hover:border-theme-border-strong'
                      }`}
                    >
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold ${
                          step.done
                            ? 'bg-gradient-to-br from-whatsapp-500 to-emerald-600 text-white shadow-[0_4px_10px_rgba(37,211,102,0.25)]'
                            : 'bg-theme-surface text-theme-muted ring-1 ring-theme-border'
                        }`}
                      >
                        {step.done ? (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        ) : (
                          index + 1
                        )}
                      </span>
                      <span className="min-w-0 pt-0.5 leading-relaxed">{step.text}</span>
                    </li>
                  ))}
                </ol>

                <div className="mt-5 flex flex-wrap items-center gap-2">
                  <div className="flex flex-1 items-center gap-2 rounded-xl bg-emerald-50/80 px-3 py-2.5 text-[12px] font-semibold text-whatsapp-800 ring-1 ring-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-300 dark:ring-emerald-900/40">
                    <Link2 className="h-3.5 w-3.5 shrink-0" />
                    Need help? Go to WhatsApp → Settings or contact your administrator.
                  </div>
                  {!isReady && (
                    <AppButton
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        skipOnboardingSetup();
                        window.location.href = '/';
                      }}
                    >
                      Skip for now
                    </AppButton>
                  )}
                </div>
              </SettingsPanel>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(disconnectTarget)}
        onClose={() => setDisconnectTarget(null)}
        onConfirm={confirmDisconnect}
        title="Disconnect WhatsApp number?"
        description="You're about to disconnect this number from your workspace."
        highlight={disconnectTarget ? formatPhoneDisplay(disconnectTarget.phone) : undefined}
        details={[
          'New messages will stop until you connect again',
          'Existing chats remain saved',
        ]}
        confirmLabel="Disconnect"
        cancelLabel="Keep connected"
        variant="danger"
        icon={PhoneOff}
        loading={Boolean(disconnectingId)}
      />
    </PageShell>
  );
}
