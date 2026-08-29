import { useEffect, useState } from 'react';
import InfoTip from '../ui/InfoTip';
import { campaignApi } from '../../services/api';
import { formatMessagingLimitTier } from '../../utils/messagingLimitTier';
import { useWhatsAppNumber } from '../../contexts/WhatsAppNumberContext';

function LimitTip({
  cap,
  known,
  unlimited,
}: {
  cap: string;
  known: boolean;
  unlimited: boolean;
}) {
  return (
    <div className="space-y-2 font-medium text-neutral-950">
      <p className="font-extrabold">
        {unlimited
          ? 'Meta set this account to unlimited unique users / 24h.'
          : known
            ? `This connected number’s Meta ceiling is ${cap} unique people / 24 hours.`
            : 'Waiting for Meta to send this number’s messaging-limit tier.'}
      </p>
      <p>
        Used is unique campaign recipients we sent in the last 24 hours on this number. It is not Meta’s leftover.
        Exact remaining is only in WhatsApp Manager → Messaging limits.
      </p>
      <p>
        Meta counts unique people templated outside an open 24h chat, across the whole Business Manager. Inbox
        replies inside a chat do not use this cap.
      </p>
    </div>
  );
}

export default function MetaDailyLimitCard({ className = '' }: { className?: string }) {
  const { activeNumber } = useWhatsAppNumber();
  const [uniqueUsed24h, setUniqueUsed24h] = useState(0);
  const [tier, setTier] = useState<string | null>(activeNumber?.messagingLimitTier ?? null);

  useEffect(() => {
    setTier(activeNumber?.messagingLimitTier ?? null);
    let cancelled = false;
    campaignApi.quota()
      .then(({ data }) => {
        if (cancelled) return;
        const payload = data?.data as {
          uniqueUsed24h?: number;
          messagingLimitTier?: string | null;
        };
        if (typeof payload?.uniqueUsed24h === 'number') setUniqueUsed24h(payload.uniqueUsed24h);
        if (payload?.messagingLimitTier) setTier(payload.messagingLimitTier);
      })
      .catch(() => {
        /* keep connected-number tier */
      });
    return () => {
      cancelled = true;
    };
  }, [activeNumber?.id, activeNumber?.messagingLimitTier]);

  const limit = formatMessagingLimitTier(tier);

  return (
    <div
      className={`flex min-w-0 flex-col items-center justify-center rounded-xl border border-neutral-100/90 bg-white px-2 py-2.5 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-slate-700/70 dark:bg-slate-900/70 sm:rounded-2xl sm:px-3 sm:py-3 ${className}`}
    >
      <p className="flex items-center justify-center gap-1 text-[9px] font-extrabold uppercase tracking-[0.08em] text-neutral-500 sm:text-[10px]">
        <span>Meta daily limit</span>
        <InfoTip
          content={<LimitTip cap={limit.cap} known={limit.known} unlimited={limit.unlimited} />}
          label="Meta daily limit explained"
        />
      </p>
      <p className="mt-1 text-[1.15rem] font-extrabold leading-none tabular-nums text-neutral-950 dark:text-white sm:text-[1.45rem]">
        {uniqueUsed24h.toLocaleString()}
      </p>
      <p className="mt-0.5 text-[10px] font-medium text-neutral-400">
        {limit.unlimited ? 'of Unlimited' : limit.known ? `of ${limit.cap}` : 'Waiting for Meta'}
      </p>
    </div>
  );
}
