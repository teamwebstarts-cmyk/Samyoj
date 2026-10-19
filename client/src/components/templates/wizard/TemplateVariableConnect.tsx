import { Wand2, X } from 'lucide-react';
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
  /** Shown in the panel header (create variant), left of auto-fill. */
  headerAction?: React.ReactNode;
  /** Compact editor under the body (create) vs confirmation on review. */
  variant?: 'create' | 'review';
  /** Rows added via "Add variable" whose {{n}} is not in the text yet. */
  stagedVars?: TemplateVariableMeta[];
  onRemoveStaged?: (index: number) => void;
  onEditStaged?: (index: number, patch: Partial<TemplateVariableMeta>) => void;
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
  compact = false,
  scopeTag = false,
}: {
  form: TemplateFormState;
  meta: TemplateVariableMeta;
  onChange: (form: TemplateFormState) => void;
  /** Create variant: single row — description and source side by side, no sample field. */
  compact?: boolean;
  /** Show a Header/Body tag (create variant, when both scopes are present). */
  scopeTag?: boolean;
}) {
  const sample = getSample(form, meta.scope, meta.index);

  return (
    <div className="rounded-lg border border-slate-200/90 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-900/60">
      <div className="flex items-center gap-2">
        <span className="inline-flex shrink-0 rounded-md bg-emerald-50 px-1.5 py-0.5 font-mono text-[11px] font-bold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
          {`{{${meta.index}}}`}
        </span>
        {scopeTag ? (
          <span className="inline-flex shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            {meta.scope}
          </span>
        ) : null}
        <input
          type="text"
          value={meta.description}
          onChange={(e) => onChange(patchMeta(form, meta.scope, meta.index, { description: e.target.value }))}
          placeholder="What this field is"
          aria-label={`Description for {{${meta.index}}}`}
          className="h-8 min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 text-[12px] font-medium dark:border-slate-700 dark:bg-slate-950"
        />
        {compact ? (
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
            aria-label={`Filled from, for {{${meta.index}}}`}
            className="h-8 w-44 shrink-0 rounded-md border border-slate-200 bg-white px-2 text-[12px] font-medium dark:border-slate-700 dark:bg-slate-950"
            title="How this variable is filled when sending"
          >
            {VARIABLE_SOURCE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        ) : null}
      </div>
      {!compact && (
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
      )}
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

/** A staged variable (added via "Add variable") awaiting its {{n}} in the body text. */
function StagedVariableRow({
  row,
  onEdit,
  onRemove,
}: {
  row: TemplateVariableMeta;
  onEdit?: (index: number, patch: Partial<TemplateVariableMeta>) => void;
  onRemove?: (index: number) => void;
}) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white p-2.5 opacity-80 dark:border-slate-600 dark:bg-slate-900/60">
      <div className="flex items-center gap-2">
        <span
          title="Type or insert {{n}} in the body text to activate this variable"
          className="inline-flex shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400"
        >
          {`{{${row.index}}}`}
        </span>
        <input
          type="text"
          value={row.description}
          onChange={(e) => onEdit?.(row.index, { description: e.target.value })}
          placeholder="What this field is"
          aria-label={`Description for {{${row.index}}}`}
          className="h-8 min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 text-[12px] font-medium dark:border-slate-700 dark:bg-slate-950"
        />
        <select
          value={row.suggestedSource || ''}
          onChange={(e) => {
            const source = (e.target.value || undefined) as TemplateVariableMeta['suggestedSource'];
            onEdit?.(row.index, {
              suggestedSource: source,
              customKey: source === 'contact.custom' ? row.customKey || '' : undefined,
            });
          }}
          aria-label={`Filled from, for {{${row.index}}}`}
          className="h-8 w-44 shrink-0 rounded-md border border-slate-200 bg-white px-2 text-[12px] font-medium dark:border-slate-700 dark:bg-slate-950"
          title="How this variable will be filled when sending"
        >
          {VARIABLE_SOURCE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {onRemove ? (
          <button
            type="button"
            onClick={() => onRemove(row.index)}
            aria-label={`Remove variable {{${row.index}}}`}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
      {row.suggestedSource === 'contact.custom' ? (
        <input
          type="text"
          value={row.customKey || ''}
          onChange={(e) => onEdit?.(row.index, { customKey: e.target.value })}
          placeholder="custom field key, e.g. order_id"
          aria-label="Custom field key"
          className="mt-2 h-8 w-full rounded-md border border-slate-200 bg-white px-2 font-mono text-[11px] dark:border-slate-700 dark:bg-slate-950"
        />
      ) : null}
    </div>
  );
}

/** Connect {{n}} body/header fields to contact data while writing the template. */
export default function TemplateVariableConnect({
  form,
  onChange,
  onAutoFill,
  headerAction,
  variant = 'create',
  stagedVars = [],
  onRemoveStaged,
  onEditStaged,
}: TemplateVariableConnectProps) {
  const bodyVars = form.variableMeta.filter((m) => m.scope === 'body');
  const headerVars = form.variableMeta.filter((m) => m.scope === 'header');

  // Create variant always shows the panel: headerAction ("Add variable") must
  // stay reachable even before any variable exists.
  if (bodyVars.length === 0 && headerVars.length === 0 && stagedVars.length === 0) {
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
    if (!headerAction) return null;
  }

  const title = variant === 'review' ? 'Confirm variables' : 'Connect variables';
  const hint =
    variant === 'review'
      ? 'These values are used when you send later, and as samples for WhatsApp review.'
      : 'Map each {{n}} to a contact field so Inbox and Campaigns fill it automatically.';

  return (
    <div className={variant === 'create' ? 'mt-4' : 'template-wizard-card overflow-hidden'}>
      <div className={`flex flex-wrap items-center justify-between gap-2 ${variant === 'review' ? 'border-b border-slate-100 px-4 py-3 dark:border-slate-800' : 'mb-2.5'}`}>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <p
              className={`text-[13px] ${
                variant === 'create'
                  ? 'font-semibold text-theme-secondary'
                  : 'font-bold text-slate-900 dark:text-white'
              }`}
            >
              {title}
            </p>
            <FieldInfoTip text={hint} />
          </div>
          {variant !== 'create' ? <p className="text-[11px] text-slate-500">{hint}</p> : null}
        </div>
        <div className="flex items-center gap-2">
          {headerAction}
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
      </div>

      <div className={variant === 'review' ? 'space-y-3 px-4 py-3' : 'space-y-2'}>
        {headerVars.length > 0 && (
          <div className="space-y-2">
            {headerVars.map((meta) => (
              <VariableRow
                key={`header-${meta.index}`}
                form={form}
                meta={meta}
                onChange={onChange}
                compact={variant === 'create'}
                scopeTag={variant === 'create'}
              />
            ))}
          </div>
        )}
        {bodyVars.map((meta) => (
          <VariableRow
            key={`body-${meta.index}`}
            form={form}
            meta={meta}
            onChange={onChange}
            compact={variant === 'create'}
            scopeTag={variant === 'create' && headerVars.length > 0}
          />
        ))}
        {stagedVars.length > 0 ? (
          <div className="space-y-2">
            {stagedVars.map((row) => (
              <StagedVariableRow
                key={`staged-${row.index}`}
                row={row}
                onEdit={onEditStaged}
                onRemove={onRemoveStaged}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
