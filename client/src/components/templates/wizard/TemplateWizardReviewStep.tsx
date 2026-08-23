import { Check } from 'lucide-react';
import { CATEGORY_OPTIONS, LANGUAGE_OPTIONS } from '../../../utils/templateUtils';
import type { TemplateFormState } from '../../../utils/templateForm';
import { autoFillTemplateSamples } from './templateWizardModel';
import TemplateVariableConnect from './TemplateVariableConnect';

interface TemplateWizardReviewStepProps {
  form: TemplateFormState;
  onChange: (form: TemplateFormState) => void;
  onAutoFill?: () => void;
}

function buttonTypeLabel(type: string) {
  if (type === 'URL') return 'Visit website';
  if (type === 'PHONE_NUMBER') return 'Call phone number';
  if (type === 'COPY_CODE') return 'Copy offer code';
  return 'Quick reply';
}

function categoryLabel(value: string) {
  return CATEGORY_OPTIONS.find((o) => o.value === value)?.label || value;
}

function languageLabel(value: string) {
  return LANGUAGE_OPTIONS.find((o) => o.value === value)?.label || value;
}

function headerLabel(form: TemplateFormState) {
  if (form.headerFormat === 'NONE') return 'None';
  if (form.headerFormat === 'TEXT') return form.header.trim() || 'Text';
  return form.headerFormat.charAt(0) + form.headerFormat.slice(1).toLowerCase();
}

export default function TemplateWizardReviewStep({
  form,
  onChange,
  onAutoFill,
}: TemplateWizardReviewStepProps) {
  const filledButtons = form.buttons.filter((b) => b.text.trim());
  const varCount = form.variableMeta.length;

  return (
    <div className="space-y-4">
      <div className="template-wizard-card p-4">
        <p className="text-[14px] font-bold text-slate-900 dark:text-white">Check before you submit</p>
        <p className="mt-0.5 text-[11px] text-slate-500">
          WhatsApp will review this copy. Variables you connected on Create are ready to send later.
        </p>
        <dl className="mt-3 grid grid-cols-2 gap-2 text-[12px] sm:grid-cols-4">
          <div className="rounded-lg border border-slate-100 bg-slate-50/80 px-2.5 py-2 dark:border-slate-800 dark:bg-slate-900/40">
            <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Name</dt>
            <dd className="mt-0.5 truncate font-mono text-[11px] font-semibold text-slate-800 dark:text-slate-200">
              {form.name || '—'}
            </dd>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50/80 px-2.5 py-2 dark:border-slate-800 dark:bg-slate-900/40">
            <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Category</dt>
            <dd className="mt-0.5 font-semibold text-slate-800 dark:text-slate-200">
              {categoryLabel(form.category)}
            </dd>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50/80 px-2.5 py-2 dark:border-slate-800 dark:bg-slate-900/40">
            <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Language</dt>
            <dd className="mt-0.5 font-semibold text-slate-800 dark:text-slate-200">
              {languageLabel(form.language)}
            </dd>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50/80 px-2.5 py-2 dark:border-slate-800 dark:bg-slate-900/40">
            <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Header</dt>
            <dd className="mt-0.5 truncate font-semibold text-slate-800 dark:text-slate-200">
              {headerLabel(form)}
            </dd>
          </div>
        </dl>
        {form.footer ? (
          <p className="mt-2 text-[11px] text-slate-500">
            Footer: <span className="font-medium text-slate-700 dark:text-slate-300">{form.footer}</span>
          </p>
        ) : null}
      </div>

      <TemplateVariableConnect
        form={form}
        onChange={onChange}
        onAutoFill={onAutoFill ?? (() => onChange(autoFillTemplateSamples(form)))}
        variant="review"
      />

      {filledButtons.length > 0 && (
        <div className="template-wizard-card p-4">
          <p className="text-[13px] font-bold text-slate-900 dark:text-white">
            Buttons ({filledButtons.length})
          </p>
          <ul className="mt-2 space-y-1.5">
            {filledButtons.map((btn, i) => (
              <li key={`${btn.type}-${i}`} className="flex items-center gap-2 text-[12px]">
                <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-500 dark:bg-slate-800">
                  {buttonTypeLabel(btn.type)}
                </span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{btn.text}</span>
                {btn.type === 'URL' && btn.url ? (
                  <span className="min-w-0 truncate text-slate-500">{btn.url}</span>
                ) : null}
                {btn.type === 'PHONE_NUMBER' && btn.phone_number ? (
                  <span className="text-slate-500">{btn.phone_number}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-start gap-2 rounded-xl border border-emerald-200/70 bg-emerald-50/60 px-3.5 py-2.5 dark:border-emerald-900/40 dark:bg-emerald-950/20">
        <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
        <p className="text-[11px] leading-relaxed text-emerald-900 dark:text-emerald-200">
          {varCount > 0
            ? 'Sample values help WhatsApp review faster. Submit when the live preview on the right looks right.'
            : 'Submit when the live preview on the right looks right.'}
        </p>
      </div>
    </div>
  );
}
