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
}

export default function GettingStartedCard({
  steps,
  completedCount,
  totalSteps,
}: GettingStartedCardProps) {
  return (
    <section className="dashboard-card flex h-full flex-col justify-between rounded-2xl border border-neutral-100/90 bg-white p-[var(--card-pad)] shadow-xs sm:rounded-2xl">
      {/* Card Header: Icon + Title + Progress Badge */}
      <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
        <div className="flex min-w-0 items-center gap-2 sm:gap-2.5">
          <IconWell accent="emerald" size="sm" round>
            <ListChecks className="h-4 w-4 stroke-[2.2]" />
          </IconWell>
          <h2 className="truncate text-[14px] sm:text-[15px] md:text-[16px] font-bold text-neutral-900 tracking-tight">
            Getting started checklist
          </h2>
        </div>
        <span className="rounded-full bg-emerald-50 px-2 sm:px-2.5 py-0.5 text-[11px] sm:text-[11.5px] font-bold tabular-nums text-emerald-700 border border-emerald-200/60">
          {completedCount}/{totalSteps} completed
        </span>
      </div>

      {/* Card Body: Left Checklist Items + Right Illustration */}
      <div className="mt-3 flex min-h-0 flex-1 items-center justify-between gap-3 sm:mt-3.5 sm:gap-4">
        <ul className="min-w-0 flex-1 space-y-1 sm:space-y-1.5">
          {steps.map((step) => {
            const Row = (
              <div
                className={`flex items-center gap-2 sm:gap-2.5 rounded-xl px-1.5 sm:px-2 py-1 sm:py-1.5 transition-colors ${
                  step.completed ? 'opacity-70' : 'hover:bg-neutral-50/80'
                }`}
              >
                <ChecklistMark completed={step.completed} className="h-4 w-4 shrink-0" />
                <span
                  className={`text-[12.5px] sm:text-[13px] md:text-[13.5px] font-semibold ${
                    step.completed
                      ? 'text-neutral-500 line-through'
                      : 'text-neutral-900 group-hover:text-emerald-700'
                  }`}
                >
                  {step.title}
                </span>
              </div>
            );

            if (step.href && !step.completed) {
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

        <div className="hidden md:flex shrink-0 items-center justify-center pl-1 lg:pl-2">
          <ChecklistIllustrationSvg className="h-24 w-24 lg:h-28 lg:w-28 xl:h-32 xl:w-32" />
        </div>
      </div>
    </section>
  );
}
