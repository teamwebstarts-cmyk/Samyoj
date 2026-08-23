import { LayoutGrid, Minimize2 } from 'lucide-react';
import type { DisplayDensity } from '../../lib/density/densityStore';
import { useDensity } from '../../contexts/DensityContext';

const modes: Array<{ id: DisplayDensity; icon: typeof LayoutGrid; label: string; hint: string }> = [
  { id: 'comfortable', icon: LayoutGrid, label: 'Comfortable', hint: 'More spacing' },
  { id: 'compact', icon: Minimize2, label: 'Compact', hint: 'Fits more on screen' },
];

export default function DensityToggle({ flat = false }: { flat?: boolean }) {
  const { density, setDensity } = useDensity();
  const activeIndex = modes.findIndex((m) => m.id === density);

  return (
    <div
      className={`relative flex items-center rounded-2xl border border-theme-border bg-theme-subtle p-1 ${flat ? '' : 'shadow-theme'}`}
      role="radiogroup"
      aria-label="Display density"
    >
      <span
        className={`pointer-events-none absolute bottom-1 top-1 rounded-xl bg-theme-surface transition-all duration-300 ease-out ${flat ? 'ring-1 ring-theme-border' : 'shadow-theme'}`}
        style={{
          width: 'calc(50% - 4px)',
          left: `calc(${activeIndex * 50}% + 2px)`,
        }}
      />
      {modes.map(({ id, icon: Icon, label, hint }) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={density === id}
          title={hint}
          onClick={() => setDensity(id)}
          className={`relative z-10 flex flex-1 items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-[11px] font-semibold transition-colors ${
            density === id ? 'text-theme-fg' : 'text-theme-muted hover:text-theme-secondary'
          }`}
        >
          <Icon className="h-3.5 w-3.5" strokeWidth={2.25} />
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  );
}
