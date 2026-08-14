import AppInput from '../../ui/AppInput';
import type { TemplateButton, TemplateLibraryEntry, MessageTemplate } from '../../../types';
import type { TemplateFormState } from '../../../utils/templateForm';
import {
  canCloneFromMetaLibrary,
  isFlowLibraryTemplate,
  libraryNeedsButtonInputs,
  humanizeLibraryName,
  normalizeWebsiteUrl,
} from '../../../utils/templateLibrary';

const SOURCE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: 'Type manually (campaign)' },
  { value: 'contact.name', label: 'Auto: Customer name' },
  { value: 'contact.phone', label: 'Auto: Phone number' },
  { value: 'contact.email', label: 'Auto: Email' },
  { value: 'contact.custom', label: 'Auto: Contact custom field' },
  { value: 'custom', label: 'Same value for everyone' },
];

interface TemplateLibraryReviewStepProps {
  item: (TemplateLibraryEntry | MessageTemplate) & { source: 'meta' | 'account' };
  form: TemplateFormState;
  onChange: (form: TemplateFormState) => void;
  createName: string;
  onCreateNameChange: (value: string) => void;
  nameError?: string | null;
  buttonUrl: string;
  onButtonUrlChange: (value: string) => void;
  buttonUrlError?: string | null;
  buttonPhone: string;
  onButtonPhoneChange: (value: string) => void;
}

