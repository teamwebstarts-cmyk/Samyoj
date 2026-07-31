import type { SocketConnectionStatus } from '../../hooks/useSocket';

interface ConnectionStatusIndicatorProps {
  status: SocketConnectionStatus;
  reconnectAttempts: number;
  totalDisconnects: number;
}

const STATUS_CONFIG: Record<
  SocketConnectionStatus,
  { color: string; bgColor: string; label: string; pulse?: boolean }
> = {
  connected: {
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-500',
    label: 'Connected',
  },
  connecting: {
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-500',
    label: 'Connecting…',
    pulse: true,
  },
  disconnected: {
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-500',
    label: 'Disconnected',
  },
  error: {
    color: 'text-red-700 dark:text-red-500',
    bgColor: 'bg-red-600',
    label: 'Connection Error',
    pulse: true,
  },
};

export default function ConnectionStatusIndicator({
  status,
  reconnectAttempts,
  totalDisconnects,
}: ConnectionStatusIndicatorProps) {
  const config = STATUS_CONFIG[status];

  const tooltip =
    status === 'connecting'
      ? `Attempt ${reconnectAttempts}…`
      : totalDisconnects > 0
        ? `${totalDisconnects} disconnect${totalDisconnects > 1 ? 's' : ''} today`
        : undefined;

  return (
    <div className="flex items-center gap-1.5" title={tooltip}>
      <span className="relative flex h-2 w-2">
        {config.pulse && (
          <span
            className={`absolute inline-flex h-full w-full animate-ping rounded-full ${config.bgColor} opacity-60`}
          />
        )}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${config.bgColor}`} />
      </span>
      <span className={`text-[11px] font-semibold ${config.color} hidden sm:inline`}>
        {config.label}
      </span>
    </div>
  );
}