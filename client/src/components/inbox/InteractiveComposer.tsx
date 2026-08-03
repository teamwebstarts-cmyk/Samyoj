import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import {
  ClipboardCopy,
  ExternalLink,
  LayoutGrid,
  List,
  MousePointerClick,
  Phone,
  Plus,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import AppButton from '../ui/AppButton';
import AppInput from '../ui/AppInput';
import AppSelect from '../ui/AppSelect';
import AppTextarea from '../ui/AppTextarea';
import { WhatsAppInteractivePreview, ComposerPreviewPane } from './WhatsAppPreview';
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

/** Meta Cloud API interactive limits (session messages). */
const LIMITS = {
  header: 60,
  body: 1024,
  footer: 60,
  buttonTitle: 20,
  maxButtons: 3,
  listButtonLabel: 20,
  sectionTitle: 24,
  rowTitle: 24,
  rowDescription: 72,
  maxSections: 10,
  maxTotalRows: 10,
  ctaLabel: 20,
  couponCode: 15,
} as const;

const MODES: Array<{
  id: InteractiveComposerMode;
  label: string;
  short: string;
  icon: typeof LayoutGrid;
  hint: string;
}> = [
  {
    id: 'reply',
    label: 'Buttons',
    short: 'Buttons',
    icon: MousePointerClick,
    hint: 'Up to 3 quick replies',
  },
  {
    id: 'list',
    label: 'List',
    short: 'List',
    icon: List,
    hint: 'Menu · up to 10 rows',
  },
  {
    id: 'cta_url',
    label: 'URL',
    short: 'URL',
    icon: ExternalLink,
    hint: 'Open https link',
  },
  {
    id: 'cta_call',
    label: 'Call',
    short: 'Call',
    icon: Phone,
    hint: 'Dial a number',
  },
  {
    id: 'copy_code',
    label: 'Copy code',
    short: 'Code',
    icon: ClipboardCopy,
    hint: 'Offer / coupon template',
  },
];

const COMPACT_INPUT = '!h-9 text-[13px]';
const COMPACT_LABEL = 'text-[11px] font-semibold text-theme-secondary';

function emptyListSection(index: number) {
  return {
    title: index === 0 ? 'Options' : `Section ${index + 1}`,
    rows: [{ id: `row_${index}_1`, title: 'Option 1', description: '' }],
  };
}

function slugId(title: string, fallback: string) {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40);
  return slug || fallback;
}

function charHint(value: string, max: number) {
  return `${value.length}/${max}`;
}

