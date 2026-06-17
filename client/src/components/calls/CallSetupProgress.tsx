import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bot,
  CheckCircle2,
  ChevronDown,
  Circle,
  Phone,
  PhoneCall,
  Settings,
  Sparkles,
  Wifi,
} from 'lucide-react';
import AppButton from '../ui/AppButton';

export type SetupStep = 'whatsapp' | 'calling' | 'bot';

interface CallSetupProgressProps {
  whatsappConnected: boolean;
  callingEnabled: boolean;
  botReady: boolean;
  onEnableCalling?: () => void;
  enabling?: boolean;
  enableHints?: string[];
}

const steps: Array<{
  id: SetupStep;
  title: string;
  description: string;
  icon: typeof Phone;
  done: (s: Omit<CallSetupProgressProps, 'onEnableCalling' | 'enabling' | 'enableHints'>) => boolean;
  action?: SetupStep;
}> = [
  {
    id: 'whatsapp',
    title: 'WhatsApp connected',
    description: 'Your business number is linked to this platform.',
    icon: Wifi,
    done: (s) => s.whatsappConnected,
    action: 'whatsapp',
  },
  {
    id: 'calling',
    title: 'Voice calls enabled',
    description: 'Customers can call you directly from WhatsApp chat.',
    icon: PhoneCall,
    done: (s) => s.callingEnabled,
    action: 'calling',
  },
  {
    id: 'bot',
    title: 'AI bot ready',
    description: 'An active bot picks up and speaks with callers.',
    icon: Bot,
    done: (s) => s.botReady,
    action: 'bot',
  },
];

export default function CallSetupProgress({
  whatsappConnected,
  callingEnabled,
  botReady,
  onEnableCalling,
  enabling,
  enableHints = [],
}: CallSetupProgressProps) {
  const state = { whatsappConnected, callingEnabled, botReady };
  const completed = steps.filter((s) => s.done(state)).length;
  const allDone = completed === steps.length;
  const nextStep = steps.find((s) => !s.done(state));
  const [expanded, setExpanded] = useState(!allDone);

  if (allDone && !expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="dashboard-card flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left transition hover:bg-emerald-50/30"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-whatsapp-600 text-white shadow-[0_3px_10px_rgba(37,211,102,0.25)]">
            <CheckCircle2 className="h-4.5 w-4.5" />
          </span>
          <div>
            <p className="text-[13px] font-extrabold text-neutral-900">Voice calls are live</p>
            <p className="text-[12px] font-medium text-neutral-500">AI auto-answers incoming WhatsApp calls</p>
          </div>
        </div>
        <ChevronDown className="h-4 w-4 shrink-0 text-neutral-400" />
      </button>
    );
  }

  return (
    <div className="dashboard-card overflow-hidden p-0">
      {allDone && (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="flex w-full items-center justify-end gap-1 border-b border-neutral-100 px-4 py-2 text-[11px] font-semibold text-neutral-500 hover:bg-neutral-50"
        >
          Collapse
          <ChevronDown className="h-3.5 w-3.5 rotate-180" />
        </button>
      )}
      <div className="border-b border-neutral-100 bg-gradient-to-r from-violet-50/80 via-white to-emerald-50/50 px-5 py-4 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-200/80 bg-white/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-violet-700 shadow-sm">
                <Sparkles className="h-3 w-3" />
                Setup
              </span>
              <span className="text-[12px] font-semibold text-neutral-500">
                {completed} of {steps.length} complete
              </span>
            </div>
            <h2 className="mt-2 text-base font-extrabold tracking-tight text-neutral-900 sm:text-lg">
              {allDone ? 'You’re ready for voice calls' : 'Finish setup to go live'}
            </h2>
            <p className="mt-1 max-w-xl text-[13px] font-medium leading-relaxed text-neutral-600">
              {allDone
                ? 'Incoming WhatsApp calls are answered by your AI bot automatically — 24/7.'
                : 'Complete the steps below. Once live, every call is logged with a full conversation transcript.'}
            </p>
          </div>

          {!allDone && nextStep?.id === 'calling' && whatsappConnected && (
            <AppButton loading={enabling} onClick={onEnableCalling} size="sm">
              <Phone className="h-4 w-4" />
              Enable calls
            </AppButton>
          )}
          {!allDone && nextStep?.id === 'whatsapp' && (
            <Link to="/settings">
              <AppButton variant="secondary" size="sm">
                <Settings className="h-4 w-4" />
                Connect WhatsApp
              </AppButton>
            </Link>
          )}
          {!allDone && nextStep?.id === 'bot' && (
            <Link to="/ai-bot">
              <AppButton variant="secondary" size="sm">
                <Bot className="h-4 w-4" />
                Set up AI bot
              </AppButton>
            </Link>
          )}
        </div>

        <div className="mt-4 h-2 overflow-hidden rounded-full bg-neutral-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-violet-500 via-whatsapp-500 to-emerald-500 transition-all duration-500"
            style={{ width: `${(completed / steps.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="grid divide-y divide-neutral-100 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {steps.map((step) => {
          const done = step.done(state);
          const isNext = !done && nextStep?.id === step.id;
          const Icon = step.icon;

          return (
            <div
              key={step.id}
              className={`flex gap-3 px-5 py-4 sm:px-6 ${isNext ? 'bg-violet-50/40' : 'bg-white'}`}
            >
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
                  done
                    ? 'bg-gradient-to-br from-emerald-500 to-whatsapp-600 text-white shadow-[0_4px_14px_rgba(37,211,102,0.3)]'
                    : isNext
                      ? 'bg-gradient-to-br from-violet-600 to-indigo-700 text-white shadow-[0_4px_14px_rgba(99,102,241,0.3)]'
                      : 'bg-neutral-100 text-neutral-400'
                }`}
              >
                {done ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-5 w-5" strokeWidth={2} />}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-[13px] font-extrabold text-neutral-900">{step.title}</p>
                  {!done && !isNext && <Circle className="h-3 w-3 text-neutral-300" />}
                </div>
                <p className="mt-0.5 text-[12px] font-medium leading-relaxed text-neutral-500">
                  {step.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {enableHints.length > 0 && !callingEnabled && whatsappConnected && (
        <div className="border-t border-amber-100 bg-amber-50/60 px-5 py-4 sm:px-6">
          <p className="text-[12px] font-bold text-amber-900">If this fails, check your WhatsApp Business settings:</p>
          <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
            {enableHints.map((hint) => (
              <li key={hint} className="flex gap-2 text-[11px] font-medium leading-relaxed text-amber-950/90">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-amber-500" />
                {hint}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
