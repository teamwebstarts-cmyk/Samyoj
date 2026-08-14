import {
  CheckCircle2,
  Clock,
  Copy,
  Eye,
  LayoutGrid,
  Mail,
  Megaphone,
  MessageSquare,
  Plus,
  Sparkles,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatSubmissionDate, type TemplateWizardSubmitResult } from './templateWizardModel';
import { TEMPLATE_REVIEW_ETA } from '../../../utils/templateRejectionGuide';
import { CATEGORY_OPTIONS, LANGUAGE_OPTIONS } from '../../../utils/templateUtils';
import { toastSuccess } from '../../../utils/toast';

interface TemplateWizardSubmitStepProps {
  result: TemplateWizardSubmitResult;
  status?: string;
  language?: string;
  category?: string;
  onCreateAnother: () => void;
}

function categoryLabel(value?: string) {
  if (!value) return null;
  return CATEGORY_OPTIONS.find((o) => o.value === value)?.label || value;
}

function languageLabel(value?: string) {
  if (!value) return null;
  return LANGUAGE_OPTIONS.find((o) => o.value === value)?.label || value;
}

export default function TemplateWizardSubmitStep({
  result,
  status = 'PENDING',
  language,
  category,
  onCreateAnother,
}: TemplateWizardSubmitStepProps) {
  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(result.submissionId);
      toastSuccess('Submission ID copied');
    } catch {
      /* ignore */
    }
  };

  const upperStatus = status.toUpperCase();
  const isApproved = upperStatus === 'APPROVED';
  const isRejected = upperStatus === 'REJECTED';
  const campaignHref = `/campaigns/new?template=${encodeURIComponent(result.templateName)}${
    language ? `&language=${encodeURIComponent(language)}` : ''
  }`;
  const thisTemplateHref = `/templates?view=${encodeURIComponent(result.templateName)}`;
  const cat = categoryLabel(category);
  const lang = languageLabel(language);

  const nextSteps = isApproved
    ? [
        {
          icon: CheckCircle2,
          tone: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400',
          title: 'Already approved',
          body: 'Meta already reviewed this library copy. There is no 24-hour wait.',
        },
        {
          icon: Megaphone,
          tone: 'bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-400',
          title: 'Send a campaign',
          body: 'Pick this template in Campaigns to message opted-in customers.',
        },
        {
          icon: MessageSquare,
          tone: 'bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-400',
          title: 'Use in Inbox',
          body: 'When the 24-hour window is closed, send it from a conversation.',
        },
      ]
    : [
        {
          icon: Clock,
          tone: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400',
          title: 'WhatsApp review',
          body: `Quality and policy check. ${TEMPLATE_REVIEW_ETA.typical}.`,
        },
        {
          icon: Mail,
          tone: 'bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-400',
          title: 'We’ll notify you',
          body: 'Leave this page — you’ll get an in-app alert when the status changes.',
        },
        {
          icon: CheckCircle2,
          tone: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400',
          title: 'Then you can send',
          body: 'Once approved, it appears on the Templates page for campaigns and chats.',
        },
      ];

  return (
    <div className="space-y-4">
      <div className="template-wizard-card overflow-hidden">
        <div
          className={`relative overflow-hidden px-5 pb-5 pt-6 sm:px-6 ${
            isApproved
              ? 'bg-gradient-to-br from-emerald-50 via-white to-sky-50 dark:from-emerald-950/40 dark:via-slate-900 dark:to-slate-900'
              : isRejected
                ? 'bg-gradient-to-br from-rose-50 via-white to-slate-50 dark:from-rose-950/30 dark:via-slate-900 dark:to-slate-900'
                : 'bg-gradient-to-br from-amber-50 via-white to-violet-50 dark:from-amber-950/30 dark:via-slate-900 dark:to-slate-900'
          }`}
        >
          <div className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-violet-400/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-16 right-24 h-32 w-32 rounded-full bg-emerald-400/10 blur-2xl" />

          <div className="relative flex items-start gap-4">
            <span
              className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl shadow-sm ring-4 ${
                isApproved
                  ? 'bg-emerald-600 text-white ring-emerald-100 dark:ring-emerald-900/60'
                  : isRejected
                    ? 'bg-rose-600 text-white ring-rose-100 dark:ring-rose-900/60'
                    : 'bg-violet-600 text-white ring-violet-100 dark:ring-violet-900/60'
              }`}
            >
              {isApproved ? <CheckCircle2 className="h-7 w-7" /> : <Sparkles className="h-7 w-7" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
                {isApproved ? 'Ready to send' : isRejected ? 'Needs changes' : 'Submitted to WhatsApp'}
              </p>
              <h2 className="mt-1 text-[20px] font-extrabold tracking-tight text-slate-900 dark:text-white">
                {isApproved
                  ? 'Template ready to use'
                  : isRejected
                    ? 'Template was not approved'
                    : 'Template submitted successfully'}
              </h2>
              <p className="mt-1.5 max-w-xl text-[13px] leading-relaxed text-slate-600 dark:text-slate-400">
                {isApproved
                  ? 'Added from Meta’s library. You can send it from Campaigns and Inbox right away.'
                  : isRejected
                    ? 'Open it from the template list to see the reason, then edit and resubmit.'
                    : 'WhatsApp is reviewing this template. You’ll be notified as soon as there’s an update.'}
              </p>
            </div>
          </div>

          <div className="relative mt-5 flex flex-wrap items-center gap-2 rounded-2xl border border-white/80 bg-white/80 px-4 py-3 shadow-sm backdrop-blur-sm dark:border-slate-700/80 dark:bg-slate-900/70">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
                isApproved
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300'
                  : isRejected
                    ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300'
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300'
              }`}
            >
              {!isApproved && !isRejected ? (
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
                </span>
              ) : (
                <span
                  className={`h-2 w-2 rounded-full ${isApproved ? 'bg-emerald-500' : 'bg-rose-500'}`}
                />
              )}
              {upperStatus}
            </span>
            <p className="min-w-0 truncate font-mono text-[13px] font-bold text-slate-800 dark:text-slate-100">
              {result.templateName}
            </p>
            {cat ? (
              <span className="rounded-md bg-sky-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-700 dark:bg-sky-950/50 dark:text-sky-300">
                {cat}
              </span>
            ) : null}
            {lang ? (
              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {lang}
              </span>
            ) : null}
          </div>

          <div className="relative mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Link
              to="/templates"
              className="btn-primary inline-flex h-11 min-h-[44px] items-center justify-center gap-2 rounded-xl px-5 text-[13px] font-bold"
            >
              <LayoutGrid className="h-4 w-4" />
              Back to templates
            </Link>
            <Link
              to={thisTemplateHref}
              className="inline-flex h-11 min-h-[44px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Eye className="h-4 w-4" />
              View this template
            </Link>
            {isApproved ? (
              <>
                <Link
                  to={campaignHref}
                  className="inline-flex h-11 min-h-[44px] items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 text-[13px] font-semibold text-white shadow-sm transition hover:bg-violet-700"
                >
                  <Megaphone className="h-4 w-4" />
                  Use in campaign
                </Link>
                <Link
                  to="/inbox"
                  className="inline-flex h-11 min-h-[44px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                >
                  <MessageSquare className="h-4 w-4" />
                  Use in inbox
                </Link>
              </>
            ) : null}
            <button
              type="button"
              onClick={onCreateAnother}
              className="inline-flex h-11 min-h-[44px] items-center justify-center gap-2 rounded-xl px-4 text-[13px] font-semibold text-slate-600 transition hover:bg-white/80 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <Plus className="h-4 w-4" />
              Create another
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-px border-t border-slate-100 bg-slate-100 sm:grid-cols-3 dark:border-slate-800 dark:bg-slate-800">
          <div className="bg-white px-5 py-3.5 dark:bg-slate-900">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
              Submission ID
            </p>
            <p className="mt-1 flex items-center gap-1.5 font-mono text-[12px] font-semibold text-slate-800 dark:text-slate-200">
              <span className="truncate">{result.submissionId}</span>
              <button
                type="button"
                onClick={() => void copyId()}
                className="rounded p-0.5 text-slate-400 hover:text-slate-600"
                aria-label="Copy submission ID"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            </p>
          </div>
          <div className="bg-white px-5 py-3.5 dark:bg-slate-900">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
              Submitted on
            </p>
            <p className="mt-1 text-[12px] font-semibold text-slate-800 dark:text-slate-200">
              {formatSubmissionDate(result.submittedAt)}
            </p>
          </div>
          <div className="bg-white px-5 py-3.5 dark:bg-slate-900">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
              {isApproved ? 'Review time' : 'Estimated review'}
            </p>
            <p className="mt-1 text-[12px] font-semibold text-slate-800 dark:text-slate-200">
              {isApproved ? 'None — already approved' : TEMPLATE_REVIEW_ETA.typical}
            </p>
          </div>
        </div>

        <div className="border-t border-slate-100 px-5 py-5 sm:px-6 dark:border-slate-800">
          <p className="text-[13px] font-bold text-slate-900 dark:text-white">What happens next</p>
          <ol className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {nextSteps.map((step, index) => (
              <li
                key={step.title}
                className="rounded-xl border border-slate-100 bg-slate-50/80 p-3.5 dark:border-slate-800 dark:bg-slate-900/50"
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${step.tone}`}
                  >
                    <step.icon className="h-4 w-4" />
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                    Step {index + 1}
                  </span>
                </div>
                <p className="mt-2.5 text-[12px] font-bold text-slate-900 dark:text-white">
                  {step.title}
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-600 dark:text-slate-400">
                  {step.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
