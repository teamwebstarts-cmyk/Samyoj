import { BarChart3, Headphones, PhoneCall } from 'lucide-react';
import AppButton from '../ui/AppButton';

interface CallsPageHeaderProps {
  phoneNumber?: string | null;
  isReady: boolean;
  liveCount: number;
  callsToday: number;
  totalCalls: number;
  showAnalytics?: boolean;
  onToggleAnalytics?: () => void;
}

export default function CallsPageHeader({
  phoneNumber,
  isReady,
  liveCount,
  callsToday,
  totalCalls,
  showAnalytics,
  onToggleAnalytics,
}: CallsPageHeaderProps) {
  const stats = [
    { label: 'Status', value: isReady ? 'Live' : 'Setup', tone: isReady ? 'text-whatsapp-600' : 'text-amber-700' },
    { label: 'Live', value: liveCount, tone: liveCount > 0 ? 'text-whatsapp-600' : 'text-neutral-900' },
    { label: 'Today', value: callsToday },
    { label: 'Total', value: totalCalls },
  ];

  return (
    <div className="shrink-0 rounded-2xl border border-neutral-200/70 bg-white px-4 py-3.5 shadow-[0_1px_0_rgba(0,0,0,0.04)] sm:px-5 sm:py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-200/80 bg-violet-50/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-violet-800">
              <Headphones className="h-3 w-3" />
              Voice calls
            </span>
            {isReady && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-200/80">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                </span>
                Ready
              </span>
            )}
          </div>
          <h1 className="mt-2 text-lg font-extrabold tracking-tight text-neutral-900 sm:text-xl">
            WhatsApp AI calling
          </h1>
          <p className="mt-0.5 text-[13px] font-medium text-neutral-600">
            {phoneNumber ? (
              <>
                <PhoneCall className="mr-1 inline h-3.5 w-3.5 text-whatsapp-600" />
                {phoneNumber} · AI answers and saves transcripts
              </>
            ) : (
              'Connect WhatsApp to receive voice calls with AI auto-answer.'
            )}
          </p>
        </div>

        <div className="flex flex-col items-stretch gap-2 sm:items-end">
        {onToggleAnalytics && (
          <AppButton
            variant={showAnalytics ? 'primary' : 'secondary'}
            size="sm"
            onClick={onToggleAnalytics}
          >
            <BarChart3 className="h-4 w-4" />
            Analytics
          </AppButton>
        )}
        <div className="grid grid-cols-4 gap-2 sm:gap-3">
          {stats.map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-neutral-100 bg-neutral-50/80 px-2.5 py-2 text-center sm:min-w-[72px] sm:px-3"
            >
              <p className={`text-base font-extrabold tabular-nums sm:text-lg ${item.tone ?? 'text-neutral-900'}`}>
                {item.value}
              </p>
              <p className="text-[9px] font-bold uppercase tracking-wide text-neutral-500 sm:text-[10px]">
                {item.label}
              </p>
            </div>
          ))}
        </div>
        </div>
      </div>
    </div>
  );
}
