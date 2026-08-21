import { useState, useRef, useEffect } from 'react';
import {
  BarChart3,
  Bot,
  Download,
  FileSpreadsheet,
  Megaphone,
  RefreshCw,
  ShieldCheck,
  Users,
} from 'lucide-react';
import AppButton from '../ui/AppButton';
import ReportsDateRangePicker, { type DateRangeSelection } from './ReportsDateRangePicker';
import type { ReportsTabKey } from '../../types';

interface ReportsHeaderProps {
  activeTab: ReportsTabKey;
  onTabChange: (tab: ReportsTabKey) => void;
  dateSelection: DateRangeSelection;
  onDateChange: (next: DateRangeSelection) => void;
  onRefresh: () => void;
  onExport: (type: 'overview' | 'team' | 'templates') => void;
  exporting?: boolean;
}

const TABS: Array<{ key: ReportsTabKey; label: string; icon: typeof BarChart3 }> = [
  { key: 'overview', label: 'Overview', icon: BarChart3 },
  { key: 'team', label: 'Team & Support', icon: Users },
  { key: 'campaigns', label: 'Campaigns & Templates', icon: Megaphone },
  { key: 'ai', label: 'AI & Automation', icon: Bot },
  { key: 'meta', label: 'Meta Ops & Health', icon: ShieldCheck },
];

export default function ReportsHeader({
  activeTab,
  onTabChange,
  dateSelection,
  onDateChange,
  onRefresh,
  onExport,
  exporting = false,
}: ReportsHeaderProps) {
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
    };
    if (exportOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [exportOpen]);

  const handleExportClick = (type: 'overview' | 'team' | 'templates') => {
    setExportOpen(false);
    onExport(type);
  };

  return (
    <div className="space-y-4">
      {/* Top Filter & Control Row */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300">
              <BarChart3 className="h-4 w-4" />
            </span>
            <h1 className="text-xl font-black tracking-tight text-theme-fg sm:text-2xl">
              Reports & Intelligence
            </h1>
          </div>
          <p className="mt-0.5 text-[12px] font-medium text-theme-muted">
            Realtime performance metrics, team productivity, campaign ROI, and Meta health.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ReportsDateRangePicker selection={dateSelection} onChange={onDateChange} />

          {/* Export CTA Dropdown */}
          <div ref={exportRef} className="relative inline-block text-left">
            <AppButton
              variant="secondary"
              size="sm"
              icon={<Download size={14} />}
              loading={exporting}
              onClick={() => setExportOpen((prev) => !prev)}
            >
              Export
            </AppButton>

            {exportOpen && (
              <div className="absolute right-0 z-50 mt-1.5 w-52 origin-top-right rounded-2xl border border-theme-border bg-theme-surface p-1.5 shadow-panel backdrop-blur-xl animate-fade-down dark:bg-slate-900/95">
                <p className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-theme-muted">
                  Download CSV
                </p>
                <button
                  type="button"
                  onClick={() => handleExportClick('overview')}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[12px] font-medium text-theme-fg hover:bg-theme-subtle"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  Overview Summary CSV
                </button>
                <button
                  type="button"
                  onClick={() => handleExportClick('team')}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[12px] font-medium text-theme-fg hover:bg-theme-subtle"
                >
                  <Users className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
                  Agent Scorecard CSV
                </button>
                <button
                  type="button"
                  onClick={() => handleExportClick('templates')}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[12px] font-medium text-theme-fg hover:bg-theme-subtle"
                >
                  <Megaphone className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
                  Template Delivery CSV
                </button>
              </div>
            )}
          </div>

          <AppButton
            variant="secondary"
            size="sm"
            icon={<RefreshCw size={14} />}
            onClick={onRefresh}
            aria-label="Refresh reports"
          />
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex overflow-x-auto border-b border-theme-border/80 scrollbar-none">
        <div className="flex min-w-full gap-1 sm:min-w-0">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => onTabChange(tab.key)}
                className={`flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-[13px] font-bold whitespace-nowrap transition ${
                  active
                    ? 'border-whatsapp-600 text-whatsapp-700 dark:border-whatsapp-400 dark:text-whatsapp-300'
                    : 'border-transparent text-theme-muted hover:border-theme-border hover:text-theme-fg'
                }`}
              >
                <Icon className={`h-4 w-4 ${active ? 'text-whatsapp-600 dark:text-whatsapp-400' : 'text-theme-muted'}`} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
