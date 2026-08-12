import { Check, Lightbulb, Wand2, X } from 'lucide-react';
import { getTemplateApprovalChecklist } from '../../../utils/templateUtils';
import type { TemplateFormState } from '../../../utils/templateForm';

interface TemplateWizardReviewStepProps {
  form: TemplateFormState;
  onChange: (form: TemplateFormState) => void;
  onAutoFill: () => void;
}

function buttonTypeLabel(type: string) {
  if (type === 'URL') return 'Visit website';
  if (type === 'PHONE_NUMBER') return 'Call phone number';
  if (type === 'COPY_CODE') return 'Copy offer code';
  return 'Quick reply';
}

function formatPhonePreview(phone: string) {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('91') && digits.length >= 12) {
    const local = digits.slice(2);
    return `+91 ${local.slice(0, 5)} ${local.slice(5)}`.trim();
  }
  return phone || '—';
}

export default function TemplateWizardReviewStep({
  form,
  onChange,
  onAutoFill,
}: TemplateWizardReviewStepProps) {
  const checklist = getTemplateApprovalChecklist(form);
  const bodyVars = form.variableMeta.filter((m) => m.scope === 'body');
  const headerVars = form.variableMeta.filter((m) => m.scope === 'header');
  const filledButtons = form.buttons.filter((b) => b.text.trim());
  const actionableButtons = filledButtons.filter(
    (b) => b.type === 'PHONE_NUMBER' || b.type === 'URL' || b.type === 'COPY_CODE',
  );

  const updateMeta = (scope: 'body' | 'header', index: number, description: string) => {
    onChange({
      ...form,
      variableMeta: form.variableMeta.map((m) =>
        m.scope === scope && m.index === index ? { ...m, description } : m,
      ),
    });
  };

  const updateSample = (scope: 'body' | 'header', index: number, value: string) => {
    if (scope === 'body') {
      const bodyExamples = [...form.bodyExamples];
      bodyExamples[index - 1] = value;
      onChange({ ...form, bodyExamples });
      return;
    }
    const headerExamples = [...form.headerExamples];
    headerExamples[index - 1] = value;
    onChange({ ...form, headerExamples });
  };

  const getSample = (scope: 'body' | 'header', index: number) =>
    scope === 'body' ? form.bodyExamples[index - 1] || '' : form.headerExamples[index - 1] || '';

  return (
    <div className="space-y-4">
      <div className="template-wizard-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
          <div>
            <p className="text-[14px] font-bold text-slate-900 dark:text-white">Variable samples</p>
            <p className="text-[11px] text-slate-500">
              Add sample values for variables and review before submission.
            </p>
          </div>
          <button
            type="button"
            onClick={onAutoFill}
            className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-[11px] font-bold text-violet-700 transition hover:bg-violet-100 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-300"
          >
            <Wand2 className="h-3.5 w-3.5" />
            Auto-fill samples
          </button>
        </div>

        {bodyVars.length === 0 && headerVars.length === 0 && (
          <div className="border-b border-slate-100 px-4 py-6 text-center dark:border-slate-800">
            <p className="text-[13px] font-semibold text-slate-700 dark:text-slate-300">
              No variables in this template
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              You can continue to submit — sample values are only required when placeholders are used.
            </p>
          </div>
        )}

        {bodyVars.length > 0 && (
          <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
            <p className="mb-3 text-[12px] font-bold text-slate-700 dark:text-slate-300">
              Body variables ({bodyVars.length})
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-[12px]">
                <thead>
                  <tr className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                    <th className="pb-2 pr-3">Variable</th>
                    <th className="pb-2 pr-3">Description</th>
                    <th className="pb-2 pr-3">Sample value</th>
                    <th className="pb-2">Preview</th>
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
                      <td className="py-2.5 pr-3">
                        <input
                          type="text"
                          value={meta.description}
                          onChange={(e) => updateMeta('body', meta.index, e.target.value)}
                          className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[12px] dark:border-slate-700 dark:bg-slate-900"
                        />
                      </td>
                      <td className="py-2.5 pr-3">
                        <input
                          type="text"
                          value={getSample('body', meta.index)}
                          onChange={(e) => updateSample('body', meta.index, e.target.value)}
                          placeholder={meta.index === 1 ? 'Rahul' : 'Value'}
                          className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[12px] dark:border-slate-700 dark:bg-slate-900"
                          required
                        />
                      </td>
                      <td className="py-2.5 font-semibold text-emerald-600">
                        {getSample('body', meta.index) || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {headerVars.length > 0 && (
          <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
            <p className="mb-3 text-[12px] font-bold text-slate-700 dark:text-slate-300">
              Header variables ({headerVars.length})
            </p>
            <div className="space-y-2">
              {headerVars.map((meta) => (
                <div key={`header-${meta.index}`} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <span className="inline-flex w-fit rounded-md bg-emerald-50 px-2 py-0.5 font-mono text-[11px] font-bold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
                    {`{{${meta.index}}}`}
                  </span>
                  <input
                    type="text"
                    value={getSample('header', meta.index)}
                    onChange={(e) => updateSample('header', meta.index, e.target.value)}
                    className="rounded-md border border-slate-200 px-2 py-1.5 text-[12px] dark:border-slate-700 dark:bg-slate-900"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {actionableButtons.length > 0 && (
          <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
            <p className="mb-3 text-[12px] font-bold text-slate-700 dark:text-slate-300">
              Button variables ({actionableButtons.length})
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-left text-[12px]">
                <thead>
                  <tr className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                    <th className="pb-2 pr-3">Variable</th>
                    <th className="pb-2 pr-3">Type</th>
                    <th className="pb-2 pr-3">Sample value</th>
                    <th className="pb-2">Preview</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {actionableButtons.map((btn, i) => {
                    const btnIndex = form.buttons.indexOf(btn);
                    const preview =
                      btn.type === 'PHONE_NUMBER'
                        ? formatPhonePreview(btn.phone_number)
                        : btn.type === 'URL'
                          ? btn.url || '—'
                          : btn.example || '—';
                    return (
                      <tr key={i}>
                        <td className="py-2.5 pr-3">
                          <span className="inline-flex rounded-md bg-emerald-50 px-2 py-0.5 font-mono text-[11px] font-bold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
                            {`{{${i + 1}}}`}
                          </span>
                        </td>
                        <td className="py-2.5 pr-3 text-slate-600">{buttonTypeLabel(btn.type)}</td>
                        <td className="py-2.5 pr-3">
                          {btn.type === 'PHONE_NUMBER' ? (
                            <div className="flex gap-2">
                              <span className="flex h-9 shrink-0 items-center rounded-md border border-slate-200 bg-slate-50 px-2 text-[11px] font-semibold">
                                IN +91
                              </span>
                              <input
                                type="tel"
                                value={btn.phone_number.replace(/^\+91/, '').trim()}
                                onChange={(e) => {
                                  const digits = e.target.value.replace(/\D/g, '');
                                  const buttons = [...form.buttons];
                                  buttons[btnIndex] = {
                                    ...btn,
                                    phone_number: digits ? `+91${digits}` : '',
                                  };
                                  onChange({ ...form, buttons });
                                }}
                                placeholder="98765 43210"
                                className="h-9 min-w-0 flex-1 rounded-md border border-slate-200 px-2 text-[12px] dark:border-slate-700 dark:bg-slate-900"
                              />
                            </div>
                          ) : btn.type === 'URL' ? (
                            <input
                              type="text"
                              value={btn.url}
                              onChange={(e) => {
                                const buttons = [...form.buttons];
                                buttons[btnIndex] = { ...btn, url: e.target.value };
                                onChange({ ...form, buttons });
                              }}
                              className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-[12px] dark:border-slate-700 dark:bg-slate-900"
                            />
                          ) : btn.type === 'COPY_CODE' ? (
                            <input
                              type="text"
                              value={btn.example}
                              onChange={(e) => {
                                const buttons = [...form.buttons];
                                buttons[btnIndex] = { ...btn, example: e.target.value };
                                onChange({ ...form, buttons });
                              }}
                              className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-[12px] dark:border-slate-700 dark:bg-slate-900"
                            />
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </td>
                        <td className="py-2.5 font-semibold text-emerald-600">{preview}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="flex items-start gap-2 border-t border-emerald-200/60 bg-emerald-50/50 px-4 py-3 dark:border-emerald-900/40 dark:bg-emerald-950/20">
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          <p className="text-[11px] leading-relaxed text-emerald-900 dark:text-emerald-200">
            Sample values help WhatsApp review your template faster. Make sure all variables are
            meaningful and follow WhatsApp Policy.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_280px]">
        <div className="template-wizard-card p-4">
          <p className="text-[13px] font-bold text-slate-900 dark:text-white">Approval readiness checklist</p>
          <ul className="mt-3 space-y-2.5">
            {checklist.map((item) => (
              <li key={item.id} className="flex items-start gap-2.5 text-[12px]">
                <span
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                    item.passed
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
                      : 'bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400'
                  }`}
                >
                  {item.passed ? (
                    <Check className="h-3 w-3" strokeWidth={2.75} />
                  ) : (
                    <X className="h-3 w-3" strokeWidth={2.75} />
                  )}
                </span>
                <span className={item.passed ? 'text-slate-700 dark:text-slate-300' : 'font-semibold text-rose-700 dark:text-rose-300'}>
                  {item.label}
                  {item.hint && !item.passed ? (
                    <span className="mt-0.5 block font-normal text-slate-500">{item.hint}</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="template-wizard-card bg-amber-50/60 p-4 dark:bg-amber-950/20">
          <p className="flex items-center gap-1.5 text-[12px] font-bold text-amber-900 dark:text-amber-200">
            <Lightbulb className="h-4 w-4" />
            Tips for faster approval
          </p>
          <ul className="mt-2.5 list-disc space-y-1.5 pl-4 text-[11px] leading-relaxed text-amber-900/90 dark:text-amber-200/90">
            <li>Avoid emojis in the template body</li>
            <li>Use clear, professional language</li>
            <li>Keep variables inside full sentences</li>
            <li>Match category to message purpose</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
