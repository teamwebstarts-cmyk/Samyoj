import { useEffect, useState } from 'react';
import {
  SlidersHorizontal,
  LayoutGrid,
  Eye,
  EyeOff,
  MessageSquare,
  Phone,
  Bot,
  Workflow,
  Send,
  ClipboardList,
  Package,
  UserPlus,
  Ticket,
  UsersRound,
  CreditCard,
  Code,
} from 'lucide-react';
import SettingsPanel from './SettingsPanel';
import AppButton from '../ui/AppButton';
import { settingsApi } from '../../services/api';
import { toastError, toastSuccess } from '../../utils/toast';

interface ModuleOption {
  id: string;
  name: string;
  description: string;
  icon: typeof LayoutGrid;
  category: 'core' | 'growth' | 'admin';
}

const CRM_MODULES: ModuleOption[] = [
  {
    id: '/inbox',
    name: 'Unified Inbox',
    description: 'Real-time multi-agent customer chat management',
    icon: MessageSquare,
    category: 'core',
  },
  {
    id: '/contacts',
    name: 'Contacts & Audiences',
    description: 'Customer contact directory, tags, and custom attributes',
    icon: UserPlus,
    category: 'core',
  },
  {
    id: '/calls',
    name: 'Voice Calls',
    description: 'Outbound voice broadcasting and AI voice agents',
    icon: Phone,
    category: 'growth',
  },
  {
    id: '/ai-bot',
    name: 'AI Bots & Studio',
    description: 'Knowledge base training, FAQ bots, and smart replies',
    icon: Bot,
    category: 'growth',
  },
  {
    id: '/automations',
    name: 'Flow Automations',
    description: 'Visual drag-and-drop conversational workflows',
    icon: Workflow,
    category: 'growth',
  },
  {
    id: '/campaigns',
    name: 'Broadcast Campaigns',
    description: 'Bulk broadcast scheduling, lists, and Meta template dispatches',
    icon: Send,
    category: 'growth',
  },
  {
    id: '/templates',
    name: 'Meta Templates',
    description: 'WhatsApp Cloud API pre-approved message templates',
    icon: ClipboardList,
    category: 'growth',
  },
  {
    id: '/tickets',
    name: 'Support Tickets',
    description: 'Customer issue resolution and support ticket queues',
    icon: Ticket,
    category: 'core',
  },
  {
    id: '/commerce',
    name: 'Commerce & Orders',
    description: 'Catalog products, cart management, and payment links',
    icon: Package,
    category: 'growth',
  },
  {
    id: '/team',
    name: 'Team & Agents',
    description: 'Agent seats, role permissions, and workload routing',
    icon: UsersRound,
    category: 'admin',
  },
  {
    id: '/billing',
    name: 'Billing & Quotas',
    description: 'Subscription plans, invoices, and Meta wallet balance',
    icon: CreditCard,
    category: 'admin',
  },
];

