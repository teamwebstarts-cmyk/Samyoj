import { Link } from 'react-router-dom';
import { ListChecks } from 'lucide-react';
import ChecklistMark from './icons/ChecklistMark';
import IconWell from './icons/IconWell';
import { ChecklistIllustrationSvg } from './icons/CardIllustrations';

export interface GettingStartedStep {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  href?: string;
}

interface GettingStartedCardProps {
  steps: GettingStartedStep[];
  completedCount: number;
  totalSteps: number;
  className?: string;
}

export default function GettingStartedCard({
  steps,
  completedCount,
  totalSteps,
  className = '',
}: GettingStartedCardProps) {
  const allDone = totalSteps > 0 && completedCount >= totalSteps;

  return (
    <section className={`dashboard-card flex h-full flex-col justify-between rounded-2xl border border-neutral-100/90 bg-white p-[var(--card-pad)] shadow-xs sm:rounded-2xl ${className}`}>
      {/* Card Header: Icon + Title + Progress Badge */}
      <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
        <div className="flex min-w-0 items-center gap-2 sm:gap-2.5">
          <IconWell accent="violet" size="sm" round>
            <ListChecks className="h-4 w-4 stroke-[2.2]" />
          </IconWell>
          <h2 className="truncate text-[12px] font-extrabold tracking-tight text-neutral-900 sm:text-[12.5px]">
            Getting started checklist
          </h2>
        </div>
        <span
          className={`rounded-lg px-2 sm:px-2.5 py-0.5 text-[11px] sm:text-[11.5px] font-bold tabular-nums border ${
            allDone
              ? 'bg-emerald-100 text-emerald-800 border-emerald-300/70'
              : 'bg-emerald-50 text-emerald-700 border-emerald-200/60'
          }`}
        >
          {allDone ? 'All done' : `${completedCount}/${totalSteps} completed`}
        </span>
      </div>

      {/* Card Body: Left Checklist Items + Right Illustration */}
      <div className="mt-2 flex min-h-0 flex-1 items-start justify-between gap-2 sm:mt-3 sm:gap-3">
        <ul className="min-w-0 flex-1 space-y-1 sm:space-y-1.5">
          {steps.map((step) => {
            const Row = (
              <div
                className={`flex items-center gap-1.5 rounded-lg px-1 py-0.5 sm:px-1.5 sm:py-1 transition-colors ${
                  step.completed ? 'opacity-70' : 'hover:bg-neutral-50/80'
                }`}
              >
                <ChecklistMark completed={step.completed} className="h-4 w-4 shrink-0" />
                <span
                    className={`min-w-0 truncate text-[11px] font-semibold ${
                    step.completed
                      ? 'text-neutral-500 line-through'
                      : 'text-neutral-900 group-hover:text-emerald-700'
                  }`}
                >
                  {step.title}
                </span>
              </div>
            );

            if (step.href) {
              return (
                <li key={step.id}>
                  <Link to={step.href} className="group block">
                    {Row}
                  </Link>
                </li>
              );
            }
            return <li key={step.id}>{Row}</li>;
          })}
        </ul>

        <div className="hidden shrink-0 items-center justify-center 2xl:flex">
          <ChecklistIllustrationSvg className="h-16 w-16" />
        </div>
      </div>
    </section>
  );
}
