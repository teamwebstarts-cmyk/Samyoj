import { Bot, Clock, Smartphone } from 'lucide-react';

const tips = [
  {
    icon: Smartphone,
    title: 'Connect WhatsApp',
    description: 'Link your business number to send and receive messages.',
    accent:
      'from-emerald-500/10 via-white to-teal-500/5 border-emerald-200/60 dark:via-slate-900 dark:border-emerald-800/40',
    iconBg:
      'bg-gradient-to-br from-whatsapp-500 to-emerald-600 text-white shadow-[0_4px_14px_rgba(37,211,102,0.3)]',
  },
  {
    icon: Bot,
    title: 'Set up AI replies',
    description: 'Create a bot that answers common questions for you.',
    accent:
      'from-indigo-500/10 via-white to-violet-500/5 border-indigo-200/60 dark:via-slate-900 dark:border-indigo-800/40',
    iconBg:
      'bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-[0_4px_14px_rgba(99,102,241,0.3)]',
  },
  {
    icon: Clock,
    title: 'Business hours',
    description: 'Set when your team is available for away messages.',
    accent:
      'from-amber-500/10 via-white to-orange-500/5 border-amber-200/60 dark:via-slate-900 dark:border-amber-800/40',
    iconBg:
      'bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-[0_4px_14px_rgba(245,158,11,0.3)]',
  },
] as const;

export default function SettingsInsightCards() {
  return (
    <div className="grid auto-rows-fr gap-3 sm:grid-cols-3">
      {tips.map((tip) => {
        const Icon = tip.icon;
        return (
          <div
            key={tip.title}
            className={`flex items-start gap-3 rounded-2xl border bg-gradient-to-br p-4 sm:gap-4 sm:p-5 ${tip.accent}`}
          >
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl sm:h-11 sm:w-11 ${tip.iconBg}`}
            >
              <Icon className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={2.25} />
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-extrabold tracking-tight text-theme-fg">{tip.title}</p>
              <p className="mt-1 text-[12px] font-medium leading-relaxed text-theme-secondary">
                {tip.description}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
