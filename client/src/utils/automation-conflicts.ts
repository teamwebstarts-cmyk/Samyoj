import type { AutomationConflict } from '../types';
import { toastError, toastWarning } from './toast';

/** Returns false when save must stop (error-severity conflicts). Warnings still save. */
export function notifySaveConflicts(conflicts: AutomationConflict[]): boolean {
  if (!conflicts.length) return true;
  const errors = conflicts.filter((c) => c.severity === 'error');
  if (errors.length) {
    toastError(errors.map((c) => c.message).join('\n'));
    return false;
  }
  const shown = conflicts.slice(0, 3).map((c) => c.message);
  const extra =
    conflicts.length > 3 ? `\n+${conflicts.length - 3} more — see Automations after save.` : '';
  toastWarning(shown.join('\n') + extra);
  return true;
}
