import type { ReactNode } from 'react';

interface TemplateWizardPageFooterProps {
  /** Left cluster: context chip or Cancel / Back buttons. */
  start?: ReactNode;
  /** Right cluster: the step's primary (and optional secondary) actions. */
  end?: ReactNode;
}

/** One persistent footer for every template wizard page — same container on
 * Browse, Edit, and Submitted; callers pass the buttons for their step. */
export default function TemplateWizardPageFooter({ start, end }: TemplateWizardPageFooterProps) {
  return (
    <footer className="template-wizard-footer">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col items-stretch gap-3 px-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6 lg:px-8">
        <div className="wizard-footer-start">{start}</div>
        <div className="wizard-footer-end">{end}</div>
      </div>
    </footer>
  );
}
