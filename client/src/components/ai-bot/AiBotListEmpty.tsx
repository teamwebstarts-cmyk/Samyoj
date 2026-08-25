import {
  ArrowRight,
  BookOpen,
  Bot,
  MessageSquare,
  PhoneCall,
  PlayCircle,
  Plus,
  Sparkles,
  Volume2,
  Zap,
} from 'lucide-react';
import AppButton from '../ui/AppButton';
import EmptyState from '../ui/EmptyState';

interface AiBotListEmptyProps {
  mode: 'new' | 'filter';
  hasSearch: boolean;
  channel?: 'CHAT' | 'CALL';
  onCreate: () => void;
  canCreate?: boolean;
  onClearFilters: () => void;
}

/** 3-step modern empty hero card matching Campaigns, Automations, and Contacts. */
export default function AiBotListEmpty({
  mode,
  hasSearch,
  channel = 'CHAT',
  onCreate,
  canCreate = true,
  onClearFilters,
}: AiBotListEmptyProps) {
  const calling = channel === 'CALL';

  if (mode === 'new') {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-violet-100 bg-gradient-to-br from-white via-violet-50/35 to-sky-50/45 px-4 py-5 shadow-sm dark:border-violet-900/50 dark:from-slate-950 dark:via-violet-950/15 dark:to-sky-950/15 sm:px-6 sm:py-6">
        <div
          className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-violet-300/20 blur-3xl dark:bg-violet-500/10"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-24 left-1/3 h-48 w-48 rounded-full bg-sky-300/15 blur-3xl dark:bg-sky-500/10"
          aria-hidden="true"
        />

        <div className="relative grid items-center gap-6 lg:grid-cols-[210px_minmax(0,1fr)]">
          <div className="hidden rounded-2xl border border-violet-100 bg-white/75 p-4 shadow-sm dark:border-violet-900/50 dark:bg-slate-950/60 lg:block">
            <div className="flex items-center gap-2">
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-md ${
                  calling
                    ? 'bg-gradient-to-br from-sky-500 to-indigo-600 shadow-sky-500/20'
                    : 'bg-gradient-to-br from-violet-600 to-indigo-700 shadow-violet-500/20'
                }`}
              >
                {calling ? (
                  <PhoneCall className="h-5 w-5" strokeWidth={2.1} />
                ) : (
                  <Bot className="h-5 w-5" strokeWidth={2.1} />
                )}
              </span>
              <div>
                <p
                  className={`text-[10px] font-extrabold uppercase tracking-[0.12em] ${
                    calling ? 'text-sky-700 dark:text-sky-300' : 'text-violet-700 dark:text-violet-300'
                  }`}
                >
                  {calling ? 'Voice AI' : 'AI Assistant'}
                </p>
                <p className="mt-0.5 text-[11px] font-bold text-slate-700 dark:text-slate-200">
                  {calling ? 'Phone answering' : 'Instant 24/7 chat'}
                </p>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              {calling ? (
                <>
                  <div className="flex items-center gap-2 rounded-lg bg-sky-50 px-2.5 py-2 text-[10px] font-bold text-sky-700 dark:bg-sky-950/30 dark:text-sky-300">
                    <Volume2 className="h-3.5 w-3.5" />
                    Natural Indian speech
                  </div>
                  <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-2.5 py-2 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                    <PlayCircle className="h-3.5 w-3.5" />
                    Live phone pickup
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2 rounded-lg bg-violet-50 px-2.5 py-2 text-[10px] font-bold text-violet-700 dark:bg-violet-950/30 dark:text-violet-300">
                    <Sparkles className="h-3.5 w-3.5" />
                    Auto-generated FAQs
                  </div>
                  <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-2.5 py-2 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                    <Zap className="h-3.5 w-3.5" />
                    24/7 Smart handoff
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="min-w-0">
            <h3 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
              {calling ? 'Set up your AI voice answering agent' : 'Build your first AI chat assistant'}
            </h3>
            <p className="mt-1.5 max-w-xl text-[11px] font-medium leading-relaxed text-slate-500 dark:text-slate-400 sm:text-[12px]">
              {calling
                ? 'Handle inbound phone calls with natural-sounding voice assistants that speak your customer’s preferred language.'
                : 'Train an intelligent assistant to reply to customers on WhatsApp automatically around the clock.'}
            </p>

            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              {(calling
                ? [
                    {
                      icon: PhoneCall,
                      label: 'Create voice agent',
                      tone: 'bg-sky-50 text-sky-600 dark:bg-sky-950/35 dark:text-sky-300',
                    },
                    {
                      icon: Volume2,
                      label: 'Pick voice & language',
                      tone: 'bg-violet-50 text-violet-600 dark:bg-violet-950/35 dark:text-violet-300',
                    },
                    {
                      icon: PlayCircle,
                      label: 'Turn on call answering',
                      tone: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/35 dark:text-emerald-300',
                    },
                  ]
                : [
                    {
                      icon: Bot,
                      label: 'Set up personality',
                      tone: 'bg-violet-50 text-violet-600 dark:bg-violet-950/35 dark:text-violet-300',
                    },
                    {
                      icon: BookOpen,
                      label: 'Train knowledge base',
                      tone: 'bg-sky-50 text-sky-600 dark:bg-sky-950/35 dark:text-sky-300',
                    },
                    {
                      icon: PlayCircle,
                      label: 'Turn on 24/7 replies',
                      tone: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/35 dark:text-emerald-300',
                    },
                  ]
              ).map(({ icon: StepIcon, label, tone }, index) => (
                <div
                  key={label}
                  className="group flex min-h-[62px] items-center gap-2.5 rounded-xl border border-slate-200/70 bg-white/80 px-3 py-2.5 shadow-[0_4px_14px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-[0_8px_20px_rgba(139,92,246,0.10)] dark:border-slate-800/80 dark:bg-slate-950/55 dark:hover:border-violet-800"
                >
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${tone}`}>
                    <StepIcon className="h-4 w-4" strokeWidth={2.1} />
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5">
                      <span className="text-[9px] font-extrabold tabular-nums text-violet-600 dark:text-violet-300">
                        0{index + 1}
                      </span>
                      <span className="truncate text-[10.5px] font-bold text-slate-700 dark:text-slate-200">
                        {label}
                      </span>
                    </span>
                  </span>
                  {index < 2 && (
                    <ArrowRight className="ml-auto hidden h-3.5 w-3.5 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-violet-500 sm:block" />
                  )}
                </div>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2.5">
              <AppButton
                className="!min-h-9"
                size="sm"
                icon={<Plus className="h-3.5 w-3.5" />}
                onClick={onCreate}
                disabled={!canCreate}
              >
                {calling ? 'New calling bot' : 'New chat bot'}
              </AppButton>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <EmptyState
      icon={calling ? PhoneCall : MessageSquare}
      variant="filter"
      title={hasSearch ? 'No bots match your search' : 'No bots for this filter'}
      description={
        hasSearch
          ? 'Try another search term, or clear filters to see all bots.'
          : 'No bots match the selected status. Switch or clear filters to see all bots.'
      }
      action={
        <AppButton variant="secondary" onClick={onClearFilters}>
          Clear filters
        </AppButton>
      }
    />
  );
}
