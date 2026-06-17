import { useEffect, useMemo, useState } from 'react';
import {
  ClipboardCopy,
  ExternalLink,
  LayoutGrid,
  List,
  Lock,
  Phone,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import AppButton from '../ui/AppButton';
import AppInput from '../ui/AppInput';
import AppSelect from '../ui/AppSelect';
import AppTextarea from '../ui/AppTextarea';
import { WhatsAppInteractivePreview } from './WhatsAppPreview';
import { templateApi } from '../../services/api';
import { getTemplateButtons } from '../../utils/templateForm';
import type { MessageTemplate, SendMessagePayload, ServiceWindowInfo } from '../../types';

export type InteractiveComposerMode = 'reply' | 'list' | 'cta_url' | 'cta_call' | 'copy_code';

type ComposerPayload = SendMessagePayload;

interface InteractiveComposerProps {
  open: boolean;
  onClose: () => void;
  onSend: (payload: ComposerPayload) => Promise<void>;
  sending?: boolean;
  serviceWindow: ServiceWindowInfo;
}

const MODES: Array<{
  id: InteractiveComposerMode;
  label: string;
  icon: typeof LayoutGrid;
  requiresWindow: boolean;
}> = [
  { id: 'reply', label: 'Buttons', icon: LayoutGrid, requiresWindow: true },
  { id: 'list', label: 'List', icon: List, requiresWindow: true },
  { id: 'cta_url', label: 'URL', icon: ExternalLink, requiresWindow: true },
  { id: 'cta_call', label: 'Call', icon: Phone, requiresWindow: true },
  { id: 'copy_code', label: 'Copy code', icon: ClipboardCopy, requiresWindow: false },
];

function emptyListSection(index: number) {
  return {
    title: index === 0 ? 'Options' : `Section ${index + 1}`,
    rows: [
      { id: `row_${index}_1`, title: 'Option 1', description: '' },
      { id: `row_${index}_2`, title: 'Option 2', description: '' },
    ],
  };
}

export default function InteractiveComposer({
  open,
  onClose,
  onSend,
  sending,
  serviceWindow,
}: InteractiveComposerProps) {
  const [mode, setMode] = useState<InteractiveComposerMode>('reply');
  const [header, setHeader] = useState('');
  const [body, setBody] = useState('');
  const [footer, setFooter] = useState('');
  const [buttons, setButtons] = useState([
    { id: 'yes', title: 'Yes' },
    { id: 'no', title: 'No' },
  ]);
  const [ctaLabel, setCtaLabel] = useState('Open link');
  const [ctaUrl, setCtaUrl] = useState('https://');
  const [ctaPhone, setCtaPhone] = useState('');
  const [listButtonLabel, setListButtonLabel] = useState('View options');
  const [listSections, setListSections] = useState([emptyListSection(0)]);
  const [copyCodeTemplates, setCopyCodeTemplates] = useState<MessageTemplate[]>([]);
  const [templateName, setTemplateName] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [bodyParams, setBodyParams] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    templateApi
      .list({ status: 'APPROVED', all: 'true' })
      .then(({ data }) => {
        const payload = data.data;
        const list = Array.isArray(payload) ? payload : payload?.templates || [];
        const withCopyCode = list.filter((template: MessageTemplate) =>
          getTemplateButtons(template).some((btn) => btn.type === 'COPY_CODE')
        );
        setCopyCodeTemplates(withCopyCode);
        if (withCopyCode.length) setTemplateName(withCopyCode[0].name);
      })
      .catch(() => setCopyCodeTemplates([]));
  }, [open]);

  const selectedTemplate = useMemo(
    () => copyCodeTemplates.find((template) => template.name === templateName),
    [copyCodeTemplates, templateName]
  );

  useEffect(() => {
    if (!selectedTemplate) {
      setBodyParams([]);
      return;
    }
    const bodyText =
      selectedTemplate.body ||
      selectedTemplate.components?.find((component) => component.type === 'BODY')?.text ||
      '';
    const varCount = (bodyText.match(/\{\{\d+\}\}/g) || []).length;
    setBodyParams(Array.from({ length: varCount }, () => ''));
  }, [selectedTemplate]);

  if (!open) return null;

  const activeMode = MODES.find((entry) => entry.id === mode)!;
  const modeBlocked = activeMode.requiresWindow && !serviceWindow.open;
  const totalRows = listSections.reduce((sum, section) => sum + section.rows.length, 0);

  const handleSend = async () => {
    if (modeBlocked) return;

    if (mode === 'copy_code') {
      if (!selectedTemplate || !couponCode.trim()) return;
      await onSend({
        type: 'TEMPLATE',
        templateName: selectedTemplate.name,
        templateLanguage: selectedTemplate.language,
        templateParams: {
          body: bodyParams.filter(Boolean),
          couponCode: couponCode.trim().slice(0, 15),
        },
      });
      onClose();
      return;
    }

    if (!body.trim()) return;

    const payload: ComposerPayload = {
      type: 'INTERACTIVE',
      interactive: {
        mode,
        header: header.trim() || undefined,
        body: body.trim(),
        footer: footer.trim() || undefined,
      },
    };

    if (mode === 'reply') {
      const validButtons = buttons.filter((btn) => btn.title.trim()).slice(0, 3);
      if (!validButtons.length) return;
      payload.interactive!.buttons = validButtons.map((btn, index) => ({
        id: btn.id.trim() || `btn_${index}`,
        title: btn.title.trim(),
      }));
    }

    if (mode === 'cta_url') {
      if (!ctaUrl.trim().startsWith('https://')) return;
      payload.interactive!.ctaLabel = ctaLabel.trim() || 'Open link';
      payload.interactive!.ctaUrl = ctaUrl.trim();
    }

    if (mode === 'cta_call') {
      if (!ctaPhone.trim()) return;
      payload.interactive!.ctaLabel = ctaLabel.trim() || 'Call us';
      payload.interactive!.ctaPhone = ctaPhone.trim();
    }

    if (mode === 'list') {
      if (!listSections.length || totalRows < 1 || totalRows > 10) return;
      payload.interactive!.listButtonLabel = listButtonLabel.trim() || 'Menu';
      payload.interactive!.listSections = listSections.map((section) => ({
        title: section.title?.trim() || undefined,
        rows: section.rows
          .filter((row) => row.title.trim())
          .map((row, index) => ({
            id: row.id.trim() || `row_${index}`,
            title: row.title.trim(),
            description: row.description?.trim() || undefined,
          })),
      }));
    }

    await onSend(payload);
    onClose();
  };

  const previewBody =
    mode === 'copy_code'
      ? selectedTemplate?.body ||
        selectedTemplate?.components?.find((component) => component.type === 'BODY')?.text ||
        'Your offer code message'
      : body || 'Your message will appear here';

  return (
    <div className="border-t border-violet-200/60 bg-violet-50/40 px-3 py-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[12px] font-bold text-violet-800">
          <LayoutGrid className="h-4 w-4" />
          Interactive message
        </div>
        <button type="button" onClick={onClose} className="text-violet-600">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {MODES.map((entry) => {
          const Icon = entry.icon;
          const disabled = entry.requiresWindow && !serviceWindow.open;
          return (
            <button
              key={entry.id}
              type="button"
              disabled={disabled}
              onClick={() => setMode(entry.id)}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold transition ${
                mode === entry.id
                  ? 'bg-violet-700 text-white'
                  : disabled
                    ? 'cursor-not-allowed bg-neutral-100 text-neutral-400'
                    : 'bg-white text-violet-700 ring-1 ring-violet-200 hover:bg-violet-50'
              }`}
            >
              <Icon className="h-3 w-3" />
              {entry.label}
            </button>
          );
        })}
      </div>

      {modeBlocked && (
        <div className="mb-3 flex items-start gap-2 rounded-xl border border-amber-200/80 bg-amber-50/90 px-3 py-2 text-[12px] text-amber-900">
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>
            The 24-hour customer service window is closed. Switch to <strong>Copy code</strong> to send
            an approved template, or wait for the customer to message again.
          </p>
        </div>
      )}

      {mode !== 'copy_code' && (
        <>
          <div className="grid gap-2 sm:grid-cols-2">
            <AppInput
              label="Header (optional)"
              value={header}
              onChange={(e) => setHeader(e.target.value.slice(0, 60))}
              placeholder="Short headline"
              maxLength={60}
            />
            <AppInput
              label="Footer (optional)"
              value={footer}
              onChange={(e) => setFooter(e.target.value.slice(0, 60))}
              placeholder="Small print"
              maxLength={60}
            />
          </div>
          <AppTextarea
            className="mt-2"
            label="Message"
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, 1024))}
            rows={2}
            placeholder="Write the message body..."
          />
        </>
      )}

      {mode === 'reply' && (
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {buttons.map((btn, index) => (
            <AppInput
              key={index}
              label={`Button ${index + 1}`}
              value={btn.title}
              onChange={(e) =>
                setButtons((prev) =>
                  prev.map((entry, idx) =>
                    idx === index ? { ...entry, title: e.target.value.slice(0, 20) } : entry
                  )
                )
              }
              placeholder="Button label"
            />
          ))}
        </div>
      )}

      {mode === 'cta_url' && (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <AppInput
            label="Button label"
            value={ctaLabel}
            onChange={(e) => setCtaLabel(e.target.value.slice(0, 20))}
            placeholder="Open link"
          />
          <AppInput
            label="URL"
            value={ctaUrl}
            onChange={(e) => setCtaUrl(e.target.value)}
            placeholder="https://example.com/page"
          />
        </div>
      )}

      {mode === 'cta_call' && (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <AppInput
            label="Button label"
            value={ctaLabel}
            onChange={(e) => setCtaLabel(e.target.value.slice(0, 20))}
            placeholder="Call us"
          />
          <AppInput
            label="Phone number"
            value={ctaPhone}
            onChange={(e) => setCtaPhone(e.target.value)}
            placeholder="+919876543210"
          />
        </div>
      )}

      {mode === 'list' && (
        <div className="mt-2 space-y-3">
          <AppInput
            label="Menu button label"
            value={listButtonLabel}
            onChange={(e) => setListButtonLabel(e.target.value.slice(0, 20))}
            placeholder="View options"
          />
          {totalRows > 10 && (
            <p className="text-[12px] font-medium text-red-600">
              List messages allow at most 10 rows total ({totalRows} entered).
            </p>
          )}
          {listSections.map((section, sectionIndex) => (
            <div key={sectionIndex} className="rounded-xl border border-violet-100 bg-white/80 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wide text-violet-700">
                  Section {sectionIndex + 1}
                </span>
                {listSections.length > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      setListSections((prev) => prev.filter((_, idx) => idx !== sectionIndex))
                    }
                    className="text-neutral-400 hover:text-red-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <AppInput
                label="Section title (optional)"
                value={section.title || ''}
                onChange={(e) =>
                  setListSections((prev) =>
                    prev.map((entry, idx) =>
                      idx === sectionIndex
                        ? { ...entry, title: e.target.value.slice(0, 24) }
                        : entry
                    )
                  )
                }
              />
              <div className="mt-2 space-y-2">
                {section.rows.map((row, rowIndex) => (
                  <div key={rowIndex} className="grid gap-2 sm:grid-cols-2">
                    <AppInput
                      label={`Row ${rowIndex + 1} title`}
                      value={row.title}
                      onChange={(e) =>
                        setListSections((prev) =>
                          prev.map((entry, idx) => {
                            if (idx !== sectionIndex) return entry;
                            const rows = [...entry.rows];
                            rows[rowIndex] = { ...rows[rowIndex], title: e.target.value.slice(0, 24) };
                            return { ...entry, rows };
                          })
                        )
                      }
                    />
                    <AppInput
                      label="Description (optional)"
                      value={row.description || ''}
                      onChange={(e) =>
                        setListSections((prev) =>
                          prev.map((entry, idx) => {
                            if (idx !== sectionIndex) return entry;
                            const rows = [...entry.rows];
                            rows[rowIndex] = {
                              ...rows[rowIndex],
                              description: e.target.value.slice(0, 72),
                            };
                            return { ...entry, rows };
                          })
                        )
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
          {listSections.length < 10 && totalRows < 10 && (
            <AppButton
              type="button"
              variant="ghost"
              size="sm"
              icon={<Plus className="h-3.5 w-3.5" />}
              onClick={() => setListSections((prev) => [...prev, emptyListSection(prev.length)])}
            >
              Add section
            </AppButton>
          )}
        </div>
      )}

      {mode === 'copy_code' && (
        <div className="mt-2 space-y-2">
          {copyCodeTemplates.length ? (
            <>
              <AppSelect
                label="Copy-code template"
                value={templateName}
                options={copyCodeTemplates.map((template) => ({
                  value: template.name,
                  label: template.name,
                }))}
                onChange={(e) => setTemplateName(e.target.value)}
              />
              {bodyParams.map((value, index) => (
                <AppInput
                  key={index}
                  label={`Body variable {{${index + 1}}}`}
                  value={value}
                  onChange={(e) =>
                    setBodyParams((prev) => {
                      const next = [...prev];
                      next[index] = e.target.value;
                      return next;
                    })
                  }
                />
              ))}
              <AppInput
                label="Offer code"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.slice(0, 15))}
                placeholder="SAVE20"
                hint="Sent as the copy-code button value"
              />
            </>
          ) : (
            <p className="rounded-xl border border-dashed border-amber-200 bg-amber-50/80 px-3 py-3 text-[12px] text-amber-900">
              No approved templates with a copy-code button. Create one under Templates first.
            </p>
          )}
        </div>
      )}

      <div className="mt-3 rounded-xl border border-violet-100 bg-white/70 p-3">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-violet-700">Preview</p>
        <WhatsAppInteractivePreview
          mode={mode}
          header={header || undefined}
          body={previewBody}
          footer={footer || undefined}
          buttons={buttons.filter((btn) => btn.title.trim())}
          ctaLabel={ctaLabel}
          listButtonLabel={listButtonLabel}
          listSections={listSections}
          couponCode={couponCode || undefined}
          compact
          showSurface
        />
      </div>

      <div className="mt-3 flex justify-end gap-2">
        <AppButton variant="secondary" size="sm" onClick={onClose}>
          Cancel
        </AppButton>
        <AppButton
          size="sm"
          loading={sending}
          disabled={modeBlocked || (mode === 'list' && totalRows > 10)}
          onClick={() => void handleSend()}
        >
          Send {activeMode.label.toLowerCase()}
        </AppButton>
      </div>
    </div>
  );
}
