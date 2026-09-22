import { useEffect, useRef, useState } from 'react';
import { BarChart3, Copy, Megaphone, Pencil, TestTube2, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ModalPreviewCard } from '../ui/modalUi';
import AppAlert from '../ui/AppAlert';
import AppButton from '../ui/AppButton';
import AppInput from '../ui/AppInput';
import StatusBadge from '../ui/StatusBadge';
import { WhatsAppTemplatePreview, getTemplateParts } from '../inbox/WhatsAppPreview';
import TemplateHeaderMediaField from './TemplateHeaderMediaField';
import { getFilledTemplatePreview, getTemplateHeaderFormat, templateNeedsHeaderMedia } from '../campaigns/campaignPreviewUtils';
import { templateApi } from '../../services/api';
import { getTemplateRejectedReason, getQualityLabel, countTemplateVars, getTemplateBodyText, getTemplateHeaderText } from '../../utils/templateUtils';
import { getTemplateRejectionGuide, getTemplateStatusHelp } from '../../utils/templateRejectionGuide';
import TemplateButtonExtras from './TemplateButtonExtras';
import TemplateParamField from './TemplateParamField';
import {
  fetchTemplateVariableMeta,
  paramsIncludeMappedContact,
  previewParams,
  templateDynamicUrlButtons,
  templateNeedsCoupon,
  tokenForMeta,
} from '../../utils/templateForm';
import type { MessageTemplate, TemplateUsage } from '../../types';
import { toastError, toastSuccess } from '../../utils/toast';
import { PHONE_PLACEHOLDER } from '../../utils/phone';
import { useWhatsAppNumber } from '../../contexts/WhatsAppNumberContext';

interface TemplateDetailPanelProps {
  template: MessageTemplate;
  onDuplicate: () => void;
  onResubmit: () => void;
  onDelete: () => void;
  canManage?: boolean;
}

