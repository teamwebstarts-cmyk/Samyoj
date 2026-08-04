import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Lightbulb } from 'lucide-react';
import { AiBotMascotIllustrationSvg } from './icons/CardIllustrations';

interface WorkspaceTipCardProps {
  readRate?: string | null;
  readRateDelta?: number | null;
  messagesSent?: number;
  failedMessages?: number;
  openChats?: number;
}

function isWorkspaceEmpty(props: WorkspaceTipCardProps): boolean {
  return (
    (props.openChats ?? 0) === 0 &&
    (props.messagesSent ?? 0) === 0 &&
    (props.failedMessages ?? 0) === 0
  );
}

function buildTip(props: WorkspaceTipCardProps): {
  body: ReactNode;
  cta: { label: string; to: string };
} {
  const sent = props.messagesSent ?? 0;
  const failed = props.failedMessages ?? 0;
  const openChats = props.openChats ?? 0;
  const rate = props.readRate?.replace(/%$/, '');
  const rateNum = rate != null && rate !== '' ? Number(rate) : null;
  const delta = typeof props.readRateDelta === 'number' ? props.readRateDelta : null;

  if (openChats > 0) {
    return {
      body: (
        <>
          You have{' '}
          <strong className="font-extrabold text-neutral-900">
            {openChats} open chat{openChats === 1 ? '' : 's'}.
          </strong>{' '}
          Reply from <strong className="font-extrabold text-neutral-900">Inbox</strong> to keep
          customers happy.
        </>
      ),
      cta: { label: 'Open Inbox', to: '/inbox' },
    };
  }

  if (failed > 0) {
    return {
      body: (
        <>
          <strong className="font-extrabold text-rose-700">
            {failed} message{failed === 1 ? '' : 's'} failed
          </strong>{' '}
          in this period. Review failures before your next campaign.
        </>
      ),
      cta: { label: 'View failures', to: '/reports' },
    };
  }

  if (delta != null && delta !== 0 && rateNum != null && Number.isFinite(rateNum)) {
    const higher = delta > 0;
    return {
      body: (
        <>
          Your read rate is{' '}
          <strong className="font-extrabold text-emerald-800">
            {Math.abs(delta)} pts {higher ? 'higher' : 'lower'}
          </strong>{' '}
          than the previous period (now {rateNum}%).{' '}
          {higher
            ? 'Keep the momentum with a short follow-up to recent contacts.'
            : 'Try a clearer template or follow up with contacts who did not read.'}
        </>
      ),
      cta: { label: 'Create campaign', to: '/campaigns' },
    };
  }

  if (rateNum != null && Number.isFinite(rateNum) && sent > 0) {
    return {
      body: (
        <>
          Current read rate is{' '}
          <strong className="font-extrabold text-emerald-800">{rateNum}%</strong> across{' '}
          {sent.toLocaleString()} sent message{sent === 1 ? '' : 's'}. Re-engage quiet contacts with
          a focused campaign.
        </>
      ),
      cta: { label: 'Create campaign', to: '/campaigns' },
    };
  }

  return {
    body: <>Review Inbox and campaigns to keep your WhatsApp workspace moving.</>,
    cta: { label: 'Open Inbox', to: '/inbox' },
  };
}

/** Honest workspace tip from live metrics — not an AI model output. */
export default function AiSuggestionCard(props: WorkspaceTipCardProps) {
  const empty = isWorkspaceEmpty(props);
  const tip = empty ? null : buildTip(props);

  return (
    <section aria-label="Workspace tip" className="h-full">
      <div className="dashboard-card relative flex h-full flex-col overflow-hidden rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/90 via-teal-50/40 to-emerald-100/50 p-3 shadow-xs sm:rounded-3xl sm:p-3.5">
        <div className="flex shrink-0 items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
            <Lightbulb className="h-4 w-4 stroke-[2.2]" />
          </span>
          <h2 className="truncate text-[14px] font-bold tracking-tight text-neutral-900 sm:text-[15px]">
            Workspace tip
          </h2>
        </div>

        {empty ? (
          <div className="mt-2.5 flex min-h-0 flex-1 items-center gap-2.5 sm:gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-bold leading-snug text-neutral-900 sm:text-[13.5px]">
                You have no conversations yet.
              </p>
              <p className="mt-1 text-[12px] font-medium leading-relaxed text-neutral-600 sm:text-[12.5px]">
                Once you start receiving messages, they will show up here.
              </p>
              <Link
                to="/inbox"
                className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-xl bg-whatsapp-500 px-4 py-2.5 text-[13px] font-bold tracking-tight text-white shadow-[0_4px_14px_rgba(37,211,102,0.35)] transition duration-200 hover:bg-[#1ebe57] hover:shadow-[0_6px_16px_rgba(37,211,102,0.32)] active:scale-[0.98]"
              >
                Open Inbox
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="flex shrink-0 items-center justify-center">
              <AiBotMascotIllustrationSvg className="h-14 w-14 sm:h-16 sm:w-16 lg:h-[4.75rem] lg:w-[4.75rem]" />
            </div>
          </div>
        ) : tip ? (
          <div className="mt-2.5 flex min-h-0 flex-1 items-center gap-2 sm:gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] font-medium leading-relaxed text-neutral-700 sm:text-[13px]">
                {tip.body}
              </p>
              <Link
                to={tip.cta.to}
                className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-xl bg-whatsapp-500 px-4 py-2.5 text-[13px] font-bold tracking-tight text-white shadow-[0_4px_14px_rgba(37,211,102,0.35)] transition duration-200 hover:bg-[#1ebe57] hover:shadow-[0_6px_16px_rgba(37,211,102,0.32)] active:scale-[0.98]"
              >
                {tip.cta.label}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="hidden shrink-0 items-center justify-center sm:flex">
              <AiBotMascotIllustrationSvg className="h-16 w-16 lg:h-[4.75rem] lg:w-[4.75rem]" />
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
