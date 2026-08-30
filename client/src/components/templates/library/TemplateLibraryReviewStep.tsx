import { useRef, useState, type ReactNode } from 'react';
import { Loader2, Upload } from 'lucide-react';
import AppInput from '../../ui/AppInput';
import AppSelect from '../../ui/AppSelect';
import InfoTip from '../../ui/InfoTip';
import type { TemplateFormState } from '../../../utils/templateForm';
import type { CatalogListItem } from '../../../utils/templateLibrary';
import { libraryNeedsButtonInputs, normalizeWebsiteUrl } from '../../../utils/templateLibrary';
import { templateApi } from '../../../services/api';
import { headerMediaAccept, headerMediaMimeAllowed, type HeaderMediaFormat } from '../../../utils/headerMedia';
import { toastError } from '../../../utils/toast';

const FILL_SOURCE_OPTIONS = [
  { value: '', label: 'Manual (per campaign)' },
  { value: 'contact.name', label: 'Contact name' },
  { value: 'contact.phone', label: 'Phone' },
  { value: 'contact.email', label: 'Email' },
  { value: 'contact.custom', label: 'Custom field' },
  { value: 'custom', label: 'Same for everyone' },
];

interface TemplateLibraryReviewStepProps {
  item: CatalogListItem;
  form: TemplateFormState;
  onChange: (form: TemplateFormState) => void;
  createName: string;
  onCreateNameChange: (value: string) => void;
  nameError?: string | null;
  language: string;
  onLanguageChange: (language: string) => void;
  buttonUrl: string;
  onButtonUrlChange: (value: string) => void;
  buttonUrlError?: string | null;
  buttonPhone: string;
  onButtonPhoneChange: (value: string) => void;
}

function reviewInfoContent(): ReactNode {
  return (
    <>
      This copy is saved in Samyoj. Submit sends it to Meta for <span className="font-semibold">this WhatsApp number</span>.
      Utility and authentication are usually faster. Marketing is slower. Samyoj cannot pre-approve Meta on your number.
    </>
  );
}

function fileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function TemplateLibraryReviewStep({
  item,
  form,
  onChange,
  createName,
  onCreateNameChange,
  nameError,
  language,
  onLanguageChange,
  buttonUrl,
  onButtonUrlChange,
  buttonUrlError,
  buttonPhone,
  onButtonPhoneChange,
}: TemplateLibraryReviewStepProps) {
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const needsButtons = libraryNeedsButtonInputs(item);
  const urlButtons = (item.buttons || []).filter((button) => button.type?.toUpperCase() === 'URL');
  const urlButton = urlButtons[0];
  const phoneButton = (item.buttons || []).find((button) => button.type?.toUpperCase() === 'PHONE_NUMBER');
  const bodyVars = form.variableMeta.filter((meta) => meta.scope === 'body');

  const updateSource = (index: number, source: string) => {
    onChange({
      ...form,
      variableMeta: form.variableMeta.map((meta) =>
        meta.scope === 'body' && meta.index === index
          ? {
              ...meta,
              suggestedSource: (source || undefined) as TemplateFormState['variableMeta'][number]['suggestedSource'],
              customKey: source === 'contact.custom' ? meta.customKey || '' : undefined,
            }
          : meta,
      ),
    });
  };

  const updateCustomKey = (index: number, customKey: string) => {
    onChange({
      ...form,
      variableMeta: form.variableMeta.map((meta) =>
        meta.scope === 'body' && meta.index === index ? { ...meta, customKey } : meta,
      ),
    });
  };

  return (
    <div className="space-y-3">
      <div className="template-wizard-card p-3 sm:p-3.5">
        <div className="flex flex-wrap items-center gap-1">
          <p className="text-[12px] font-bold text-slate-900 dark:text-white sm:text-[13px]">{item.title}</p>
          <InfoTip label="About this template" content={reviewInfoContent()} />
        </div>
        <p className="mt-1 text-[11px] font-medium text-slate-500">{item.copy}</p>
        <p className="mt-0.5 font-mono text-[10px] text-slate-400">{item.id}</p>
        {item.mediaFormat ? (
          <div className="mt-2 rounded-lg bg-sky-50 px-2.5 py-2 text-[11px] font-semibold leading-relaxed text-sky-800 dark:bg-sky-950/30 dark:text-sky-200">
            <p>This draft has a {item.mediaFormat.toLowerCase()} header. Upload a sample file before submitting it to Meta.</p>
            <input
              ref={mediaInputRef}
              type="file"
              className="hidden"
              accept={headerMediaAccept(item.mediaFormat as HeaderMediaFormat)}
              onChange={async (event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (!file) return;
                const format = item.mediaFormat as HeaderMediaFormat;
                if (!headerMediaMimeAllowed(format, file.type)) {
                  toastError(`Choose a ${format.toLowerCase()} file.`);
                  return;
                }
                setUploadingMedia(true);
                try {
                  const { data } = await templateApi.uploadHeader({
                    data: await fileAsBase64(file),
                    mimeType: file.type,
                  });
                  const handle = data?.data?.handle;
                  if (!handle) throw new Error('Meta did not return a media handle.');
                  onChange({ ...form, headerMediaHandle: handle });
                } catch (error) {
                  toastError(error instanceof Error ? error.message : 'Could not upload sample media.');
                } finally {
                  setUploadingMedia(false);
                }
              }}
            />
            <button
              type="button"
              className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-sky-700 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-sky-800 disabled:opacity-60"
              onClick={() => mediaInputRef.current?.click()}
              disabled={uploadingMedia}
            >
              {uploadingMedia ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              {uploadingMedia ? 'Uploading…' : form.headerMediaHandle ? 'Replace sample media' : 'Upload sample media'}
            </button>
            {form.headerMediaHandle ? <span className="ml-2 text-[10px] font-bold text-emerald-700">Sample ready</span> : null}
          </div>
        ) : null}
      </div>

      <div className="template-wizard-card p-3 sm:p-3.5">
        <AppInput
          id="library-template-name"
          label="Template name on this number"
          placeholder="order_confirmed"
          value={createName}
          onChange={(event) => onCreateNameChange(event.target.value.toLowerCase().replace(/\s/g, '_'))}
          required
          pattern="[a-z0-9_]+"
          error={nameError || undefined}
          labelInfo="Lowercase letters, numbers, and underscore only. This is the name Meta stores on your WhatsApp account."
        />
        <div className="mt-3">
          <AppSelect
            size="compact"
            label="Language to submit"
            value={language}
            isSearchable={false}
            options={[
              { value: 'en_US', label: 'English' },
              { value: 'hi_IN', label: 'Hindi' },
            ]}
            onChange={(event) => onLanguageChange(event.target.value)}
          />
        </div>

        {needsButtons && (
          <div className="mt-3 space-y-2.5 border-t border-slate-100 pt-3 dark:border-slate-800">
            <div className="flex items-center gap-1">
              <p className="text-[12px] font-bold text-slate-800 dark:text-slate-200">Button website — optional</p>
              <InfoTip
                label="Button link help"
                content="Meta locks the website domain on this template at review. Only a path ending like /order-123 can change later when you send. Body fields {{1}} are separate. Leave this empty to use a chat button instead — no website needed to submit."
              />
            </div>
            <p className="text-[11px] font-medium leading-relaxed text-slate-500">
              Leave empty if you do not have a shop page yet. We will submit a chat button with the same label. If you
              paste a site, use your real https shop or tracking page — Meta reviews that domain now.
            </p>
            {urlButton && (
              <AppInput
                id="library-button-url"
                label={
                  urlButtons.length > 1
                    ? urlButtons.map((button) => button.text).join(' + ')
                    : urlButton.text || 'Website URL'
                }
                hint="Optional"
                labelInfo="Domain is saved on the template. Add /{{1}} at the end if each customer should get a unique path."
                placeholder="Leave empty, or https://yourstore.com/track"
                value={buttonUrl}
                error={buttonUrlError || undefined}
                onChange={(event) => onButtonUrlChange(event.target.value)}
                onBlur={(event) => onButtonUrlChange(normalizeWebsiteUrl(event.target.value))}
              />
            )}
            {urlButtons.length > 1 ? (
              <p className="text-[11px] font-medium leading-relaxed text-slate-500">
                Both buttons open this same website. WhatsApp stores one page on this draft.
              </p>
            ) : null}
            {phoneButton && (
              <AppInput
                id="library-button-phone"
                label={phoneButton.text || 'Call number'}
                placeholder="+919876543210"
                value={buttonPhone}
                onChange={(event) => onButtonPhoneChange(event.target.value)}
                required
              />
            )}
          </div>
        )}
      </div>

      {bodyVars.length > 0 && (
        <div className="template-wizard-card overflow-hidden">
          <div className="flex items-center gap-1 border-b border-slate-100 px-3 py-2.5 dark:border-slate-800 sm:px-3.5">
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <p className="text-[12px] font-bold text-slate-900 dark:text-white">Variables — fill later</p>
                <InfoTip
                  label="Variable mapping help"
                  content="Samples are only for Meta review. Real {{1}} values fill when you send. Inbox and Campaigns use the Fill from mapping you pick here."
                />
              </div>
              <p className="mt-0.5 text-[11px] font-medium leading-relaxed text-slate-500">
                Preview uses sample text like Rahul. When you send, Contact name / Same for everyone replaces it.
              </p>
            </div>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800" role="list">
            {bodyVars.map((meta, rowIndex) => {
              const sample = form.bodyExamples[meta.index - 1] || '—';
              return (
                <article key={`body-${meta.index}`} role="listitem" className="px-3 py-3 sm:px-3.5">
                  <div className="flex gap-2.5">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-100 text-[10px] font-extrabold tabular-nums text-slate-600 dark:bg-slate-800 dark:text-slate-300">
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
                          Sample: <span className="text-slate-600 dark:text-slate-300">{sample}</span>
                        </p>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <AppSelect
                          size="compact"
                          label="Fill from"
                          value={meta.suggestedSource || ''}
                          isSearchable={false}
                          options={FILL_SOURCE_OPTIONS}
                          onChange={(event) => updateSource(meta.index, event.target.value)}
                        />
                        {meta.suggestedSource === 'contact.custom' && (
                          <AppInput
                            id={`library-var-custom-${meta.index}`}
                            label="Field key"
                            placeholder="order_id"
                            value={meta.customKey || ''}
                            onChange={(event) => updateCustomKey(meta.index, event.target.value)}
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
