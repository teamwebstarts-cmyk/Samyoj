import { useState } from 'react';
import { Check, ChevronDown, Lightbulb, X } from 'lucide-react';
import { getTemplateApprovalChecklist } from '../../../utils/templateUtils';
import type { TemplateFormState } from '../../../utils/templateForm';

const FAST_APPROVAL_TIPS = [
  'Avoid emojis in the template body',
  'Use clear, professional language',
  'Keep variables inside full sentences',
  'Match category to message purpose',
] as const;

interface TemplateWizardApprovalAsideProps {
  form: TemplateFormState;
}

/** Compact collapsible approval status under the live WhatsApp preview. */
export default function TemplateWizardApprovalAside({ form }: TemplateWizardApprovalAsideProps) {
  const checklist = getTemplateApprovalChecklist(form);
  const passed = checklist.filter((item) => item.passed).length;
  const total = checklist.length;
  const ready = passed === total;
  const [openChecklist, setOpenChecklist] = useState(false);
  const [openTips, setOpenTips] = useState(false);

  return (
    <div className="mt-3 space-y-2">
      <div className="template-wizard-card overflow-hidden">
        <button
          type="button"
          onClick={() => setOpenChecklist((v) => !v)}
          aria-expanded={openChecklist}
          className="flex w-full items-center gap-2 px-3 py-2 text-left transition hover:bg-slate-50/80 dark:hover:bg-slate-900/50"
        >
          <span
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
              ready
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
                : 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
            }`}
          >
            {ready ? <Check className="h-3 w-3" strokeWidth={2.75} /> : <X className="h-3 w-3" strokeWidth={2.75} />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[12px] font-bold text-slate-900 dark:text-white">
              Approval readiness
            </span>
            <span className={`text-[10px] font-semibold ${ready ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-800 dark:text-amber-300'}`}>
              {passed}/{total} {ready ? 'ready' : 'to fix'}
            </span>
          </span>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${openChecklist ? 'rotate-180' : ''}`}
            aria-hidden
          />
        </button>
        {openChecklist && (
          <ul className="space-y-1.5 border-t border-slate-100 px-3 py-2.5 dark:border-slate-800">
            {checklist.map((item) => (
              <li key={item.id} className="flex items-start gap-2 text-[11px] leading-snug">
                <span
                  className={`mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full ${
                    item.passed
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
                      : 'bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400'
                  }`}
                >
                  {item.passed ? (
                    <Check className="h-2.5 w-2.5" strokeWidth={2.75} />
                  ) : (
                    <X className="h-2.5 w-2.5" strokeWidth={2.75} />
                  )}
                </span>
                <span className={item.passed ? 'text-slate-600 dark:text-slate-300' : 'font-semibold text-rose-700 dark:text-rose-300'}>
                  {item.label}
                  {item.hint && !item.passed ? (
                    <span className="mt-0.5 block font-normal text-slate-500">{item.hint}</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="template-wizard-card overflow-hidden">
        <button
          type="button"
          onClick={() => setOpenTips((v) => !v)}
          aria-expanded={openTips}
          className="flex w-full items-center gap-2 px-3 py-2 text-left transition hover:bg-amber-50/50 dark:hover:bg-amber-950/20"
        >
          <Lightbulb className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-300" />
          <span className="min-w-0 flex-1 text-[12px] font-bold text-slate-900 dark:text-white">
            Faster approval
          </span>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${openTips ? 'rotate-180' : ''}`}
            aria-hidden
          />
        </button>
        {openTips && (
          <ul className="list-disc space-y-1 border-t border-amber-100/80 px-3 py-2.5 pl-8 text-[11px] leading-relaxed text-slate-600 dark:border-amber-900/40 dark:text-slate-300">
            {FAST_APPROVAL_TIPS.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
