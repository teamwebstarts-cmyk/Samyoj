import { useEffect, useMemo, useState } from 'react';
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
  Moon,
  Palette,
  PhoneCall,
  Send,
  Settings2,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Webhook,
} from 'lucide-react';
import CallingSettingsPanel from '../components/calls/CallingSettingsPanel';
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
import LoadingState from '../components/ui/LoadingState';
import PageHeader from '../components/ui/PageHeader';
import PageHero from '../components/ui/PageHero';
import PageShell from '../components/ui/PageShell';
import ThemeToggle from '../components/ui/ThemeToggle';
import { useTheme } from '../contexts/ThemeContext';
import { aiBotApi, settingsApi, teamApi, whatsappApi } from '../services/api';
import type { AiUsageSummary, BusinessHours, OrgAiSettings } from '../types';
import { toastError, toastSuccess } from '../utils/toast';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type SettingsTab = 'general' | 'whatsapp' | 'automation' | 'ai' | 'calling' | 'campaigns' | 'inbox' | 'integrations' | 'setup';

interface WhatsappNumber {
  id: string;
  phoneNumber: string;
  isActive: boolean;
  createdAt: string;
}

interface WebhookStatus {
  connected: boolean;
  phoneNumber?: string;
  webhookUrl?: string | null;
  subscribed: boolean;
}

function formatHour(hour: number) {
  const normalized = hour === 24 ? 0 : hour;
  const period = normalized >= 12 ? 'PM' : 'AM';
  const display = normalized % 12 === 0 ? 12 : normalized % 12;
  return `${display}:00 ${period}`;
}

