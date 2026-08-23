import { Wand2 } from 'lucide-react';
import {
  sampleForVariable,
  type TemplateFormState,
  type TemplateVariableMeta,
} from '../../../utils/templateForm';
import FieldInfoTip from '../../ui/FieldInfoTip';

export const VARIABLE_SOURCE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: 'Type when sending' },
  { value: 'contact.name', label: 'Customer name' },
  { value: 'contact.phone', label: 'Phone number' },
  { value: 'contact.email', label: 'Email' },
  { value: 'contact.custom', label: 'Contact custom field' },
  { value: 'custom', label: 'Same value for everyone' },
];

interface TemplateVariableConnectProps {
  form: TemplateFormState;
  onChange: (form: TemplateFormState) => void;
  onAutoFill?: () => void;
  /** Compact editor under the body (create) vs confirmation on review. */
  variant?: 'create' | 'review';
}

function patchMeta(
  form: TemplateFormState,
  scope: 'body' | 'header',
  index: number,
  patch: Partial<TemplateVariableMeta>,
): TemplateFormState {
  return {
    ...form,
    variableMeta: form.variableMeta.map((m) =>
      m.scope === scope && m.index === index ? { ...m, ...patch } : m,
    ),
  };
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

function getSample(form: TemplateFormState, scope: 'body' | 'header', index: number) {
  return scope === 'body' ? form.bodyExamples[index - 1] || '' : form.headerExamples[index - 1] || '';
}

function VariableRow({
  form,
  meta,
  onChange,
}: {
  form: TemplateFormState;
  meta: TemplateVariableMeta;
  onChange: (form: TemplateFormState) => void;
}) {
  const sample = getSample(form, meta.scope, meta.index);

  return (
    <div className="rounded-lg border border-slate-200/90 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-900/60">
      <div className="flex items-center gap-2">
        <span className="inline-flex shrink-0 rounded-md bg-emerald-50 px-1.5 py-0.5 font-mono text-[11px] font-bold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
          {`{{${meta.index}}}`}
        </span>
        <input
          type="text"
          value={meta.description}
          onChange={(e) => onChange(patchMeta(form, meta.scope, meta.index, { description: e.target.value }))}
          placeholder="What this field is"
          aria-label={`Description for {{${meta.index}}}`}
          className="h-8 min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 text-[12px] font-medium dark:border-slate-700 dark:bg-slate-950"
        />
      </div>
      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="block min-w-0">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">
            Filled from
          </span>
          <select
            value={meta.suggestedSource || ''}
            onChange={(e) => {
              const source = (e.target.value || undefined) as TemplateVariableMeta['suggestedSource'];
              let next = patchMeta(form, meta.scope, meta.index, {
                suggestedSource: source,
                customKey: source === 'contact.custom' ? meta.customKey || '' : undefined,
              });
              if (!getSample(next, meta.scope, meta.index).trim() && source) {
                next = patchSample(
                  next,
                  meta.scope,
                  meta.index,
                  sampleForVariable(meta.description, meta.index, source),
                );
              }
              onChange(next);
            }}
            className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-[12px] font-medium dark:border-slate-700 dark:bg-slate-950"
            title="How this variable is filled when sending"
          >
            {VARIABLE_SOURCE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block min-w-0">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">
            Sample for WhatsApp
          </span>
          <input
            type="text"
            value={sample}
            onChange={(e) => onChange(patchSample(form, meta.scope, meta.index, e.target.value))}
            placeholder={meta.index === 1 ? 'Rahul' : 'Example value'}
            aria-label={`Sample for {{${meta.index}}}`}
            className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-[12px] dark:border-slate-700 dark:bg-slate-950"
            required
          />
        </label>
      </div>
      {meta.suggestedSource === 'contact.custom' && (
        <input
          type="text"
          value={meta.customKey || ''}
          onChange={(e) => onChange(patchMeta(form, meta.scope, meta.index, { customKey: e.target.value }))}
          placeholder="custom field key, e.g. order_id"
          aria-label="Custom field key"
          className="mt-2 h-8 w-full rounded-md border border-slate-200 bg-white px-2 font-mono text-[11px] dark:border-slate-700 dark:bg-slate-950"
        />
      )}
    </div>
  );
}

/** Connect {{n}} body/header fields to contact data while writing the template. */
export default function TemplateVariableConnect({
  form,
  onChange,
  onAutoFill,
  variant = 'create',
}: TemplateVariableConnectProps) {
  const bodyVars = form.variableMeta.filter((m) => m.scope === 'body');
  const headerVars = form.variableMeta.filter((m) => m.scope === 'header');

  if (bodyVars.length === 0 && headerVars.length === 0) {
    if (variant === 'review') {
      return (
        <div className="template-wizard-card px-4 py-3">
          <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-200">No personal fields</p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            This message has no variables. You can submit it as written.
          </p>
        </div>
      );
    }
    return null;
  }

  const title = variant === 'review' ? 'Confirm variables' : 'Connect variables';
  const hint =
    variant === 'review'
      ? 'These values are used when you send later, and as samples for WhatsApp review.'
      : 'Map each {{n}} to a contact field so Inbox and Campaigns fill it automatically.';

  return (
    <div className={variant === 'create' ? 'mt-4 rounded-xl border border-emerald-100 bg-emerald-50/40 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/15' : 'template-wizard-card overflow-hidden'}>
      <div className={`flex flex-wrap items-center justify-between gap-2 ${variant === 'review' ? 'border-b border-slate-100 px-4 py-3 dark:border-slate-800' : 'mb-2.5'}`}>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-[13px] font-bold text-slate-900 dark:text-white">{title}</p>
            <FieldInfoTip text={hint} />
          </div>
          {variant === 'create' ? (
            <p className="mt-0.5 text-[11px] font-medium text-slate-500">{hint}</p>
          ) : (
            <p className="text-[11px] text-slate-500">{hint}</p>
          )}
        </div>
        {onAutoFill ? (
          <button
            type="button"
            onClick={onAutoFill}
            className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1.5 text-[11px] font-bold text-violet-700 transition hover:bg-violet-100 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-300"
          >
            <Wand2 className="h-3.5 w-3.5" />
            Auto-fill samples
          </button>
        ) : null}
      </div>

      <div className={variant === 'review' ? 'space-y-3 px-4 py-3' : 'space-y-3'}>
        {headerVars.length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
              Header ({headerVars.length})
            </p>
            {headerVars.map((meta) => (
              <VariableRow key={`header-${meta.index}`} form={form} meta={meta} onChange={onChange} />
            ))}
          </div>
        )}
        {bodyVars.length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
              Body ({bodyVars.length})
            </p>
            {bodyVars.map((meta) => (
              <VariableRow key={`body-${meta.index}`} form={form} meta={meta} onChange={onChange} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
