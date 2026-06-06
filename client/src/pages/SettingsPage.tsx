import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle,
  Link2,
  LogOut,
  Settings2,
  ShieldCheck,
  Smartphone,
  Webhook,
} from 'lucide-react';
import AppAlert from '../components/ui/AppAlert';
import AppButton from '../components/ui/AppButton';
import LoadingState from '../components/ui/LoadingState';
import PageHero from '../components/ui/PageHero';
import PageShell from '../components/ui/PageShell';
import SectionCard from '../components/ui/SectionCard';
import { whatsappApi } from '../services/api';

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

export default function SettingsPage() {
  const [numbers, setNumbers] = useState<WhatsappNumber[]>([]);
  const [connectUrl, setConnectUrl] = useState('');
  const [webhookStatus, setWebhookStatus] = useState<WebhookStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const [settingUpWebhook, setSettingUpWebhook] = useState(false);
  const [error, setError] = useState('');
  const [webhookMessage, setWebhookMessage] = useState('');

  const load = () => {
    Promise.all([whatsappApi.numbers(), whatsappApi.connectUrl(), whatsappApi.webhookStatus()])
      .then(([numbersRes, urlRes, webhookRes]) => {
        setNumbers(numbersRes.data.data);
        setConnectUrl(urlRes.data.data.url);
        setWebhookStatus(webhookRes.data.data);
        setError('');
      })
      .catch((err: unknown) => {
        const msg =
          (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
            ?.error?.message || 'Failed to load WhatsApp settings.';
        setError(msg);
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const stats = useMemo(
    () => ({
      connected: numbers.length,
      webhook: webhookStatus?.subscribed ? 1 : 0,
      ready: numbers.length > 0 && webhookStatus?.subscribed ? 1 : 0,
    }),
    [numbers, webhookStatus],
  );

  const handleConnect = () => {
    if (!connectUrl) return;
    setConnecting(true);
    window.location.href = connectUrl;
  };

  const handleDisconnect = async (id: string, phone: string) => {
    const confirmed = window.confirm(
      `Disconnect +${phone}?\n\nNew messages will stop until you connect again. Existing chats remain saved.`
    );
    if (!confirmed) return;

    setDisconnectingId(id);
    setError('');
    try {
      await whatsappApi.disconnect(id);
      load();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
          ?.error?.message || 'Failed to disconnect WhatsApp.';
      setError(msg);
    } finally {
      setDisconnectingId(null);
    }
  };

  const handleSetupWebhook = async () => {
    setSettingUpWebhook(true);
    setWebhookMessage('');
    try {
      const { data } = await whatsappApi.setupWebhook();
      const url = data.data.callbackUrl;
      setWebhookMessage(
        url
          ? `Webhook configured: ${url}`
          : 'WhatsApp Business Account linked to this app. You can send campaigns now.'
      );
      load();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
          ?.error?.message || 'Webhook setup failed';
      setWebhookMessage(msg);
    } finally {
      setSettingUpWebhook(false);
    }
  };

  return (
    <PageShell>
      <div className="space-y-5 animate-fade-up-delay sm:space-y-6">
        <PageHero
          badge="Account setup"
          badgeIcon={Settings2}
          title="Connect WhatsApp and enable real-time inbox"
          description="Link your WhatsApp Business number via Meta OAuth and register webhooks to receive customer messages instantly."
          accent="emerald"
          stats={[
            { label: 'Numbers', value: stats.connected, tone: 'text-whatsapp-700' },
            {
              label: 'Webhook',
              value: stats.webhook ? 'Live' : 'Off',
              tone: stats.webhook ? 'text-whatsapp-700' : 'text-amber-700',
            },
            {
              label: 'Ready',
              value: stats.ready ? 'Yes' : 'No',
              tone: stats.ready ? 'text-whatsapp-700' : 'text-neutral-500',
            },
          ]}
        />

        {error && <AppAlert variant="error">{error}</AppAlert>}

        <SectionCard
          title="WhatsApp Business API"
          subtitle="Connect via Meta OAuth"
          headerAction={
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-whatsapp-500 to-whatsapp-600 text-white shadow-[0_4px_14px_rgba(37,211,102,0.35)]">
              <Smartphone className="h-5 w-5" strokeWidth={2.25} />
            </div>
          }
        >
          {loading ? (
            <LoadingState label="Loading connection..." />
          ) : numbers.length > 0 ? (
            <div className="space-y-3">
              {numbers.map((number) => (
                <div
                  key={number.id}
                  className="flex flex-col gap-3 rounded-2xl border border-emerald-200/80 bg-gradient-to-r from-emerald-50/90 to-white p-4 ring-1 ring-emerald-100 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-whatsapp-600 shadow-sm ring-1 ring-emerald-100">
                      <CheckCircle size={20} strokeWidth={2.25} />
                    </div>
                    <div>
                      <p className="font-extrabold text-neutral-900">+{number.phoneNumber}</p>
                      <p className="text-[12px] font-semibold text-whatsapp-700">Connected · Active</p>
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
              <AppButton variant="ghost" size="sm" onClick={handleConnect} disabled={connecting || !connectUrl}>
                Reconnect or add another number
              </AppButton>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50/70 px-4 py-8 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-whatsapp-500 to-whatsapp-600 text-white shadow-[0_4px_14px_rgba(37,211,102,0.35)]">
                <Smartphone className="h-6 w-6" strokeWidth={2.25} />
              </div>
              <p className="mt-4 text-[14px] font-semibold text-neutral-800">
                No WhatsApp number connected yet
              </p>
              <p className="mt-1 text-[13px] font-medium text-neutral-500">
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
              <p className="mt-3 text-[11px] font-medium text-neutral-500">
                After granting permissions, you will return here automatically.
              </p>
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Incoming messages"
          subtitle="Webhook configuration for real-time inbox"
          headerAction={
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-[0_4px_14px_rgba(14,165,233,0.3)]">
              <Webhook className="h-5 w-5" strokeWidth={2.25} />
            </div>
          }
        >
          {webhookStatus?.connected ? (
            <div className="space-y-3 text-[13px]">
              <div
                className={`flex items-start gap-2.5 rounded-2xl p-4 ring-1 ${
                  webhookStatus.subscribed
                    ? 'bg-emerald-50/90 ring-emerald-100'
                    : 'bg-amber-50/90 ring-amber-100'
                }`}
              >
                {webhookStatus.subscribed ? (
                  <>
                    <CheckCircle size={18} className="mt-0.5 shrink-0 text-whatsapp-600" />
                    <div>
                      <p className="font-extrabold text-emerald-900">Webhook subscribed</p>
                      <p className="mt-0.5 font-medium text-emerald-800/90">
                        Incoming messages are enabled for your inbox.
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <AlertCircle size={18} className="mt-0.5 shrink-0 text-amber-600" />
                    <div>
                      <p className="font-extrabold text-amber-900">Webhook not subscribed</p>
                      <p className="mt-0.5 font-medium text-amber-800/90">
                        Customer messages won&apos;t arrive until the webhook is registered.
                      </p>
                    </div>
                  </>
                )}
              </div>

              {webhookStatus.webhookUrl ? (
                <div className="rounded-2xl border border-neutral-100 bg-neutral-50/80 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-400">
                    Webhook URL
                  </p>
                  <code className="mt-2 block break-all rounded-xl bg-white px-3 py-2 text-[12px] text-neutral-800 ring-1 ring-neutral-100">
                    {webhookStatus.webhookUrl}
                  </code>
                </div>
              ) : (
                <AppAlert variant="info">
                  Set <code className="rounded bg-white/80 px-1">META_WEBHOOK_URL</code> in server .env
                </AppAlert>
              )}

              <AppButton
                variant="secondary"
                size="sm"
                onClick={handleSetupWebhook}
                disabled={settingUpWebhook}
                loading={settingUpWebhook}
              >
                {webhookStatus.webhookUrl ? 'Register webhook with Meta' : 'Link WhatsApp to this app'}
              </AppButton>

              {webhookMessage && (
                <AppAlert
                  variant={
                    webhookMessage.startsWith('Webhook configured') ||
                    webhookMessage.includes('linked to this app')
                      ? 'success'
                      : 'error'
                  }
                >
                  {webhookMessage}
                </AppAlert>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50/70 px-4 py-6 text-center">
              <p className="text-[13px] font-medium text-neutral-600">
                Connect WhatsApp first to enable incoming messages.
              </p>
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Setup checklist"
          subtitle="Complete these steps for full functionality"
          headerAction={
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-[0_4px_14px_rgba(139,92,246,0.35)]">
              <ShieldCheck className="h-5 w-5" strokeWidth={2.25} />
            </div>
          }
        >
          <ol className="space-y-3">
            {[
              { text: 'Add WhatsApp product in Meta Developer Console' },
              {
                text: 'Add redirect URI',
                code: 'http://localhost:5173/settings/whatsapp/callback',
              },
              { text: 'Set META_APP_ID and META_APP_SECRET in server .env' },
              { text: 'Run HTTPS tunnel', code: 'cloudflared tunnel --url http://localhost:5000' },
              {
                text: 'Set META_WEBHOOK_URL to tunnel URL +',
                code: '/api/whatsapp/webhook',
              },
              { text: 'Click "Register webhook with Meta" above' },
            ].map((step, index) => (
              <li
                key={step.text}
                className="flex gap-3 rounded-xl border border-neutral-100 bg-neutral-50/70 px-3 py-3 text-[12px] font-medium text-neutral-600"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-[11px] font-bold text-violet-700 ring-1 ring-violet-100">
                  {index + 1}
                </span>
                <span className="pt-0.5 leading-relaxed">
                  {step.text}
                  {step.code && (
                    <>
                      {' '}
                      <code className="rounded bg-white px-1.5 py-0.5 text-[11px] text-neutral-800 ring-1 ring-neutral-100">
                        {step.code}
                      </code>
                    </>
                  )}
                </span>
              </li>
            ))}
          </ol>

          <div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50/80 px-3 py-2 text-[12px] font-semibold text-whatsapp-800 ring-1 ring-emerald-100">
            <Link2 className="h-3.5 w-3.5" />
            Need help? Follow Meta&apos;s WhatsApp Cloud API setup guide in the developer docs.
          </div>
        </SectionCard>
      </div>
    </PageShell>
  );
}
