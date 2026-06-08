import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export interface FlowBuilderPanelTab<T extends string> {
  value: T;
  label: string;
  icon: LucideIcon;
  description: string;
}

interface FlowBuilderSidePanelProps<T extends string> {
  active: T;
  onChange: (value: T) => void;
  tabs: FlowBuilderPanelTab<T>[];
  children: ReactNode;
}

export default function FlowBuilderSidePanel<T extends string>({
  active,
  onChange,
  tabs,
  children,
}: FlowBuilderSidePanelProps<T>) {
  const current = tabs.find((tab) => tab.value === active) ?? tabs[0];

  return (
    <aside className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-violet-100/70 bg-white shadow-[0_8px_32px_rgba(99,102,241,0.07),0_1px_0_rgba(255,255,255,0.95)_inset]">
      <div className="shrink-0 border-b border-violet-100/60 bg-gradient-to-r from-violet-50/50 via-white to-emerald-50/30 px-3 pt-3">
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = active === tab.value;

            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => onChange(tab.value)}
                title={tab.label}
                className={`flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-2 text-[12px] font-bold transition active:scale-[0.98] ${
                  isActive
                    ? 'border-violet-200 bg-gradient-to-r from-violet-500 to-indigo-600 text-white shadow-[0_4px_12px_rgba(99,102,241,0.28)]'
                    : 'border-neutral-200/80 bg-white text-neutral-600 hover:border-violet-200 hover:bg-violet-50/50 hover:text-violet-700'
                }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} />
                <span className="whitespace-nowrap">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="shrink-0 border-b border-neutral-100/80 px-5 py-4">
        <p className="text-[15px] font-extrabold tracking-tight text-neutral-900">{current.label}</p>
        <p className="mt-1 text-[12px] font-medium leading-relaxed text-neutral-500">
          {current.description}
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain">
        <div className="min-w-0 px-5 py-4 pb-8">{children}</div>
      </div>
    </aside>
  );
}
