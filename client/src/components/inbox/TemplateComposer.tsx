import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Send } from 'lucide-react';
import AppButton from '../ui/AppButton';
import AppInput from '../ui/AppInput';
import TemplatePicker from './TemplatePicker';
import TemplateParamField from '../templates/TemplateParamField';
import { ComposerPreviewPane, WhatsAppTemplatePreview, getTemplateParts } from './WhatsAppPreview';
import {
  getFilledTemplatePreview,
  templateNeedsHeaderMedia,
} from '../campaigns/campaignPreviewUtils';
import TemplateButtonExtras from '../templates/TemplateButtonExtras';
import { templateApi } from '../../services/api';
import { getErrorMessage } from '../../utils/errors';
import { countTemplateVars, getTemplateBodyText, getTemplateHeaderText } from '../../utils/templateUtils';
import {
  fetchTemplateVariableMeta,
  previewParams,
  templateDynamicUrlButtons,
  templateNeedsCoupon,
  tokenForMeta,
  variableDescription,
  type TemplateVariableMeta,
} from '../../utils/templateForm';
import type { MessageTemplate, TemplateParams } from '../../types';
import { asCustomAttributes } from '../../utils/customAttributes';

interface TemplateComposerProps {
  onSend: (payload: {
    templateName: string;
    templateLanguage: string;
    templateParams?: TemplateParams;
  }) => void;
  sending: boolean;
  onCancel: () => void;
  /** Show a compact 24h-window hint inside the form body (not a duplicate page title). */
  windowClosed?: boolean;
  contactName?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  contactCustomAttributes?: Record<string, string> | unknown | null;
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
  contactName,
  contactPhone,
  contactEmail,
  contactCustomAttributes,
}: TemplateComposerProps) {
  const [templates, setTemplates] = useState<MessageTemplate[]>(() => approvedTemplatesCache ?? []);
  const [loading, setLoading] = useState(() => !approvedTemplatesCache);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState(
    () => approvedTemplatesCache?.[0]?.name ?? '',
  );
  const [bodyParams, setBodyParams] = useState<string[]>([]);
  const [headerParams, setHeaderParams] = useState<string[]>([]);
  const [headerMediaUrl, setHeaderMediaUrl] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [buttonUrlSuffixes, setButtonUrlSuffixes] = useState<string[]>([]);
  const [variableMeta, setVariableMeta] = useState<TemplateVariableMeta[]>([]);

  const loadApprovedTemplates = () => {
    let cancelled = false;
    setLoading(true);
    templateApi
      .list({ status: 'APPROVED', all: 'true' })
      .then(({ data }) => {
        if (cancelled) return;
        const payload = data.data;
        const list = Array.isArray(payload) ? payload : payload?.templates || [];
        approvedTemplatesCache = list;
        setTemplates(list);
        setLoadError(null);
        if (list.length) setTemplateName((prev) => prev || list[0].name);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoadError(getErrorMessage(err, 'Couldn’t load approved templates. Try again.'));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  };

  useEffect(() => {
    if (approvedTemplatesCache) {
      setTemplates(approvedTemplatesCache);
      setLoading(false);
      setLoadError(null);
      if (!templateName && approvedTemplatesCache.length) {
        setTemplateName(approvedTemplatesCache[0].name);
      }
      return;
    }

    return loadApprovedTemplates();
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
      setCouponCode('');
      setButtonUrlSuffixes([]);
      setVariableMeta([]);
      return;
    }
    const bodyCount = countTemplateVars(getTemplateBodyText(selected));
    const headerCount = countTemplateVars(getTemplateHeaderText(selected));
    setBodyParams(Array.from({ length: bodyCount }, () => ''));
    setHeaderParams(Array.from({ length: headerCount }, () => ''));
    setHeaderMediaUrl('');
    setCouponCode('');
    setButtonUrlSuffixes(Array.from({ length: templateDynamicUrlButtons(selected).length }, () => ''));
    let cancelled = false;
    fetchTemplateVariableMeta(selected.name, selected.language).then((meta) => {
      if (cancelled) return;
      setVariableMeta(meta);
      setBodyParams(
        Array.from({ length: bodyCount }, (_, i) => {
          const m = meta.find((v) => v.scope === 'body' && v.index === i + 1);
          return tokenForMeta(m);
        }),
      );
      setHeaderParams(
        Array.from({ length: headerCount }, (_, i) => {
          const m = meta.find((v) => v.scope === 'header' && v.index === i + 1);
          return tokenForMeta(m);
        }),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [selected]);

  const contactPreview = {
    name: contactName,
    phone: contactPhone,
    email: contactEmail,
    customAttributes: asCustomAttributes(contactCustomAttributes),
  };
  const preview = selected
    ? getFilledTemplatePreview(selected, {
        bodyParams: previewParams(bodyParams, contactPreview),
        headerParams: previewParams(headerParams, contactPreview),
        couponCode,
        buttonUrlSuffixes,
      })
    : null;

  const handleTemplateChange = (name: string) => {
    setTemplateName(name);
  };

  const needsCoupon = selected ? templateNeedsCoupon(selected) : false;
  const missingVars = [...bodyParams, ...headerParams].some((value) => !value.trim());
  const missingCoupon = needsCoupon && !couponCode.trim();
  const missingUrls = selected
    ? templateDynamicUrlButtons(selected).some((_, index) => !buttonUrlSuffixes[index]?.trim())
    : false;
  const canSendTemplate = Boolean(selected) && !missingVars && !missingCoupon && !missingUrls
    && (!selected || !templateNeedsHeaderMedia(selected) || Boolean(headerMediaUrl.trim()));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !canSendTemplate) return;
    onSend({
      templateName: selected.name,
      templateLanguage: selected.language,
      templateParams: {
        body: bodyParams,
        header: headerParams,
        headerMediaUrl: headerMediaUrl || undefined,
        couponCode: couponCode.trim() || undefined,
        buttonUrlSuffixes: buttonUrlSuffixes.some((value) => value.trim()) ? buttonUrlSuffixes : undefined,
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

  if (loading && templates.length === 0 && !loadError) {
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

  if (loadError && templates.length === 0) {
    return (
      <div className="bg-theme-surface px-4 py-4">
        <p className="text-[13px] font-bold text-theme-fg">Couldn’t load approved templates</p>
        <p className="mt-1 text-[12px] text-theme-secondary">
          This is not an empty list — WhatsApp didn’t return templates. Try again.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <AppButton type="button" size="sm" onClick={() => loadApprovedTemplates()}>
            Try again
          </AppButton>
          <AppButton type="button" variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </AppButton>
        </div>
      </div>
    );
  }

  if (!templates.length) {
    return (
      <div className="bg-theme-surface px-4 py-4">
        <p className="text-[13px] font-bold text-theme-fg">No approved templates</p>
        <p className="mt-1 text-[12px] text-theme-secondary">
          Add a Meta library template to message outside the 24-hour window immediately, or create
          your own for WhatsApp review.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            to="/templates/library"
            className="inline-flex min-h-9 items-center rounded-xl bg-emerald-600 px-3 text-[12px] font-bold text-white hover:bg-emerald-700"
          >
            Browse library
          </Link>
          <Link
            to="/templates/new"
            className="inline-flex min-h-9 items-center rounded-xl border border-theme-border px-3 text-[12px] font-bold text-theme-secondary hover:bg-theme-subtle"
          >
            Create template
          </Link>
          <AppButton type="button" variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </AppButton>
        </div>
      </div>
    );
  }

  const hasVars =
    bodyParams.length > 0 ||
    headerParams.length > 0 ||
    Boolean(selected && templateNeedsHeaderMedia(selected)) ||
    Boolean(selected && (templateNeedsCoupon(selected) || templateDynamicUrlButtons(selected).length > 0));

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
                    {headerParams.map((value, i) => (
                      <TemplateParamField
                        key={`inbox-header-${selected?.name ?? 't'}-${i}`}
                        id={`inbox-header-${i}`}
                        compact
                        label={`Header ${variableDescription(variableMeta, 'header', i, `{{${i + 1}}}`)}`}
                        placeholder="Type a value"
                        value={value}
                        contact={contactPreview}
                        labelClassName="text-[11px] font-semibold text-theme-secondary"
                        onChange={(next) => {
                          setHeaderParams((prev) => {
                            const nextParams = [...prev];
                            nextParams[i] = next;
                            return nextParams;
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
                    {bodyParams.map((value, i) => (
                      <TemplateParamField
                        key={`inbox-body-${selected?.name ?? 't'}-${i}`}
                        id={`inbox-body-${i}`}
                        compact
                        label={`Body ${variableDescription(variableMeta, 'body', i, `{{${i + 1}}}`)}`}
                        placeholder="Type a value"
                        value={value}
                        contact={contactPreview}
                        labelClassName="text-[11px] font-semibold text-theme-secondary"
                        onChange={(next) => {
                          setBodyParams((prev) => {
                            const nextParams = [...prev];
                            nextParams[i] = next;
                            return nextParams;
                          });
                        }}
                      />
                    ))}
                  </div>
                )}

                <TemplateButtonExtras
                  compact
                  template={selected}
                  couponCode={couponCode}
                  buttonUrlSuffixes={buttonUrlSuffixes}
                  onCouponChange={setCouponCode}
                  onSuffixChange={(index, value) => {
                    setButtonUrlSuffixes((prev) => {
                      const next = [...prev];
                      while (next.length <= index) next.push('');
                      next[index] = value;
                      return next;
                    });
                  }}
                />
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
          disabled={!canSendTemplate}
        >
          Send template
        </AppButton>
      </div>
    </form>
  );
}
