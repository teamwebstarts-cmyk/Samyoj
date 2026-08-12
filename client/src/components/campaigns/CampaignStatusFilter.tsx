import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import AppSelect from '../ui/AppSelect';
import { useIsBelowLg } from '../../hooks/useBreakpoint';

const PRIMARY_STATUSES = [
  { value: '', label: 'All' },
  { value: 'SCHEDULED', label: 'Scheduled' },
  { value: 'COMPLETED', label: 'Completed' },
] as const;

const MORE_STATUSES = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'RUNNING', label: 'Running' },
  { value: 'PAUSED', label: 'Paused' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'CANCELLED', label: 'Cancelled' },
] as const;

export const campaignStatusFilterOptions = [
  { value: '', label: 'All statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SCHEDULED', label: 'Scheduled' },
  { value: 'RUNNING', label: 'Running' },
  { value: 'PAUSED', label: 'Paused' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

interface CampaignStatusFilterProps {
  value: string;
  onChange: (value: string) => void;
}

function isMoreStatus(value: string) {
  return MORE_STATUSES.some((option) => option.value === value);
}

export default function CampaignStatusFilter({ value, onChange }: CampaignStatusFilterProps) {
  const isBelowLg = useIsBelowLg();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const moreActive = isMoreStatus(value);
  const moreLabel = MORE_STATUSES.find((option) => option.value === value)?.label ?? 'More';

  useEffect(() => {
    if (!moreOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!moreRef.current?.contains(event.target as Node)) setMoreOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMoreOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [moreOpen]);

  const segments: Array<{ value: string; label: string; kind: 'primary' | 'more' }> = [
    ...PRIMARY_STATUSES.map((option) => ({ ...option, kind: 'primary' as const })),
    { value: '__more__', label: moreLabel, kind: 'more' },
  ];

  return (
    <>
      <div className="min-w-0 lg:hidden">
        <AppSelect
          className="w-full sm:w-[148px]"
          size={isBelowLg ? 'compact' : 'default'}
          value={value}
          placeholder="All statuses"
          isSearchable={false}
          options={campaignStatusFilterOptions}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>

      <div
        className="hidden h-11 items-stretch rounded-xl border border-slate-200/90 bg-slate-100/80 p-1 dark:border-slate-700 dark:bg-slate-900/80 lg:inline-flex"
        role="tablist"
        aria-label="Campaign status"
      >
        {segments.map((segment, index) => {
          const active = segment.kind === 'more' ? moreActive : value === segment.value;
          const prev = segments[index - 1];
          const prevActive = prev
            ? prev.kind === 'more'
              ? moreActive
              : value === prev.value
            : false;
          const showDivider = index > 0 && !active && !prevActive;

          return (
            <div key={segment.value} className="relative flex items-stretch">
              {showDivider && (
                <span
                  aria-hidden="true"
                  className="absolute left-0 top-1/2 h-4 w-px -translate-y-1/2 bg-slate-300/80 dark:bg-slate-600"
                />
              )}

              {segment.kind === 'primary' ? (
                <button
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    setMoreOpen(false);
                    onChange(segment.value);
                  }}
                  className={`relative z-[1] inline-flex h-9 min-w-[88px] items-center justify-center rounded-[10px] px-3.5 text-[13px] font-semibold transition ${
                    active
                      ? 'bg-white text-slate-900 shadow-sm ring-1 ring-black/[0.04] dark:bg-slate-800 dark:text-white dark:ring-white/10'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                  }`}
                >
                  {segment.label}
                </button>
              ) : (
                <div ref={moreRef} className="relative">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={active}
                    aria-haspopup="menu"
                    aria-expanded={moreOpen}
                    onClick={() => setMoreOpen((open) => !open)}
                    className={`relative z-[1] inline-flex h-9 min-w-[88px] items-center justify-center gap-1 rounded-[10px] px-3.5 text-[13px] font-semibold transition ${
                      active
                        ? 'bg-white text-slate-900 shadow-sm ring-1 ring-black/[0.04] dark:bg-slate-800 dark:text-white dark:ring-white/10'
                        : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                    }`}
                  >
                    {segment.label}
                    <ChevronDown className={`h-3.5 w-3.5 opacity-70 transition ${moreOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {moreOpen && (
                    <div
                      role="menu"
                      className="absolute right-0 top-[calc(100%+8px)] z-30 min-w-[168px] overflow-hidden rounded-xl border border-slate-200/90 bg-white p-1.5 shadow-[0_12px_32px_rgba(15,23,42,0.12)] dark:border-slate-700 dark:bg-slate-900 dark:shadow-[0_12px_32px_rgba(0,0,0,0.45)]"
                    >
                      <div className="campaign-status-more-scroll max-h-56 overflow-y-auto">
                        {MORE_STATUSES.map((option) => {
                          const selected = value === option.value;
                          return (
                            <button
                              key={option.value}
                              type="button"
                              role="menuitemradio"
                              aria-checked={selected}
                              onClick={() => {
                                onChange(option.value);
                                setMoreOpen(false);
                              }}
                              className={`flex w-full items-center rounded-lg px-3 py-2 text-left text-[13px] font-semibold transition ${
                                selected
                                  ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                                  : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800'
                              }`}
                            >
                              {option.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
