import { useState } from 'react';
import {
  Bot,
  Check,
  ChevronDown,
  ChevronUp,
  Headphones,
  Layers,
  MessageSquare,
  Minus,
  PhoneCall,
  ShieldCheck,
  Sparkles,
  Users,
  Zap,
} from 'lucide-react';
import type { PlanTier } from '../../types';

interface MatrixRow {
  name: string;
  tooltip?: string;
  values: Record<PlanTier, string | boolean>;
}

interface MatrixCategory {
  title: string;
  icon: typeof MessageSquare;
  rows: MatrixRow[];
}

const COMPARISON_CATEGORIES: MatrixCategory[] = [
  {
    title: 'WhatsApp & Messaging',
    icon: MessageSquare,
    rows: [
      {
        name: 'WhatsApp Numbers Connected',
        tooltip: 'Cloud API phone number slots connected inside Samyoj',
        values: {
          launch: '1 number',
          starter: '1 number',
          growth: '2 numbers',
          pro: '5 numbers',
          enterprise: 'Unlimited (Custom)',
        },
      },
      {
        name: 'Shared Team Inbox',
        values: { launch: true, starter: true, growth: true, pro: true, enterprise: true },
      },
      {
        name: 'Canned & Quick Replies',
        values: { launch: 'Basic', starter: 'Unlimited', growth: 'Unlimited', pro: 'Unlimited', enterprise: 'Unlimited' },
      },
      {
        name: 'Interactive Message Templates',
        values: { launch: true, starter: true, growth: true, pro: true, enterprise: true },
      },
      {
        name: 'Template Approval Sync',
        values: { launch: true, starter: true, growth: true, pro: true, enterprise: true },
      },
    ],
  },
  {
    title: 'Team & Scale',
    icon: Users,
    rows: [
      {
        name: 'Included Seats',
        tooltip: 'Active team member accounts with role-based permissions',
        values: {
          launch: '1 seat',
          starter: '3 seats',
          growth: '10 seats',
          pro: '25 seats',
          enterprise: 'Custom (Unlimited)',
        },
      },
      {
        name: 'Role-based Access Control',
        values: { launch: false, starter: 'Owner, Admin', growth: 'Full Custom Matrix', pro: 'Full Custom Matrix', enterprise: 'Full Custom Matrix + SSO' },
      },
      {
        name: 'Shift Schedules & Round-Robin',
        values: { launch: false, starter: true, growth: true, pro: true, enterprise: true },
      },
      {
        name: 'Audit Logs & Security',
        values: { launch: false, starter: '7 days', growth: '90 days', pro: '1 year', enterprise: 'Unlimited' },
      },
    ],
  },
  {
    title: 'Contacts & CRM',
    icon: Layers,
    rows: [
      {
        name: 'Contact Storage Quota',
        values: {
          launch: '100 contacts',
          starter: '5,000 contacts',
          growth: '25,000 contacts',
          pro: '100,000 contacts',
          enterprise: 'Unlimited',
        },
      },
      {
        name: 'Custom Attributes & Notes',
        values: { launch: 'Up to 5', starter: 'Unlimited', growth: 'Unlimited', pro: 'Unlimited', enterprise: 'Unlimited' },
      },
      {
        name: 'CSV Bulk Contact Import',
        values: { launch: false, starter: true, growth: true, pro: true, enterprise: true },
      },
      {
        name: 'Marketing Opt-In Consent Tracking',
        values: { launch: true, starter: true, growth: true, pro: true, enterprise: true },
      },
    ],
  },
  {
    title: 'Automation & Workflows',
    icon: Zap,
    rows: [
      {
        name: 'Active Workflows & Flows',
        values: {
          launch: '1 workflow',
          starter: '5 workflows',
          growth: 'Unlimited',
          pro: 'Unlimited',
          enterprise: 'Unlimited',
        },
      },
      {
        name: 'Drag-and-Drop Flow Builder',
        values: { launch: true, starter: true, growth: true, pro: true, enterprise: true },
      },
      {
        name: 'Keyword & Away Triggers',
        values: { launch: true, starter: true, growth: true, pro: true, enterprise: true },
      },
      {
        name: 'Webhooks & External Integrations',
        values: { launch: false, starter: 'Basic', growth: 'Advanced (Zapier, Sheets)', pro: 'Full Custom Webhooks + API', enterprise: 'Custom ETL + ERP' },
      },
    ],
  },
  {
    title: 'AI Bot & Copilot Engine',
    icon: Bot,
    rows: [
      {
        name: 'AI Chatbot Status',
        values: {
          launch: false,
          starter: false,
          growth: 'Included (Copilot & Bots)',
          pro: 'Advanced Agent',
          enterprise: 'Dedicated Fine-Tuned AI',
        },
      },
      {
        name: 'Monthly AI Token Allowance',
        tooltip: 'Tokens used for generative AI replies, embeddings, and chat suggestions',
        values: {
          launch: '—',
          starter: '—',
          growth: '100,000 tokens/mo',
          pro: '500,000 tokens/mo',
          enterprise: 'Dedicated Pool (Unlimited)',
        },
      },
      {
        name: 'Knowledge Base PDF / Doc Embeddings',
        values: { launch: false, starter: false, growth: 'Up to 25 documents', pro: 'Up to 100 documents', enterprise: 'Unlimited Vector DB' },
      },
      {
        name: 'Sarvam Indian Multilingual Brain',
        tooltip: 'Optimized for Hindi, Hinglish, Tamil, Telugu, Marathi, Bengali & 10+ Indian languages',
        values: { launch: false, starter: false, growth: true, pro: true, enterprise: true },
      },
      {
        name: 'Human Agent Takeover & Escalation',
        values: { launch: false, starter: false, growth: true, pro: true, enterprise: true },
      },
    ],
  },
  {
    title: 'AI Voice Calling Module',
    icon: PhoneCall,
    rows: [
      {
        name: 'Voice Calling Interface',
        tooltip: 'WebRTC in-browser softphone and live agent dialer',
        values: {
          launch: false,
          starter: false,
          growth: 'Optional Add-on',
          pro: 'Full Included Module',
          enterprise: 'High-Throughput Trunking',
        },
      },
      {
        name: 'AI Voice Calling Agent',
        tooltip: 'Autonomous voice agent powered by Sarvam fast STT & TTS',
        values: { launch: false, starter: false, growth: false, pro: true, enterprise: true },
      },
      {
        name: 'Inbound Auto-Answer & Routing',
        values: { launch: false, starter: false, growth: false, pro: true, enterprise: true },
      },
      {
        name: 'Call Recording & Consent Gate',
        values: { launch: false, starter: false, growth: false, pro: true, enterprise: true },
      },
    ],
  },
  {
    title: 'Meta Cloud API Ledger & Rules',
    icon: ShieldCheck,
    rows: [
      {
        name: 'Meta API Invoicing Model',
        values: {
          launch: 'Direct to Meta WABA',
          starter: 'Direct to Meta WABA',
          growth: 'Direct to Meta WABA',
          pro: 'Direct to Meta WABA',
          enterprise: 'Direct or Solution Partner',
        },
      },
      {
        name: 'Customer Service Window (24h)',
        tooltip: 'Inbound user messages are 100% free; replies are free until Oct 1, 2026',
        values: { launch: true, starter: true, growth: true, pro: true, enterprise: true },
      },
    ],
  },
  {
    title: 'Support & SLAs',
    icon: Headphones,
    rows: [
      {
        name: 'Support Channel',
        values: {
          launch: 'Community & Docs',
          starter: 'Email Support (24h SLA)',
          growth: 'Priority Email + Chat (6h SLA)',
          pro: 'Priority Direct WhatsApp + Phone (1h SLA)',
          enterprise: 'Dedicated Account Manager + 15m SLA',
        },
      },
      {
        name: 'Onboarding & Migration Assistance',
        values: { launch: false, starter: 'Self-serve', growth: 'Assisted Setup', pro: '1-on-1 Guided Onboarding', enterprise: 'Custom White-Glove' },
      },
    ],
  },
];

