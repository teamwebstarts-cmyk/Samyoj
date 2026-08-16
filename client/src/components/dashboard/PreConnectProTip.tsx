import { ArrowRight, Lightbulb } from 'lucide-react';

interface PreConnectProTipProps {
  onGetStarted: () => void;
}

export default function PreConnectProTip({ onGetStarted }: PreConnectProTipProps) {
  return (
    <section
      aria-label="Pro tip"
      className="flex flex-col gap-[var(--card-gap)] rounded-2xl border border-emerald-100/90 p-[var(--card-pad)] sm:flex-row sm:items-center sm:justify-between"
      style={{ background: 'linear-gradient(90deg, #E8F8EE 0%, #F0FDF6 55%, #ECFDF5 100%)' }}
    >
      <div className="flex min-w-0 items-start gap-3 sm:items-center">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
          <Lightbulb className="h-4 w-4" strokeWidth={2.1} />
        </span>
        <p className="text-[12.5px] font-medium leading-relaxed text-neutral-700 sm:text-[13.5px]">
          <span className="font-bold text-neutral-900">Pro Tip:</span> Complete all 4 steps to
          unlock the full potential of Samyoj and take your business to the next level.
        </p>
      </div>
      <button
        type="button"
        onClick={onGetStarted}
        className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[#25D366] px-4 text-[13px] font-bold text-white transition hover:bg-[#1ebe57] sm:h-11 sm:px-5 sm:text-[14px]"
      >
        Let&apos;s Get Started
        <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.5} />
      </button>
    </section>
  );
}
