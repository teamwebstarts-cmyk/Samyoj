import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Plus, Send, Trash2 } from 'lucide-react';
import AppButton from '../ui/AppButton';
import AppInput from '../ui/AppInput';
import AppSelect from '../ui/AppSelect';
import AppTextarea from '../ui/AppTextarea';
import { ComposerPreviewPane } from './WhatsAppPreview';
import { templateApi } from '../../services/api';
import { getTemplateButtons } from '../../utils/templateForm';
import type { MessageTemplate, SendMessagePayload, ServiceWindowInfo } from '../../types';
import type { InteractiveComposerMode } from './InteractiveComposerTypes';
import {
  COMPACT_INPUT,
  COMPACT_LABEL,
  CopyCodeEmptyState,
  InteractiveTypeSwitcher,
  LIMITS,
  ListSectionBlock,
  MemoizedInteractivePreview,
  MODES,
  charHint,
  emptyListSection,
  type ListSection,
  type PreviewModel,
} from './InteractiveComposerParts';
import { useWhatsAppNumber } from '../../contexts/WhatsAppNumberContext';

export type { InteractiveComposerMode };

type ComposerPayload = SendMessagePayload;

interface InteractiveComposerProps {
  open: boolean;
  mode: InteractiveComposerMode;
  onModeChange: (mode: InteractiveComposerMode) => void;
  onClose: () => void;
  onSend: (payload: ComposerPayload) => Promise<void>;
  sending?: boolean;
  serviceWindow: ServiceWindowInfo;
}

function slugId(title: string, fallback: string) {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40);
  return slug || fallback;
}

function isValidE164(phone: string) {
  const tel = phone.replace(/[^\d+]/g, '');
  return /^\+?\d{8,15}$/.test(tel);
}

