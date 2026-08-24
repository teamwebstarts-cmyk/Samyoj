import { Fragment, useState } from 'react';
import {
  Bot,
  Check,
  ChevronDown,
  Headphones,
  Layers,
  Minus,
  PhoneCall,
  Sparkles,
  Users,
} from 'lucide-react';
import type { PlanTier } from '../../types';

interface MatrixRow {
  name: string;
  tooltip?: string;
  values: Record<PlanTier, string | boolean>;
}

interface MatrixCategory {
  title: string;
  icon: typeof Layers;
  rows: MatrixRow[];
}

const COMPARISON_CATEGORIES: MatrixCategory[] = [
  {
    title: 'Core Quotas & Scale',
    icon: Layers,
    rows: [
      {
        name: 'WhatsApp Numbers Connected',
        tooltip: 'Cloud API phone number slots connected inside Samyoj',
        values: {
          launch: '1 number',
          starter: '1 number',
          growth: '2 numbers',
          pro: '5 numbers',
          enterprise: 'Custom / Unlimited',
        },
      },
      {
        name: 'Team Seats',
        tooltip: 'Active team member accounts with role permissions',
        values: {
          launch: '1 seat',
          starter: '3 seats',
          growth: '10 seats',
          pro: '25 seats',
          enterprise: 'Custom / Unlimited',
        },
      },
      {
        name: 'Contact Storage Quota',
        tooltip: 'Maximum contacts stored in your workspace CRM',
        values: {
          launch: '100 contacts',
          starter: '5,000 contacts',
          growth: '25,000 contacts',
          pro: '100,000 contacts',
          enterprise: 'Unlimited',
        },
      },
      {
        name: 'Active Workflows & Flows',
        tooltip: 'Automated chatbots and message sequences running simultaneously',
        values: {
          launch: '1 workflow',
          starter: '5 workflows',
          growth: 'Unlimited',
          pro: 'Unlimited',
          enterprise: 'Unlimited',
        },
      },
    ],
  },
  {
    title: 'AI Bot & Copilot Engine',
    icon: Bot,
    rows: [
      {
        name: 'AI Chatbot Assistant',
        tooltip: 'Autonomous AI replying to FAQs and customer queries 24/7',
        values: {
          launch: false,
          starter: false,
          growth: 'Included',
          pro: 'Advanced Multi-Bot',
          enterprise: 'Dedicated Fine-Tuned LLM',
        },
      },
      {
        name: 'Monthly AI Token Allowance',
        tooltip: 'Tokens for AI replies, embeddings, and chat suggestions',
        values: {
          launch: '—',
          starter: '—',
          growth: '100,000 / mo',
          pro: '500,000 / mo',
          enterprise: 'Custom Dedicated Pool',
        },
      },
      {
        name: 'Knowledge Base PDF / Doc Vector Embeddings',
        tooltip: 'Upload manuals, catalogs, and PDFs for the AI to reference',
        values: {
          launch: false,
          starter: false,
          growth: 'Up to 25 docs',
          pro: 'Up to 100 docs',
          enterprise: 'Unlimited Vector DB',
        },
      },
      {
        name: 'Indian Multilingual Brain',
        tooltip: 'Natural responses in Hindi, Hinglish, Tamil, Telugu, Marathi & 10+ Indian languages',
        values: { launch: false, starter: false, growth: true, pro: true, enterprise: true },
      },
    ],
  },
  {
    title: 'AI Voice Calling Module',
    icon: PhoneCall,
    rows: [
      {
        name: 'Browser Softphone & Calling Dialer',
        tooltip: 'WebRTC calling interface to make and receive calls',
        values: {
          launch: false,
          starter: false,
          growth: 'Add-on Available',
          pro: 'Fully Included',
          enterprise: 'High-Throughput Trunking',
        },
      },
      {
        name: 'Autonomous AI Voice Agent',
        tooltip: 'Interactive real-time voice agent powered by fast Indian STT & TTS',
        values: { launch: false, starter: false, growth: false, pro: true, enterprise: true },
      },
      {
        name: 'Call Recording & Transcription',
        values: { launch: false, starter: false, growth: false, pro: true, enterprise: true },
      },
    ],
  },
  {
    title: 'Inbox & Team Collaboration',
    icon: Users,
    rows: [
      {
        name: 'Shared Team Inbox',
        tooltip: 'Collaborative unified multi-agent WhatsApp inbox',
        values: { launch: true, starter: true, growth: true, pro: true, enterprise: true },
      },
      {
        name: 'Role-Based Access Control',
        tooltip: 'Custom operator permissions, agent restrictions, and masking',
        values: {
          launch: false,
          starter: 'Basic Roles',
          growth: 'Custom Roles',
          pro: 'Custom Roles',
          enterprise: 'Custom + SSO (SAML/Okta)',
        },
      },
      {
        name: 'Canned Replies & Quick Actions',
        values: { launch: 'Basic', starter: 'Unlimited', growth: 'Unlimited', pro: 'Unlimited', enterprise: 'Unlimited' },
      },
      {
        name: 'Audit Log Retention',
        values: { launch: '—', starter: '7 days', growth: '90 days', pro: '1 year', enterprise: 'Unlimited retention' },
      },
    ],
  },
  {
    title: 'Support',
    icon: Headphones,
    rows: [
      {
        name: 'Support Channel',
        values: {
          launch: 'Community & Docs',
          starter: 'Email Support (24h)',
          growth: 'Priority Email & Chat (6h)',
          pro: 'WhatsApp & Phone (1h)',
          enterprise: 'Dedicated Manager (15m)',
        },
      },
      {
        name: 'Onboarding & Migration Setup',
        values: {
          launch: false,
          starter: 'Self-serve',
          growth: 'Assisted Setup',
          pro: '1-on-1 Guided Onboarding',
          enterprise: 'White-Glove Migration',
        },
      },
    ],
  },
];

