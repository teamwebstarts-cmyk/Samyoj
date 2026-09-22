import { useMemo, useState } from 'react';
import AppAlert from '../ui/AppAlert';
import AppButton from '../ui/AppButton';
import {
  formatCustomerTemplateRejectionBrief,
  formatCustomerTemplateRejectionTitle,
} from '../../utils/templateRejectionGuide';

export interface TemplateRejectionAlertItem {
  templateName?: string;
  status?: string;
  reason?: string;
  createdAt?: string;
}

interface TemplateRejectionBannerProps {
  alerts: TemplateRejectionAlertItem[];
  /** Only surface rejections that still exist on this number. */
  activeRejectedNames: Set<string>;
  onShowRejected: () => void;
  onOpenTemplate: (name: string) => void;
  onClearStoredAlerts?: () => void;
  storageKey: string;
}

export default function TemplateRejectionBanner({
  alerts,
  activeRejectedNames,
  onShowRejected,
  onOpenTemplate,
  onClearStoredAlerts,
  storageKey,
}: TemplateRejectionBannerProps) {
  const visible = useMemo(
    () =>
      alerts.filter(
        (alert) => alert.templateName && activeRejectedNames.has(alert.templateName),
      ),
    [alerts, activeRejectedNames],
  );

  const fingerprint = useMemo(
    () => visible.map((a) => a.templateName).sort().join('|'),
    [visible],
  );

  const [dismissedFingerprint, setDismissedFingerprint] = useState(() => {
    try {
      return sessionStorage.getItem(storageKey) || '';
    } catch {
      return '';
    }
  });

  if (visible.length === 0 || dismissedFingerprint === fingerprint) return null;

  const dismiss = () => {
    try {
      sessionStorage.setItem(storageKey, fingerprint);
    } catch {
      /* ignore */
    }
    setDismissedFingerprint(fingerprint);
    onClearStoredAlerts?.();
  };

  return (
    <div className="border-b border-theme-border px-4 py-2.5 sm:px-5">
      <AppAlert variant="warning">
        <p className="font-semibold text-[13px]">
          {visible.length === 1
            ? 'One template needs a quick fix'
            : `${visible.length} templates need a quick fix`}
        </p>
        <p className="mt-1 text-[12px] font-medium opacity-90">
          WhatsApp did not approve these drafts. You can edit and resubmit, or delete old names you no
          longer use.
        </p>
        <ul className="mt-2 space-y-1.5 text-[12px]">
          {visible.slice(0, 4).map((alert) => {
            const name = alert.templateName || 'Template';
            const title = formatCustomerTemplateRejectionTitle(alert.reason);
            const detail = formatCustomerTemplateRejectionBrief(alert.reason);
            return (
              <li key={name} className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                <button
                  type="button"
                  className="font-mono text-[11px] font-bold text-amber-950 underline decoration-amber-700/40 underline-offset-2 hover:decoration-amber-800 dark:text-amber-100"
                  onClick={() => onOpenTemplate(name)}
                >
                  {name}
                </button>
                <span className="text-amber-900/80 dark:text-amber-200/90">
                  · {title} — {detail}
                </span>
              </li>
            );
          })}
        </ul>
        <div className="mt-3 flex flex-wrap gap-2">
          <AppButton variant="secondary" size="sm" onClick={onShowRejected}>
            Show rejected
          </AppButton>
          <AppButton variant="ghost" size="sm" onClick={dismiss}>
            Dismiss
          </AppButton>
        </div>
      </AppAlert>
    </div>
  );
}
