import { Link } from 'react-router-dom';
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
          {conflict.links && conflict.links.length > 0 ? (
            <p className="mt-1 text-[12px] opacity-90">
              {conflict.links.map((link, index) => (
                <span key={`${link.href}-${link.label}-${index}`}>
                  {index > 0 && ' · '}
                  <Link to={link.href} className="font-semibold underline underline-offset-2">
                    {link.label}
                  </Link>
                </span>
              ))}
            </p>
          ) : (
            conflict.items.length > 0 && (
              <p className="mt-1 text-[12px] opacity-90">{conflict.items.join(' · ')}</p>
            )
          )}
          <p className="mt-1.5 text-[11px] opacity-80">
            Turn off the automation you don't need, or keep only one active for the same situation.
          </p>
        </AppAlert>
      ))}
    </div>
  );
}
