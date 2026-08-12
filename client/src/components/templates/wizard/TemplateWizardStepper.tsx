import { Check } from 'lucide-react';
import { templateWizardStages } from './templateWizardModel';

interface TemplateWizardStepperProps {
  activeStep: number;
  maxReachableStep: number;
  onStepChange: (step: number) => void;
}

export default function TemplateWizardStepper({
  activeStep,
  maxReachableStep,
  onStepChange,
}: TemplateWizardStepperProps) {
  return (
    <nav
      aria-label="Template creation steps"
      className="template-wizard-stepper flex shrink-0 items-center justify-end gap-0"
    >
      <ol className="flex items-center">
        {templateWizardStages.map((stage, index) => {
          const completed = index < activeStep;
          const active = index === activeStep;
          const reachable = index <= maxReachableStep;

          return (
            <li key={stage.id} className="flex items-center">
              <button
                type="button"
                disabled={!reachable || index === activeStep}
                onClick={() => reachable && onStepChange(index)}
                className={`flex items-center gap-2 rounded-lg px-1 py-0.5 outline-none transition ${
                  reachable && index !== activeStep
                    ? 'cursor-pointer hover:bg-violet-50 dark:hover:bg-violet-950/30'
                    : 'cursor-default'
                }`}
                aria-current={active ? 'step' : undefined}
              >
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold ${
                    completed
                      ? 'bg-emerald-500 text-white'
                      : active
                        ? 'bg-violet-600 text-white shadow-[0_2px_8px_rgba(124,58,237,0.35)]'
                        : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'
                  }`}
                >
                  {completed ? <Check className="h-3.5 w-3.5" strokeWidth={2.75} /> : index + 1}
                </span>
                <span
                  className={`hidden text-[12px] font-semibold sm:inline ${
                    active ? 'text-violet-700 dark:text-violet-300' : 'text-slate-500'
                  }`}
                >
                  {stage.label}
                </span>
              </button>
              {index < templateWizardStages.length - 1 && (
                <span
                  aria-hidden
                  className={`mx-2 h-px w-6 sm:w-10 ${
                    index < activeStep ? 'bg-emerald-400' : 'bg-slate-200 dark:bg-slate-700'
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
