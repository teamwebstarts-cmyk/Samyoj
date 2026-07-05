import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, FlaskConical, Play, XCircle } from 'lucide-react';
import AppButton from '../ui/AppButton';
import AppInput from '../ui/AppInput';
import { flowApi } from '../../services/api';
import { getErrorMessage } from '../../utils/errors';
import { toastError, toastSuccess, toastWarning } from '../../utils/toast';
import type { FlowNode, FlowTriggerType } from '../../types';
import { nodeMeta, triggerMeta } from './flowMeta';

interface FlowTestPanelProps {
  triggerType: FlowTriggerType;
  triggerConfig: Record<string, unknown>;
  nodes: FlowNode[];
  startNodeId?: string;
}

type SimResult = {
  triggered: boolean;
  reason: string;
  steps: Array<{ nodeId: string; type: string; action: string; branch?: string }>;
};

const EVENT_TRIGGERS: FlowTriggerType[] = ['MISSED_CALL', 'CALL_COMPLETED'];

function defaultMessageForTrigger(triggerType: FlowTriggerType, triggerConfig: Record<string, unknown>): string {
  if (triggerType === 'KEYWORD') {
    return String(triggerConfig.keyword || 'hello');
  }
  if (triggerType === 'WELCOME') return 'Hi there!';
  return 'hello';
}

function defaultIsNewForTrigger(triggerType: FlowTriggerType): boolean {
  return triggerType === 'WELCOME';
}

function stepTypeLabel(type: string): string {
  if (type === 'user') return 'Customer';
  return nodeMeta[type as keyof typeof nodeMeta]?.label || type.replace(/_/g, ' ');
}

function friendlyStepAction(step: SimResult['steps'][number]): string {
  if (step.type === 'user') return 'Replies to your question';
  if (step.action.startsWith('Branch:')) {
    const branch = step.action.replace('Branch: ', '').trim();
    if (branch === 'true') return 'Took the Yes path';
    if (branch === 'false') return 'Took the No path';
    return `Took path "${branch}"`;
  }
  if (step.action.startsWith('A/B branch:')) {
    return `Split test — path ${step.action.replace('A/B branch: ', '').toUpperCase()}`;
  }
  if (step.action === '[Customer reply]') return 'Sends a reply';
  if (step.action === 'Show buttons') return 'Shows quick reply buttons';
  if (step.action === 'Ask question') return 'Asks a question';
  const trimmed = step.action.trim();
  if (trimmed.length > 80) return `${trimmed.slice(0, 77)}…`;
  return trimmed || 'Runs this step';
}

function friendlyReason(reason: string, triggered: boolean): string {
  if (reason.startsWith('Contact has tag "')) {
    return triggered
      ? `Contact has the "${reason.match(/"([^"]+)"/)?.[1] || 'required'}" label — flow would start.`
      : 'Contact does not have the required label.';
  }

  const map: Record<string, string> = {
    'New conversation': 'This looks like a first-time message — your flow would start.',
    'Not a new conversation': 'This is not treated as a first message, so this flow would not start.',
    'Keyword matched': 'The message contains your keyword — your flow would start.',
    'Keyword did not match': 'The message does not contain your keyword — this flow would not start.',
    'Within business hours': 'Your team is open and the customer sent a message — flow would start.',
    'Outside business hours or empty message': 'Either your team is closed or the message is empty.',
    'Outside business hours': 'Your team is away — flow would start.',
    'Within business hours or empty message': 'Either your team is open or the message is empty.',
    'Returning customer message': 'A returning customer sent a message — flow would start.',
    'New conversation or empty': 'Needs a returning customer with a message.',
    'Contact in segment': 'Contact has one of the required labels — flow would start.',
    'Contact not in segment': 'Contact does not have the required labels.',
    'Contact missing required tag': 'This contact does not have the required label.',
    'Triggered by missed call event': 'A missed call would start this flow.',
    'Reply after campaign message': 'A reply after a campaign would start this flow.',
    'No campaign context': 'No campaign reply detected.',
    'Triggered by completed call event': 'A completed call would start this flow.',
  };

  if (map[reason]) return map[reason];
  if (triggered) return reason;
  return reason || 'This scenario would not start your flow.';
}

