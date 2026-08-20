import { Info } from 'lucide-react';

interface FieldInfoTipProps {
  text: string;
}

/** Small info icon — shows full help text on hover/focus. */
export default function FieldInfoTip({ text }: FieldInfoTipProps) {
  return (
    <button
      type="button"
      className="inline-flex shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/30 dark:hover:text-slate-300"
      aria-label={text}
      title={text}
    >
      <Info className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
    </button>
  );
}
