import { useCardSpacing } from '../../contexts/CardSpacingContext';
import type { CardSpacingStep } from '../../lib/density/cardSpacingStore';

export default function CardSpacingSlider() {
  const { step, setStep } = useCardSpacing();

  return (
    <div className="max-w-md">
      <div className="flex items-center justify-between text-[11px] font-semibold text-theme-muted">
        <span>Tighter</span>
        <span className="text-theme-fg">{step === 3 ? 'Default' : step < 3 ? 'Tight' : 'Roomy'}</span>
        <span>Roomier</span>
      </div>
      <input
        type="range"
        min={1}
        max={5}
        step={1}
        value={step}
        aria-label="Card spacing"
        onChange={(e) => setStep(Number(e.target.value) as CardSpacingStep)}
        className="mt-2 h-2 w-full cursor-pointer appearance-none rounded-full bg-neutral-200 accent-emerald-600 dark:bg-neutral-700"
      />
    </div>
  );
}
