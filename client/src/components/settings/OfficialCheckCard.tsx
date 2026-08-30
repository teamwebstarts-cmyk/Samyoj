import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BadgeCheck, ExternalLink } from 'lucide-react';
import SettingsPanel from './SettingsPanel';
import AppAlert from '../ui/AppAlert';
import AppButton from '../ui/AppButton';
import { useAuth } from '../../contexts/AuthContext';
import { useWhatsAppNumber } from '../../contexts/WhatsAppNumberContext';

const WHATSAPP_MANAGER_URL = 'https://business.facebook.com/wa/manage/home/';
const OBA_HELP_URL = 'https://www.facebook.com/business/help/604726921052590';
const BUSINESS_VERIFICATION_URL = 'https://www.facebook.com/business/help/2058515294227817';
const DISPLAY_NAME_URL = 'https://www.facebook.com/business/help/757569725593362';

const LINK_CLASS =
  'font-semibold text-whatsapp-700 underline-offset-2 hover:underline dark:text-whatsapp-400';

const CHECKLIST = [
  {
    id: 'cloud-api',
    label: 'Connect a Cloud API WhatsApp number (not Business app coexistence).',
  },
  {
    id: 'business-verification',
    label: 'Complete Meta Business Verification (legal entity — this is not the green tick).',
    href: BUSINESS_VERIFICATION_URL,
    hrefLabel: 'Business Verification docs',
  },
  {
    id: 'display-name',
    label: 'Approved display name that matches the brand.',
    href: DISPLAY_NAME_URL,
    hrefLabel: 'Display name help',
  },
  {
    id: 'public-presence',
    label: 'Public website / Facebook Page that matches the business.',
  },
  {
    id: 'submit-oba',
    label: 'Submit Official Business Account in WhatsApp Manager (Profile → Official business account).',
  },
] as const;

function prepStorageKey(orgId: string | undefined, numberId: string | undefined) {
  return `samyoj.obaPrep.${orgId || 'org'}.${numberId || 'none'}`;
}

function loadTicks(key: string): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object') return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(([, value]) => typeof value === 'boolean')
    ) as Record<string, boolean>;
  } catch {
    return {};
  }
}

export default function OfficialCheckCard() {
  const { organization } = useAuth();
  const { activeNumber } = useWhatsAppNumber();
  const storageKey = useMemo(
    () => prepStorageKey(organization?.id, activeNumber?.id),
    [organization?.id, activeNumber?.id]
  );
  const [ticks, setTicks] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setTicks(loadTicks(storageKey));
  }, [storageKey]);

  const toggleTick = useCallback(
    (id: string) => {
      setTicks((prev) => {
        const next = { ...prev, [id]: !prev[id] };
        try {
          localStorage.setItem(storageKey, JSON.stringify(next));
        } catch {
          /* ignore quota / private mode */
        }
        return next;
      });
    },
    [storageKey]
  );

  const isOnBizApp = Boolean(activeNumber?.isOnBizApp);

  return (
    <SettingsPanel
      title="Green tick"
      description="We help you prepare. Meta reviews and decides. This is Meta’s Official Business Account — Samyoj cannot grant or sell it."
      icon={BadgeCheck}
    >
      <div className="space-y-4">
        {isOnBizApp ? (
          <AppAlert variant="warning">
            The green tick is not available on WhatsApp Business app numbers
            (coexistence). Meta only reviews Cloud API numbers. Connect a Cloud API line first.
          </AppAlert>
        ) : null}

        {!activeNumber ? (
          <p className="text-[13px] font-medium text-theme-secondary">
            Connect a Cloud API WhatsApp number first.{' '}
            <Link to="/settings?tab=whatsapp" className={LINK_CLASS}>
              WhatsApp settings →
            </Link>
          </p>
        ) : null}

        <div>
          <p className="text-[13px] font-semibold text-theme-fg">Prep checklist</p>
          <p className="mt-0.5 text-[12px] font-medium text-theme-muted">
            Tick as you finish — this is your prep list, not Meta’s review.
          </p>
          <ul className="mt-2.5 space-y-1">
            {CHECKLIST.map((item) => (
              <li key={item.id} className="rounded-lg px-1 py-1.5 hover:bg-theme-subtle/60">
                <label className="flex cursor-pointer items-start gap-2.5">
                  <input
                    type="checkbox"
                    checked={Boolean(ticks[item.id])}
                    onChange={() => toggleTick(item.id)}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-theme-border text-whatsapp-600 focus:ring-whatsapp-500/25"
                  />
                  <span className="min-w-0 text-[13px] font-medium leading-snug text-theme-secondary">
                    {item.label}
                  </span>
                </label>
                {'href' in item && item.href ? (
                  <a
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`ml-6 mt-0.5 inline-block text-[12px] ${LINK_CLASS}`}
                  >
                    {item.hrefLabel}
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-[13px] font-semibold text-theme-fg">How to apply</p>
          <ol className="mt-1.5 list-decimal space-y-1 pl-5 text-[13px] font-medium leading-snug text-theme-secondary">
            <li>Open WhatsApp Manager for this WABA.</li>
            <li>Go to Profile → Official business account.</li>
            <li>Submit with brand proof that matches the approved display name.</li>
            <li>Wait for Meta. If they reject, wait 30 days before applying again.</li>
          </ol>
        </div>

        <div className="flex flex-wrap gap-2">
          <a href={WHATSAPP_MANAGER_URL} target="_blank" rel="noopener noreferrer">
            <AppButton type="button" size="sm" icon={<ExternalLink className="h-3.5 w-3.5" />}>
              Open WhatsApp Manager
            </AppButton>
          </a>
          <a href={OBA_HELP_URL} target="_blank" rel="noopener noreferrer">
            <AppButton type="button" size="sm" variant="secondary">
              Meta help article
            </AppButton>
          </a>
        </div>
      </div>
    </SettingsPanel>
  );
}