const TIERS: { id: PlanTier; name: string; tag?: string }[] = [
  { id: 'launch', name: 'Launch', tag: 'Trial' },
  { id: 'starter', name: 'Starter' },
  { id: 'growth', name: 'Growth', tag: 'Popular' },
  { id: 'pro', name: 'Pro' },
  { id: 'enterprise', name: 'Enterprise' },
];

export default function BillingFeatureMatrix({
  currentPlan,
}: {
  currentPlan?: string;
}) {
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({
    'WhatsApp & Messaging': true,
    'Team & Scale': true,
    'Contacts & CRM': true,
    'Automation & Workflows': true,
    'AI Bot & Copilot Engine': true,
    'AI Voice Calling Module': true,
    'Meta Cloud API Ledger & Rules': false,
    'Support & SLAs': false,
  });

  const toggleCategory = (title: string) => {
    setOpenCategories((prev) => ({ ...prev, [title]: !prev[title] }));
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="border-b border-neutral-200/80 p-5 sm:p-6 dark:border-slate-800">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400">
                <Sparkles className="h-3.5 w-3.5" />
              </span>
              <h2 className="text-lg font-extrabold tracking-tight text-neutral-900 dark:text-white sm:text-xl">
                Compare All Features & Limits
              </h2>
            </div>
            <p className="mt-1 text-xs text-neutral-500 dark:text-slate-400">
              Clear breakdown of seats, contacts, AI engines, calling modules, and quotas across every tier.
            </p>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-neutral-200/80 bg-neutral-50/75 dark:border-slate-800 dark:bg-slate-950/40">
              <th className="w-1/3 p-4 pl-6 font-bold text-neutral-600 dark:text-slate-300">
                Capability / Resource
              </th>
              {TIERS.map((tier) => {
                const isCurrent = currentPlan === tier.id;
                const isGrowth = tier.id === 'growth';
                return (
                  <th
                    key={tier.id}
                    className={`p-4 text-center font-bold ${
                      isCurrent
                        ? 'bg-emerald-500/5 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                        : isGrowth
                          ? 'bg-violet-500/5 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300'
                          : 'text-neutral-900 dark:text-white'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-sm font-extrabold">{tier.name}</span>
                      {tier.tag && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                            tier.tag === 'Popular'
                              ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/60 dark:text-violet-300'
                              : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                          }`}
                        >
                          {tier.tag}
                        </span>
                      )}
                      {isCurrent && (
                        <span className="mt-0.5 rounded-full bg-emerald-500/20 px-1.5 py-0.2 text-[8px] font-bold uppercase text-emerald-700 dark:text-emerald-300">
                          Current
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-slate-800/60">
            {COMPARISON_CATEGORIES.map((category) => {
              const isOpen = openCategories[category.title] ?? true;
              const Icon = category.icon;
              return (
                <tbody key={category.title} className="divide-y divide-neutral-100 dark:divide-slate-800/60">
                  <tr className="bg-neutral-50/50 hover:bg-neutral-100/50 dark:bg-slate-950/20 dark:hover:bg-slate-950/40 transition-colors">
                    <td
                      colSpan={6}
                      className="p-3 pl-6 font-extrabold text-neutral-800 dark:text-slate-200 cursor-pointer select-none"
                      onClick={() => toggleCategory(category.title)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                          <span>{category.title}</span>
                          <span className="rounded-full bg-neutral-200/60 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-600 dark:bg-slate-800 dark:text-slate-400">
                            {category.rows.length}
                          </span>
                        </div>
                        {isOpen ? (
                          <ChevronUp className="h-4 w-4 text-neutral-400" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-neutral-400" />
                        )}
                      </div>
                    </td>
                  </tr>
                  {isOpen &&
                    category.rows.map((row) => (
                      <tr
                        key={row.name}
                        className="hover:bg-neutral-50/50 dark:hover:bg-slate-800/20 transition-colors"
                      >
                        <td className="p-3.5 pl-8 font-medium text-neutral-700 dark:text-slate-300">
                          <div className="flex flex-col">
                            <span>{row.name}</span>
                            {row.tooltip && (
                              <span className="text-[10px] text-neutral-400 dark:text-slate-500">
                                {row.tooltip}
                              </span>
                            )}
                          </div>
                        </td>
                        {TIERS.map((tier) => {
                          const val = row.values[tier.id];
                          const isCurrent = currentPlan === tier.id;
                          return (
                            <td
                              key={tier.id}
                              className={`p-3.5 text-center font-medium ${
                                isCurrent
                                  ? 'bg-emerald-500/5 dark:bg-emerald-500/10 text-emerald-900 dark:text-emerald-200'
                                  : 'text-neutral-700 dark:text-slate-300'
                              }`}
                            >
                              {typeof val === 'boolean' ? (
                                val ? (
                                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                                    <Check className="h-2.5 w-2.5 stroke-[3]" />
                                  </span>
                                ) : (
                                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-neutral-100 text-neutral-400 dark:bg-slate-800 dark:text-slate-600">
                                    <Minus className="h-2.5 w-2.5 stroke-[2]" />
                                  </span>
                                )
                              ) : (
                                <span
                                  className={
                                    val.includes('Included') || val.includes('Unlimited')
                                      ? 'font-bold text-violet-700 dark:text-violet-300'
                                      : ''
                                  }
                                >
                                  {val}
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                </tbody>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
