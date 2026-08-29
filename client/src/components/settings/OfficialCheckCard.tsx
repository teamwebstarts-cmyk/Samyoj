import { CheckCircle2 } from 'lucide-react';
import SettingsPanel from './SettingsPanel';
import AppButton from '../ui/AppButton';
import type { WhatsappNumberOption } from '../../contexts/WhatsAppNumberContext';

const WHATSAPP_MANAGER_URL = 'https://business.facebook.com/wa/manage/phone-numbers/';

const CHECKLIST = [
  'The number has been on WhatsApp Business Platform for about 30 days',
  'Display name is approved',
  'Two-factor PIN is set in WhatsApp Manager',
  'Business Verification is complete for the Meta Business Portfolio',
  'Templates are policy-clean (no banned promo copy on utility)',
];

interface OfficialCheckCardProps {
  activeNumber: WhatsappNumberOption | null;
}

export default function OfficialCheckCard({ activeNumber }: OfficialCheckCardProps) {
  const status = activeNumber?.officialBusinessAccount === true
    ? 'Approved'
    : activeNumber?.officialBusinessAccount === false
      ? 'Not approved yet'
      : 'Not started / unknown';

  const copyList = async () => {
    await navigator.clipboard.writeText(
      ['Official check document checklist', ...CHECKLIST.map((item, index) => `${index + 1}. ${item}`)].join('\n')
    );
  };

  return (
    <SettingsPanel
      title="Official check"
      description="Official check from Meta (often called green tick). We help you apply. Meta decides. Samyoj cannot grant or sell the badge."
      icon={CheckCircle2}
    >
      <div className="space-y-3">
        <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">
          Status: {status}
        </p>
        <ul className="list-disc space-y-1 pl-5 text-[13px] font-medium text-slate-600 dark:text-slate-300">
          {CHECKLIST.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2">
          <a href={WHATSAPP_MANAGER_URL} target="_blank" rel="noreferrer">
            <AppButton type="button" size="sm">
              Open WhatsApp Manager
            </AppButton>
          </a>
          <AppButton type="button" size="sm" variant="secondary" onClick={() => void copyList()}>
            Copy document list
          </AppButton>
        </div>
      </div>
    </SettingsPanel>
  );
}
