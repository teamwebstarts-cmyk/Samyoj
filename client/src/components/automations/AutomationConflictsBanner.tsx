import AppAlert from '../ui/AppAlert';
import type { AutomationConflict } from '../../types';

interface AutomationConflictsBannerProps {
  conflicts: AutomationConflict[];
}

export default function AutomationConflictsBanner({ conflicts }: AutomationConflictsBannerProps) {
  if (conflicts.length === 0) return null;

  return (
    <div className="space-y-2">
      {conflicts.map((conflict) => (
        <AppAlert key={conflict.type} variant={conflict.severity === 'error' ? 'error' : 'warning'}>
          <p className="font-bold">{conflict.message}</p>
          {conflict.items.length > 0 && (
            <p className="mt-1 text-[12px] opacity-90">{conflict.items.join(' · ')}</p>
          )}
          <p className="mt-1.5 text-[11px] opacity-80">
            Turn off the automation you don't need, or keep only one active for the same situation.
          </p>
        </AppAlert>
      ))}
    </div>
  );
}