function isValidE164(phone: string) {
  const tel = phone.replace(/[^\d+]/g, '');
  return /^\+?\d{8,15}$/.test(tel);
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
  const [showRowDescriptions, setShowRowDescriptions] = useState(false);
  const [copyCodeTemplates, setCopyCodeTemplates] = useState<MessageTemplate[]>([]);
  const [templateName, setTemplateName] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [bodyParams, setBodyParams] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setMode(serviceWindow.open ? 'reply' : 'copy_code');
  }, [open, serviceWindow.open]);

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
  const totalRows = listSections.reduce((sum, section) => sum + section.rows.length, 0);
  const validButtons = buttons.filter((btn) => btn.title.trim()).slice(0, LIMITS.maxButtons);

  const canSend = (() => {
    if (mode === 'copy_code') {
      return Boolean(selectedTemplate && couponCode.trim());
    }
    if (!body.trim()) return false;
    if (mode === 'reply') return validButtons.length >= 1;
    if (mode === 'cta_url') return ctaUrl.trim().startsWith('https://') && ctaUrl.trim().length > 8;
    if (mode === 'cta_call') return isValidE164(ctaPhone.trim());
    if (mode === 'list') {
      const titledRows = listSections.reduce(
        (sum, section) => sum + section.rows.filter((row) => row.title.trim()).length,
        0
      );
      return titledRows >= 1 && totalRows <= LIMITS.maxTotalRows;
    }
    return false;
  })();

  const handleModeChange = (next: InteractiveComposerMode) => {
    setMode(next);
    if (next === 'cta_url' && (ctaLabel === 'Call us' || !ctaLabel.trim())) {
      setCtaLabel('Open link');
    }
    if (next === 'cta_call' && (ctaLabel === 'Open link' || !ctaLabel.trim())) {
      setCtaLabel('Call us');
    }
  };

  const handleSend = async () => {
    if (!canSend) return;

    if (mode === 'copy_code') {
      if (!selectedTemplate || !couponCode.trim()) return;
      await onSend({
        type: 'TEMPLATE',
        templateName: selectedTemplate.name,
        templateLanguage: selectedTemplate.language,
        templateParams: {
          body: bodyParams.filter(Boolean),
          couponCode: couponCode.trim().slice(0, LIMITS.couponCode),
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
      if (!validButtons.length) return;
      payload.interactive!.buttons = validButtons.map((btn, index) => ({
        id: btn.id.trim() || slugId(btn.title, `btn_${index + 1}`),
        title: btn.title.trim().slice(0, LIMITS.buttonTitle),
      }));
    }

    if (mode === 'cta_url') {
      if (!ctaUrl.trim().startsWith('https://')) return;
      payload.interactive!.ctaLabel = (ctaLabel.trim() || 'Open link').slice(0, LIMITS.ctaLabel);
      payload.interactive!.ctaUrl = ctaUrl.trim();
    }

    if (mode === 'cta_call') {
      if (!isValidE164(ctaPhone.trim())) return;
      payload.interactive!.ctaLabel = (ctaLabel.trim() || 'Call us').slice(0, LIMITS.ctaLabel);
      payload.interactive!.ctaPhone = ctaPhone.trim();
    }

    if (mode === 'list') {
      if (!listSections.length || totalRows < 1 || totalRows > LIMITS.maxTotalRows) return;
      payload.interactive!.listButtonLabel = (listButtonLabel.trim() || 'Menu').slice(
        0,
        LIMITS.listButtonLabel
      );
      payload.interactive!.listSections = listSections.map((section) => ({
        title: section.title?.trim() || undefined,
        rows: section.rows
          .filter((row) => row.title.trim())
          .map((row, index) => ({
            id: row.id.trim() || slugId(row.title, `row_${index + 1}`),
            title: row.title.trim().slice(0, LIMITS.rowTitle),
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
      : body.trim() || 'Your message will appear here';

  const onFormKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && canSend && !sending) {
      e.preventDefault();
      void handleSend();
    }
  };

  return (
    <div
      className="flex max-h-[min(56vh,480px)] flex-col border-t border-violet-200/70 bg-gradient-to-b from-violet-50/95 to-theme-surface dark:from-violet-950/35 dark:to-theme-surface"
      onKeyDown={onFormKeyDown}
    >
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between gap-2 px-3 pb-1.5 pt-2.5 sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300">
            <LayoutGrid className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-bold text-violet-950 dark:text-violet-100">
              Interactive message
            </p>
            <p className="truncate text-[11px] font-medium text-violet-700/80 dark:text-violet-300/80">
              {activeMode.hint}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-lg p-1.5 text-violet-700 transition hover:bg-violet-100/80 dark:text-violet-300 dark:hover:bg-violet-900/40"
          aria-label="Close interactive composer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Type switcher */}
      <div
        className="flex shrink-0 gap-1 overflow-x-auto px-3 pb-2 sm:px-4"
        role="tablist"
        aria-label="Interactive message type"
      >
        {MODES.map((entry) => {
          const Icon = entry.icon;
          const selected = mode === entry.id;
          return (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => handleModeChange(entry.id)}
              title={entry.hint}
              className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-1 ${
                selected
                  ? 'bg-violet-700 text-white shadow-sm'
                  : 'bg-white/90 text-violet-700 ring-1 ring-violet-200/90 hover:bg-violet-50 dark:bg-violet-950/40 dark:text-violet-200 dark:ring-violet-800'
              }`}
            >
              <Icon className="h-3 w-3" aria-hidden />
              <span className="sm:hidden">{entry.short}</span>
              <span className="hidden sm:inline">{entry.label}</span>
            </button>
          );
        })}
      </div>

      {/* Scrollable body */}
      <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto overscroll-contain px-3 pb-2 sm:px-4">
        <div key={mode} className="inbox-interactive-panel space-y-2.5">
          {mode !== 'copy_code' && (
            <>
              <div className="grid gap-2 sm:grid-cols-2">
                <AppInput
                  label="Header"
                  hint={charHint(header, LIMITS.header)}
                  value={header}
                  onChange={(e) => setHeader(e.target.value.slice(0, LIMITS.header))}
                  placeholder="Optional headline"
                  maxLength={LIMITS.header}
                  className={COMPACT_INPUT}
                  labelClassName={COMPACT_LABEL}
                />
                <AppInput
                  label="Footer"
                  hint={charHint(footer, LIMITS.footer)}
                  value={footer}
                  onChange={(e) => setFooter(e.target.value.slice(0, LIMITS.footer))}
                  placeholder="Optional fine print"
                  maxLength={LIMITS.footer}
                  className={COMPACT_INPUT}
                  labelClassName={COMPACT_LABEL}
                />
              </div>
              <AppTextarea
                label="Message"
                hint={charHint(body, LIMITS.body)}
                value={body}
                onChange={(e) => setBody(e.target.value.slice(0, LIMITS.body))}
                rows={2}
                placeholder="Write the body customers will read…"
                className="!py-2 text-[13px] leading-snug"
              />
            </>
          )}

          {mode === 'reply' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold text-theme-secondary">
                  Reply buttons
                  <span className="ml-1.5 font-medium text-theme-muted">
                    {validButtons.length}/{LIMITS.maxButtons} · max 20 chars
                  </span>
                </p>
                {buttons.length < LIMITS.maxButtons && (
                  <button
                    type="button"
                    onClick={() =>
                      setButtons((prev) => [
                        ...prev,
                        {
                          id: `btn_${prev.length + 1}`,
                          title: '',
                        },
                      ])
                    }
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold text-violet-700 transition hover:bg-violet-100/80 dark:text-violet-300"
                  >
                    <Plus className="h-3 w-3" />
                    Add
                  </button>
                )}
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                {buttons.map((btn, index) => (
                  <div key={btn.id || index} className="relative">
                    <AppInput
                      label={`Button ${index + 1}`}
                      hint={charHint(btn.title, LIMITS.buttonTitle)}
                      value={btn.title}
                      onChange={(e) => {
                        const title = e.target.value.slice(0, LIMITS.buttonTitle);
                        setButtons((prev) =>
                          prev.map((entry, idx) =>
                            idx === index
                              ? {
                                  ...entry,
                                  title,
                                  id: slugId(title, `btn_${index + 1}`),
                                }
                              : entry
                          )
                        );
                      }}
                      placeholder="Label"
                      className={COMPACT_INPUT}
                      labelClassName={COMPACT_LABEL}
                    />
                    {buttons.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setButtons((prev) => prev.filter((_, idx) => idx !== index))
                        }
                        className="absolute right-0 top-0 rounded p-0.5 text-neutral-400 transition hover:text-red-600"
                        aria-label={`Remove button ${index + 1}`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {mode === 'cta_url' && (
            <div className="grid gap-2 sm:grid-cols-2">
              <AppInput
                label="Button label"
                hint={charHint(ctaLabel, LIMITS.ctaLabel)}
                value={ctaLabel}
                onChange={(e) => setCtaLabel(e.target.value.slice(0, LIMITS.ctaLabel))}
                placeholder="Open link"
                className={COMPACT_INPUT}
                labelClassName={COMPACT_LABEL}
              />
              <AppInput
                label="URL"
                hint="https only"
                value={ctaUrl}
                onChange={(e) => setCtaUrl(e.target.value)}
                placeholder="https://example.com"
                className={COMPACT_INPUT}
                labelClassName={COMPACT_LABEL}
                error={
                  ctaUrl.trim() && !ctaUrl.trim().startsWith('https://')
                    ? 'Must start with https://'
                    : undefined
                }
              />
            </div>
          )}

          {mode === 'cta_call' && (
            <div className="grid gap-2 sm:grid-cols-2">
              <AppInput
                label="Button label"
                hint={charHint(ctaLabel, LIMITS.ctaLabel)}
                value={ctaLabel}
                onChange={(e) => setCtaLabel(e.target.value.slice(0, LIMITS.ctaLabel))}
                placeholder="Call us"
                className={COMPACT_INPUT}
                labelClassName={COMPACT_LABEL}
              />
              <AppInput
                label="Phone"
                hint="E.164"
                value={ctaPhone}
                onChange={(e) => setCtaPhone(e.target.value)}
                placeholder="+919876543210"
                className={COMPACT_INPUT}
                labelClassName={COMPACT_LABEL}
                error={
                  ctaPhone.trim() && !isValidE164(ctaPhone.trim())
                    ? 'Use country code, e.g. +91…'
                    : undefined
                }
              />
            </div>
          )}

          {mode === 'list' && (
            <div className="space-y-2">
              <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
                <AppInput
                  label="Menu button"
                  hint={charHint(listButtonLabel, LIMITS.listButtonLabel)}
                  value={listButtonLabel}
                  onChange={(e) =>
                    setListButtonLabel(e.target.value.slice(0, LIMITS.listButtonLabel))
                  }
                  placeholder="View options"
                  className={COMPACT_INPUT}
                  labelClassName={COMPACT_LABEL}
                />
                <label className="mb-0.5 flex cursor-pointer items-center gap-1.5 rounded-lg px-1 py-2 text-[11px] font-semibold text-violet-800 dark:text-violet-200">
                  <input
                    type="checkbox"
                    checked={showRowDescriptions}
                    onChange={(e) => setShowRowDescriptions(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-violet-300 text-violet-700 focus:ring-violet-500"
                  />
                  Row details
                </label>
              </div>

              <div className="flex items-center justify-between gap-2 text-[11px] font-medium text-theme-muted">
                <span>
                  {totalRows}/{LIMITS.maxTotalRows} rows · {listSections.length}/
                  {LIMITS.maxSections} sections
                </span>
                {totalRows > LIMITS.maxTotalRows && (
                  <span className="font-semibold text-red-600">Max 10 rows total</span>
                )}
              </div>

              {listSections.map((section, sectionIndex) => (
                <div
                  key={sectionIndex}
                  className="rounded-xl border border-violet-100/90 bg-white/85 p-2.5 dark:border-violet-900/50 dark:bg-violet-950/20"
                >
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-violet-700 dark:text-violet-300">
                      Section {sectionIndex + 1}
                    </span>
                    <div className="flex items-center gap-1">
                      {totalRows < LIMITS.maxTotalRows && (
                        <button
                          type="button"
                          onClick={() =>
                            setListSections((prev) =>
                              prev.map((entry, idx) => {
                                if (idx !== sectionIndex) return entry;
                                const n = entry.rows.length + 1;
                                return {
                                  ...entry,
                                  rows: [
                                    ...entry.rows,
                                    {
                                      id: `row_${sectionIndex}_${n}`,
                                      title: `Option ${n}`,
                                      description: '',
                                    },
                                  ],
                                };
                              })
                            )
                          }
                          className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-bold text-violet-700 hover:bg-violet-50 dark:text-violet-300"
                        >
                          <Plus className="h-3 w-3" />
                          Row
                        </button>
                      )}
                      {listSections.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setListSections((prev) =>
                              prev.filter((_, idx) => idx !== sectionIndex)
                            )
                          }
                          className="rounded-md p-1 text-neutral-400 hover:text-red-600"
                          aria-label={`Remove section ${sectionIndex + 1}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <AppInput
                    label="Section title"
                    hint={charHint(section.title || '', LIMITS.sectionTitle)}
                    value={section.title || ''}
                    onChange={(e) =>
                      setListSections((prev) =>
                        prev.map((entry, idx) =>
                          idx === sectionIndex
                            ? {
                                ...entry,
                                title: e.target.value.slice(0, LIMITS.sectionTitle),
                              }
                            : entry
                        )
                      )
                    }
                    className={COMPACT_INPUT}
                    labelClassName={COMPACT_LABEL}
                  />

                  <div className="mt-1.5 space-y-1.5">
                    {section.rows.map((row, rowIndex) => (
                      <div
                        key={row.id || rowIndex}
                        className={`grid gap-1.5 ${
                          showRowDescriptions ? 'sm:grid-cols-[1fr_1fr_auto]' : 'sm:grid-cols-[1fr_auto]'
                        }`}
                      >
                        <AppInput
                          label={showRowDescriptions ? 'Title' : `Row ${rowIndex + 1}`}
                          hint={charHint(row.title, LIMITS.rowTitle)}
                          value={row.title}
                          onChange={(e) => {
                            const title = e.target.value.slice(0, LIMITS.rowTitle);
                            setListSections((prev) =>
                              prev.map((entry, idx) => {
                                if (idx !== sectionIndex) return entry;
                                const rows = [...entry.rows];
                                rows[rowIndex] = {
                                  ...rows[rowIndex],
                                  title,
                                  id: slugId(title, `row_${sectionIndex}_${rowIndex + 1}`),
                                };
                                return { ...entry, rows };
                              })
                            );
                          }}
                          className={COMPACT_INPUT}
                          labelClassName={COMPACT_LABEL}
                        />
                        {showRowDescriptions && (
                          <AppInput
                            label="Description"
                            hint={charHint(row.description || '', LIMITS.rowDescription)}
                            value={row.description || ''}
                            onChange={(e) =>
                              setListSections((prev) =>
                                prev.map((entry, idx) => {
                                  if (idx !== sectionIndex) return entry;
                                  const rows = [...entry.rows];
                                  rows[rowIndex] = {
                                    ...rows[rowIndex],
                                    description: e.target.value.slice(0, LIMITS.rowDescription),
                                  };
                                  return { ...entry, rows };
                                })
                              )
                            }
                            className={COMPACT_INPUT}
                            labelClassName={COMPACT_LABEL}
                          />
                        )}
                        {section.rows.length > 1 ? (
                          <button
                            type="button"
                            onClick={() =>
                              setListSections((prev) =>
                                prev.map((entry, idx) => {
                                  if (idx !== sectionIndex) return entry;
                                  return {
                                    ...entry,
                                    rows: entry.rows.filter((_, rIdx) => rIdx !== rowIndex),
                                  };
                                })
                              )
                            }
                            className="mb-0.5 self-end rounded-lg p-2 text-neutral-400 hover:bg-red-50 hover:text-red-600"
                            aria-label={`Remove row ${rowIndex + 1}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        ) : (
                          <span className="hidden sm:block" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {listSections.length < LIMITS.maxSections && totalRows < LIMITS.maxTotalRows && (
                <AppButton
                  type="button"
                  variant="ghost"
                  size="sm"
                  icon={<Plus className="h-3.5 w-3.5" />}
                  onClick={() =>
                    setListSections((prev) => [...prev, emptyListSection(prev.length)])
                  }
                >
                  Add section
                </AppButton>
              )}
            </div>
          )}

          {mode === 'copy_code' && (
            <div className="space-y-2">
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
                  {bodyParams.length > 0 && (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {bodyParams.map((value, index) => (
                        <AppInput
                          key={index}
                          label={`Body {{${index + 1}}}`}
                          value={value}
                          onChange={(e) =>
                            setBodyParams((prev) => {
                              const next = [...prev];
                              next[index] = e.target.value;
                              return next;
                            })
                          }
                          className={COMPACT_INPUT}
                          labelClassName={COMPACT_LABEL}
                        />
                      ))}
                    </div>
                  )}
                  <AppInput
                    label="Offer code"
                    hint={`${couponCode.length}/${LIMITS.couponCode}`}
                    value={couponCode}
                    onChange={(e) =>
                      setCouponCode(e.target.value.slice(0, LIMITS.couponCode).toUpperCase())
                    }
                    placeholder="SAVE20"
                    className={COMPACT_INPUT}
                    labelClassName={COMPACT_LABEL}
                  />
                  <p className="text-[11px] text-theme-muted">
                    Sent via an approved template with a copy-code button (Meta limit 15 chars).
                  </p>
                </>
              ) : (
                <p className="rounded-xl border border-dashed border-amber-200 bg-amber-50/80 px-3 py-2.5 text-[12px] text-amber-900">
                  No approved templates with a copy-code button. Create one under Templates first.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Live preview */}
        <div className="overflow-hidden rounded-xl border border-violet-100/90 bg-[#efeae2] [background-image:radial-gradient(circle_at_1px_1px,rgba(0,0,0,0.04)_1px,transparent_0)] [background-size:14px_14px] dark:border-violet-900/40 dark:bg-neutral-900/60">
          <div className="flex items-center justify-between border-b border-black/5 px-2.5 py-1.5 dark:border-white/5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-theme-muted">
              Preview
            </p>
            <p className="truncate text-[10px] font-medium text-theme-muted">{activeMode.label}</p>
          </div>
          <div className="max-h-[132px] overflow-y-auto overscroll-contain p-2.5">
            <WhatsAppInteractivePreview
              mode={mode}
              header={header || undefined}
              body={previewBody}
              footer={footer || undefined}
              buttons={validButtons}
              ctaLabel={ctaLabel}
              listButtonLabel={listButtonLabel}
              listSections={listSections}
              couponCode={couponCode || undefined}
              compact
              direction="outbound"
              showSurface={false}
            />
          </div>
        </div>
      </div>

      {/* Sticky actions */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-t border-violet-200/60 bg-theme-surface/95 px-3 py-2.5 backdrop-blur-sm sm:px-4 dark:border-violet-900/40">
        <p className="hidden text-[10px] font-medium text-theme-muted sm:block">
          ⌘/Ctrl + Enter to send
        </p>
        <div className="ml-auto flex items-center gap-2">
          <AppButton type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </AppButton>
          <AppButton
            size="sm"
            icon={<Send size={14} />}
            loading={sending}
            disabled={!canSend}
            onClick={() => void handleSend()}
          >
            Send {activeMode.short.toLowerCase()}
          </AppButton>
        </div>
      </div>
    </div>
  );
}
