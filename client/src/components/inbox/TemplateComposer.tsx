import { useEffect, useMemo, useState } from 'react';
import { LayoutTemplate, Send, X } from 'lucide-react';
import AppButton from '../ui/AppButton';
import AppInput from '../ui/AppInput';
import AppSelect from '../ui/AppSelect';
import { ComposerPreviewPane, WhatsAppTemplatePreview, getTemplateParts } from './WhatsAppPreview';
import {
  getFilledTemplatePreview,
  templateNeedsHeaderMedia,
} from '../campaigns/campaignPreviewUtils';
import { templateApi } from '../../services/api';
import { countTemplateVars, getTemplateBodyText, getTemplateHeaderText } from '../../utils/templateUtils';
import type { MessageTemplate } from '../../types';

interface TemplateComposerProps {
  onSend: (payload: {
    templateName: string;
    templateLanguage: string;
    templateParams?: { body?: string[]; header?: string[]; headerMediaUrl?: string };
  }) => void;
  sending: boolean;
  onCancel: () => void;
}

/** Session cache so reopening Template tab doesn’t flash empty / re-fetch every time. */
let approvedTemplatesCache: MessageTemplate[] | null = null;

export default function TemplateComposer({ onSend, sending, onCancel }: TemplateComposerProps) {
  const [templates, setTemplates] = useState<MessageTemplate[]>(() => approvedTemplatesCache ?? []);
  const [loading, setLoading] = useState(() => !approvedTemplatesCache);
  const [templateName, setTemplateName] = useState(
    () => approvedTemplatesCache?.[0]?.name ?? '',
  );
  const [bodyParams, setBodyParams] = useState<string[]>([]);
  const [headerParams, setHeaderParams] = useState<string[]>([]);
  const [headerMediaUrl, setHeaderMediaUrl] = useState('');

  useEffect(() => {
    if (approvedTemplatesCache) {
      setTemplates(approvedTemplatesCache);
      setLoading(false);
      if (!templateName && approvedTemplatesCache.length) {
        setTemplateName(approvedTemplatesCache[0].name);
      }
      return;
    }

    let cancelled = false;
    templateApi
      .list({ status: 'APPROVED', all: 'true' })
      .then(({ data }) => {
        if (cancelled) return;
        const payload = data.data;
        const list = Array.isArray(payload) ? payload : payload?.templates || [];
        approvedTemplatesCache = list;
        setTemplates(list);
        if (list.length) setTemplateName((prev) => prev || list[0].name);
      })
      .catch(() => {
        if (!cancelled) setTemplates([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrate once; cache handles revisits
  }, []);

  const selected = useMemo(
    () => templates.find((t) => t.name === templateName),
    [templates, templateName],
  );

  useEffect(() => {
    if (!selected) {
      setBodyParams([]);
      setHeaderParams([]);
      setHeaderMediaUrl('');
      return;
    }
    setBodyParams(Array(countTemplateVars(getTemplateBodyText(selected))).fill(''));
    setHeaderParams(Array(countTemplateVars(getTemplateHeaderText(selected))).fill(''));
    setHeaderMediaUrl('');
  }, [selected]);

  const preview = selected
    ? getFilledTemplatePreview(selected, { bodyParams, headerParams })
    : null;

  const handleTemplateChange = (name: string) => {
    setTemplateName(name);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    onSend({
      templateName: selected.name,
      templateLanguage: selected.language,
      templateParams: {
        body: bodyParams.filter(Boolean),
        header: headerParams.filter(Boolean),
        headerMediaUrl: headerMediaUrl || undefined,
      },
    });
  };

  const previewCard =
    preview && selected ? (
      <WhatsAppTemplatePreview
        {...preview}
        headerFormat={getTemplateParts(selected).headerFormat}
        headerMediaUrl={headerMediaUrl || undefined}
        variant="compact"
        direction="outbound"
        showSurface={false}
      />
    ) : null;

  if (loading) {
    return (
      <div className="border-t border-amber-200/80 bg-gradient-to-b from-amber-50/95 to-theme-surface px-3 py-3 sm:px-4 dark:from-amber-950/30">
        <div className="mb-3 flex items-center gap-2">
          <div className="inbox-skeleton-shimmer h-8 w-8 rounded-lg" />
          <div className="space-y-1.5">
            <div className="inbox-skeleton-shimmer h-3.5 w-28 rounded" />
            <div className="inbox-skeleton-shimmer h-2.5 w-36 rounded" />
          </div>
        </div>
        <div className="inbox-skeleton-shimmer mb-2 h-3 w-24 rounded" />
        <div className="inbox-skeleton-shimmer h-11 w-full rounded-xl" />
        <div className="mt-3 flex justify-end gap-2">
          <div className="inbox-skeleton-shimmer h-9 w-16 rounded-xl" />
          <div className="inbox-skeleton-shimmer h-9 w-28 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!templates.length) {
    return (
      <div className="border-t border-amber-200/80 bg-gradient-to-r from-amber-50/95 to-orange-50/60 px-4 py-4 dark:from-amber-950/30 dark:to-orange-950/20">
        <p className="text-[13px] font-bold text-amber-950">No approved templates</p>
        <p className="mt-1 text-[12px] text-amber-900/85">
          Create and get a template approved under Templates to message outside the 24-hour window.
        </p>
        <AppButton type="button" variant="ghost" size="sm" className="mt-2" onClick={onCancel}>
          Cancel
        </AppButton>
      </div>
    );
  }

  const hasVars = bodyParams.length > 0 || headerParams.length > 0 || Boolean(selected && templateNeedsHeaderMedia(selected));

  return (
    <form
      onSubmit={handleSubmit}
      className="flex max-h-[min(58vh,520px)] flex-col border-t border-amber-200/80 bg-gradient-to-b from-amber-50/95 to-theme-surface dark:from-amber-950/30"
    >
      <div className="flex shrink-0 items-center justify-between gap-2 px-3 pb-2 pt-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
            <LayoutTemplate className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-bold text-amber-950 dark:text-amber-200">Send template</p>
            <p className="truncate text-[11px] font-medium text-amber-800/80 dark:text-amber-400">
              24-hour window closed
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="shrink-0 rounded-lg p-1.5 text-amber-700 transition hover:bg-amber-100/80 dark:text-amber-300 dark:hover:bg-amber-900/40"
          aria-label="Cancel template send"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row md:divide-x md:divide-theme-border/60">
        {/* Left: inputs — sole scroll region on desktop; includes mobile preview in same scroll */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-2 sm:px-4 md:max-w-[50%] md:flex-[0_0_48%] md:pb-3">
          <div className="space-y-3">
            <AppSelect
              label="Approved template"
              value={templateName}
              options={templates.map((t) => ({
                value: t.name,
                label: `${t.name} (${t.language})`,
              }))}
              onChange={(e) => handleTemplateChange(e.target.value)}
              isSearchable
            />

            {hasVars && (
              <div className="space-y-2.5">
                {(headerParams.length > 0 || (selected && templateNeedsHeaderMedia(selected))) && (
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    {headerParams.map((_, i) => (
                      <AppInput
                        key={`inbox-header-${selected?.name ?? 't'}-${i}`}
                        label={`Header {{${i + 1}}}`}
                        value={headerParams[i]}
                        className="!h-9 text-[13px]"
                        labelClassName="text-[11px] font-semibold text-theme-secondary"
                        onChange={(e) => {
                          const value = e.target.value;
                          setHeaderParams((prev) => {
                            const next = [...prev];
                            next[i] = value;
                            return next;
                          });
                        }}
                      />
                    ))}
                    {selected && templateNeedsHeaderMedia(selected) && (
                      <AppInput
                        className={`!h-9 text-[13px] ${headerParams.length % 2 === 1 ? '' : 'sm:col-span-2'}`}
                        label="Header media URL"
                        placeholder="https://..."
                        value={headerMediaUrl}
                        labelClassName="text-[11px] font-semibold text-theme-secondary"
                        onChange={(e) => setHeaderMediaUrl(e.target.value)}
                      />
                    )}
                  </div>
                )}

                {bodyParams.length > 0 && (
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    {bodyParams.map((_, i) => (
                      <AppInput
                        key={`inbox-body-${selected?.name ?? 't'}-${i}`}
                        label={`Body {{${i + 1}}}`}
                        value={bodyParams[i]}
                        className="!h-9 text-[13px]"
                        labelClassName="text-[11px] font-semibold text-theme-secondary"
                        onChange={(e) => {
                          const value = e.target.value;
                          setBodyParams((prev) => {
                            const next = [...prev];
                            next[i] = value;
                            return next;
                          });
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Mobile: preview below inputs, no inner scroll */}
            {previewCard && selected && (
              <ComposerPreviewPane
                subtitle={selected.name}
                className="overflow-hidden rounded-xl border border-theme-border/80 md:hidden"
              >
                {previewCard}
              </ComposerPreviewPane>
            )}
          </div>
        </div>

        {/* Right: sticky live preview (desktop only) */}
        {previewCard && selected && (
          <ComposerPreviewPane
            subtitle={selected.name}
            className="hidden md:flex md:min-h-0 md:flex-[0_0_52%]"
          >
            {previewCard}
          </ComposerPreviewPane>
        )}
      </div>

      <div className="flex shrink-0 items-center justify-end gap-2 border-t border-amber-200/60 bg-theme-surface/95 px-3 py-2.5 backdrop-blur-sm sm:px-4 dark:border-amber-900/40">
        <AppButton type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </AppButton>
        <AppButton
          type="submit"
          size="sm"
          icon={<Send size={14} />}
          loading={sending}
          disabled={!selected}
        >
          Send template
        </AppButton>
      </div>
    </form>
  );
}
