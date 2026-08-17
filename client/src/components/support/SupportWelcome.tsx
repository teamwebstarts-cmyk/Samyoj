import {
  Bot,
  GraduationCap,
  LayoutTemplate,
  Megaphone,
  MessageCircle,
  Phone,
  Smartphone,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { FOCUS_RING_CLASS } from '../../hooks/inboxA11y';
import { SUPPORT_STARTER_PROMPTS } from './prompts';

const ICONS: Record<string, LucideIcon> = {
  connect: Smartphone,
  'inbox-template': LayoutTemplate,
  'apply-bot': Bot,
  'chat-vs-call': Phone,
  inbound: MessageCircle,
  campaign: Megaphone,
  train: GraduationCap,
  'opt-in': Users,
};

interface SupportWelcomeProps {
  disabled: boolean;
  onAsk: (question: string) => void;
}

export default function SupportWelcome({ disabled, onAsk }: SupportWelcomeProps) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-[15px] font-extrabold tracking-tight text-theme-fg">What can I help with?</p>
        <p className="mt-1 text-[12.5px] font-medium leading-relaxed text-theme-secondary">
          Ask how to use Samyoj — or tap a common question.
        </p>
      </div>

      <div>
        <p className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.14em] text-theme-muted">
          Popular questions
        </p>
        <ul className="grid grid-cols-2 gap-2">
          {SUPPORT_STARTER_PROMPTS.map((prompt) => {
            const Icon = ICONS[prompt.id] || MessageCircle;
            return (
              <li key={prompt.id}>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onAsk(prompt.question)}
                  className={`flex w-full items-start gap-2.5 rounded-xl border border-theme-border bg-theme-surface px-3 py-2.5 text-left shadow-sm transition hover:border-emerald-300/90 hover:bg-emerald-50/70 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:border-emerald-500/35 dark:hover:bg-emerald-950/35 ${FOCUS_RING_CLASS}`}
                >
                  <span
                    className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-whatsapp-700 ring-1 ring-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-900/60"
                    aria-hidden
                  >
                    <Icon className="h-3.5 w-3.5" strokeWidth={2.15} />
                  </span>
                  <span className="min-w-0 pt-0.5 text-[12.5px] font-bold leading-snug text-theme-fg">
                    {prompt.label}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
