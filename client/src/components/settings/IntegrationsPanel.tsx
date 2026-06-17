import { useEffect, useState } from 'react';
import { Copy, Key, Trash2, Webhook } from 'lucide-react';
import AppButton from '../ui/AppButton';
import AppInput from '../ui/AppInput';
import SectionCard from '../ui/SectionCard';
import { complianceApi, integrationsApi } from '../../services/api';
import type { ApiKeyItem, WebhookEndpoint } from '../../types';
import { toastError, toastSuccess } from '../../utils/toast';

const eventLabels: Record<string, string> = {
  'message.received': 'New message received',
  'message.sent': 'Message sent',
  'message.delivered': 'Message delivered',
  'message.read': 'Message read',
  'message.failed': 'Message failed to send',
  'contact.created': 'New contact added',
  'contact.updated': 'Contact updated',
};

function eventLabel(event: string): string {
  return eventLabels[event] || event.replace(/\./g, ' · ').replace(/_/g, ' ');
}

export default function IntegrationsPanel() {
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookEndpoint[]>([]);
  const [events, setEvents] = useState<string[]>([]);
  const [newKeyName, setNewKeyName] = useState('');
  const [newWebhookUrl, setNewWebhookUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>(['message.received']);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const load = () => {
    Promise.all([integrationsApi.listKeys(), integrationsApi.listWebhooks()])
      .then(([keysRes, hooksRes]) => {
        setKeys(keysRes.data.data.keys);
        setWebhooks(hooksRes.data.data.endpoints);
        setEvents(hooksRes.data.data.availableEvents);
      })
      .catch(() => toastError('Failed to load integrations'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const createKey = async () => {
    if (!newKeyName.trim()) return;
    try {
      const { data } = await integrationsApi.createKey(newKeyName.trim());
      await navigator.clipboard.writeText(data.data.key);
      toastSuccess('Connection key created and copied');
      setNewKeyName('');
      load();
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
      toastSuccess('Notification set up — security key copied');
      setNewWebhookUrl('');
      load();
    } catch {
      toastError('Failed to set up notification');
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await complianceApi.exportData();
      const url = URL.createObjectURL(blob as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `data-export-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toastSuccess('Your data download started');
    } catch {
      toastError('Download failed');
    } finally {
      setExporting(false);
    }
  };

  if (loading) return <p className="text-[13px] text-theme-muted">Loading...</p>;

  return (
    <div className="space-y-5">
      <SectionCard
        title="Connect other apps"
        subtitle="For Zapier, your website, or custom tools. Ask a developer if you're not sure."
      >
        <div className="flex flex-wrap gap-2">
          <AppInput
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder="Key name (e.g. Zapier)"
            className="min-w-[200px] flex-1"
          />
          <AppButton size="sm" icon={<Key className="h-4 w-4" />} onClick={() => void createKey()}>
            Create key
          </AppButton>
        </div>
        <div className="mt-3 space-y-2">
          {keys.map((k) => (
            <div
              key={k.id}
              className="flex items-center justify-between rounded-xl border border-theme-border px-3 py-2 text-[12px]"
            >
              <span>
                <strong>{k.name}</strong> · {k.keyPrefix}...
              </span>
              <button
                type="button"
                onClick={() =>
                  integrationsApi.revokeKey(k.id).then(load).catch(() => toastError('Could not remove key'))
                }
                className="text-red-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="App notifications" subtitle="Get notified in your other software when something happens">
        <AppInput
          label="Notification URL"
          value={newWebhookUrl}
          onChange={(e) => setNewWebhookUrl(e.target.value)}
          placeholder="https://your-app.com/notifications"
        />
        <div className="mt-2 flex flex-wrap gap-2">
          {events.map((ev) => (
            <label key={ev} className="flex items-center gap-1.5 text-[12px]">
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
        <AppButton
          className="mt-3"
          size="sm"
          icon={<Webhook className="h-4 w-4" />}
          onClick={() => void createWebhook()}
        >
          Add notification
        </AppButton>
        <div className="mt-3 space-y-2">
          {webhooks.map((w) => (
            <div key={w.id} className="rounded-xl border border-theme-border px-3 py-2 text-[12px]">
              <p className="font-semibold break-all">{w.url}</p>
              <p className="text-theme-muted">{w.events.map(eventLabel).join(', ')}</p>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Download my data" subtitle="Get a copy of your contacts, messages, and settings">
        <AppButton size="sm" loading={exporting} icon={<Copy className="h-4 w-4" />} onClick={() => void handleExport()}>
          Download my data
        </AppButton>
      </SectionCard>
    </div>
  );
}
