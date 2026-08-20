import { MessageCircleQuestion } from 'lucide-react';
import { FOCUS_RING_CLASS } from '../../hooks/inboxA11y';
import { SUPPORT_STARTER_PROMPTS } from './prompts';

interface SupportWelcomeProps {
  disabled: boolean;
  onAsk: (question: string) => void;
}

export default function SupportWelcome({ disabled, onAsk }: SupportWelcomeProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-sky-100/90 bg-gradient-to-br from-sky-50/90 via-white to-blue-50/50 px-4 py-3.5 dark:border-sky-900/40 dark:from-sky-950/30 dark:via-theme-surface dark:to-blue-950/20">
        <p className="text-[15px] font-extrabold tracking-tight text-theme-fg">What do you need help with?</p>
        <p className="mt-1 text-[12.5px] font-medium leading-relaxed text-theme-secondary">
          Ask in your own words, or tap one of these common questions.
        </p>
      </div>

      <ul className="flex flex-col gap-2">
        {SUPPORT_STARTER_PROMPTS.map((prompt) => (
          <li key={prompt.id}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onAsk(prompt.question)}
              className={`flex w-full items-start gap-3 rounded-xl border border-theme-border bg-theme-surface px-3.5 py-3 text-left shadow-sm transition hover:border-sky-300/90 hover:bg-sky-50/80 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:border-sky-600/40 dark:hover:bg-sky-950/30 ${FOCUS_RING_CLASS}`}
            >
              <span
                className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700 ring-1 ring-sky-200/80 dark:bg-sky-950/50 dark:text-sky-300 dark:ring-sky-800/60"
                aria-hidden
              >
                <MessageCircleQuestion className="h-4 w-4" strokeWidth={2.1} />
              </span>
              <span className="min-w-0 text-[13px] font-semibold leading-snug text-theme-fg">
                {prompt.label}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
