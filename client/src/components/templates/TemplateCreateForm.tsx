import { useRef, useState } from 'react';
import { AlertCircle, AlertTriangle, Image, Info, Loader2, Upload } from 'lucide-react';
import AppAlert from '../ui/AppAlert';
import AppInput from '../ui/AppInput';
import { messagingConsent } from '../../utils/plainLanguage';
import AppSelect from '../ui/AppSelect';
import AppTextarea from '../ui/AppTextarea';
import { ModalPanel, ModalPreviewCard } from '../ui/modalUi';
import { WhatsAppTemplatePreview } from '../inbox/WhatsAppPreview';
import TemplateButtonEditor from './TemplateButtonEditor';
import TemplateGuidanceDisclosure from './TemplateGuidanceDisclosure';
import { templateApi } from '../../services/api';
import {
  buildCreatePayload,
  syncFormExamples,
  type TemplateFormState,
} from '../../utils/templateForm';
import {
  CATEGORY_OPTIONS,
  HEADER_FORMAT_OPTIONS,
  LANGUAGE_OPTIONS,
  validateTemplateForm,
} from '../../utils/templateUtils';
import { getFilledTemplatePreview } from '../campaigns/campaignPreviewUtils';
import type { MessageTemplate } from '../../types';
import { toastError } from '../../utils/toast';

