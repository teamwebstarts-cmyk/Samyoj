import { Link } from 'react-router-dom';
import {
  CheckCircle2,
  Circle,
  PhoneCall,
  X,
} from 'lucide-react';
import AppButton from '../ui/AppButton';

interface CallsSetupSheetProps {
  whatsappConnected: boolean;
  callingEnabled: boolean;
  botReady: boolean;
  onEnableCalling?: () => void;
  enabling?: boolean;
  enableHints?: string[];
  onClose: () => void;
}

export default function CallsSetupSheet({
  whatsappConnected,
  callingEnabled,
  botReady,
  onEnableCalling,
  enabling,
  enableHints = [],
  onClose,
}: CallsSetupSheetProps) {
  const steps = [
    { id: 'whatsapp' as const, label: 'WhatsApp connected', done: whatsappConnected, href: '/settings' },
    { id: 'calling' as const, label: 'Enable calling on Meta', done: callingEnabled, action: true },
    { id: 'bot' as const, label: 'AI bot ready', done: botReady, href: '/ai-bot' },
    { id: 'voice' as const, label: 'Voice ready', done: callingEnabled && botReady },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose}>
      <div
        className="absolute bottom-0 left-0 right-0 max-h-[90dvh] overflow-y-auto rounded-t-2xl bg-white px-5 pb-8 pt-4 shadow-2xl sm:relative sm:mx-auto sm:my-10 sm:max-w-lg sm:rounded-2xl sm:shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-[16px] font-extrabold text-neutral-900">Call setup</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {steps.map((step) => (
            <div key={step.id} className="flex items-center gap-3 rounded-xl border border-neutral-200 px-4 py-3">
              {step.done ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
              ) : (
                <Circle className="h-5 w-5 shrink-0 text-neutral-300" />
              )}
              <span className="flex-1 text-[14px] font-semibold text-neutral-800">{step.label}</span>
              {!step.done && step.href && (
                <Link to={step.href} className="text-[12px] font-bold text-emerald-700 hover:underline">
                  Go
                </Link>
              )}
              {!step.done && step.action && (
                <AppButton size="sm" loading={enabling} onClick={onEnableCalling}>
                  <PhoneCall className="h-3 w-3" />
                  Enable
                </AppButton>
              )}
            </div>
          ))}
        </div>

        {enableHints.length > 0 && !callingEnabled && whatsappConnected && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-[12px] font-bold text-amber-900">Before enabling, complete in Meta Business Manager:</p>
            <ul className="mt-2 space-y-1.5">
              {enableHints.map((hint) => (
                <li key={hint} className="flex gap-2 text-[11px] font-medium text-amber-800">
                  <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-amber-500" />
                  {hint}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
