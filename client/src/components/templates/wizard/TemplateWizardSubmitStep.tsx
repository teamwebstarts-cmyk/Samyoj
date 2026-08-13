import {
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  List,
  Mail,
  Megaphone,
  MessageSquare,
  Plus,
  Send,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatSubmissionDate, type TemplateWizardSubmitResult } from './templateWizardModel';
import { toastSuccess } from '../../../utils/toast';

interface TemplateWizardSubmitStepProps {
  result: TemplateWizardSubmitResult;
  status?: string;
  language?: string;
  onCreateAnother: () => void;
}

export default function TemplateWizardSubmitStep({
  result,
  status = 'PENDING',
  language,
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

  return (
    <div className="space-y-4">
      <div className="template-wizard-card overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-5 dark:border-slate-800">
          <div className="flex items-start gap-3">
            <span
              className={`flex h-10 w-10 items-center justify-center rounded-full ${
                isApproved
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
                  : 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400'
              }`}
            >
              {isApproved ? <CheckCircle2 className="h-5 w-5" /> : <Send className="h-5 w-5" />}
            </span>
            <div>
              <h2 className="text-[18px] font-bold text-slate-900 dark:text-white">
                {isApproved ? 'Template ready to use' : 'Template submitted successfully!'}
              </h2>
              <p className="mt-1 text-[13px] text-slate-600 dark:text-slate-400">
                {isApproved
                  ? 'Added from Meta’s library. You can send it from Campaigns and Inbox right away.'
                  : 'Your template is now pending WhatsApp approval. You’ll be notified as soon as there’s an update.'}
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 rounded-xl border border-slate-100 bg-slate-50/80 p-4 sm:grid-cols-3 dark:border-slate-800 dark:bg-slate-900/40">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                Submission ID
              </p>
              <p className="mt-1 flex items-center gap-1.5 font-mono text-[12px] font-semibold text-slate-800 dark:text-slate-200">
                {result.submissionId}
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
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                Submitted on
              </p>
              <p className="mt-1 text-[12px] font-semibold text-slate-800 dark:text-slate-200">
                {formatSubmissionDate(result.submittedAt)}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                {isApproved ? 'Review time' : 'Estimated review time'}
              </p>
              <p className="mt-1 text-[12px] font-semibold text-slate-800 dark:text-slate-200">
                {isApproved ? 'None — already approved' : 'Up to 24 hours'}
              </p>
            </div>
          </div>

          <div
            className={`mt-4 flex items-start gap-2.5 rounded-xl border px-4 py-3 ${
              isApproved
                ? 'border-emerald-200/80 bg-emerald-50/70 dark:border-emerald-900/40 dark:bg-emerald-950/25'
                : isRejected
                  ? 'border-rose-200/80 bg-rose-50/70 dark:border-rose-900/40 dark:bg-rose-950/25'
                  : 'border-amber-200/80 bg-amber-50/70 dark:border-amber-900/40 dark:bg-amber-950/25'
            }`}
          >
            {isApproved ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            ) : (
              <Clock
                className={`mt-0.5 h-4 w-4 shrink-0 ${isRejected ? 'text-rose-600' : 'text-amber-600'}`}
              />
            )}
            <div>
              <p
                className={`text-[12px] font-bold ${
                  isApproved
                    ? 'text-emerald-900 dark:text-emerald-200'
                    : isRejected
                      ? 'text-rose-900 dark:text-rose-200'
                      : 'text-amber-900 dark:text-amber-200'
                }`}
              >
                Status: {upperStatus}
              </p>
              <p
                className={`mt-0.5 text-[11px] leading-relaxed ${
                  isApproved
                    ? 'text-emerald-800/90 dark:text-emerald-300/90'
                    : isRejected
                      ? 'text-rose-800/90 dark:text-rose-300/90'
                      : 'text-amber-800/90 dark:text-amber-300/90'
                }`}
              >
                {isApproved
                  ? 'Your template is approved. You can use it in campaigns and inbox right away.'
                  : isRejected
                    ? 'WhatsApp rejected this template. Open it from the list to see the reason and edit.'
                    : "We'll automatically check for status updates every 30 seconds. You can leave this page — we'll notify you when there's a change."}
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              to={`/templates?view=${encodeURIComponent(result.templateName)}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-[12px] font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              <ExternalLink className="h-4 w-4" />
              View this template
            </Link>
            <Link
              to="/templates"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-[12px] font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              <List className="h-4 w-4" />
              View all templates
            </Link>
            {isApproved ? (
              <>
                <Link
                  to={campaignHref}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-[12px] font-semibold text-white shadow-sm transition hover:bg-violet-700"
                >
                  <Megaphone className="h-4 w-4" />
                  Use in campaign
                </Link>
                <Link
                  to="/inbox"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-[12px] font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                >
                  <MessageSquare className="h-4 w-4" />
                  Use in inbox
                </Link>
              </>
            ) : null}
            <button
              type="button"
              onClick={onCreateAnother}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-[12px] font-semibold text-white shadow-sm transition hover:bg-emerald-800"
            >
              <Plus className="h-4 w-4" />
              Create another template
            </button>
          </div>
        </div>

        <div className="px-5 py-4">
          <p className="text-[13px] font-bold text-slate-900 dark:text-white">What happens next?</p>
          <ol className="mt-4 space-y-4">
            {[
              ...(isApproved
                ? [
                    {
                      icon: CheckCircle2,
                      tone: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-950/40',
                      title: 'Already approved',
                      body: 'Meta reviewed this library copy. There is no 24-hour wait.',
                    },
                    {
                      icon: Megaphone,
                      tone: 'text-violet-600 bg-violet-100 dark:bg-violet-950/40',
                      title: 'Send a campaign',
                      body: 'Pick this template in Campaigns to message opted-in customers.',
                    },
                    {
                      icon: MessageSquare,
                      tone: 'text-sky-600 bg-sky-100 dark:bg-sky-950/40',
                      title: 'Use in Inbox',
                      body: 'When the 24-hour chat window is closed, send this template from a conversation.',
                    },
                  ]
                : [
                    {
                      icon: Clock,
                      tone: 'text-amber-600 bg-amber-100 dark:bg-amber-950/40',
                      title: 'Under review by WhatsApp',
                      body: 'WhatsApp will review your template for compliance and quality.',
                    },
                    {
                      icon: Mail,
                      tone: 'text-violet-600 bg-violet-100 dark:bg-violet-950/40',
                      title: "We'll notify you",
                      body: "You'll receive an in-app notification once the status is updated.",
                    },
                    {
                      icon: CheckCircle2,
                      tone: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-950/40',
                      title: 'Use in campaigns & chats',
                      body: 'Once approved, you can start using this template right away.',
                    },
                  ]),
            ].map((step) => (
              <li key={step.title} className="flex gap-3">
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${step.tone}`}
                >
                  <step.icon className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-[12px] font-bold text-slate-900 dark:text-white">{step.title}</p>
                  <p className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-400">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