interface TemplateCreateFormProps {
  form: TemplateFormState;
  onChange: (form: TemplateFormState) => void;
  mode?: 'create' | 'resubmit';
  resubmitName?: string;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1] || '');
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function TemplateCreateForm({
  form,
  onChange,
  mode = 'create',
}: TemplateCreateFormProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [headerPreviewUrl, setHeaderPreviewUrl] = useState<string | null>(null);

  const setForm = (patch: Partial<TemplateFormState>) => {
    const next = syncFormExamples({ ...form, ...patch });
    onChange(next);
  };

  const issues = validateTemplateForm(form);
  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');

  const previewTemplate: MessageTemplate = {
    id: 'preview',
    name: form.name || 'preview',
    status: 'PENDING',
    category: form.category,
    language: form.language,
    components: [
      ...(form.headerFormat === 'TEXT' && form.header
        ? [{ type: 'HEADER', text: form.header, format: 'TEXT' }]
        : form.headerFormat !== 'NONE' && form.headerFormat !== 'TEXT'
          ? [{ type: 'HEADER', format: form.headerFormat }]
          : []),
      { type: 'BODY', text: form.body },
      ...(form.footer ? [{ type: 'FOOTER', text: form.footer }] : []),
    ],
  };

  const filledPreview = getFilledTemplatePreview(previewTemplate, {
    bodyParams: form.bodyExamples,
    headerParams: form.headerExamples,
  });

  const formPreviewButtons = form.buttons
    .filter((b) => b.text.trim())
    .map((b) => ({
      type: b.type,
      text: b.text,
      ...(b.type === 'URL' && b.url ? { url: b.url } : {}),
      ...(b.type === 'PHONE_NUMBER' && b.phone_number ? { phone_number: b.phone_number } : {}),
    }));

  const handleHeaderUpload = async (file: File) => {
    setUploading(true);
    try {
      const data = await fileToBase64(file);
      const { data: res } = await templateApi.uploadHeader({
        data,
        mimeType: file.type || 'application/octet-stream',
      });
      setForm({ headerMediaHandle: res.data.handle });
      if (file.type.startsWith('image/')) {
        setHeaderPreviewUrl(URL.createObjectURL(file));
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
    <div className="space-y-5">
      <TemplateGuidanceDisclosure
        title={
          mode === 'resubmit' ? 'Edit & resubmit for approval' : 'WhatsApp must approve this first'
        }
        icon={AlertCircle}
        tone="rose"
      >
        Only approved templates can be used in campaigns. Add sample values for every placeholder to
        improve approval chances.
      </TemplateGuidanceDisclosure>

      {form.category === 'MARKETING' && (
        <TemplateGuidanceDisclosure title="Marketing template guidelines" icon={Info} tone="sky">
          {messagingConsent.templateStopHint} Avoid misleading claims. WhatsApp may take 24–48 hours
          to review.
        </TemplateGuidanceDisclosure>
      )}

      {form.category === 'AUTHENTICATION' && (
        <AppAlert variant="info">
          <p className="font-semibold">Authentication template</p>
          <p className="mt-1 text-[12px]">
            Use for OTP and verification codes. Security recommendation will be added automatically.
          </p>
        </AppAlert>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <AppInput
          id="template-name"
          label="Template name"
          placeholder="order_update"
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <AppSelect
          id="template-category"
          label="Category"
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
          value={form.headerFormat}
          options={HEADER_FORMAT_OPTIONS}
          isSearchable={false}
          onChange={(e) =>
            setForm({
              headerFormat: e.target.value as TemplateFormState['headerFormat'],
              header: '',
              headerMediaHandle: '',
            })
          }
        />
      </div>

      {form.headerFormat === 'TEXT' && (
        <AppInput
          id="template-header"
          label="Header text"
          hint="Optional · max 60 characters"
          placeholder="Order update"
          value={form.header}
          onChange={(e) => setForm({ header: e.target.value })}
          maxLength={60}
        />
      )}

      {['IMAGE', 'VIDEO', 'DOCUMENT'].includes(form.headerFormat) && (
        <div className="rounded-2xl border border-dashed border-theme-border bg-theme-subtle/50 p-4">
          <p className="text-[13px] font-semibold text-theme-fg">Sample {form.headerFormat.toLowerCase()} for approval</p>
          <p className="mt-1 text-[11px] text-theme-muted">
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
              if (file) handleHeaderUpload(file);
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-theme-surface px-4 py-2.5 text-[13px] font-semibold text-theme-fg ring-1 ring-theme-border transition hover:bg-theme-subtle disabled:opacity-60"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : form.headerFormat === 'IMAGE' ? (
              <Image className="h-4 w-4 text-rose-600" />
            ) : (
              <Upload className="h-4 w-4 text-rose-600" />
            )}
            {form.headerMediaHandle ? 'Replace sample file' : 'Upload sample file'}
          </button>
          {form.headerMediaHandle && (
            <p className="mt-2 text-[11px] font-medium text-emerald-700">Sample uploaded successfully</p>
          )}
        </div>
      )}

      <AppTextarea
        id="template-body"
        label="Body text"
        hint="Use {{1}}, {{2}} for placeholders. Cannot start or end with a variable. Must be sequential."
        placeholder={
          form.category === 'AUTHENTICATION'
            ? 'Your verification code is {{1}}.'
            : 'Hi {{1}}, your order {{2}} is ready.'
        }
        value={form.body}
        onChange={(e) => setForm({ body: e.target.value })}
        rows={4}
        required
        maxLength={1024}
      />

      {form.bodyExamples.length > 0 && (
        <ModalPanel title="Body variable samples" accent="violet">
          <p className="mb-3 text-[11px] text-theme-secondary">Required by WhatsApp for approval</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {form.bodyExamples.map((val, i) => (
              <AppInput
                key={`body-ex-${i}`}
                label={`Sample for {{${i + 1}}}`}
                placeholder={i === 0 ? 'John' : 'Value'}
                value={val}
                onChange={(e) => {
                  const bodyExamples = [...form.bodyExamples];
                  bodyExamples[i] = e.target.value;
                  setForm({ bodyExamples });
                }}
                required
              />
            ))}
          </div>
        </ModalPanel>
      )}

      {form.headerExamples.length > 0 && (
        <ModalPanel title="Header variable samples" accent="violet">
          <div className="grid gap-3 sm:grid-cols-2">
            {form.headerExamples.map((val, i) => (
              <AppInput
                key={`header-ex-${i}`}
                label={`Sample for {{${i + 1}}}`}
                value={val}
                onChange={(e) => {
                  const headerExamples = [...form.headerExamples];
                  headerExamples[i] = e.target.value;
                  setForm({ headerExamples });
                }}
                required
              />
            ))}
          </div>
        </ModalPanel>
      )}

      <AppInput
        id="template-footer"
        label="Footer"
        hint="Optional · recommended for marketing"
        placeholder="Reply STOP to unsubscribe"
        value={form.footer}
        onChange={(e) => setForm({ footer: e.target.value })}
        maxLength={60}
      />

      {form.category === 'AUTHENTICATION' && (
        <label className="flex items-center gap-2.5 rounded-xl border border-theme-border bg-theme-subtle/50 px-3 py-3 text-[13px] font-medium text-theme-fg">
          <input
            type="checkbox"
            checked={form.addSecurityRecommendation}
            onChange={(e) => setForm({ addSecurityRecommendation: e.target.checked })}
            className="h-4 w-4 rounded border-theme-border text-rose-600"
          />
          Add security recommendation (&quot;Do not share this code&quot;)
        </label>
      )}

      <TemplateButtonEditor
        buttons={form.buttons}
        onChange={(buttons) => setForm({ buttons })}
        category={form.category}
      />

      {(warnings.length > 0 || errors.length > 0) && (
        <div className="space-y-2">
          {errors.map((issue) => (
            <p key={issue.field} className="flex items-center gap-2 text-[12px] font-medium text-red-600">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              {issue.message}
            </p>
          ))}
          {warnings.map((issue) => (
            <p key={issue.field} className="flex items-center gap-2 text-[12px] font-medium text-amber-700">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              {issue.message}
            </p>
          ))}
        </div>
      )}

      <ModalPreviewCard title="Live WhatsApp preview">
        <WhatsAppTemplatePreview
          header={filledPreview.header}
          headerFormat={form.headerFormat !== 'TEXT' && form.headerFormat !== 'NONE' ? form.headerFormat : undefined}
          headerMediaUrl={headerPreviewUrl || undefined}
          body={filledPreview.body || 'Your message body will appear here.'}
          footer={filledPreview.footer}
          buttons={formPreviewButtons}
        />
      </ModalPreviewCard>

      <input type="hidden" value={JSON.stringify(buildCreatePayload(form))} readOnly />
    </div>
  );
}
