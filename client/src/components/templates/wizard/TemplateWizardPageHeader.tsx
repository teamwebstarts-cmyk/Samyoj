import type { ComponentType, ReactNode } from 'react';
import TemplateWizardStepper from './TemplateWizardStepper';
import { templateWizardStages } from './templateWizardModel';

interface Stage {
  id: string;
  label: string;
}

interface StepperProps {
  activeStep: number;
  maxReachableStep: number;
  stages?: readonly Stage[];
  onStepChange: (step: number) => void;
  ariaLabel?: string;
}

interface TemplateWizardPageHeaderProps {
  icon: ComponentType<{ className?: string }>;
  iconTone?: 'violet' | 'emerald';
  title: string;
  subtitle?: string;
  /** Extra content under the subtitle (e.g. a back link). */
  children?: ReactNode;
  /** When present, the persistent progress stepper renders on the right. */
  stepper?: StepperProps;
}

/** One header for every template wizard page: icon + dynamic title/subtitle on
 * the left, the progress stepper on the right. Swapping titles/stages per page
 * keeps the block visually persistent across Browse → Edit → Submit. */
export default function TemplateWizardPageHeader({
  icon: Icon,
  iconTone = 'violet',
  title,
  subtitle,
  children,
  stepper,
}: TemplateWizardPageHeaderProps) {
  return (
    <div className="template-wizard-header mb-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="flex items-start gap-3">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
            iconTone === 'emerald'
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
              : 'bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300'
          }`}
        >
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-[20px] font-extrabold leading-tight tracking-tight text-slate-900 dark:text-white sm:text-[22px]">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-0.5 text-[12px] font-medium leading-snug text-slate-500">{subtitle}</p>
          ) : null}
          {children}
        </div>
      </div>
      {stepper ? (
        <TemplateWizardStepper
          activeStep={stepper.activeStep}
          maxReachableStep={stepper.maxReachableStep}
          onStepChange={stepper.onStepChange}
          stages={stepper.stages ?? templateWizardStages}
          ariaLabel={stepper.ariaLabel}
        />
      ) : null}
    </div>
  );
}