export default function InteractiveComposer({
  open,
  mode,
  onModeChange,
  onClose,
  onSend,
  sending,
  serviceWindow: _serviceWindow,
}: InteractiveComposerProps) {
  void _serviceWindow;
  const { activeNumber, resolved } = useWhatsAppNumber();
  const [header, setHeader] = useState('');
  const [body, setBody] = useState('');
  const [footer, setFooter] = useState('');
  const [buttons, setButtons] = useState([
    { id: 'btn_1', title: 'Yes' },
    { id: 'btn_2', title: 'No' },
  ]);
  const [ctaLabel, setCtaLabel] = useState('Open link');
  const [ctaUrl, setCtaUrl] = useState('https://');
  const [ctaPhone, setCtaPhone] = useState('');
  const [listButtonLabel, setListButtonLabel] = useState('View options');
  const [listSections, setListSections] = useState<ListSection[]>([emptyListSection(0)]);
  const [showRowDescriptions, setShowRowDescriptions] = useState(false);
  const [copyCodeTemplates, setCopyCodeTemplates] = useState<MessageTemplate[]>([]);
  const [templateName, setTemplateName] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [bodyParams, setBodyParams] = useState<string[]>([]);
  const activeNumberIdRef = useRef<string | null>(null);
  activeNumberIdRef.current = activeNumber?.id ?? null;
  const requestGenerationRef = useRef(0);

  useEffect(() => {
    if (!open || !resolved || !activeNumber) return;
    const requestNumberId = activeNumber.id;
    const generation = ++requestGenerationRef.current;
    templateApi
      .list({ status: 'APPROVED', all: 'true' })
      .then(({ data }) => {
        if (
          requestNumberId !== activeNumberIdRef.current ||
          generation !== requestGenerationRef.current
        ) return;
        const payload = data.data;
        const list = Array.isArray(payload) ? payload : payload?.templates || [];
        const withCopyCode = list.filter((template: MessageTemplate) =>
          getTemplateButtons(template).some((btn) => btn.type === 'COPY_CODE')
        );
        setCopyCodeTemplates(withCopyCode);
        if (withCopyCode.length) setTemplateName(withCopyCode[0].name);
      })
      .catch(() => {
        if (
          requestNumberId === activeNumberIdRef.current &&
          generation === requestGenerationRef.current
        ) {
          setCopyCodeTemplates([]);
          setTemplateName('');
        }
      });
  }, [activeNumber, open, resolved]);

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

  useEffect(() => {
    setCtaLabel((prev) => {
      if (mode === 'cta_url' && (prev === 'Call us' || !prev.trim())) return 'Open link';
      if (mode === 'cta_call' && (prev === 'Open link' || !prev.trim())) return 'Call us';
      return prev;
    });
  }, [mode]);

  const activeMode = MODES.find((entry) => entry.id === mode)!;
  const totalRows = listSections.reduce((sum, section) => sum + section.rows.length, 0);
  const validButtons = useMemo(
    () => buttons.filter((btn) => btn.title.trim()).slice(0, LIMITS.maxButtons),
    [buttons]
  );

  const canSend = useMemo(() => {
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
  }, [
    mode,
    selectedTemplate,
    couponCode,
    body,
    validButtons,
    ctaUrl,
    ctaPhone,
    listSections,
    totalRows,
  ]);

  const handleSend = useCallback(async () => {
    if (!canSend) return;

    if (mode === 'copy_code') {
      if (!selectedTemplate || !couponCode.trim()) return;
      await onSend({
        type: 'TEMPLATE',
        templateName: selectedTemplate.name,
        templateLanguage: selectedTemplate.language,
        templateParams: {
          body: bodyParams,
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
  }, [
    canSend,
    mode,
    selectedTemplate,
    couponCode,
    bodyParams,
    onSend,
    onClose,
    header,
    footer,
    validButtons,
    ctaUrl,
    ctaLabel,
    ctaPhone,
    listSections,
    totalRows,
    listButtonLabel,
  ]);

  const previewModel = useMemo((): PreviewModel => {
    const previewBody =
      mode === 'copy_code'
        ? selectedTemplate?.body ||
          selectedTemplate?.components?.find((component) => component.type === 'BODY')?.text ||
          'Your offer code message'
        : body.trim() || 'Your message will appear here';

    return {
      mode,
      header: header || undefined,
      body: previewBody,
      footer: footer || undefined,
      buttons: validButtons,
      ctaLabel,
      listButtonLabel,
      listSections,
      couponCode: couponCode || undefined,
    };
  }, [
    mode,
    selectedTemplate,
    body,
    header,
    footer,
    validButtons,
    ctaLabel,
    listButtonLabel,
    listSections,
    couponCode,
  ]);

  if (!open) return null;

  const onFormKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && canSend && !sending) {
      e.preventDefault();
      void handleSend();
    }
  };

  return (
    <div
      className="flex max-h-[min(62vh,560px)] flex-col bg-theme-surface"
      onKeyDown={onFormKeyDown}
    >
      <div className="flex min-h-0 flex-1 flex-col md:flex-row md:divide-x md:divide-violet-200/40 dark:md:divide-violet-900/30">
        <div className="inbox-composer-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-2 pt-2.5 sm:px-4 md:max-w-[60%] md:flex-[0_0_60%] md:pb-3">
          <div className="mb-2.5">
            <InteractiveTypeSwitcher
              mode={mode}
              onModeChange={onModeChange}
              size="form"
              className="w-full flex-wrap"
            />
            <p className="mt-1.5 text-[11px] font-medium text-theme-muted">{activeMode.hint}</p>
          </div>
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
                          { id: `btn_${prev.length + 1}`, title: '' },
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
                    <div key={btn.id} className="flex items-end gap-1">
                      <div className="min-w-0 flex-1">
                        <AppInput
                          label={`Button ${index + 1}`}
                          hint={charHint(btn.title, LIMITS.buttonTitle)}
                          value={btn.title}
                          onChange={(e) => {
                            const title = e.target.value.slice(0, LIMITS.buttonTitle);
                            setButtons((prev) =>
                              prev.map((entry, idx) => (idx === index ? { ...entry, title } : entry))
                            );
                          }}
                          placeholder="Label"
                          className={COMPACT_INPUT}
                          labelClassName={COMPACT_LABEL}
                        />
                      </div>
                      {buttons.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setButtons((prev) => prev.filter((_, idx) => idx !== index))
                          }
                          className="mb-0.5 shrink-0 rounded-lg p-2 text-neutral-400 transition hover:bg-red-50 hover:text-red-600"
                          aria-label={`Remove button ${index + 1}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
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
                  <ListSectionBlock
                    key={`section_${sectionIndex}_${section.rows[0]?.id ?? sectionIndex}`}
                    sectionIndex={sectionIndex}
                    section={section}
                    totalRows={totalRows}
                    listSectionsLength={listSections.length}
                    showRowDescriptions={showRowDescriptions}
                    setListSections={setListSections}
                  />
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
                  <CopyCodeEmptyState />
                )}
              </div>
            )}

            <ComposerPreviewPane
              subtitle={activeMode.label}
              className="overflow-hidden rounded-xl border border-violet-200/50 md:hidden"
            >
              <MemoizedInteractivePreview model={previewModel} />
            </ComposerPreviewPane>
          </div>
        </div>

        <ComposerPreviewPane
          subtitle={activeMode.label}
          className="hidden md:flex md:min-h-0 md:flex-[0_0_40%]"
        >
          <MemoizedInteractivePreview model={previewModel} />
        </ComposerPreviewPane>
      </div>

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
