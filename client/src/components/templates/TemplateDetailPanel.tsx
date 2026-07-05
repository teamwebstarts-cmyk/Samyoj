import { useEffect, useState } from 'react';
import { BarChart3, Copy, Megaphone, Pencil, TestTube2, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ModalPreviewCard } from '../ui/modalUi';
import AppAlert from '../ui/AppAlert';
import AppButton from '../ui/AppButton';
import AppInput from '../ui/AppInput';
import StatusBadge from '../ui/StatusBadge';
import { WhatsAppTemplatePreview, getTemplateParts } from '../inbox/WhatsAppPreview';
import { getFilledTemplatePreview, templateNeedsHeaderMedia } from '../campaigns/campaignPreviewUtils';
import { templateApi } from '../../services/api';
import { getTemplateRejectedReason, getQualityLabel, countTemplateVars, getTemplateBodyText, getTemplateHeaderText } from '../../utils/templateUtils';
import type { MessageTemplate, TemplateUsage } from '../../types';
import { toastError, toastSuccess } from '../../utils/toast';
import { PHONE_PLACEHOLDER } from '../../utils/phone';

interface TemplateDetailPanelProps {
  template: MessageTemplate;
  onDuplicate: () => void;
  onResubmit: () => void;
  onDelete: () => void;
}

export default function TemplateDetailPanel({
  template,
  onDuplicate,
  onResubmit,
  onDelete,
}: TemplateDetailPanelProps) {
  const [usage, setUsage] = useState<TemplateUsage | null>(null);
  const [testPhone, setTestPhone] = useState('');
  const [bodyParams, setBodyParams] = useState<string[]>([]);
  const [headerParams, setHeaderParams] = useState<string[]>([]);
  const [headerMediaUrl, setHeaderMediaUrl] = useState('');
  const [testing, setTesting] = useState(false);

  const parts = getTemplateParts(template);
  const quality = getQualityLabel(template.quality_score?.score);
  const rejectedReason = getTemplateRejectedReason(template.rejected_reason);
  const needsMedia = templateNeedsHeaderMedia(template);

  useEffect(() => {
    templateApi
      .usage(template.name)
      .then(({ data }) => setUsage(data.data as TemplateUsage))
      .catch(() => setUsage(null));
  }, [template.name]);

  useEffect(() => {
    setBodyParams(Array(countTemplateVars(getTemplateBodyText(template))).fill(''));
    setHeaderParams(Array(countTemplateVars(getTemplateHeaderText(template))).fill(''));
    setHeaderMediaUrl('');
  }, [template]);

  const filledPreview = getFilledTemplatePreview(template, { bodyParams, headerParams });

  const handleTestSend = async () => {
    if (!testPhone.trim()) return;
    setTesting(true);
    try {
      await templateApi.testSend(template.name, {
        phone: testPhone.trim(),
        language: template.language,
        templateParams: {
          body: bodyParams.filter(Boolean),
          header: headerParams.filter(Boolean),
          headerMediaUrl: headerMediaUrl || undefined,
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

      {rejectedReason && (
        <AppAlert variant="error">{rejectedReason}</AppAlert>
      )}

      <ModalPreviewCard title="Preview">
        <WhatsAppTemplatePreview
          {...filledPreview}
          headerFormat={parts.headerFormat}
          headerMediaUrl={headerMediaUrl || undefined}
        />
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
              <AppInput
                key={`test-body-${i}`}
                className="mt-3"
                label={`Body {{${i + 1}}}`}
                value={bodyParams[i]}
                onChange={(e) => {
                  const next = [...bodyParams];
                  next[i] = e.target.value;
                  setBodyParams(next);
                }}
              />
            ))}
            {headerParams.map((_, i) => (
              <AppInput
                key={`test-header-${i}`}
                className="mt-3"
                label={`Header {{${i + 1}}}`}
                value={headerParams[i]}
                onChange={(e) => {
                  const next = [...headerParams];
                  next[i] = e.target.value;
                  setHeaderParams(next);
                }}
              />
            ))}
            {needsMedia && (
              <AppInput
                className="mt-3"
                label="Header media URL"
                placeholder="https://..."
                value={headerMediaUrl}
                onChange={(e) => setHeaderMediaUrl(e.target.value)}
              />
            )}

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
                disabled={!testPhone.trim()}
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

      {['REJECTED', 'PAUSED'].includes(template.status) && (
        <AppButton variant="secondary" icon={<Pencil size={14} />} onClick={onResubmit}>
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
        <AppButton variant="secondary" size="sm" icon={<Copy size={14} />} onClick={onDuplicate}>
          Duplicate
        </AppButton>
        <AppButton variant="danger" size="sm" icon={<Trash2 size={14} />} onClick={onDelete}>
          Delete
        </AppButton>
      </div>
    </div>
  );
}
