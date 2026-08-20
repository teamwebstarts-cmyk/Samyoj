import { Check, Sparkles, X, Zap } from 'lucide-react';
import AppButton from '../ui/AppButton';

interface UnlockGrowthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpgrade: () => void;
  title?: string;
  description?: string;
  targetTier?: 'growth' | 'pro';
}

export default function UnlockGrowthModal({
  isOpen,
  onClose,
  onUpgrade,
  title = 'Unlock Growth & Scale Faster',
  description = 'Remove limits, automate customer conversations with AI, and connect more WhatsApp numbers.',
  targetTier = 'growth',
}: UnlockGrowthModalProps) {
  if (!isOpen) return null;

  const isGrowth = targetTier === 'growth';

  const features = isGrowth
    ? [
        '2 WhatsApp Connected Numbers',
        '10 Team Member Seats',
        '25,000 Contacts Limit',
        'Unlimited Published Automations & Flows',
        'AI Assistant & AI Chatbots Included',
        'Advanced Analytics & Priority Support',
      ]
    : [
        '5 WhatsApp Connected Numbers',
        '25 Team Member Seats',
        '100,000 Contacts Limit',
        'Full AI & Voice Calling Module Included',
        'Advanced Integrations & Custom Webhooks',
        'Dedicated Priority Support',
      ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-violet-200/80 bg-white p-6 shadow-2xl dark:border-violet-900/60 dark:bg-slate-900 sm:p-8 animate-fade-up">
        {/* Accent glow */}
        <div
          className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-violet-400/20 blur-3xl"
          aria-hidden="true"
        />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header Badge & Title */}
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-violet-700 ring-1 ring-violet-200/80 dark:bg-violet-950/50 dark:text-violet-300 dark:ring-violet-800/60">
            <Sparkles className="h-3 w-3" />
            {isGrowth ? 'Most Popular Upgrade' : 'Power User Tier'}
          </span>
        </div>

        <h2 className="mt-3 text-xl font-extrabold tracking-tight text-neutral-900 dark:text-white sm:text-2xl">
          {title}
        </h2>
        <p className="mt-1.5 text-sm text-neutral-600 dark:text-slate-300">
          {description}
        </p>

        {/* Pricing Highlight */}
        <div className="mt-5 rounded-xl border border-violet-100 bg-violet-50/50 p-4 dark:border-violet-900/40 dark:bg-violet-950/20">
          <div className="flex items-baseline justify-between">
            <div>
              <span className="text-2xl font-extrabold text-violet-700 dark:text-violet-300">
                {isGrowth ? '₹2,499' : '₹4,999'}
              </span>
              <span className="text-xs font-semibold text-neutral-500 dark:text-slate-400">
                /month + GST
              </span>
            </div>
            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-bold text-violet-700 dark:bg-violet-900/60 dark:text-violet-300">
              {isGrowth ? 'Growth Plan' : 'Pro Plan'}
            </span>
          </div>
        </div>

        {/* Features Checklist */}
        <ul className="mt-5 space-y-2.5">
          {features.map((feature) => (
            <li key={feature} className="flex items-start gap-2.5 text-sm text-neutral-700 dark:text-slate-200">
              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300">
                <Check className="h-2.5 w-2.5 stroke-[3]" />
              </span>
              <span className="font-medium">{feature}</span>
            </li>
          ))}
        </ul>

        {/* CTAs */}
        <div className="mt-7 flex flex-col gap-2.5 sm:flex-row">
          <AppButton
            variant="primary"
            className="flex-1 !bg-violet-600 hover:!bg-violet-700 text-white shadow-md shadow-violet-500/20"
            icon={<Zap className="h-4 w-4" />}
            onClick={() => {
              onUpgrade();
              onClose();
            }}
          >
            Upgrade to {isGrowth ? 'Growth' : 'Pro'}
          </AppButton>
          <AppButton
            variant="secondary"
            onClick={onClose}
          >
            Maybe later
          </AppButton>
        </div>
      </div>
    </div>
  );
}
