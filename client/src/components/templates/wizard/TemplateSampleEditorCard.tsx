import { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { TemplateFormState } from '../../../utils/templateForm';

interface TemplateSampleEditorCardProps {
  form: TemplateFormState;
  onChange: (form: TemplateFormState) => void;
}

function patchSample(
  form: TemplateFormState,
  scope: 'body' | 'header',
  index: number,
  value: string,
): TemplateFormState {
  if (scope === 'body') {
    const bodyExamples = [...form.bodyExamples];
    bodyExamples[index - 1] = value;
    return { ...form, bodyExamples };
  }
  const headerExamples = [...form.headerExamples];
  headerExamples[index - 1] = value;
  return { ...form, headerExamples };
}

/**
 * Collapsible "Preview with sample data" editor under the live preview.
 * Lists only the variables that exist in the body/header text; every keystroke
 * writes straight into the form so the phone preview updates live.
 */
export default function TemplateSampleEditorCard({ form, onChange }: TemplateSampleEditorCardProps) {
  const [open, setOpen] = useState(true);

  const vars = useMemo(() => form.variableMeta.map((m) => ({ ...m })), [form.variableMeta]);

  if (!vars.length) return null;

  const renderRow = (scope: 'body' | 'header', index: number, label: string) => {
    const sample = (scope === 'body' ? form.bodyExamples[index - 1] : form.headerExamples[index - 1]) || '';
    return (
      <label key={`${scope}-${index}`} className="block min-w-0">
        <span className="mb-1 block text-[10px] font-semibold text-slate-500 dark:text-slate-400">
          {label || `Variable ${index}`}
        </span>
        <input
          type="text"
          value={sample}
          onChange={(e) => onChange(patchSample(form, scope, index, e.target.value))}
          onKeyDown={(e) => {
            // This card lives inside the wizard <form> — Enter must not submit it.
            if (e.key === 'Enter') e.preventDefault();
          }}
          placeholder="Sample value"
          aria-label={`Sample for ${scope} variable ${index}`}
          className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-[12px] text-slate-800 outline-none transition focus:border-violet-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
        />
      </label>
    );
  };

  const headerVars = vars.filter((m) => m.scope === 'header');
  const bodyVars = vars.filter((m) => m.scope === 'body');

  return (
    <div className="template-wizard-card mt-3 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 text-left transition hover:bg-slate-50/80 dark:border-slate-800 dark:hover:bg-slate-900/50"
      >
        <span className="min-w-0">
          <span className="block text-[13px] font-bold leading-5 text-slate-900 dark:text-white">
            Preview with sample data
          </span>
          <span className="block text-[10.5px] font-medium text-slate-500 dark:text-slate-400">
            Edit samples — the preview updates as you type
          </span>
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>
      {open && (
        <div className="space-y-2.5 px-4 py-3">
          {headerVars.map((m) => renderRow('header', m.index, m.description))}
          {bodyVars.map((m) => renderRow('body', m.index, m.description))}
        </div>
      )}
    </div>
  );
}
