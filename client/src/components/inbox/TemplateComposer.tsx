import { useEffect, useMemo, useState } from 'react';
import { Send } from 'lucide-react';
import AppButton from '../ui/AppButton';
import AppInput from '../ui/AppInput';
import TemplatePicker from './TemplatePicker';
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
  /** Show a compact 24h-window hint inside the form body (not a duplicate page title). */
  windowClosed?: boolean;
}

/** Session cache so reopening Template tab doesn’t flash empty / re-fetch every time. */
let approvedTemplatesCache: MessageTemplate[] | null = null;

export function invalidateApprovedTemplatesCache() {
  approvedTemplatesCache = null;
}

export default function TemplateComposer({
  onSend,
  sending,
  onCancel,
  windowClosed,
}: TemplateComposerProps) {
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
      <div className="bg-theme-surface px-3 py-3 sm:px-4">
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
      <div className="bg-theme-surface px-4 py-4">
        <p className="text-[13px] font-bold text-theme-fg">No approved templates</p>
        <p className="mt-1 text-[12px] text-theme-secondary">
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
      className="flex max-h-[min(62vh,560px)] flex-col bg-theme-surface"
    >
      <div className="flex min-h-0 flex-1 flex-col md:flex-row md:divide-x md:divide-theme-border/60">
        {/* Left: inputs — sole scroll region on desktop; includes mobile preview in same scroll */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-2 pt-2.5 sm:px-4 md:max-w-[60%] md:flex-[0_0_60%] md:pb-3">
          <div className="space-y-3">
            {windowClosed ? (
              <p className="rounded-lg bg-amber-50/90 px-2.5 py-1.5 text-[11px] font-medium text-amber-900 ring-1 ring-amber-200/70 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-800/45">
                24-hour reply window is closed — send an approved template to restart the conversation.
              </p>
            ) : (
              <p className="rounded-lg bg-emerald-50/80 px-2.5 py-1.5 text-[11px] font-medium text-emerald-900 ring-1 ring-emerald-200/60 dark:bg-emerald-950/35 dark:text-emerald-200 dark:ring-emerald-800/40">
                Templates can be sent anytime — useful for proactive updates even while the chat window is open.
              </p>
            )}
            <TemplatePicker
              templates={templates}
              value={templateName}
              onChange={handleTemplateChange}
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
            className="hidden md:flex md:min-h-0 md:flex-[0_0_40%]"
          >
            {previewCard}
          </ComposerPreviewPane>
        )}
      </div>

      <div className="flex shrink-0 items-center justify-end gap-2 border-t border-theme-border/80 bg-theme-surface/95 px-3 py-2.5 backdrop-blur-sm sm:px-4">
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