export default function FlowTestPanel({ triggerType, triggerConfig, nodes, startNodeId }: FlowTestPanelProps) {
  const [message, setMessage] = useState(() => defaultMessageForTrigger(triggerType, triggerConfig));
  const [isNew, setIsNew] = useState(() => defaultIsNewForTrigger(triggerType));
  const [tags, setTags] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SimResult | null>(null);

  const triggerInfo = triggerMeta[triggerType];
  const isEventTrigger = EVENT_TRIGGERS.includes(triggerType);
  const needsTags = triggerType === 'CONTACT_TAG' || triggerType === 'SEGMENT';
  const needsFirstMessage = triggerType === 'WELCOME' || triggerType === 'ANY_MESSAGE';

  useEffect(() => {
    setMessage(defaultMessageForTrigger(triggerType, triggerConfig));
    setIsNew(defaultIsNewForTrigger(triggerType));
    setResult(null);
  }, [triggerType, triggerConfig.keyword]);

  const tagHint = useMemo(() => {
    if (triggerType === 'CONTACT_TAG' && triggerConfig.tag) {
      return `Try adding "${String(triggerConfig.tag)}" to test a match`;
    }
    if (triggerType === 'SEGMENT' && Array.isArray(triggerConfig.tags) && triggerConfig.tags.length) {
      return `Try: ${(triggerConfig.tags as string[]).join(', ')}`;
    }
    return 'Separate labels with commas';
  }, [triggerType, triggerConfig]);

  const runTest = async () => {
    if (!nodes.length) {
      toastWarning('Add at least one step before trying it out');
      return;
    }

    setLoading(true);
    try {
      const { data } = await flowApi.simulate({
        triggerType,
        triggerConfig,
        nodes,
        startNodeId,
        message: isEventTrigger ? 'call-event' : message,
        isNewConversation: isNew,
        contactTags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      });
      const sim = data.data;
      setResult(sim);

      if (sim.triggered) {
        toastSuccess(`Flow would run — ${sim.steps.length} step(s) checked`);
      } else {
        toastWarning('Flow would not start for this scenario');
      }
    } catch (err: unknown) {
      setResult({ triggered: false, reason: 'Something went wrong. Please try again.', steps: [] });
      toastError(getErrorMessage(err, 'Test failed'));
    } finally {
      setLoading(false);
    }
  };

  if (!nodes.length) {
    return (
      <div className="flex min-h-[280px] flex-col items-center justify-center rounded-2xl border border-dashed border-violet-200/80 bg-gradient-to-br from-violet-50/40 to-white px-6 py-10 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-[0_8px_24px_rgba(99,102,241,0.25)]">
          <FlaskConical className="h-7 w-7" strokeWidth={2} />
        </div>
        <p className="mt-4 text-[15px] font-extrabold text-neutral-900">Add steps first</p>
        <p className="mt-1.5 max-w-[240px] text-[12px] font-medium leading-relaxed text-neutral-500">
          Once you add steps, you can test whether your flow starts and what happens next — no real message needed.
        </p>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-5">
      <div className="rounded-xl border border-violet-100/80 bg-gradient-to-r from-violet-50/50 to-white px-3.5 py-3">
        <p className="text-[12px] font-bold text-neutral-900">Test before you go live</p>
        <p className="mt-0.5 text-[11px] font-medium leading-relaxed text-neutral-500">
          Pretend a customer messages you and see if this flow starts.
          {triggerInfo ? ` Currently set to: ${triggerInfo.label}.` : ''}
        </p>
      </div>

      {isEventTrigger ? (
        <p className="rounded-xl border border-sky-100 bg-sky-50 px-3.5 py-3 text-[12px] font-medium leading-relaxed text-sky-800">
          This flow starts from a {triggerInfo?.label.toLowerCase() || 'phone event'}, not a text message. Tap Run test to
          simulate that event.
        </p>
      ) : (
        <AppInput
          label="What does the customer send?"
          value={message}
          onChange={(e) => {
            setMessage(e.target.value);
            setResult(null);
          }}
          placeholder={triggerType === 'KEYWORD' ? String(triggerConfig.keyword || 'pricing') : 'hello'}
          hint={
            triggerType === 'KEYWORD'
              ? 'Type a message like your customer would — we check if your keyword matches'
              : 'Type any sample message'
          }
        />
      )}

      {needsFirstMessage && (
        <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-neutral-200/80 bg-white px-3.5 py-3">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={isNew}
            onChange={(e) => {
              setIsNew(e.target.checked);
              setResult(null);
            }}
          />
          <span className="text-[12px] font-medium leading-relaxed text-neutral-700">
            {triggerType === 'WELCOME'
              ? 'This is their first message to you'
              : 'This is NOT their first message (returning customer)'}
          </span>
        </label>
      )}

      {needsTags && (
        <AppInput
          label="Contact labels on this person"
          value={tags}
          onChange={(e) => {
            setTags(e.target.value);
            setResult(null);
          }}
          placeholder="vip, lead"
          hint={tagHint}
        />
      )}

      <AppButton size="sm" className="w-full sm:w-auto" icon={<Play size={14} />} loading={loading} onClick={runTest}>
        Run test
      </AppButton>

      {result && (
        <div
          className={`rounded-xl border p-4 ${
            result.triggered ? 'border-emerald-200/80 bg-emerald-50/80' : 'border-amber-200/80 bg-amber-50/80'
          }`}
        >
          <div className="flex items-start gap-2.5">
            {result.triggered ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" strokeWidth={2.25} />
            ) : (
              <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" strokeWidth={2.25} />
            )}
            <div className="min-w-0 flex-1">
              <p className={`text-[13px] font-extrabold ${result.triggered ? 'text-emerald-900' : 'text-amber-900'}`}>
                {result.triggered ? 'Yes — flow would start' : 'No — flow would not start'}
              </p>
              <p className="mt-1 text-[12px] leading-relaxed text-neutral-600">
                {friendlyReason(result.reason, result.triggered)}
              </p>
            </div>
          </div>

          {result.triggered && result.steps.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-500">What happens next</p>
              {result.steps.map((step, i) => (
                <div
                  key={`${step.nodeId}-${i}`}
                  className="flex gap-2.5 rounded-lg border border-white/80 bg-white/90 px-3 py-2"
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-100 text-[10px] font-extrabold text-violet-700">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[12px] font-bold text-neutral-800">{stepTypeLabel(step.type)}</p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-neutral-600">{friendlyStepAction(step)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
