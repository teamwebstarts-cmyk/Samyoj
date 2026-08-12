import { Check } from 'lucide-react';

export const campaignWizardStages = [
  { label: 'Message', description: 'Choose template and content' },
  { label: 'Audience', description: 'Select recipients' },
  { label: 'Review & Send', description: 'Review and confirm' },
] as const;

interface CampaignWizardStepperProps {
  activeStep: number;
  onStepChange: (step: number) => void;
}

export default function CampaignWizardStepper({
  activeStep,
  onStepChange,
}: CampaignWizardStepperProps) {
  return (
    <nav
      aria-label="Campaign creation steps"
      role="tablist"
      className="campaign-wizard-stepper rounded-xl border border-slate-200/80 bg-white px-3 py-2.5 dark:border-slate-800 dark:bg-slate-950 sm:px-4"
    >
      <ol className="flex items-center">
        {campaignWizardStages.map((stage, index) => {
          const completed = index < activeStep;
          const active = index === activeStep;
          const locked = index > activeStep;

          return (
            <li key={stage.label} className="flex min-w-0 flex-1 items-center">
              <button
                type="button"
                id={`campaign-wizard-step-${index}`}
                role="tab"
                aria-selected={active}
                aria-current={active ? 'step' : undefined}
                aria-controls={`campaign-wizard-panel-${index}`}
                aria-disabled={locked}
                disabled={locked}
                onClick={() => onStepChange(index)}
                className={`group flex min-w-0 items-center gap-2 text-left outline-none transition ${
                  locked ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'
                } focus-visible:ring-2 focus-visible:ring-emerald-500/30 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950`}
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold transition sm:h-8 sm:w-8 ${
                    completed
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                      : active
                        ? 'bg-emerald-600 text-white shadow-[0_3px_10px_rgba(16,185,129,0.28)]'
                        : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                  }`}
                >
                  {completed ? <Check className="h-3.5 w-3.5" strokeWidth={2.75} /> : index + 1}
                </span>
                <span className="min-w-0">
                  <span
                    className={`block truncate text-[10px] font-extrabold sm:text-[11px] ${
                      active || completed
                        ? 'text-emerald-700 dark:text-emerald-300'
                        : 'text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {stage.label}
                  </span>
                  <span className="mt-0.5 hidden truncate text-[10px] font-medium text-slate-400 sm:block">
                    {stage.description}
                  </span>
                </span>
              </button>

              {index < campaignWizardStages.length - 1 && (
                <span
                  aria-hidden="true"
                  className={`mx-2 h-px min-w-4 flex-1 sm:mx-4 ${
                    index < activeStep
                      ? 'bg-emerald-400 dark:bg-emerald-700'
                      : 'bg-slate-200 dark:bg-slate-800'
                  }`}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
