import { useEffect, useState } from 'react';
import { ChevronDown, Copy, Download, Key, RefreshCw, Trash2, Webhook } from 'lucide-react';
import AppButton from '../ui/AppButton';
import AppInput from '../ui/AppInput';
import SettingsPanel from './SettingsPanel';
import WhatsAppButtonBuilder from './WhatsAppButtonBuilder';
import { complianceApi, integrationsApi } from '../../services/api';
import type { ApiKeyItem, WebhookEndpoint } from '../../types';
import { toastError, toastSuccess } from '../../utils/toast';
import { SettingsTabSkeleton } from './SettingsSkeleton';

const eventLabels: Record<string, string> = {
  'message.received': 'New message',
  'message.sent': 'Message sent',
  'message.delivered': 'Delivered',
  'message.read': 'Read',
  'message.failed': 'Failed',
  'contact.created': 'New contact',
  'contact.updated': 'Contact updated',
};

function eventLabel(event: string): string {
  return eventLabels[event] || event.replace(/\./g, ' · ').replace(/_/g, ' ');
}

interface WebhookDelivery {
  id: string;
  event: string;
  status: string;
  attempts: number;
  lastStatusCode?: number | null;
  lastError?: string | null;
  createdAt: string;
  deliveredAt?: string | null;
}

interface IntegrationsPanelProps {
  /** API keys & webhooks — owners/admins only; hidden from normal team members. */
  showDeveloperTools?: boolean;
}