export default function SettingsPage() {
  const { mode, resolved } = useTheme();
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [numbers, setNumbers] = useState<WhatsappNumber[]>([]);
  const [connectUrl, setConnectUrl] = useState('');
  const [webhookStatus, setWebhookStatus] = useState<WebhookStatus | null>(null);
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
    batchSize: 50,
    batchDelayMs: 1000,
  });
  const [savingCampaigns, setSavingCampaigns] = useState(false);
  const [setupMeta, setSetupMeta] = useState({
    hasBusinessHours: false,
    hasAiBot: false,
    teamCount: 1,
  });

  const load = () => {
    Promise.all([
      whatsappApi.numbers(),
      whatsappApi.connectUrl(),
      whatsappApi.webhookStatus(),
      settingsApi.get(),
      settingsApi.aiUsage(),
      aiBotApi.list(),
      teamApi.list(),
    ])
      .then(([numbersRes, urlRes, webhookRes, settingsRes, usageRes, botsRes, teamRes]) => {
        setNumbers(numbersRes.data.data);
        setConnectUrl(urlRes.data.data.url);
        setWebhookStatus(webhookRes.data.data);
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

  const isReady = numbers.length > 0 && Boolean(webhookStatus?.subscribed);
  const setupProgress = useMemo(() => {
    const steps = [
      numbers.length > 0,
      Boolean(webhookStatus?.subscribed),
      setupMeta.hasBusinessHours,
      setupMeta.hasAiBot,
      setupMeta.teamCount > 1,
    ];
    return Math.round((steps.filter(Boolean).length / steps.length) * 100);
  }, [numbers, webhookStatus, setupMeta]);

  const tabs = useMemo(
    () => [
      {
        id: 'general' as const,
        label: 'Appearance',
        description: 'Theme & display',
        icon: Palette,
      },
      {
        id: 'whatsapp' as const,
        label: 'WhatsApp',
        description: 'Number & messages',
        icon: Smartphone,
        badge: !isReady ? 'Setup' : undefined,
      },
      {
        id: 'automation' as const,
        label: 'Business hours',
        description: 'When your team is available',
        icon: Clock,
      },
      {
        id: 'ai' as const,
        label: 'AI',
        description: 'Smart reply settings',
        icon: Bot,
      },
      {
        id: 'calling' as const,
        label: 'Calling',
        description: 'Voice calls & routing',
        icon: PhoneCall,
      },
      {
        id: 'campaigns' as const,
        label: 'Campaigns',
        description: 'Send limits & speed',
        icon: Send,
      },
      {
        id: 'inbox' as const,
        label: 'Inbox tools',
        description: 'Canned replies & labels',
        icon: MessageSquare,
      },
      {
        id: 'integrations' as const,
        label: 'Integrations',
        description: 'API keys, webhooks, GDPR',
        icon: Plug,
      },
      {
        id: 'setup' as const,
        label: 'Getting started',
        description: 'Step-by-step setup',
        icon: ShieldCheck,
      },
    ],
    [isReady],
  );

  const handleConnect = () => {
    if (!connectUrl) return;
    setConnecting(true);
    window.location.href = connectUrl;
  };

  const handleDisconnect = async (id: string, phone: string) => {
    const confirmed = window.confirm(
      `Disconnect +${phone}?\n\nNew messages will stop until you connect again. Existing chats remain saved.`,
    );
    if (!confirmed) return;

    setDisconnectingId(id);
    try {
      await whatsappApi.disconnect(id);
      load();
      toastSuccess('WhatsApp disconnected');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
          ?.error?.message || 'Failed to disconnect WhatsApp.';
      toastError(msg);
    } finally {
      setDisconnectingId(null);
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

  return (
    <PageShell>
      <PageHeader
        actions={
          !isReady ? (
            <AppButton size="sm" onClick={handleConnect} loading={connecting} disabled={!connectUrl}>
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
            {activeTab === 'general' && (
              <SettingsPanel
                title="Appearance"
                description="Choose light or dark mode. Changes apply right away."
                icon={Moon}
                accent="violet"
              >
                <div className="space-y-5">
                  <div className="rounded-2xl border border-violet-200/60 bg-gradient-to-r from-violet-50/80 via-white to-fuchsia-50/30 p-4 dark:border-violet-800/40 dark:from-violet-950/20 dark:via-theme-surface dark:to-fuchsia-950/10">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-[0_4px_12px_rgba(139,92,246,0.28)]">
                        <Sparkles className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-[13px] font-extrabold text-theme-fg">Active theme</p>
                        <p className="text-[12px] font-semibold capitalize text-violet-700 dark:text-violet-300">
                          {mode === 'system' ? `System (${resolved})` : mode}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="mb-3 text-[12px] font-bold uppercase tracking-wide text-theme-muted">
                      Theme mode
                    </p>
                    <ThemeToggle variant="menu" />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {[
                      {
                        label: 'Light workspace',
                        active: resolved === 'light',
                        preview: 'bg-white ring-slate-200',
                        bar: 'bg-slate-100',
                        dot: 'bg-whatsapp-500',
                      },
                      {
                        label: 'Dark workspace',
                        active: resolved === 'dark',
                        preview: 'bg-slate-900 ring-slate-700',
                        bar: 'bg-slate-800',
                        dot: 'bg-emerald-400',
                      },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className={`rounded-2xl border p-3 transition ${
                          item.active
                            ? 'border-violet-300/70 bg-violet-50/50 ring-1 ring-violet-200/60 dark:border-violet-700/50 dark:bg-violet-950/20 dark:ring-violet-800/40'
                            : 'border-theme-border bg-theme-subtle/40'
                        }`}
                      >
                        <div
                          className={`overflow-hidden rounded-xl ring-1 ${item.preview} p-2`}
                        >
                          <div className={`mb-2 h-2 rounded-full ${item.bar}`} />
                          <div className="flex gap-1.5">
                            <div className={`h-8 w-8 rounded-lg ${item.bar}`} />
                            <div className="flex-1 space-y-1">
                              <div className={`h-1.5 w-full rounded ${item.bar}`} />
                              <div className={`h-1.5 w-2/3 rounded ${item.bar}`} />
                            </div>
                          </div>
                          <div className={`mt-2 h-1.5 w-1/3 rounded-full ${item.dot}`} />
                        </div>
                        <p className="mt-2 text-center text-[11px] font-bold text-theme-secondary">
                          {item.label}
                        </p>
                      </div>
                    ))}
                  </div>

                  <p className="text-[12px] font-medium leading-relaxed text-theme-muted">
                    System mode follows your OS preference and updates automatically when you switch
                    between light and dark on your device.
                  </p>
                </div>
              </SettingsPanel>
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
                  {loading ? (
                    <LoadingState label="Loading connection..." />
                  ) : numbers.length > 0 ? (
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
                        disabled={connecting || !connectUrl}
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
                        Connect your business number to start messaging customers.
                      </p>
                      <AppButton
                        className="mt-5"
                        onClick={handleConnect}
                        disabled={connecting || !connectUrl}
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
                        <div className="rounded-2xl border border-theme-border bg-theme-subtle/50 p-4">
                          <p className="text-[11px] font-bold uppercase tracking-wide text-theme-muted">
                            Connection status
                          </p>
                          <p className="mt-2 text-[12px] font-medium text-theme-fg">
                            Connected and receiving messages.
                          </p>
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
                      outside hours trigger away messages
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
                      value={aiUsage.byAction.chat || 0}
                      tone="text-sky-700 dark:text-sky-400"
                    />
                    <SettingsStat
                      label="Search usage"
                      value={aiUsage.byAction.embedding || 0}
                      tone="text-emerald-700 dark:text-emerald-400"
                    />
                  </div>
                )}
              </SettingsPanel>
            )}

            {activeTab === 'calling' && <CallingSettingsPanel />}

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

                <div className="grid gap-4 sm:grid-cols-3">
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
                description="API keys, outbound webhooks, and GDPR export."
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

                <div className="mt-5 flex items-center gap-2 rounded-xl bg-emerald-50/80 px-3 py-2.5 text-[12px] font-semibold text-whatsapp-800 ring-1 ring-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-300 dark:ring-emerald-900/40">
                  <Link2 className="h-3.5 w-3.5 shrink-0" />
                  Need help? Go to WhatsApp → Settings or contact your administrator.
                </div>
              </SettingsPanel>
            )}
          </div>
        </div>
      </div>
    </PageShell>
  );
}