export default function TemplateDetailPanel({
  template,
  onDuplicate,
  onResubmit,
  onDelete,
  canManage = true,
}: TemplateDetailPanelProps) {
  const [usage, setUsage] = useState<TemplateUsage | null>(null);
  const [testPhone, setTestPhone] = useState('');
  const [bodyParams, setBodyParams] = useState<string[]>([]);
  const [headerParams, setHeaderParams] = useState<string[]>([]);
  const [headerMediaUrl, setHeaderMediaUrl] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [buttonUrlSuffixes, setButtonUrlSuffixes] = useState<string[]>([]);
  const [testing, setTesting] = useState(false);
  const { activeNumber, resolved } = useWhatsAppNumber();
  const activeNumberIdRef = useRef<string | null>(null);
  activeNumberIdRef.current = activeNumber?.id ?? null;

  const parts = getTemplateParts(template);
  const quality = getQualityLabel(template.quality_score?.score);
  const rejectedReason = getTemplateRejectedReason(template.rejected_reason);
  const rejectionGuide = getTemplateRejectionGuide(template.rejected_reason);
  const statusHelp = getTemplateStatusHelp(template.status);
  const needsMedia = templateNeedsHeaderMedia(template);

  useEffect(() => {
    if (!resolved || !activeNumber) return;
    const requestNumberId = activeNumber.id;
    templateApi
      .usage(template.name)
      .then(({ data }) => {
        if (requestNumberId === activeNumberIdRef.current) {
          setUsage(data.data as TemplateUsage);
        }
      })
      .catch(() => {
        if (requestNumberId === activeNumberIdRef.current) setUsage(null);
      });
  }, [activeNumber, resolved, template.name]);

  useEffect(() => {
    let cancelled = false;
    fetchTemplateVariableMeta(template.name, template.language).then((meta) => {
      if (cancelled) return;
      setBodyParams(
        Array.from({ length: countTemplateVars(getTemplateBodyText(template)) }, (_, i) => {
          const mapped = meta.find((item) => item.scope === 'body' && item.index === i + 1);
          return tokenForMeta(mapped);
        }),
      );
      setHeaderParams(
        Array.from({ length: countTemplateVars(getTemplateHeaderText(template)) }, (_, i) => {
          const mapped = meta.find((item) => item.scope === 'header' && item.index === i + 1);
          return tokenForMeta(mapped);
        }),
      );
      setHeaderMediaUrl('');
      setCouponCode('');
      setButtonUrlSuffixes(Array.from({ length: templateDynamicUrlButtons(template).length }, () => ''));
    });
    return () => {
      cancelled = true;
    };
  }, [template]);

  const filledPreview = getFilledTemplatePreview(template, {
    bodyParams: previewParams(bodyParams),
    headerParams: previewParams(headerParams),
    couponCode,
    buttonUrlSuffixes,
  });

  const handleTestSend = async () => {
    if (!testPhone.trim()) return;
    if (templateNeedsCoupon(template) && !couponCode.trim()) {
      toastError('Add the coupon code.');
      return;
    }
    if (templateDynamicUrlButtons(template).some((_, index) => !buttonUrlSuffixes[index]?.trim())) {
      toastError('Add the unique ending for the button link.');
      return;
    }
    setTesting(true);
    try {
      await templateApi.testSend(template.name, {
        phone: testPhone.trim(),
        language: template.language,
        templateParams: {
          body: bodyParams,
          header: headerParams,
          headerMediaUrl: headerMediaUrl || undefined,
          couponCode: couponCode.trim() || undefined,
          buttonUrlSuffixes: buttonUrlSuffixes.some((value) => value.trim()) ? buttonUrlSuffixes : undefined,
        },
      });
      toastSuccess('Test template sent');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message || 'Failed to send test';
      toastError(msg);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={template.status} />
        <span className="rounded-full bg-theme-subtle px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-theme-muted ring-1 ring-theme-border">
          {template.category || '—'}
        </span>
        <span className="rounded-full bg-theme-subtle px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-theme-muted ring-1 ring-theme-border">
          {template.language || '—'}
        </span>
        {quality && (
          <span className={`text-[11px] font-bold ${quality.tone}`}>{quality.label}</span>
        )}
      </div>

      {statusHelp && (
        <AppAlert variant={template.status === 'PENDING' ? 'info' : 'warning'}>
          <p className="font-semibold">{statusHelp.title}</p>
          <p className="mt-1 text-[12px]">{statusHelp.message}</p>
        </AppAlert>
      )}

      {(rejectedReason || rejectionGuide) && (
        <div className="rounded-xl border border-amber-200/80 bg-amber-50/60 p-4 dark:border-amber-900/50 dark:bg-amber-950/30">
          <p className="text-[13px] font-bold text-amber-900 dark:text-amber-200">
            {rejectionGuide?.title ?? 'Needs changes before sending'}
          </p>
          <p className="mt-1 text-[12px] text-amber-800 dark:text-amber-300">
            {rejectionGuide?.summary ?? rejectedReason}
          </p>
          {rejectionGuide?.fixes?.length ? (
            <ul className="mt-3 list-disc space-y-1.5 pl-4 text-[12px] text-amber-900 dark:text-amber-200">
              {rejectionGuide.fixes.map((fix) => (
                <li key={fix}>{fix}</li>
              ))}
            </ul>
          ) : null}
        </div>
      )}

      <ModalPreviewCard title="Preview">
        <WhatsAppTemplatePreview
          {...filledPreview}
          headerFormat={parts.headerFormat}
          headerMediaUrl={headerMediaUrl || undefined}
        />
        {paramsIncludeMappedContact([...bodyParams, ...headerParams]) && (
          <p className="mt-2 text-[11px] font-medium text-theme-secondary">
            Name is a sample. Each person gets their own.
          </p>
        )}
      </ModalPreviewCard>

      {template.status === 'APPROVED' && (
        <>
          <div className="rounded-xl border border-theme-border bg-theme-subtle/30 p-4">
            <p className="flex items-center gap-2 text-[12px] font-bold text-theme-fg">
              <TestTube2 className="h-4 w-4 text-emerald-600" />
              Test send
            </p>
            <p className="mt-1 text-[11px] text-theme-secondary">
              Send this template to your phone before using it in a campaign.
            </p>

            {bodyParams.map((_, i) => (
              <div key={`test-body-${i}`} className="mt-3">
                <TemplateParamField
                  id={`test-body-${i}`}
                  compact
                  label={`Body {{${i + 1}}}`}
                  value={bodyParams[i]}
                  onChange={(next) => {
                    const nextParams = [...bodyParams];
                    nextParams[i] = next;
                    setBodyParams(nextParams);
                  }}
                />
              </div>
            ))}
            {headerParams.map((_, i) => (
              <div key={`test-header-${i}`} className="mt-3">
                <TemplateParamField
                  id={`test-header-${i}`}
                  compact
                  label={`Header {{${i + 1}}}`}
                  value={headerParams[i]}
                  onChange={(next) => {
                    const nextParams = [...headerParams];
                    nextParams[i] = next;
                    setHeaderParams(nextParams);
                  }}
                />
              </div>
            ))}
            {needsMedia && (
              <div className="mt-3">
                <TemplateHeaderMediaField
                  format={getTemplateHeaderFormat(template) as 'IMAGE' | 'VIDEO' | 'DOCUMENT'}
                  value={headerMediaUrl}
                  onChange={setHeaderMediaUrl}
                  required
                />
              </div>
            )}
            <div className="mt-3 space-y-3">
              <TemplateButtonExtras
                compact
                template={template}
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

            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
              <AppInput
                className="flex-1"
                label="Your phone number"
                placeholder={PHONE_PLACEHOLDER}
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
              />
              <AppButton
                type="button"
                variant="secondary"
                icon={<TestTube2 size={14} />}
                onClick={handleTestSend}
                loading={testing}
                disabled={!testPhone.trim() || !canManage}
              >
                Send test
              </AppButton>
            </div>
          </div>

          <Link
            to={`/campaigns?template=${encodeURIComponent(template.name)}&language=${encodeURIComponent(template.language)}`}
            className="flex items-center justify-center gap-2 rounded-xl border border-theme-border bg-theme-subtle/40 px-4 py-3 text-[13px] font-bold text-violet-700 transition hover:bg-theme-subtle dark:text-violet-300"
          >
            <Megaphone className="h-4 w-4" />
            Use in campaign
          </Link>
        </>
      )}

      {['REJECTED', 'PAUSED', 'DISABLED'].includes(template.status) && (
      <AppButton variant="secondary" icon={<Pencil size={14} />} onClick={onResubmit} disabled={!canManage}>
          Edit & resubmit
        </AppButton>
      )}

      {usage && usage.totals.campaignCount > 0 && (
        <div className="rounded-2xl border border-theme-border bg-theme-subtle/40 p-4">
          <p className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-wide text-theme-muted">
            <BarChart3 className="h-4 w-4" />
            Usage analytics
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl bg-theme-surface p-3 ring-1 ring-theme-border">
              <p className="text-[10px] font-bold uppercase text-theme-muted">Campaigns</p>
              <p className="mt-1 text-lg font-extrabold text-theme-fg">{usage.totals.campaignCount}</p>
            </div>
            <div className="rounded-xl bg-theme-surface p-3 ring-1 ring-theme-border">
              <p className="text-[10px] font-bold uppercase text-theme-muted">Sent</p>
              <p className="mt-1 text-lg font-extrabold text-theme-fg">{usage.totals.totalSent}</p>
            </div>
            <div className="rounded-xl bg-theme-surface p-3 ring-1 ring-theme-border">
              <p className="text-[10px] font-bold uppercase text-theme-muted">Delivered</p>
              <p className="mt-1 text-lg font-extrabold text-emerald-700">{usage.totals.totalDelivered}</p>
            </div>
            <div className="rounded-xl bg-theme-surface p-3 ring-1 ring-theme-border">
              <p className="text-[10px] font-bold uppercase text-theme-muted">Failed</p>
              <p className="mt-1 text-lg font-extrabold text-red-600">{usage.totals.totalFailed}</p>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-t border-theme-border pt-4">
        <AppButton variant="secondary" size="sm" icon={<Copy size={14} />} onClick={onDuplicate} disabled={!canManage}>
          Duplicate
        </AppButton>
        <AppButton variant="danger" size="sm" icon={<Trash2 size={14} />} onClick={onDelete} disabled={!canManage}>
          Delete
        </AppButton>
      </div>
    </div>
  );
}
