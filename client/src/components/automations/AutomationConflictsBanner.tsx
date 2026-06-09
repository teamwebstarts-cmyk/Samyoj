import { AlertTriangle } from 'lucide-react';
import type { AutomationConflict } from '../../types';

interface AutomationConflictsBannerProps {
  conflicts: AutomationConflict[];
}

export default function AutomationConflictsBanner({ conflicts }: AutomationConflictsBannerProps) {
  if (conflicts.length === 0) return null;

  return (
    <div className="space-y-2">
      {conflicts.map((conflict) => (
        <div
          key={conflict.type}
          className="flex items-start gap-3 rounded-2xl border border-amber-200/70 bg-gradient-to-r from-amber-50/90 to-orange-50/50 px-4 py-3.5"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div className="min-w-0">
            <p className="text-[13px] font-bold text-amber-950">{conflict.message}</p>
            {conflict.items.length > 0 && (
              <p className="mt-1 text-[12px] font-medium text-amber-800/90">{conflict.items.join(' · ')}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
