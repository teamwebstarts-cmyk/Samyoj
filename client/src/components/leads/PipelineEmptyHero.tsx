import {
  ArrowRight,
  Kanban,
  Plus,
  Target,
  TrendingUp,
  UserRound,
} from 'lucide-react';
import AppButton from '../ui/AppButton';

interface PipelineEmptyHeroProps {
  onCreateLead: () => void;
  onBrowseContacts?: () => void;
}

/** Empty pipeline hero matching Team, Contacts, and Campaigns empty cards. */
export default function PipelineEmptyHero({ onCreateLead, onBrowseContacts }: PipelineEmptyHeroProps) {
  const steps = [
    {
      icon: UserRound,
      label: 'Open any contact',
      tone: 'bg-sky-50 text-sky-600 dark:bg-sky-950/35 dark:text-sky-300',
    },
    {
      icon: Target,
      label: 'Convert to lead',
      tone: 'bg-amber-50 text-amber-600 dark:bg-amber-950/35 dark:text-amber-300',
    },
    {
      icon: TrendingUp,
      label: 'Track stages here',
      tone: 'bg-violet-50 text-violet-600 dark:bg-violet-950/35 dark:text-violet-300',
    },
  ] as const;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-amber-100 bg-gradient-to-br from-white via-amber-50/35 to-violet-50/45 px-4 py-5 shadow-sm dark:border-amber-900/50 dark:from-slate-950 dark:via-amber-950/15 dark:to-violet-950/15 sm:px-6 sm:py-6">
      <div
        className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-amber-300/20 blur-3xl dark:bg-amber-500/10"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-24 left-1/3 h-48 w-48 rounded-full bg-violet-300/15 blur-3xl dark:bg-violet-500/10"
        aria-hidden="true"
      />

      <div className="relative grid items-center gap-6 lg:grid-cols-[210px_minmax(0,1fr)]">
        <div className="hidden rounded-2xl border border-amber-100 bg-white/75 p-4 shadow-sm dark:border-amber-900/50 dark:bg-slate-950/60 lg:block">
          <div className="flex items-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-[0_8px_20px_rgba(245,158,11,0.22)]">
              <Kanban className="h-5 w-5" strokeWidth={2.1} />
            </span>
            <div>
              <p className="text-[13px] font-medium text-slate-700 dark:text-slate-200">
                Track sales stages
              </p>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-2.5 py-2 text-[10px] font-bold text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
              <Target className="h-3.5 w-3.5" />
              Lead from contacts
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-violet-50 px-2.5 py-2 text-[10px] font-bold text-violet-700 dark:bg-violet-950/30 dark:text-violet-300">
              <TrendingUp className="h-3.5 w-3.5" />
              New → Won stages
            </div>
          </div>
        </div>

        <div className="min-w-0">
          <h3 className="empty-lead text-slate-900 dark:text-white">
            Start your sales pipeline
          </h3>
          <p className="mt-1.5 max-w-xl text-[11px] font-medium leading-relaxed text-slate-500 dark:text-slate-400 sm:text-[12px]">
            Convert contacts to leads and move them through stages — from first touch to won deals.
          </p>

          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {steps.map(({ icon: StepIcon, label, tone }, index) => (
              <div
                key={label}
                className="group flex min-h-[62px] items-center gap-2.5 rounded-xl border border-slate-200/70 bg-white/80 px-3 py-2.5 shadow-[0_4px_14px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:border-amber-200 hover:shadow-[0_8px_20px_rgba(245,158,11,0.10)] dark:border-slate-800/80 dark:bg-slate-950/55 dark:hover:border-amber-800"
              >
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${tone}`}>
                  <StepIcon className="h-4 w-4" strokeWidth={2.1} />
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5">
                    <span className="text-[11px] font-medium tabular-nums text-amber-600 dark:text-amber-300">
                      0{index + 1}
                    </span>
                    <span className="truncate text-[12px] font-medium text-slate-700 dark:text-slate-200">
                      {label}
                    </span>
                  </span>
                </span>
                {index < 2 && (
                  <ArrowRight className="ml-auto hidden h-3.5 w-3.5 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-amber-500 sm:block" />
                )}
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <AppButton
              className="!min-h-9"
              size="sm"
              icon={<Plus className="h-3.5 w-3.5" />}
              onClick={onCreateLead}
            >
              Create your first lead
              <ArrowRight className="h-3.5 w-3.5" />
            </AppButton>
            {onBrowseContacts ? (
              <AppButton className="!min-h-9" size="sm" variant="secondary" onClick={onBrowseContacts}>
                Browse contacts
              </AppButton>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
