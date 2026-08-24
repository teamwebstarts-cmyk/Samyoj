import AppAlert from '../ui/AppAlert';
import { explainTemplateIssue } from '../../utils/templateIssueCopy';

interface TemplateIssueAlertProps {
  message: string;
  className?: string;
}

/** Friendly error card: short title, plain explanation, optional example. */
export default function TemplateIssueAlert({ message, className = '' }: TemplateIssueAlertProps) {
  const issue = explainTemplateIssue(message);

  return (
    <AppAlert variant="error" className={className}>
      <p className="text-[13px] font-bold leading-snug">{issue.title}</p>
      {issue.detail ? (
        <p className="mt-1 text-[12px] font-medium leading-relaxed opacity-90">{issue.detail}</p>
      ) : null}
      {issue.example ? (
        <p className="mt-2 inline-flex max-w-full items-center rounded-lg bg-white/80 px-2.5 py-1 font-mono text-[11px] font-semibold text-red-800 ring-1 ring-red-200/70 dark:bg-red-950/40 dark:text-red-200 dark:ring-red-800/50">
          Example: {issue.example}
        </p>
      ) : null}
    </AppAlert>
  );
}
