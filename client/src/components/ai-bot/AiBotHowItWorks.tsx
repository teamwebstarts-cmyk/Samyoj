import { BookOpen, Bot, MessageSquare, Sparkles } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const steps: Array<{
  step: string;
  title: string;
  description: string;
  icon: LucideIcon;
  accent: string;
  iconBg: string;
}> = [
  {
    step: '01',
    title: 'Configure your bot',
    description: 'Set instructions, tone, and when the bot should reply — default bot handles all messages.',
    icon: Bot,
    accent: 'from-violet-500/10 via-theme-surface to-indigo-500/5 border-violet-200/60 dark:border-violet-500/25',
    iconBg:
      'bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-[0_4px_14px_rgba(99,102,241,0.35)]',
  },
  {
    step: '02',
    title: 'Add knowledge',
    description: 'Upload FAQs, import your website, or add PDFs so answers stay accurate and on-brand.',
    icon: BookOpen,
    accent: 'from-sky-500/10 via-theme-surface to-blue-500/5 border-sky-200/60 dark:border-sky-500/25',
    iconBg: 'bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-[0_4px_14px_rgba(14,165,233,0.3)]',
  },
  {
    step: '03',
    title: 'Go live on WhatsApp',
    description: 'Turn the bot ON — customers get instant AI replies. Hand off to humans anytime from Inbox.',
    icon: MessageSquare,
    accent: 'from-emerald-500/10 via-theme-surface to-teal-500/5 border-emerald-200/60 dark:border-emerald-500/25',
    iconBg:
      'bg-gradient-to-br from-whatsapp-500 to-emerald-600 text-white shadow-[0_4px_14px_rgba(37,211,102,0.35)]',
  },
];

export default function AiBotHowItWorks() {
  return (
    <section className="dashboard-card overflow-hidden p-0">
      <div className="border-b border-theme-border bg-theme-subtle/50 px-4 py-4 sm:px-5">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-[14px] font-extrabold tracking-tight text-theme-fg">How AI auto-reply works</h3>
            <p className="text-[12px] font-medium text-theme-secondary">Three steps to automate customer conversations</p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 p-4 sm:grid-cols-3 sm:gap-4 sm:p-5">
        {steps.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.step}
              className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br p-4 ${item.accent}`}
            >
              <span className="absolute right-3 top-2 text-[2.5rem] font-black leading-none text-theme-fg/5">
                {item.step}
              </span>
              <div className={`relative flex h-10 w-10 items-center justify-center rounded-xl ${item.iconBg}`}>
                <Icon className="h-4 w-4" strokeWidth={2.25} />
              </div>
              <p className="relative mt-3 text-[13px] font-extrabold text-theme-fg">{item.title}</p>
              <p className="relative mt-1.5 text-[12px] font-medium leading-relaxed text-theme-secondary">
                {item.description}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
