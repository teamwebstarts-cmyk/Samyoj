import { ChevronDown, Copy, MessageCircle } from 'lucide-react';
import { useMemo, useState } from 'react';
import AppButton from '../ui/AppButton';
import AppInput from '../ui/AppInput';
import SettingsPanel from './SettingsPanel';
import { buildWaMeSnippet, buildWaMeUrl, digitsOnlyPhone } from '../../utils/waMe';
import { toastSuccess } from '../../utils/toast';
import { useWhatsAppNumber } from '../../contexts/WhatsAppNumberContext';

function MockWebsitePreview({
  label,
  color,
  position,
  href,
}: {
  label: string;
  color: string;
  position: 'br' | 'bl';
  href: string;
}) {
  return (
    <div
      className="relative isolate h-52 overflow-hidden rounded-lg border border-slate-200/80 bg-gradient-to-b from-slate-50 to-white shadow-inner"
      aria-hidden
    >
      <div className="border-b border-slate-200/70 bg-white/90 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-slate-300" />
          <div className="h-2 w-2 rounded-full bg-slate-300" />
          <div className="h-2 w-2 rounded-full bg-slate-300" />
          <div className="ml-2 h-2 w-24 rounded-full bg-slate-200" />
        </div>
      </div>

      <div className="space-y-2.5 px-5 py-4">
        <div className="h-3 w-2/5 rounded-full bg-slate-200" />
        <div className="h-2 w-full max-w-[85%] rounded-full bg-slate-100" />
        <div className="h-2 w-full max-w-[70%] rounded-full bg-slate-100" />
        <div className="h-2 w-full max-w-[55%] rounded-full bg-slate-100" />
      </div>

      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute bottom-4 z-10 whitespace-nowrap text-[14px] font-semibold leading-none text-white no-underline shadow-[0_8px_24px_rgba(15,23,42,0.18)] transition hover:brightness-95"
        style={{
          backgroundColor: color,
          padding: '12px 16px',
          borderRadius: '999px',
          ...(position === 'bl' ? { left: '16px' } : { right: '16px' }),
        }}
      >
        {label}
      </a>
    </div>
  );
}

export default function WhatsAppButtonBuilder() {
  const { activeNumber } = useWhatsAppNumber();
  const [label, setLabel] = useState('Chat on WhatsApp');
  const [prefill, setPrefill] = useState('Hi, I have a question.');
  const [color, setColor] = useState('#25D366');
  const [position, setPosition] = useState<'br' | 'bl'>('br');
  const [embedOpen, setEmbedOpen] = useState(false);
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
        <div className="space-y-4">
          <p className="text-[12px] font-medium text-theme-secondary">
            Number: {digitsOnlyPhone(phone)} · preview{' '}
            <a
              href={previewHref}
              target="_blank"
              rel="noreferrer"
              className="font-bold text-whatsapp-600 underline decoration-whatsapp-500/30 underline-offset-2 hover:text-whatsapp-700 dark:text-whatsapp-400"
            >
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

          <div className="overflow-hidden rounded-xl border border-theme-border/80 bg-theme-subtle/25">
            <div className="border-b border-theme-border/60 px-3.5 py-3">
              <p className="text-[13px] font-bold text-theme-fg">Live preview</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-theme-secondary">
                How the floating button looks on a typical website page.
              </p>
            </div>
            <div className="p-3.5">
              <MockWebsitePreview label={label} color={color} position={position} href={previewHref} />
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-theme-border bg-theme-surface/60">
            <div className="flex items-center gap-2 px-3.5 py-3">
              <button
                type="button"
                onClick={() => setEmbedOpen((open) => !open)}
                className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left transition hover:opacity-80"
                aria-expanded={embedOpen}
              >
                <div className="min-w-0">
                  <p className="text-[13px] font-bold text-theme-fg">Embed code</p>
                  <p className="mt-0.5 text-[10px] font-medium text-theme-muted">
                    Paste before &lt;/body&gt; on your site
                  </p>
                </div>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-theme-muted transition ${embedOpen ? 'rotate-180' : ''}`}
                />
              </button>
              <AppButton
                type="button"
                size="sm"
                variant="secondary"
                icon={<Copy className="h-3.5 w-3.5" />}
                onClick={() => void copy()}
              >
                Copy
              </AppButton>
            </div>

            {embedOpen && (
              <div className="border-t border-theme-border px-3.5 py-3">
                <pre className="overflow-x-auto rounded-lg border border-theme-border/80 bg-theme-subtle/40 p-3 font-mono text-[11px] leading-relaxed text-theme-fg">
                  {snippet}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </SettingsPanel>
  );
}
