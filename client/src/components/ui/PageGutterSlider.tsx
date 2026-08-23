import { usePageGutter } from '../../contexts/PageGutterContext';
import { PAGE_GUTTER_MAX_STEP, pageGutterLabel, type PageGutterStep } from '../../lib/density/pageGutterStore';

export default function PageGutterSlider() {
  const { step, setStep } = usePageGutter();

  return (
    <div className="max-w-md">
      <div className="flex items-center justify-between text-[11px] font-semibold text-theme-muted">
        <span>Narrow</span>
        <span className="text-theme-fg">{pageGutterLabel(step)}</span>
        <span>Wide</span>
      </div>
      <input
        type="range"
        min={1}
        max={PAGE_GUTTER_MAX_STEP}
        step={1}
        value={step}
        aria-label="Page side space"
        onChange={(e) => setStep(Number(e.target.value) as PageGutterStep)}
        className="mt-2 h-2 w-full cursor-pointer appearance-none rounded-full bg-neutral-200 accent-emerald-600 dark:bg-neutral-700"
      />
    </div>
  );
}
