import { Link } from 'react-router-dom';
import ChecklistMark from './icons/ChecklistMark';

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
  const progress = totalSteps ? Math.round((completedCount / totalSteps) * 100) : 0;

  return (
    <section className="dashboard-card flex h-full flex-col rounded-2xl p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[14px] font-extrabold tracking-tight text-neutral-900 sm:text-[15px]">
            Getting started
          </h2>
          <p className="mt-0.5 text-[12px] font-medium text-neutral-500">
            {completedCount}/{totalSteps} completed
          </p>
        </div>
        <span className="rounded-full border border-emerald-200/80 bg-emerald-50 px-2 py-0.5 text-[11px] font-bold tabular-nums text-emerald-800">
          {progress}%
        </span>
      </div>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-neutral-100">
        <div
          className="h-full rounded-full bg-whatsapp-600 transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>

      <ul className="mt-3 space-y-1.5">
        {steps.map((step) => {
          const Row = (
            <div
              className={`flex items-start gap-2.5 rounded-xl px-2 py-2 ${
                step.completed ? 'opacity-70' : 'hover:bg-neutral-50'
              }`}
            >
              <ChecklistMark completed={step.completed} className="mt-0.5 h-4 w-4" />
              <div className="min-w-0">
                <p
                  className={`text-[13px] font-bold ${
                    step.completed ? 'text-neutral-500 line-through' : 'text-neutral-900'
                  }`}
                >
                  {step.title}
                </p>
                {step.description && !step.completed && (
                  <p className="mt-0.5 text-[11px] font-medium text-neutral-500">{step.description}</p>
                )}
              </div>
            </div>
          );

          if (step.href && !step.completed) {
            return (
              <li key={step.id}>
                <Link to={step.href}>{Row}</Link>
              </li>
            );
          }
          return <li key={step.id}>{Row}</li>;
        })}
      </ul>
    </section>
  );
}
