import { BarChart3, FlaskConical, GitBranch, Settings2, SlidersHorizontal, Smartphone } from 'lucide-react';

export type FlowBuilderTab = 'flow' | 'edit' | 'preview' | 'settings' | 'test' | 'analytics';

interface FlowMobileNavProps {
  active: FlowBuilderTab;
  onChange: (tab: FlowBuilderTab) => void;
  showTest?: boolean;
  showAnalytics?: boolean;
}

export default function FlowMobileNav({ active, onChange, showTest, showAnalytics }: FlowMobileNavProps) {
  const tabs: Array<{ id: FlowBuilderTab; label: string; icon: typeof GitBranch }> = [
    { id: 'flow', label: 'Steps', icon: GitBranch },
    { id: 'edit', label: 'Edit', icon: SlidersHorizontal },
    { id: 'preview', label: 'Preview', icon: Smartphone },
    ...(showTest ? [{ id: 'test' as const, label: 'Try it', icon: FlaskConical }] : []),
    ...(showAnalytics ? [{ id: 'analytics' as const, label: 'Stats', icon: BarChart3 }] : []),
    { id: 'settings', label: 'Settings', icon: Settings2 },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-neutral-200/80 bg-white/95 px-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl lg:hidden">
      <div className="mx-auto flex max-w-lg items-center justify-around">
        {tabs.map(({ id, label, icon: Icon }) => {
          const isActive = active === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              className={`flex min-w-[52px] flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 transition ${
                isActive ? 'text-whatsapp-700' : 'text-neutral-500'
              }`}
            >
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-xl transition ${
                  isActive
                    ? 'bg-gradient-to-br from-whatsapp-600 to-emerald-700 text-white shadow-[0_4px_12px_rgba(37,211,102,0.35)]'
                    : 'bg-neutral-100 text-neutral-500'
                }`}
              >
                <Icon className="h-3.5 w-3.5" strokeWidth={2.25} />
              </div>
              <span className={`text-[9px] font-bold ${isActive ? 'text-whatsapp-700' : ''}`}>
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
