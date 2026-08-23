import type { ReactNode } from 'react';
import AppInput from '../../ui/AppInput';
import AppSelect from '../../ui/AppSelect';
import InfoTip from '../../ui/InfoTip';
import type { TemplateButton, TemplateLibraryEntry, MessageTemplate } from '../../../types';
import type { TemplateFormState } from '../../../utils/templateForm';
import {
  canCloneFromMetaLibrary,
  isFlowLibraryTemplate,
  libraryNeedsButtonInputs,
  humanizeLibraryName,
  normalizeWebsiteUrl,
} from '../../../utils/templateLibrary';

const FILL_SOURCE_OPTIONS = [
  { value: '', label: 'Manual (per campaign)' },
  { value: 'contact.name', label: 'Contact name' },
  { value: 'contact.phone', label: 'Phone' },
  { value: 'contact.email', label: 'Email' },
  { value: 'contact.custom', label: 'Custom field' },
  { value: 'custom', label: 'Same for everyone' },
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

function reviewInfoContent(
  canClone: boolean,
  source: 'meta' | 'account',
): ReactNode {
  if (canClone) {
    return (
      <>
        Meta already reviewed this copy. Add as-is for instant approval in Campaigns and Inbox.
        Editing the text in the editor sends it through WhatsApp review instead.
      </>
    );
  }
  if (source === 'meta') {
    return 'This library template needs a few edits in the editor before you can submit it.';
  }
  return 'This template is already on your account. Use it as a starting point in the editor.';
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
    <div className="space-y-3">
      <div className="template-wizard-card p-3 sm:p-3.5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1">
              <p className="text-[12px] font-bold text-slate-900 dark:text-white sm:text-[13px]">
                {humanizeLibraryName(item.name)}
              </p>
              <InfoTip label="About this template" content={reviewInfoContent(canClone, item.source)} />
              {isFlow && (
                <InfoTip
                  label="WhatsApp Flow template"
                  content="Interactive form template. Adding from the library keeps the form. Customizing in the editor removes the form button."
                />
              )}
            </div>
            <p className="mt-0.5 truncate font-mono text-[10px] text-slate-400">{item.name}</p>
          </div>
          {canClone && (
            <span className="shrink-0 rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              Ready to add
            </span>
          )}
        </div>
      </div>

      {canClone && (
        <div className="template-wizard-card p-3 sm:p-3.5">
          <AppInput
            id="library-template-name"
            label="Template name"
            placeholder="order_update"
            value={createName}
            onChange={(e) => onCreateNameChange(e.target.value.toLowerCase().replace(/\s/g, '_'))}
            required
            pattern="[a-z0-9_]+"
            error={nameError || undefined}
            labelInfo="Lowercase letters, numbers, and underscore only."
          />

          {needsButtons && (
            <div className="mt-3 space-y-2.5 border-t border-slate-100 pt-3 dark:border-slate-800">
              <div className="flex items-center gap-1">
                <p className="text-[12px] font-bold text-slate-800 dark:text-slate-200">Button links</p>
                <InfoTip
                  label="Button link help"
                  content="WhatsApp opens these on the customer's phone. Use a public https:// page or a phone number with country code."
                />
              </div>
              {urlButton && (
                <AppInput
                  id="library-button-url"
                  label={urlButton.text || 'Website URL'}
                  placeholder="https://yourstore.com/track"
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
                  label={phoneButton.text || 'Call number'}
                  placeholder="+919876543210"
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
          <div className="flex items-center gap-1 border-b border-slate-100 px-3 py-2.5 dark:border-slate-800 sm:px-3.5">
            <p className="text-[12px] font-bold text-slate-900 dark:text-white">Variables</p>
            <InfoTip
              label="Variable mapping help"
              content="Map each placeholder to a contact field so campaigns and Inbox can auto-fill messages. Sample values come from Meta."
            />
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800" role="list">
            {bodyVars.map((meta, rowIndex) => {
              const sample = form.bodyExamples[meta.index - 1] || '—';
              return (
                <article
                  key={`body-${meta.index}`}
                  role="listitem"
                  className="px-3 py-3 sm:px-3.5"
                >
                  <div className="flex gap-2.5">
                    <span
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-100 text-[10px] font-extrabold tabular-nums text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                      aria-hidden
                    >
                      {rowIndex + 1}
                    </span>

                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex rounded-md bg-emerald-50 px-1.5 py-0.5 font-mono text-[11px] font-bold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
                            {`{{${meta.index}}}`}
                          </span>
                          <span className="text-[12px] font-semibold text-slate-700 dark:text-slate-200">
                            {meta.description}
                          </span>
                        </div>
                        <p className="text-[10px] font-medium text-slate-400">
                          Sample:{' '}
                          <span className="text-slate-600 dark:text-slate-300">{sample}</span>
                        </p>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-2">
                        <AppSelect
                          size="compact"
                          label="Fill from"
                          value={meta.suggestedSource || ''}
                          isSearchable={false}
                          options={FILL_SOURCE_OPTIONS}
                          onChange={(e) => updateSource(meta.index, e.target.value)}
                        />
                        {meta.suggestedSource === 'contact.custom' && (
                          <AppInput
                            id={`library-var-custom-${meta.index}`}
                            label="Field key"
                            placeholder="order_id"
                            value={meta.customKey || ''}
                            onChange={(e) => updateCustomKey(meta.index, e.target.value)}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
