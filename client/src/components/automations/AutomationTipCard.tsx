import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

interface AutomationTipCardProps {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
}

export default function AutomationTipCard({ icon: Icon, title, children }: AutomationTipCardProps) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-violet-200/50 bg-violet-50/40 px-3.5 py-2.5 dark:border-violet-500/20 dark:bg-violet-950/20">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-violet-600 dark:text-violet-400" strokeWidth={2} />
      <p className="min-w-0 text-[12px] leading-relaxed text-theme-secondary">
        <span className="font-bold text-theme-fg">{title}</span>
        {' — '}
        {children}
      </p>
    </div>
  );
}

export function AiBotLink() {
  return (
    <Link to="/ai-bot" className="font-bold text-violet-700 underline underline-offset-2 dark:text-violet-300">
      AI Bots
    </Link>
  );
}
