import type { TextSize } from '../../lib/density/typographyStore';
import { useTypography } from '../../contexts/TypographyContext';

const modes: Array<{ id: TextSize; label: string; hint: string; sample: string }> = [
  { id: 'small', label: 'Small', hint: 'Fit more on screen', sample: 'Aa' },
  { id: 'default', label: 'Default', hint: 'Standard size', sample: 'Aa' },
  { id: 'large', label: 'Large', hint: 'Easier to read', sample: 'Aa' },
];

const sampleClass: Record<TextSize, string> = {
  small: 'text-[10px]',
  default: 'text-[12px]',
  large: 'text-[15px]',
};

export default function TextSizeToggle() {
  const { textSize, setTextSize } = useTypography();
  const activeIndex = modes.findIndex((m) => m.id === textSize);

  return (
    <div
      className="relative flex items-center rounded-2xl border border-theme-border bg-theme-subtle p-1 shadow-theme"
      role="radiogroup"
      aria-label="Text size"
    >
      <span
        className="pointer-events-none absolute bottom-1 top-1 rounded-xl bg-theme-surface shadow-theme transition-all duration-300 ease-out"
        style={{
          width: 'calc(33.333% - 4px)',
          left: `calc(${activeIndex * 33.333}% + 2px)`,
        }}
      />
      {modes.map(({ id, label, hint, sample }) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={textSize === id}
          title={hint}
          onClick={() => setTextSize(id)}
          className={`relative z-10 flex flex-1 items-center justify-center gap-1.5 rounded-xl px-2 py-2 font-semibold transition-colors ${
            textSize === id ? 'text-theme-fg' : 'text-theme-muted hover:text-theme-secondary'
          }`}
        >
          <span className={`leading-none ${sampleClass[id]}`} aria-hidden>
            {sample}
          </span>
          <span className="hidden text-[11px] sm:inline">{label}</span>
        </button>
      ))}
    </div>
  );
}
