interface RingMetricProps {
  label: string;
  value: string;
  color: string;
  trackColor?: string;
}

export default function RingMetric({ label, value, color, trackColor = 'text-neutral-100' }: RingMetricProps) {
  const num = Math.min(parseFloat(value) || 0, 100);
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (num / 100) * circumference;

  return (
    <div className="flex flex-col items-center text-center">
      <div className="relative h-[88px] w-[88px]">
        <svg className="h-[88px] w-[88px] -rotate-90" viewBox="0 0 88 88" aria-hidden>
          <circle
            cx="44"
            cy="44"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="7"
            className={trackColor}
          />
          <circle
            cx="44"
            cy="44"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className={`${color} transition-all duration-1000 ease-out`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-extrabold tabular-nums leading-none text-neutral-900">{value}%</span>
        </div>
      </div>
      <p className="mt-2 text-[11px] font-semibold text-neutral-600">{label}</p>
    </div>
  );
}