export default function TemplateLibraryReviewStep({
  item,
  form,
  onChange,
  createName,
  onCreateNameChange,
  nameError,
  buttonUrl,
  onButtonUrlChange,
  buttonUrlError,
  buttonPhone,
  onButtonPhoneChange,
}: TemplateLibraryReviewStepProps) {
  const canClone = canCloneFromMetaLibrary(item);
  const isFlow = isFlowLibraryTemplate(item);
  const needsButtons = libraryNeedsButtonInputs(item);
  const urlButton = (item.buttons || []).find((b: TemplateButton) => b.type?.toUpperCase() === 'URL');
  const phoneButton = (item.buttons || []).find(
    (b: TemplateButton) => b.type?.toUpperCase() === 'PHONE_NUMBER',
  );
  const bodyVars = form.variableMeta.filter((m) => m.scope === 'body');

  const updateSource = (index: number, source: string) => {
    onChange({
      ...form,
      variableMeta: form.variableMeta.map((m) =>
        m.scope === 'body' && m.index === index
          ? {
              ...m,
              suggestedSource: (source || undefined) as TemplateFormState['variableMeta'][number]['suggestedSource'],
              customKey: source === 'contact.custom' ? m.customKey || '' : undefined,
            }
          : m,
      ),
    });
  };

  const updateCustomKey = (index: number, customKey: string) => {
    onChange({
      ...form,
      variableMeta: form.variableMeta.map((m) =>
        m.scope === 'body' && m.index === index ? { ...m, customKey } : m,
      ),
    });
  };

  return (
    <div className="space-y-4">
      <div className="template-wizard-card p-4 sm:p-5">
        <p className="text-[13px] font-bold text-slate-900 dark:text-white">
          {humanizeLibraryName(item.name)}
        </p>
        <p className="mt-0.5 font-mono text-[11px] text-slate-400">{item.name}</p>
        <p className="mt-2 text-[12px] leading-relaxed text-slate-600 dark:text-slate-400">
          {canClone
            ? 'This Meta library copy is already reviewed. Adding it as-is is usually approved immediately — you can send it from Campaigns and Inbox. Customizing the text in the editor sends it through WhatsApp review instead.'
            : item.source === 'meta'
              ? 'This library template needs a few edits in the editor before you can submit it.'
              : 'This is a template already on your account. Use it as a starting point in the editor.'}
        </p>
        {isFlow && (
          <p className="mt-2 rounded-lg border border-sky-200 bg-sky-50/80 px-3 py-2 text-[11px] text-sky-900 dark:border-sky-900/40 dark:bg-sky-950/30 dark:text-sky-200">
            This is an interactive form template (WhatsApp Flow). Submitting from the library keeps
            the form. Customizing in the editor will drop the form button.
          </p>
        )}
      </div>

      {canClone && (
        <div className="template-wizard-card p-4 sm:p-5">
          <AppInput
            id="library-template-name"
            label="Your template name"
            placeholder="my_delivery_update"
                  hint="Lowercase letters, numbers, and _ only — like order_update."
            value={createName}
            onChange={(e) => onCreateNameChange(e.target.value.toLowerCase().replace(/\s/g, '_'))}
            required
            pattern="[a-z0-9_]+"
          />
          {nameError && (
            <p className="mt-1.5 text-[11px] font-semibold text-rose-600">{nameError}</p>
          )}

          {needsButtons && (
            <div className="mt-4 space-y-3">
              <p className="text-[12px] font-bold text-slate-800 dark:text-slate-200">
                Where should the button take customers?
              </p>
              <p className="text-[11px] text-slate-500">
                WhatsApp opens this on their phone. Use a page on your live website.
              </p>
              {urlButton && (
                <AppInput
                  id="library-button-url"
                  label={`${urlButton.text || 'Website'} URL`}
                  placeholder="https://yourstore.com/verify"
                  hint="Customers open this in WhatsApp. Use a public https:// page — not this Samyoj screen."
                  value={buttonUrl}
                  error={buttonUrlError || undefined}
                  onChange={(e) => onButtonUrlChange(e.target.value)}
                  onBlur={(e) => onButtonUrlChange(normalizeWebsiteUrl(e.target.value))}
                  required
                />
              )}
              {phoneButton && (
                <AppInput
                  id="library-button-phone"
                  label={`${phoneButton.text || 'Call'} phone number`}
                  placeholder="+919876543210"
                  hint="Include country code."
                  value={buttonPhone}
                  onChange={(e) => onButtonPhoneChange(e.target.value)}
                  required
                />
              )}
            </div>
          )}
        </div>
      )}

      {bodyVars.length > 0 && (
        <div className="template-wizard-card overflow-hidden">
          <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
            <p className="text-[13px] font-bold text-slate-900 dark:text-white">Variables</p>
            <p className="text-[11px] text-slate-500">
              Sample values come from WhatsApp. “Filled from” connects each one to a contact so campaigns
              can fill it automatically.
            </p>
          </div>
          <div className="overflow-x-auto px-4 py-3">
            <table className="w-full min-w-[520px] text-left text-[12px]">
              <thead>
                <tr className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                  <th className="pb-2 pr-3">Variable</th>
                  <th className="pb-2 pr-3">Description</th>
                  <th className="pb-2 pr-3">Filled from</th>
                  <th className="pb-2">Sample</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {bodyVars.map((meta) => (
                  <tr key={`body-${meta.index}`}>
                    <td className="py-2.5 pr-3">
                      <span className="inline-flex rounded-md bg-emerald-50 px-2 py-0.5 font-mono text-[11px] font-bold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
                        {`{{${meta.index}}}`}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 font-medium text-slate-700 dark:text-slate-300">
                      {meta.description}
                    </td>
                    <td className="py-2.5 pr-3">
                      <select
                        value={meta.suggestedSource || ''}
                        onChange={(e) => updateSource(meta.index, e.target.value)}
                        className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[12px] font-medium dark:border-slate-700 dark:bg-slate-900"
                      >
                        {SOURCE_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                      {meta.suggestedSource === 'contact.custom' && (
                        <input
                          type="text"
                          value={meta.customKey || ''}
                          onChange={(e) => updateCustomKey(meta.index, e.target.value)}
                          placeholder="order_id"
                          className="mt-1.5 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 font-mono text-[11px] dark:border-slate-700 dark:bg-slate-900"
                          aria-label="Custom field key"
                        />
                      )}
                    </td>
                    <td className="py-2.5 font-medium text-slate-600 dark:text-slate-400">
                      {form.bodyExamples[meta.index - 1] || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