export default function AdminUiTogglesPanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hiddenModules, setHiddenModules] = useState<string[]>([]);
  const [hiddenSettingsTabs, setHiddenSettingsTabs] = useState<string[]>([]);

  const load = () => {
    setLoading(true);
    settingsApi
      .getUiToggles()
      .then(({ data }) => {
        setHiddenModules(data.data.hiddenModules || []);
        setHiddenSettingsTabs(data.data.hiddenSettingsTabs || []);
      })
      .catch(() => toastError('Could not load UI feature toggles'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const toggleModule = (id: string) => {
    setHiddenModules((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  };

  const toggleSettingsTab = (tabId: string) => {
    setHiddenSettingsTabs((prev) =>
      prev.includes(tabId) ? prev.filter((t) => t !== tabId) : [...prev, tabId]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await settingsApi.updateUiToggles({ hiddenModules, hiddenSettingsTabs });
      toastSuccess('CRM visibility settings saved successfully');
    } catch {
      toastError('Failed to save visibility settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="h-64 animate-pulse rounded-2xl bg-theme-subtle/60" />;
  }

  return (
    <div className="space-y-6">
      <SettingsPanel
        title="Admin CRM Module Visibility"
        description="Toggle on/off modules on the sidebar and navigation for team members."
        icon={SlidersHorizontal}
        accent="indigo"
        footer={
          <div className="flex items-center justify-between gap-4">
            <p className="text-[12px] font-medium text-theme-muted">
              Hidden modules will not appear in the primary sidebar navigation.
            </p>
            <AppButton loading={saving} onClick={handleSave}>
              Save visibility preferences
            </AppButton>
          </div>
        }
      >
        <div className="space-y-3">
          {CRM_MODULES.map((mod) => {
            const isHidden = hiddenModules.includes(mod.id);
            const Icon = mod.icon;
            return (
              <div
                key={mod.id}
                onClick={() => toggleModule(mod.id)}
                className={`flex cursor-pointer items-center justify-between rounded-2xl border p-4 transition ${
                  !isHidden
                    ? 'border-indigo-200/80 bg-gradient-to-r from-indigo-50/70 to-theme-surface ring-1 ring-indigo-100 dark:border-indigo-900/40 dark:from-indigo-950/30 dark:ring-indigo-900/40'
                    : 'border-theme-border bg-theme-subtle/40 opacity-70 hover:opacity-100'
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                      !isHidden
                        ? 'bg-indigo-100/90 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-300'
                        : 'bg-theme-surface text-theme-muted'
                    }`}
                  >
                    <Icon size={19} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-[13px] font-bold text-theme-fg">{mod.name}</p>
                      <span className="font-mono text-[11px] text-theme-muted">{mod.id}</span>
                    </div>
                    <p className="mt-0.5 text-[11px] font-medium text-theme-secondary">
                      {mod.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold ${
                      !isHidden
                        ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-200'
                        : 'bg-theme-surface text-theme-muted ring-1 ring-theme-border'
                    }`}
                  >
                    {!isHidden ? (
                      <>
                        <Eye size={13} />
                        Visible
                      </>
                    ) : (
                      <>
                        <EyeOff size={13} />
                        Hidden
                      </>
                    )}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </SettingsPanel>

      {/* Settings Tabs Visibility */}
      <SettingsPanel
        title="Admin Settings Tabs Visibility"
        description="Hide advanced settings tabs (like Developer APIs) from non-admin team members."
        icon={Code}
        accent="violet"
      >
        <div className="space-y-3">
          {[
            {
              id: 'integrations',
              name: 'Developer APIs & Webhooks Tab',
              desc: 'Hide API tokens and outbound webhooks from non-technical staff.',
            },
            {
              id: 'inbox',
              name: 'Operating Hours & Rules Tab',
              desc: 'Restrict modifying operating schedules to administrators only.',
            },
          ].map((tab) => {
            const isHidden = hiddenSettingsTabs.includes(tab.id);
            return (
              <div
                key={tab.id}
                onClick={() => toggleSettingsTab(tab.id)}
                className={`flex cursor-pointer items-center justify-between rounded-2xl border p-4 transition ${
                  !isHidden
                    ? 'border-violet-200/80 bg-gradient-to-r from-violet-50/70 to-theme-surface ring-1 ring-violet-100 dark:border-violet-900/40 dark:from-violet-950/30 dark:ring-violet-900/40'
                    : 'border-theme-border bg-theme-subtle/40 opacity-70 hover:opacity-100'
                }`}
              >
                <div>
                  <p className="text-[13px] font-bold text-theme-fg">{tab.name}</p>
                  <p className="mt-0.5 text-[11px] font-medium text-theme-secondary">{tab.desc}</p>
                </div>
                <span
                  className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold ${
                    !isHidden
                      ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/60 dark:text-violet-200'
                      : 'bg-theme-surface text-theme-muted ring-1 ring-theme-border'
                  }`}
                >
                  {!isHidden ? <Eye size={13} /> : <EyeOff size={13} />}
                  {!isHidden ? 'Visible to Team' : 'Admins Only'}
                </span>
              </div>
            );
          })}
        </div>
      </SettingsPanel>
    </div>
  );
}
