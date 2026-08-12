import { CheckCircle2, Gift, Info, MessageCircle, ShieldCheck, Users, Zap } from 'lucide-react';
import type { MessageTemplate } from '../../../types';
import type { CampaignWizardForm } from './campaignWizardModel';
import type { AudiencePreviewMetrics } from '../CampaignAudiencePreview';

export interface CampaignQuotaData {
  sentToday: number;
  limit: number;
  remaining: number;
  batchSize: number;
  batchDelayMs: number;
}

interface CampaignWizardSummaryRailProps {
  form: CampaignWizardForm;
  selectedTemplate?: MessageTemplate;
  channelLabel: string;
  includedCount: number | null;
  audienceMetrics?: AudiencePreviewMetrics | null;
  estimatedCost?: number | null;
  quota: CampaignQuotaData | null;
  variant: 'audience' | 'review';
}

function audienceLabel(form: CampaignWizardForm) {
  switch (form.audienceType) {
    case 'MANUAL':
      return 'Phone numbers';
    case 'TAGS':
      return 'Contact tags';
    case 'CONTACTS':
      return 'Selected contacts';
    default:
      return 'Consented contacts';
  }
}

function NumberValue({ value }: { value: number | null }) {
  return (
    <span className="font-extrabold tabular-nums text-slate-900 dark:text-white">
      {value === null ? '—' : value.toLocaleString()}
    </span>
  );
}

