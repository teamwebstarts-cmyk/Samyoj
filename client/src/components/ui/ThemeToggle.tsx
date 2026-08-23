import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme, type ThemeMode } from '../../contexts/ThemeContext';

const modes: Array<{ id: ThemeMode; icon: typeof Sun; label: string }> = [
  { id: 'light', icon: Sun, label: 'Light' },
  { id: 'dark', icon: Moon, label: 'Dark' },
  { id: 'system', icon: Monitor, label: 'System' },
];

interface ThemeToggleProps {
  variant?: 'pill' | 'compact' | 'menu';
  /** Flat style without inner shadow — better on Settings cards */
  flat?: boolean;
}

export default function ThemeToggle({ variant = 'pill', flat = false }: ThemeToggleProps) {
  const { mode, resolved, setMode } = useTheme();

  if (variant === 'compact') {
    const isDark = resolved === 'dark';
    return (
      <button
        type="button"
        onClick={() => setMode(isDark ? 'light' : 'dark')}
        className="topbar-icon-btn group relative overflow-hidden"
        aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        title={isDark ? 'Light mode' : 'Dark mode'}
      >
        <Sun
          className={`absolute h-[18px] w-[18px] transition-all duration-300 ${
            isDark ? 'rotate-90 scale-0 opacity-0' : 'rotate-0 scale-100 opacity-100'
          }`}
          strokeWidth={2}
        />
        <Moon
          className={`absolute h-[18px] w-[18px] transition-all duration-300 ${
            isDark ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-0 opacity-0'
          }`}
          strokeWidth={2}
        />
      </button>
    );
  }

  if (variant === 'menu') {
    return (
      <div className="grid grid-cols-3 gap-2">
        {modes.map(({ id, icon: Icon, label }) => {
          const active = mode === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setMode(id)}
              className={`flex flex-col items-center gap-1.5 rounded-xl border px-3 py-3 text-center transition ${
                active
                  ? 'border-whatsapp-500/40 bg-whatsapp-500/10 text-whatsapp-600 dark:text-whatsapp-400'
                  : 'border-theme-border bg-theme-surface text-theme-secondary hover:border-whatsapp-500/20 hover:bg-theme-subtle'
              }`}
            >
              <Icon className="h-4 w-4" strokeWidth={2} />
              <span className="text-[11px] font-semibold">{label}</span>
            </button>
          );
        })}
      </div>
    );
  }

  const activeIndex = modes.findIndex((m) => m.id === mode);

  return (
    <div
      className={`relative flex items-center rounded-2xl border border-theme-border bg-theme-subtle p-1 ${flat ? '' : 'shadow-theme'}`}
      role="radiogroup"
      aria-label="Theme"
    >
      <span
        className={`pointer-events-none absolute bottom-1 top-1 rounded-xl bg-theme-surface transition-all duration-300 ease-out ${flat ? 'ring-1 ring-theme-border' : 'shadow-theme'}`}
        style={{
          width: 'calc(33.333% - 4px)',
          left: `calc(${activeIndex * 33.333}% + 2px)`,
        }}
      />
      {modes.map(({ id, icon: Icon, label }) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={mode === id}
          onClick={() => setMode(id)}
          className={`relative z-10 flex flex-1 items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-[11px] font-semibold transition-colors ${
            mode === id ? 'text-theme-fg' : 'text-theme-muted hover:text-theme-secondary'
          }`}
        >
          <Icon className="h-3.5 w-3.5" strokeWidth={2.25} />
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  );
}