export default function IntegrationsPanel({ showDeveloperTools = false }: IntegrationsPanelProps) {
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookEndpoint[]>([]);
  const [events, setEvents] = useState<string[]>([]);
  const [newKeyName, setNewKeyName] = useState('');
  const [newWebhookUrl, setNewWebhookUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>(['message.received']);
  const [exporting, setExporting] = useState(false);
  const [csvExporting, setCsvExporting] = useState(false);
  const [devOpen, setDevOpen] = useState(false);
  const [devLoading, setDevLoading] = useState(false);
  const [devLoaded, setDevLoaded] = useState(false);
  const [expandedWebhookId, setExpandedWebhookId] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [deliveriesLoading, setDeliveriesLoading] = useState(false);

  const loadDeveloperData = () => {
    setDevLoading(true);
    Promise.all([integrationsApi.listKeys(), integrationsApi.listWebhooks()])
      .then(([keysRes, hooksRes]) => {
        setKeys(keysRes.data.data.keys);
        setWebhooks(hooksRes.data.data.endpoints);
        setEvents(hooksRes.data.data.availableEvents);
        setDevLoaded(true);
      })
      .catch(() => toastError('Failed to load developer settings'))
      .finally(() => setDevLoading(false));
  };

  useEffect(() => {
    if (showDeveloperTools && devOpen && !devLoaded && !devLoading) {
      loadDeveloperData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once when section opens
  }, [showDeveloperTools, devOpen, devLoaded, devLoading]);

  const loadDeliveries = async (webhookId: string) => {
    if (expandedWebhookId === webhookId) {
      setExpandedWebhookId(null);
      return;
    }
    setExpandedWebhookId(webhookId);
    setDeliveriesLoading(true);
    try {
      const { data } = await integrationsApi.webhookDeliveries(webhookId);
      setDeliveries(data.data.deliveries || []);
    } catch {
      toastError('Failed to load deliveries');
      setDeliveries([]);
    } finally {
      setDeliveriesLoading(false);
    }
  };

  const replayDelivery = async (deliveryId: string) => {
    try {
      await integrationsApi.replayDelivery(deliveryId);
      toastSuccess('Delivery replay queued');
      if (expandedWebhookId) void loadDeliveries(expandedWebhookId);
    } catch {
      toastError('Replay failed');
    }
  };

  const createKey = async () => {
    if (!newKeyName.trim()) return;
    try {
      const { data } = await integrationsApi.createKey(newKeyName.trim());
      await navigator.clipboard.writeText(data.data.key);
      toastSuccess('API key created and copied');
      setNewKeyName('');
      loadDeveloperData();
    } catch {
      toastError('Failed to create key');
    }
  };

  const createWebhook = async () => {
    if (!newWebhookUrl.trim()) return;
    try {
      const { data } = await integrationsApi.createWebhook({
        url: newWebhookUrl.trim(),
        events: selectedEvents,
      });
      await navigator.clipboard.writeText(data.data.secret);
      toastSuccess('Webhook added — secret copied');
      setNewWebhookUrl('');
      loadDeveloperData();
    } catch {
      toastError('Failed to add webhook');
    }
  };

  const handleCsvExport = async () => {
    setCsvExporting(true);
    try {
      const res = await integrationsApi.exportGoogleSheets();
      const blob = res.data as Blob;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `contacts-${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toastSuccess('Contacts CSV downloaded');
    } catch {
      toastError('Export failed');
    } finally {
      setCsvExporting(false);
    }
  };

  const handleFullExport = async () => {
    setExporting(true);
    try {
      const blob = await complianceApi.exportData();
      const url = URL.createObjectURL(blob as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `data-export-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toastSuccess('Download started');
    } catch {
      toastError('Download failed');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <WhatsAppButtonBuilder />
      <SettingsPanel
        title="Data & export"
        description="Download your contacts or a full workspace backup."
        icon={Download}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-theme-border/80 bg-theme-subtle/25 p-3.5">
            <p className="text-[13px] font-bold text-theme-fg">Contacts CSV</p>
            <p className="mt-1 text-[11px] leading-relaxed text-theme-secondary">
              Spreadsheet of your contacts. Open in Excel or Google Sheets.
            </p>
            <AppButton
              className="mt-3"
              size="sm"
              variant="secondary"
              loading={csvExporting}
              onClick={() => void handleCsvExport()}
            >
              Download CSV
            </AppButton>
          </div>

          <div className="rounded-xl border border-theme-border/80 bg-theme-subtle/25 p-3.5">
            <p className="text-[13px] font-bold text-theme-fg">Full backup</p>
            <p className="mt-1 text-[11px] leading-relaxed text-theme-secondary">
              Contacts, messages, and settings in one JSON file.
            </p>
            <AppButton
              className="mt-3"
              size="sm"
              variant="secondary"
              loading={exporting}
              icon={<Copy className="h-4 w-4" />}
              onClick={() => void handleFullExport()}
            >
              Download backup
            </AppButton>
          </div>
        </div>
      </SettingsPanel>

      {showDeveloperTools && (
        <div className="overflow-hidden rounded-2xl border border-theme-border bg-theme-surface/60 shadow-none">
          <button
            type="button"
            onClick={() => setDevOpen((v) => !v)}
            className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition hover:bg-theme-subtle/40"
            aria-expanded={devOpen}
          >
            <div className="min-w-0">
              <p className="text-[13px] font-bold text-theme-fg">Developer integrations</p>
              <p className="mt-0.5 text-[10px] font-medium text-theme-muted">
                API keys & webhooks — skip unless a developer sets this up
              </p>
            </div>
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-theme-muted transition ${devOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {devOpen && (
            <div className="space-y-4 border-t border-theme-border px-4 py-4">
              {devLoading ? (
                <SettingsTabSkeleton variant="compact" />
              ) : (
                <>
                  <section>
                    <div className="mb-2 flex items-center gap-2">
                      <Key className="h-4 w-4 text-theme-muted" />
                      <h3 className="text-[12px] font-bold text-theme-fg">API keys</h3>
                    </div>
                    <p className="mb-2 text-[10px] text-theme-secondary">
                      For Zapier, CRM, or custom software. Not needed for Inbox or campaigns.
                    </p>
                    <div className="flex gap-2">
                      <AppInput
                        value={newKeyName}
                        onChange={(e) => setNewKeyName(e.target.value)}
                        placeholder="Key name"
                        className="min-w-0 flex-1"
                      />
                      <AppButton size="sm" onClick={() => void createKey()}>
                        Create
                      </AppButton>
                    </div>
                    {keys.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {keys.map((k) => (
                          <div
                            key={k.id}
                            className="flex items-center justify-between rounded-lg border border-theme-border/80 px-2.5 py-1.5 text-[11px]"
                          >
                            <span>
                              <strong>{k.name}</strong>
                              <span className="text-theme-muted"> · {k.keyPrefix}…</span>
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                integrationsApi
                                  .revokeKey(k.id)
                                  .then(loadDeveloperData)
                                  .catch(() => toastError('Could not remove'))
                              }
                              className="text-red-600"
                              aria-label={`Remove ${k.name}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>

                  <section className="border-t border-theme-border/60 pt-4">
                    <div className="mb-2 flex items-center gap-2">
                      <Webhook className="h-4 w-4 text-theme-muted" />
                      <h3 className="text-[12px] font-bold text-theme-fg">Webhooks</h3>
                    </div>
                    <p className="mb-2 text-[10px] text-theme-secondary">
                      Push events (new message, new contact) to your server. Requires a developer.
                    </p>
                    <AppInput
                      label="URL"
                      value={newWebhookUrl}
                      onChange={(e) => setNewWebhookUrl(e.target.value)}
                      placeholder="https://your-server.com/hooks/samyoj"
                    />
                    <div className="mt-2 flex flex-wrap gap-x-2 gap-y-1">
                      {events.map((ev) => (
                        <label key={ev} className="flex items-center gap-1 text-[10px] text-theme-secondary">
                          <input
                            type="checkbox"
                            checked={selectedEvents.includes(ev)}
                            onChange={(e) =>
                              setSelectedEvents((prev) =>
                                e.target.checked ? [...prev, ev] : prev.filter((x) => x !== ev)
                              )
                            }
                          />
                          {eventLabel(ev)}
                        </label>
                      ))}
                    </div>
                    <AppButton className="mt-2" size="sm" onClick={() => void createWebhook()}>
                      Add webhook
                    </AppButton>
                    {webhooks.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {webhooks.map((w) => (
                          <div key={w.id} className="rounded-lg border border-theme-border/80 px-2.5 py-2 text-[11px]">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="truncate font-semibold">{w.url}</p>
                                <p className="text-theme-muted">{w.events.map(eventLabel).join(', ')}</p>
                              </div>
                              <AppButton size="sm" variant="secondary" onClick={() => void loadDeliveries(w.id)}>
                                {expandedWebhookId === w.id ? 'Hide' : 'Log'}
                              </AppButton>
                            </div>
                            {expandedWebhookId === w.id && (
                              <div className="mt-2 border-t border-theme-border/60 pt-2">
                                {deliveriesLoading ? (
                                  <p className="text-[10px] text-theme-muted">Loading…</p>
                                ) : deliveries.length === 0 ? (
                                  <p className="text-[10px] text-theme-muted">No deliveries yet</p>
                                ) : (
                                  <ul className="max-h-32 space-y-1 overflow-y-auto">
                                    {deliveries.map((d) => (
                                      <li
                                        key={d.id}
                                        className="flex items-center justify-between gap-2 rounded bg-theme-subtle/50 px-2 py-1 text-[10px]"
                                      >
                                        <span>
                                          {eventLabel(d.event)} ·{' '}
                                          <strong
                                            className={
                                              d.status === 'FAILED' ? 'text-red-600' : 'text-emerald-700'
                                            }
                                          >
                                            {d.status}
                                          </strong>
                                        </span>
                                        {d.status === 'FAILED' && (
                                          <button
                                            type="button"
                                            className="inline-flex items-center gap-0.5 font-semibold text-sky-700"
                                            onClick={() => void replayDelivery(d.id)}
                                          >
                                            <RefreshCw className="h-3 w-3" />
                                            Retry
                                          </button>
                                        )}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