function QuotaCard({ quota }: { quota: CampaignQuotaData | null }) {
  const usedPct = quota ? Math.min(100, Math.round((quota.sentToday / Math.max(quota.limit, 1)) * 100)) : 0;
  return (
    <section className="campaign-wizard-card overflow-hidden">
      <div className="flex items-center gap-2 border-b border-slate-100 px-3.5 py-3 dark:border-slate-800">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300">
          <Zap className="h-3.5 w-3.5" strokeWidth={2.25} />
        </span>
        <p className="text-[12px] font-extrabold text-slate-900 dark:text-white">Daily campaign limit</p>
      </div>
      <div className="space-y-2.5 p-3.5">
        <div className="flex items-center justify-between gap-2 text-[10px]">
          <span className="font-medium text-slate-500">
            {quota ? `${quota.sentToday.toLocaleString()} of ${quota.limit.toLocaleString()} used` : 'Checking limit…'}
          </span>
          <span className="font-extrabold text-emerald-600">{quota ? `${usedPct}%` : '—'}</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${usedPct}%` }}
          />
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-emerald-50/70 px-2.5 py-2 dark:bg-emerald-950/25">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-300" />
          <p className="text-[10px] font-semibold leading-relaxed text-emerald-800 dark:text-emerald-200">
            {quota
              ? `${quota.remaining.toLocaleString()} messages remain today.`
              : 'Your daily sending limit will appear here.'}
          </p>
        </div>
      </div>
    </section>
  );
}

export default function CampaignWizardSummaryRail({
  form,
  selectedTemplate,
  channelLabel,
  includedCount,
  audienceMetrics,
  estimatedCost,
  quota,
  variant,
}: CampaignWizardSummaryRailProps) {
  return (
    <aside className="space-y-3">
      <section className="campaign-wizard-card overflow-hidden">
        <div className="border-b border-slate-100 px-3.5 py-3 dark:border-slate-800">
          <h2 className="text-[13px] font-extrabold text-slate-900 dark:text-white">
            {variant === 'review' ? 'Campaign summary' : 'Audience summary'}
          </h2>
        </div>
        <div className="space-y-3 p-3.5">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-slate-400">Campaign name</p>
            <p className="mt-1 truncate text-[11px] font-extrabold text-slate-800 dark:text-slate-200">
              {form.name || 'Untitled campaign'}
            </p>
          </div>

          <div className="flex items-start gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600 dark:bg-violet-950/50 dark:text-violet-300">
              <Gift className="h-3.5 w-3.5" strokeWidth={2.2} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[11px] font-extrabold text-slate-800 dark:text-slate-200">
                {selectedTemplate?.name || 'No template selected'}
              </p>
              <p className="mt-0.5 truncate text-[9px] font-medium text-slate-400">
                {selectedTemplate ? `${selectedTemplate.language} · ${selectedTemplate.category}` : 'Choose an approved template'}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
            <MessageCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-300" />
            <div className="min-w-0">
              <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-slate-400">WhatsApp channel</p>
              <p className="mt-1 truncate text-[11px] font-bold text-slate-800 dark:text-slate-200">
                {channelLabel}
              </p>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-3 dark:border-slate-800">
            <p className="text-[9px] font-bold text-slate-400">Audience</p>
            <p className="mt-1 text-[11px] font-extrabold text-slate-800 dark:text-slate-200">
              {audienceLabel(form)}
            </p>
          </div>

          {variant === 'audience' && (
            <div className="border-t border-slate-100 pt-3 dark:border-slate-800">
              <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-slate-400">Reach estimate</p>
              <div className="mt-2 space-y-1.5">
                <div className="flex items-center justify-between gap-2 text-[10px]">
                  <span className="font-medium text-slate-500">Opted-in recipients</span>
                  <NumberValue value={audienceMetrics?.optedIn ?? includedCount} />
                </div>
                <div className="flex items-center justify-between gap-2 text-[10px]">
                  <span className="font-medium text-slate-500">Estimated failed</span>
                  <span className="font-extrabold tabular-nums text-slate-700 dark:text-slate-200">
                    {audienceMetrics?.estimatedFailed == null
                      ? '—'
                      : `~${audienceMetrics.estimatedFailed.toLocaleString()} (1%)`}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 text-[10px]">
                  <span className="font-medium text-slate-500">Estimated to reach</span>
                  <span className="font-extrabold tabular-nums text-emerald-600 dark:text-emerald-300">
                    {audienceMetrics?.estimatedReach == null
                      ? '—'
                      : `~${audienceMetrics.estimatedReach.toLocaleString()}`}
                  </span>
                </div>
              </div>
            </div>
          )}

          {estimatedCost != null && estimatedCost > 0 && (
            <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-[10px] dark:border-slate-800">
              <span className="font-semibold text-slate-500">Estimated cost</span>
              <span className="font-extrabold text-amber-700 dark:text-amber-300">
                ₹{estimatedCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
          )}
        </div>
      </section>

      <QuotaCard quota={quota} />

      {variant === 'review' ? (
        <>
          <section className="campaign-wizard-card overflow-hidden">
            <div className="border-b border-slate-100 px-3.5 py-3 dark:border-slate-800">
              <h2 className="text-[12px] font-extrabold text-slate-900 dark:text-white">What happens next?</h2>
            </div>
            <ol className="space-y-3 p-3.5">
              {[
                'Campaign will start sending.',
                'You can monitor real-time progress.',
                'Results will be available after delivery.',
              ].map((item, index) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-[9px] font-extrabold text-white">
                    {index + 1}
                  </span>
                  <span className="text-[10px] font-semibold leading-relaxed text-slate-600 dark:text-slate-300">
                    {item}
                  </span>
                </li>
              ))}
            </ol>
          </section>
          <div className="flex items-start gap-2 rounded-xl border border-amber-200/80 bg-amber-50/80 px-3 py-2.5 dark:border-amber-900/50 dark:bg-amber-950/20">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-300" />
            <p className="text-[10px] font-semibold leading-relaxed text-amber-800 dark:text-amber-200">
              Please make sure all details are correct. Once sent, a campaign cannot be edited.
            </p>
          </div>
        </>
      ) : (
        <div className="flex items-start gap-2 rounded-xl border border-emerald-200/80 bg-emerald-50/70 px-3 py-2.5 dark:border-emerald-900/50 dark:bg-emerald-950/20">
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-300" />
          <p className="text-[10px] font-semibold leading-relaxed text-emerald-800 dark:text-emerald-200">
            Delivery depends on template quality, user settings, and WhatsApp policies.
          </p>
        </div>
      )}

      {variant === 'audience' && (
        <div className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[10px] font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-900/50 sm:flex">
          <Users className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          Audience eligibility is checked before saving and sending.
        </div>
      )}
    </aside>
  );
}
