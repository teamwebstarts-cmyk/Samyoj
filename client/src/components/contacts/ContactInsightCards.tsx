import { MessageSquare, Send, Tag } from 'lucide-react';

const tips = [
  {
    icon: Tag,
    title: 'Segment with tags',
    description: 'Group VIPs, leads, and regions — then target them in campaigns instantly.',
    accent: 'from-violet-500/10 via-white to-purple-500/5 border-violet-200/60 dark:via-slate-900 dark:border-violet-800/40',
    iconBg:
      'bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-[0_4px_14px_rgba(139,92,246,0.35)]',
  },
  {
    icon: MessageSquare,
    title: 'WhatsApp-ready profiles',
    description: 'Inbound chats auto-create contacts with activity history and conversation links.',
    accent: 'from-sky-500/10 via-white to-blue-500/5 border-sky-200/60 dark:via-slate-900 dark:border-sky-800/40',
    iconBg:
      'bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-[0_4px_14px_rgba(14,165,233,0.3)]',
  },
  {
    icon: Send,
    title: 'Campaign audiences',
    description: 'Select contacts in bulk or filter by opt-in status before sending templates.',
    accent: 'from-emerald-500/10 via-white to-teal-500/5 border-emerald-200/60 dark:via-slate-900 dark:border-emerald-800/40',
    iconBg:
      'bg-gradient-to-br from-whatsapp-500 to-emerald-600 text-white shadow-[0_4px_14px_rgba(37,211,102,0.3)]',
  },
] as const;

export default function ContactInsightCards() {
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
