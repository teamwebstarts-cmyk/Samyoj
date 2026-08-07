import { PhoneCall } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import SettingsPanel from '../settings/SettingsPanel';
import CallingSettingsForm from './CallingSettingsForm';

type SectionId =
  | 'who'
  | 'behavior'
  | 'greetings'
  | 'after-hours'
  | 'missed'
  | 'voice'
  | 'personality'
  | 'training'
  | 'advanced';

const VALID_SECTIONS: SectionId[] = [
  'who',
  'behavior',
  'greetings',
  'after-hours',
  'missed',
  'voice',
  'personality',
  'training',
  'advanced',
];

export default function CallingSettingsPanel() {
  const [searchParams] = useSearchParams();
  const sectionParam = searchParams.get('section') as SectionId | null;
  const initialSection =
    sectionParam && VALID_SECTIONS.includes(sectionParam) ? sectionParam : 'who';

  return (
    <SettingsPanel
      title="Customize calls"
      description="Choose who picks up WhatsApp calls and what callers hear — plain language, same settings as Calls → Customize."
      icon={PhoneCall}
      accent="emerald"
    >
      <CallingSettingsForm initialSection={initialSection} />
    </SettingsPanel>
  );
}