const TIERS: { id: PlanTier; name: string; tag?: string }[] = [
  { id: 'launch', name: 'Kickstart', tag: '14-day trial' },
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
  const [open, setOpen] = useState(false);

  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200/80 bg-white shadow-sm transition-all dark:border-slate-800 dark:bg-slate-900">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={`flex w-full items-center justify-between gap-3 p-4 text-left transition-colors sm:p-6 ${
          open
            ? 'border-b border-neutral-200/80 bg-neutral-50/50 dark:border-slate-800 dark:bg-slate-950/30'
            : 'bg-neutral-50/30 hover:bg-neutral-50/60 dark:bg-slate-950/20 dark:hover:bg-slate-950/40'
        }`}
      >
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400">
            <Sparkles className="h-4 w-4" />
          </span>
          <h2 className="text-base font-bold tracking-tight text-neutral-900 dark:text-white sm:text-lg">
            Compare All Features & Limits
          </h2>
        </div>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-neutral-400 transition-transform duration-200 dark:text-slate-500 ${
            open ? 'rotate-180' : ''
          }`}
          aria-hidden
        />
      </button>

      {open && (
          <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] table-fixed border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-neutral-200/80 bg-neutral-100/60 dark:border-slate-800 dark:bg-slate-950/60">
              <th className="sticky left-0 z-20 w-[25%] p-3.5 pl-6 font-bold text-neutral-600 dark:text-slate-300 bg-neutral-100 dark:bg-slate-950 shadow-[inset_-1px_0_0_0_rgba(0,0,0,0.05)] dark:shadow-[inset_-1px_0_0_0_rgba(255,255,255,0.05)]">
                Feature / Quota
              </th>
              {TIERS.map((tier) => {
                const isCurrent = currentPlan === tier.id;
                const isGrowth = tier.id === 'growth';
                return (
                  <th
                    key={tier.id}
                    className={`p-3.5 text-center font-bold ${
                      isCurrent
                        ? 'bg-emerald-500/5 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                        : isGrowth
                          ? 'bg-violet-500/5 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300'
                          : 'text-neutral-900 dark:text-white'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-xs font-extrabold">{tier.name}</span>
                      {tier.tag && (
                        <span
                          className={`rounded-full px-2 py-0.2 text-[8px] font-bold uppercase tracking-wider ${
                            tier.tag === 'Popular'
                              ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/60 dark:text-violet-300'
                              : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
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
              const Icon = category.icon;
              return (
                <Fragment key={category.title}>
                  {/* Category Header Row */}
                  <tr className="border-t border-neutral-200/70 dark:border-slate-800 bg-neutral-50/60 dark:bg-slate-950/30">
                    <td className="p-0 sticky left-0 z-10 bg-neutral-50 dark:bg-slate-950 shadow-[inset_-1px_0_0_0_rgba(0,0,0,0.05)] dark:shadow-[inset_-1px_0_0_0_rgba(255,255,255,0.05)]">
                      <div className="w-full flex items-center justify-between p-3.5 pl-6 text-left font-bold text-neutral-800 dark:text-slate-200">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-neutral-200/70 text-neutral-700 dark:bg-slate-800 dark:text-slate-300">
                            <Icon className="h-3 w-3" />
                          </span>
                          <span className="text-xs font-bold">{category.title}</span>
                        </div>
                      </div>
                    </td>
                    <td colSpan={5} className="p-0">
                      {/* Empty space that scrolls */}
                    </td>
                  </tr>

                  {/* Feature Rows */}
                  {category.rows.map((row) => (
                      <tr
                        key={row.name}
                        className="group/row hover:bg-neutral-50/60 dark:hover:bg-slate-800/30 transition-colors border-t border-neutral-100 dark:border-slate-800/40"
                      >
                        <td className="sticky left-0 z-10 p-3 pl-8 font-medium text-neutral-700 dark:text-slate-300 bg-white dark:bg-slate-900 group-hover/row:bg-neutral-50/60 dark:group-hover/row:bg-slate-800/90 shadow-[inset_-1px_0_0_0_rgba(0,0,0,0.05)] dark:shadow-[inset_-1px_0_0_0_rgba(255,255,255,0.05)] transition-colors">
                          <div className="flex flex-col">
                            <span className="text-xs font-semibold">{row.name}</span>
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
                              className={`p-3 text-center text-xs font-medium ${
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
                </Fragment>
              );
            })}
          </tbody>
        </table>
          </div>
      )}
    </div>
  );
}
