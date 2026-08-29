import { MessageCircle, Copy } from 'lucide-react';
import { useMemo, useState } from 'react';
import AppButton from '../ui/AppButton';
import AppInput from '../ui/AppInput';
import SettingsPanel from './SettingsPanel';
import { buildWaMeSnippet, buildWaMeUrl, digitsOnlyPhone } from '../../utils/waMe';
import { toastSuccess } from '../../utils/toast';
import { useWhatsAppNumber } from '../../contexts/WhatsAppNumberContext';

export default function WhatsAppButtonBuilder() {
  const { activeNumber } = useWhatsAppNumber();
  const [label, setLabel] = useState('Chat on WhatsApp');
  const [prefill, setPrefill] = useState('Hi, I have a question.');
  const [color, setColor] = useState('#25D366');
  const [position, setPosition] = useState<'br' | 'bl'>('br');
  const phone = activeNumber?.phoneNumber || '';
  const snippet = useMemo(
    () =>
      buildWaMeSnippet({
        phone,
        label,
        text: prefill,
        color,
        position,
      }),
    [phone, label, prefill, color, position]
  );
  const previewHref = buildWaMeUrl(phone, prefill);

  const copy = async () => {
    if (!snippet) return;
    await navigator.clipboard.writeText(snippet);
    toastSuccess('Snippet copied');
  };

  return (
    <SettingsPanel
      title="Website WhatsApp button"
      description="Official wa.me link for the active number. Visitors tap it to open WhatsApp. This is not an in-page chat and not a campaign opt-in."
      icon={MessageCircle}
    >
      {!phone ? (
        <p className="text-[13px] font-medium text-slate-500">Connect a WhatsApp number first.</p>
      ) : (
        <div className="space-y-3">
          <p className="text-[12px] font-medium text-slate-500">
            Number: {digitsOnlyPhone(phone)} · preview{' '}
            <a href={previewHref} target="_blank" rel="noreferrer" className="font-bold text-emerald-700 underline">
              {previewHref}
            </a>
          </p>
          <AppInput id="wa-btn-label" label="Button text" value={label} onChange={(e) => setLabel(e.target.value)} />
          <AppInput
            id="wa-btn-prefill"
            label="Prefill message"
            value={prefill}
            onChange={(e) => setPrefill(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-2">
            <AppInput id="wa-btn-color" label="Color" value={color} onChange={(e) => setColor(e.target.value)} />
            <label className="block text-[11px] font-bold text-slate-500">
              Position
              <select
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] dark:border-slate-700 dark:bg-slate-950"
                value={position}
                onChange={(e) => setPosition(e.target.value as 'br' | 'bl')}
              >
                <option value="br">Bottom right</option>
                <option value="bl">Bottom left</option>
              </select>
            </label>
          </div>
          <pre className="overflow-x-auto rounded-xl bg-slate-950 p-3 text-[11px] text-slate-100">{snippet}</pre>
          <AppButton type="button" size="sm" icon={<Copy className="h-3.5 w-3.5" />} onClick={() => void copy()}>
            Copy snippet
          </AppButton>
        </div>
      )}
    </SettingsPanel>
  );
}
