import { useRef, useState } from 'react';
import { AlertCircle, FileText, Image, Loader2, Plus, Smile, Upload } from 'lucide-react';
import AppInput from '../../ui/AppInput';
import AppSelect from '../../ui/AppSelect';
import AppTextarea from '../../ui/AppTextarea';
import TemplateButtonEditor from '../TemplateButtonEditor';
import { templateApi } from '../../../services/api';
import {
  CATEGORY_OPTIONS,
  HEADER_FORMAT_OPTIONS,
  LANGUAGE_OPTIONS,
  countTemplateVars,
} from '../../../utils/templateUtils';
import { messagingConsent } from '../../../utils/plainLanguage';
import { syncFormExamples, type TemplateFormState } from '../../../utils/templateForm';
import { toastError } from '../../../utils/toast';

interface TemplateWizardCreateStepProps {
  form: TemplateFormState;
  onChange: (form: TemplateFormState) => void;
  mode: 'create' | 'resubmit';
  onHeaderPreviewUrl?: (url: string | null) => void;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1] || '');
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function TemplateWizardCreateStep({
  form,
  onChange,
  mode,
  onHeaderPreviewUrl,
}: TemplateWizardCreateStepProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [uploading, setUploading] = useState(false);

  const setForm = (patch: Partial<TemplateFormState>) => {
    onChange(syncFormExamples({ ...form, ...patch }));
  };

  const insertVariable = (target: 'body' | 'header') => {
    const text = target === 'body' ? form.body : form.header;
    const nextIndex = countTemplateVars(text) + 1;
    const token = `{{${nextIndex}}}`;
    const el = target === 'body' ? bodyRef.current : null;
    if (el) {
      const start = el.selectionStart ?? text.length;
      const end = el.selectionEnd ?? text.length;
      const next = `${text.slice(0, start)}${token}${text.slice(end)}`;
      setForm(target === 'body' ? { body: next } : { header: next });
      requestAnimationFrame(() => {
        el.focus();
        const pos = start + token.length;
        el.setSelectionRange(pos, pos);
      });
      return;
    }
    setForm(target === 'body' ? { body: `${text}${token}` } : { header: `${text}${token}` });
  };

  const handleHeaderUpload = async (file: File) => {
    if (file.size > 16 * 1024 * 1024) {
      toastError('File too large. Maximum size is 16 MB.');
      return;
    }
    setUploading(true);
    try {
      const data = await fileToBase64(file);
      const { data: res } = await templateApi.uploadHeader({
        data,
        mimeType: file.type || 'application/octet-stream',
      });
      setForm({ headerMediaHandle: res.data.handle });
      if (file.type.startsWith('image/')) {
        onHeaderPreviewUrl?.(URL.createObjectURL(file));
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message || 'Failed to upload header media';
      toastError(msg);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-xl border border-rose-200/80 bg-rose-50/70 px-4 py-3 dark:border-rose-900/40 dark:bg-rose-950/25">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
        <div>
          <p className="text-[13px] font-bold text-rose-900 dark:text-rose-200">
            WhatsApp must approve this first
          </p>
          <p className="mt-0.5 text-[12px] leading-relaxed text-rose-800/90 dark:text-rose-300/90">
            Only approved templates can be used in campaigns. Add sample values for every placeholder to
            improve approval chances.
          </p>
        </div>
      </div>

      {form.category === 'MARKETING' && (
        <div className="rounded-xl border border-sky-200/70 bg-sky-50/60 px-4 py-3 text-[12px] text-sky-900 dark:border-sky-900/40 dark:bg-sky-950/30 dark:text-sky-200">
          <p className="font-semibold">Marketing template guidelines</p>
          <p className="mt-1">{messagingConsent.templateStopHint} Avoid misleading claims.</p>
        </div>
      )}

      {form.category === 'UTILITY' && (
        <div className="rounded-xl border border-sky-200/70 bg-sky-50/60 px-4 py-3 text-[12px] text-sky-900 dark:border-sky-900/40 dark:bg-sky-950/30 dark:text-sky-200">
          <p className="font-semibold">Utility template guidelines</p>
          <p className="mt-1">
            Use for transactional updates (orders, appointments, account alerts). Avoid promotional
            language — Meta may recategorize or reject miscategorized templates.
          </p>
        </div>
      )}

      <div className="template-wizard-card p-4 sm:p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <AppInput
            id="template-name"
            label="Template name"
            placeholder="order_update"
            hint="Use lowercase letters, numbers and underscores only."
            value={form.name}
            onChange={(e) =>
              setForm({ name: e.target.value.toLowerCase().replace(/\s/g, '_') })
            }
            required
            pattern="[a-z0-9_]+"
            disabled={mode === 'resubmit'}
          />
          <AppSelect
            id="template-language"
            label="Language"
            value={form.language}
            options={LANGUAGE_OPTIONS}
            isSearchable
            onChange={(e) => setForm({ language: e.target.value })}
            required
          />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <AppSelect
            id="template-category"
            label="Category"
            hint="Choose the category that best fits your template."
            value={form.category}
            options={CATEGORY_OPTIONS}
            isSearchable={false}
            onChange={(e) =>
              setForm({ category: e.target.value as TemplateFormState['category'] })
            }
            required
          />
          <AppSelect
            id="template-header-format"
            label="Header type"
            hint="Select the type of header for your template."
            value={form.headerFormat}
            options={HEADER_FORMAT_OPTIONS}
            isSearchable={false}
            onChange={(e) =>
              setForm({
                headerFormat: e.target.value as TemplateFormState['headerFormat'],
                header: e.target.value === 'TEXT' ? form.header : '',
                headerMediaHandle: ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(e.target.value)
                  ? form.headerMediaHandle
                  : '',
              })
            }
          />
        </div>

        {form.headerFormat === 'TEXT' && (
          <div className="mt-4">
            <AppInput
              id="template-header"
              label="Header text"
              hint="Optional · max 60 characters"
              placeholder="Order update"
              value={form.header}
              onChange={(e) => setForm({ header: e.target.value })}
              maxLength={60}
            />
          </div>
        )}

        {['IMAGE', 'VIDEO', 'DOCUMENT'].includes(form.headerFormat) && (
          <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-900/40">
            <p className="text-[13px] font-semibold text-slate-900 dark:text-white">
              Sample {form.headerFormat.toLowerCase()} for approval
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              Upload a sample file. WhatsApp uses this during template approval.
            </p>
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              accept={
                form.headerFormat === 'IMAGE'
                  ? 'image/*'
                  : form.headerFormat === 'VIDEO'
                    ? 'video/*'
                    : '.pdf,application/pdf'
              }
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleHeaderUpload(file);
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="mt-3 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : form.headerFormat === 'IMAGE' ? (
                <Image className="h-4 w-4" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {form.headerMediaHandle ? 'Replace sample file' : 'Upload sample file'}
            </button>
            {form.headerMediaHandle && (
              <p className="mt-2 text-[11px] font-medium text-emerald-700">Sample uploaded successfully</p>
            )}
          </div>
        )}

        <div className="mt-4">
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
            <label htmlFor="template-body" className="text-[13px] font-semibold text-theme-secondary">
              Body text <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => insertVariable('body')}
                className="inline-flex items-center gap-1 rounded-md border border-violet-200 bg-violet-50 px-2 py-1 text-[10px] font-bold text-violet-700 transition hover:bg-violet-100 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-300"
              >
                <Plus className="h-3 w-3" />
                Add variable
              </button>
              <span className="text-[10px] font-medium text-slate-400">
                {form.body.length}/1024
              </span>
            </div>
          </div>
          <p className="mb-2 text-[11px] text-slate-500">
            Use {'{{1}}'}, {'{{2}}'} for placeholders like a name or order number.
          </p>
          <AppTextarea
            ref={bodyRef}
            id="template-body"
            label=""
            aria-label="Body text"
            placeholder="Hi {{1}}, your order {{2}} is ready."
            value={form.body}
            onChange={(e) => setForm({ body: e.target.value })}
            rows={4}
            required
            maxLength={1024}
            className="!mt-0"
          />
          <div className="mt-1 flex justify-end">
            <Smile className="h-4 w-4 text-slate-300" aria-hidden />
          </div>
        </div>

        <div className="mt-4">
          <AppInput
            id="template-footer"
            label="Footer"
            hint="Optional · recommended for marketing"
            placeholder="Reply STOP to unsubscribe"
            value={form.footer}
            onChange={(e) => setForm({ footer: e.target.value })}
            maxLength={60}
          />
          <p className="mt-1 text-right text-[10px] text-slate-400">{form.footer.length}/60</p>
        </div>

        {form.category === 'AUTHENTICATION' && (
          <label className="mt-4 flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-3 text-[13px] font-medium dark:border-slate-700 dark:bg-slate-900/40">
            <input
              type="checkbox"
              checked={form.addSecurityRecommendation}
              onChange={(e) => setForm({ addSecurityRecommendation: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-violet-600"
            />
            Add security recommendation (&quot;Do not share this code&quot;)
          </label>
        )}

        <div className="mt-6 border-t border-slate-100 pt-5 dark:border-slate-800">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-violet-600" />
              <p className="text-[13px] font-bold text-slate-900 dark:text-white">Buttons</p>
            </div>
          </div>
          <TemplateButtonEditor
            buttons={form.buttons}
            onChange={(buttons) => setForm({ buttons })}
            category={form.category}
            variant="wizard"
          />
        </div>
      </div>
    </div>
  );
}
