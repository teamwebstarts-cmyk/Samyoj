import { BadgeCheck } from 'lucide-react';
import AppAlert from '../../ui/AppAlert';
import { CATEGORY_OPTIONS, LANGUAGE_OPTIONS } from '../../../utils/templateUtils';
import type { TemplateFormState } from '../../../utils/templateForm';
import type { TemplateButton } from '../../../types';
import type { CatalogListItem } from '../../../utils/templateLibrary';

export function categoryLabel(value: string) {
  return CATEGORY_OPTIONS.find((o) => o.value === value)?.label || value;
}

export function languageLabel(value: string) {
  return LANGUAGE_OPTIONS.find((o) => o.value === value)?.label || value;
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 py-2 last:border-b-0 dark:border-slate-800">
      <span className="shrink-0 text-[11.5px] font-semibold text-slate-500 dark:text-slate-400">{label}</span>
      <span className="min-w-0 text-right text-[11.5px] font-semibold text-slate-800 dark:text-slate-200">{children}</span>
    </div>
  );
}

interface TemplateDetailsCardProps {
  entry: CatalogListItem;
  form: TemplateFormState;
  previewButtons: TemplateButton[];
}

/** "Template details" table under the WhatsApp preview phone — shared by the
 * wizard and library preview panels (same content, always expanded). */
export default function TemplateDetailsCard({ entry, form, previewButtons }: TemplateDetailsCardProps) {
  const variableCount = (form.body.match(/\{\{\d+\}\}/g) || []).length;

  return (
    <div className="template-wizard-card mt-3 overflow-hidden">
      <div className="flex w-full items-center border-b border-slate-100 px-4 py-3 dark:border-slate-800">
        <span className="text-[13px] font-bold leading-5 text-slate-900 dark:text-white">Template details</span>
      </div>
      <div className="px-4 py-1.5">
        <DetailRow label="Name">
          <span className="truncate font-mono text-[11px]" title={form.name || entry.id}>
            {form.name || entry.id}
          </span>
        </DetailRow>
        <DetailRow label="Category">
          <span className="inline-flex items-center rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-bold text-violet-700 ring-1 ring-violet-200/70 dark:bg-violet-950/40 dark:text-violet-300 dark:ring-violet-800/50">
            {categoryLabel(form.category || entry.category)}
          </span>
        </DetailRow>
        <DetailRow label="Language">{languageLabel(form.language)}</DetailRow>
        <DetailRow label="Buttons">
          {previewButtons.length
            ? previewButtons.map((button) => button.text).filter(Boolean).join(', ')
            : 'None'}
        </DetailRow>
        <DetailRow label="Variables">
          {variableCount
            ? `${variableCount} variable${variableCount === 1 ? '' : 's'} ${Array.from(
                { length: variableCount },
                (_, i) => `{{${i + 1}}}`,
              ).join(' ')}`
            : 'None'}
        </DetailRow>
        <DetailRow label="Status">
          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
            <BadgeCheck className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
            {entry.ready ? 'Ready on this number' : 'Approved by Meta'}
          </span>
        </DetailRow>
      </div>
      <div className="px-3 pb-3">
        <AppAlert variant="info" className="!text-[11px] leading-relaxed">
          {entry.ready
            ? 'This sample is already live on this number — nothing to submit.'
            : 'This is a library skeleton from Meta. You can clone it directly onto your number; Meta still reviews clones.'}
        </AppAlert>
      </div>
    </div>
  );
}
