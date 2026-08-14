import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Check, ChevronDown, ChevronUp, Clock, Rocket } from 'lucide-react';
import AppButton from '../ui/AppButton';
import AppInput from '../ui/AppInput';
import AppSelect from '../ui/AppSelect';
import AppTextarea from '../ui/AppTextarea';
import { nodeMeta, triggerMeta } from './flowMeta';
import { flowAudienceState } from '../../utils/flow-live';
import { campaignApi } from '../../services/api';
import type { Campaign, FlowNode, FlowStatus, FlowTriggerType } from '../../types';

const BASIC_TRIGGERS: FlowTriggerType[] = ['WELCOME', 'KEYWORD', 'OFF_HOURS', 'BUSINESS_HOURS'];
const ADVANCED_TRIGGERS: FlowTriggerType[] = [
  'ANY_MESSAGE',
  'CONTACT_TAG',
  'SEGMENT',
  'MISSED_CALL',
  'CAMPAIGN_REPLY',
  'CALL_COMPLETED',
];

const PRIORITY_OPTIONS = [
  { value: '20', label: 'Low — only if nothing else matches' },
  { value: '50', label: 'Normal — recommended' },
  { value: '80', label: 'High — runs before other flows' },
];

interface FlowSettingsPanelProps {
  name: string;
  description: string;
  triggerType: FlowTriggerType;
  enabled: boolean;
  keyword: string;
  exactMatch: boolean;
  regexMatch: boolean;
  contactTag: string;
  segmentTags: string;
  campaignId: string;
  startNodeId: string;
  priority: number;
  nodes: FlowNode[];
  flowStatus: FlowStatus;
  isNew: boolean;
  saving: boolean;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onTriggerTypeChange: (value: FlowTriggerType) => void;
  onEnabledChange: (value: boolean) => void;
  onKeywordChange: (value: string) => void;
  onExactMatchChange: (value: boolean) => void;
  onRegexMatchChange: (value: boolean) => void;
  onContactTagChange: (value: string) => void;
  onSegmentTagsChange: (value: string) => void;
  onCampaignIdChange: (value: string) => void;
  onStartNodeIdChange: (value: string) => void;
  onPriorityChange: (value: number) => void;
  onPublish: () => void;
  onDirty?: () => void;
}

function StepLabel({ step, title }: { step: number; title: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-100 text-[11px] font-extrabold text-violet-700">
        {step}
      </span>
      <p className="text-[13px] font-extrabold text-neutral-900">{title}</p>
    </div>
  );
}

function TriggerOption({
  type,
  selected,
  onSelect,
}: {
  type: FlowTriggerType;
  selected: boolean;
  onSelect: () => void;
}) {
  const meta = triggerMeta[type];
  const Icon = meta.icon;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition active:scale-[0.99] ${
        selected
          ? 'border-violet-300 bg-violet-50/80 ring-2 ring-violet-400/30'
          : 'border-neutral-200/80 bg-white hover:border-violet-200 hover:bg-violet-50/40'
      }`}
    >
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${meta.gradient} text-white shadow-sm`}
      >
        <Icon className="h-3.5 w-3.5" strokeWidth={2.25} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-bold text-neutral-900">{meta.label}</p>
        <p className="mt-0.5 truncate text-[11px] font-medium text-neutral-500">{meta.description}</p>
      </div>
      {selected && (
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-600 text-white">
          <Check className="h-3 w-3" strokeWidth={3} />
        </span>
      )}
    </button>
  );
}

function InfoNote({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'sky' | 'rose' | 'emerald' }) {
  const styles = {
    neutral: 'border-neutral-200 bg-neutral-50 text-neutral-700',
    sky: 'border-sky-100 bg-sky-50 text-sky-800',
    rose: 'border-rose-100 bg-rose-50 text-rose-800',
    emerald: 'border-emerald-100 bg-emerald-50 text-emerald-800',
  };

  return (
    <p className={`rounded-xl border px-3 py-2.5 text-[12px] font-medium leading-relaxed ${styles[tone]}`}>
      {children}
    </p>
  );
}

export default function FlowSettingsPanel({
  name,
  description,
  triggerType,
  enabled,
  keyword,
  exactMatch,
  regexMatch,
  contactTag,
  segmentTags,
  campaignId,
  startNodeId,
  priority,
  nodes,
  flowStatus,
  isNew,
  saving,
  onNameChange,
  onDescriptionChange,
  onTriggerTypeChange,
  onEnabledChange,
  onKeywordChange,
  onExactMatchChange,
  onRegexMatchChange,
  onContactTagChange,
  onSegmentTagsChange,
  onCampaignIdChange,
  onStartNodeIdChange,
  onPriorityChange,
  onPublish,
  onDirty,
}: FlowSettingsPanelProps) {
  const [showMoreTriggers, setShowMoreTriggers] = useState(false);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [campaignOptions, setCampaignOptions] = useState<Array<{ value: string; label: string }>>([
    { value: '', label: 'Any campaign reply' },
  ]);

  useEffect(() => {
    if (ADVANCED_TRIGGERS.includes(triggerType)) {
      setShowMoreTriggers(true);
    }
  }, [triggerType]);

  useEffect(() => {
    if (regexMatch || exactMatch || priority !== 50 || (nodes.length > 1 && startNodeId && startNodeId !== nodes[0]?.id)) {
      setShowMoreOptions(true);
    }
  }, [regexMatch, exactMatch, priority, nodes, startNodeId]);

  useEffect(() => {
    if (triggerType !== 'CAMPAIGN_REPLY') return;
    let cancelled = false;
    campaignApi
      .list({ limit: '50' })
      .then(({ data }) => {
        if (cancelled) return;
        const campaigns = (data.data.campaigns || []) as Campaign[];
        const options = [
          { value: '', label: 'Any campaign reply' },
          ...campaigns.map((campaign) => ({ value: campaign.id, label: campaign.name })),
        ];
        if (campaignId && !options.some((option) => option.value === campaignId)) {
          options.push({ value: campaignId, label: 'Saved campaign' });
        }
        setCampaignOptions(options);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [triggerType, campaignId]);

  const markDirty = () => onDirty?.();

  const startNodeOptions = nodes.map((n, i) => ({
    value: n.id,
    label: `${i + 1}. ${nodeMeta[n.type]?.label ?? n.type}`,
  }));

  const priorityValue = priority <= 30 ? '20' : priority >= 70 ? '80' : '50';
  const audience = flowAudienceState({ status: flowStatus, enabled, isNew });
  const live = audience === 'live';
  const onTitle = live
    ? 'Live — customers get this'
    : enabled
      ? 'On selected — still a draft until you publish'
      : 'Off — customers will not get this';
  const onSubtitle = live
    ? 'Turn off anytime to stop this flow'
    : enabled
      ? 'Click Save to publish. Customers will not get this while it is a draft.'
      : 'Turn on when you are ready, then Save so it is published and live.';

  return (
    <div className="min-w-0 space-y-6">
      <section className="space-y-3">
        <StepLabel step={1} title="Name this flow" />
        <AppInput
          label="Flow name"
          value={name}
          onChange={(e) => {
            onNameChange(e.target.value);
            markDirty();
          }}
          placeholder="e.g. Welcome new customers"
          hint="Pick a name you'll recognize later"
        />
        <AppTextarea
          label="Short note (optional)"
          value={description}
          onChange={(e) => {
            onDescriptionChange(e.target.value);
            markDirty();
          }}
          rows={2}
          placeholder="Who is this for? e.g. First-time visitors asking about pricing"
        />
      </section>

      <section className="space-y-3">
        <StepLabel step={2} title="When should it run?" />
        <p className="text-[11px] font-medium leading-relaxed text-neutral-500">
          Pick the most common situation. You can change this anytime.
        </p>

        <div className="space-y-2">
          {BASIC_TRIGGERS.map((type) => (
            <TriggerOption
              key={type}
              type={type}
              selected={triggerType === type}
              onSelect={() => {
                onTriggerTypeChange(type);
                markDirty();
              }}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={() => setShowMoreTriggers(!showMoreTriggers)}
          className="flex w-full items-center justify-between rounded-xl border border-dashed border-neutral-200/80 px-3 py-2 text-left transition hover:border-violet-200 hover:bg-violet-50/30"
        >
          <span className="text-[11px] font-bold text-neutral-600">
            {showMoreTriggers ? 'Hide other start options' : 'Other start options'}
          </span>
          {showMoreTriggers ? (
            <ChevronUp className="h-3.5 w-3.5 text-neutral-400" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-neutral-400" />
          )}
        </button>

        {showMoreTriggers && (
          <div className="space-y-2">
            {ADVANCED_TRIGGERS.map((type) => (
              <TriggerOption
                key={type}
                type={type}
                selected={triggerType === type}
                onSelect={() => {
                  onTriggerTypeChange(type);
                  markDirty();
                }}
              />
            ))}
          </div>
        )}
      </section>

      {triggerType === 'KEYWORD' && (
        <section className="space-y-3 rounded-xl border border-violet-100/80 bg-violet-50/30 p-3.5">
          <p className="text-[12px] font-bold text-neutral-800">Which word should we watch for?</p>
          <AppInput
            label="Word or phrase"
            value={keyword}
            onChange={(e) => {
              onKeywordChange(e.target.value);
              markDirty();
            }}
            placeholder="e.g. pricing, demo, help"
            hint="We'll start this flow when a customer sends this word"
          />
          <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-neutral-200/60 bg-white px-3 py-2.5">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={exactMatch}
              onChange={(e) => {
                onExactMatchChange(e.target.checked);
                markDirty();
              }}
            />
            <span className="text-[11px] font-medium leading-relaxed text-neutral-700">
              Match the whole message exactly (not just part of it)
            </span>
          </label>
        </section>
      )}

      {triggerType === 'CONTACT_TAG' && (
        <AppInput
          label="Contact must have this label"
          value={contactTag}
          onChange={(e) => {
            onContactTagChange(e.target.value);
            markDirty();
          }}
          placeholder="e.g. vip"
          hint="Starts when the contact already has this tag"
        />
      )}

      {triggerType === 'SEGMENT' && (
        <AppInput
          label="Contact labels (any match)"
          value={segmentTags}
          onChange={(e) => {
            onSegmentTagsChange(e.target.value);
            markDirty();
          }}
          placeholder="vip, lead, premium"
          hint="Separate labels with commas"
        />
      )}

      {(triggerType === 'BUSINESS_HOURS' || triggerType === 'OFF_HOURS') && (
        <Link
          to="/settings"
          className="flex items-center gap-2 rounded-xl border border-sky-100 bg-sky-50 px-3 py-2.5 text-[12px] font-semibold text-sky-700 transition hover:bg-sky-100"
        >
          <Clock className="h-4 w-4 shrink-0" />
          Set your business hours in Settings
        </Link>
      )}

      {triggerType === 'MISSED_CALL' && (
        <InfoNote tone="rose">
          Runs when a customer calls and nobody answers. Voice calls must be enabled in Settings.
        </InfoNote>
      )}

      {triggerType === 'CAMPAIGN_REPLY' && (
        <AppSelect
          label="Campaign (optional)"
          value={campaignId}
          options={campaignOptions}
          placeholder="Any campaign reply"
          onChange={(e) => {
            onCampaignIdChange(e.target.value);
            markDirty();
          }}
          hint="Leave as any campaign, or pick one so only that blast's replies start this flow"
        />
      )}

      {triggerType === 'CALL_COMPLETED' && (
        <InfoNote tone="emerald">Runs after a phone call with the customer ends successfully.</InfoNote>
      )}

      {triggerType === 'ANY_MESSAGE' && (
        <InfoNote>
          This runs when no other flow matches. Use it as a catch-all auto-reply.
        </InfoNote>
      )}

      <section className="space-y-3">
        <button
          type="button"
          onClick={() => setShowMoreOptions(!showMoreOptions)}
          className="flex w-full items-center justify-between rounded-xl border border-dashed border-neutral-200/80 px-3 py-2 text-left transition hover:border-violet-200 hover:bg-violet-50/30"
        >
          <span className="text-[11px] font-bold text-neutral-600">
            {showMoreOptions ? 'Hide extra options' : 'Extra options'}
          </span>
          {showMoreOptions ? (
            <ChevronUp className="h-3.5 w-3.5 text-neutral-400" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-neutral-400" />
          )}
        </button>

        {showMoreOptions && (
          <div className="space-y-3 rounded-xl border border-neutral-100 bg-neutral-50/60 p-3.5">
            <AppSelect
              label="If multiple flows could run"
              value={priorityValue}
              options={PRIORITY_OPTIONS}
              isSearchable={false}
              onChange={(e) => {
                onPriorityChange(Number(e.target.value));
                markDirty();
              }}
              hint="Most people can leave this on Normal"
            />

            {nodes.length > 1 && (
              <AppSelect
                label="Which step runs first"
                value={startNodeId || nodes[0]?.id || ''}
                options={startNodeOptions}
                isSearchable={false}
                onChange={(e) => {
                  onStartNodeIdChange(e.target.value);
                  markDirty();
                }}
                hint="Only needed if your flow has more than one starting path"
              />
            )}

            {triggerType === 'KEYWORD' && (
              <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-neutral-200/60 bg-white px-3 py-2.5">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={regexMatch}
                  onChange={(e) => {
                    onRegexMatchChange(e.target.checked);
                    markDirty();
                  }}
                />
                <span className="text-[11px] font-medium leading-relaxed text-neutral-600">
                  Advanced pattern matching (for technical users)
                </span>
              </label>
            )}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <StepLabel step={3} title="Turn it on" />
        <div
          className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3.5 transition ${
            live
              ? 'border-emerald-200/80 bg-gradient-to-r from-emerald-50/80 to-white'
              : enabled
                ? 'border-amber-200/80 bg-gradient-to-r from-amber-50/80 to-white'
                : 'border-neutral-200/80 bg-neutral-50/50'
          }`}
        >
          <div className="min-w-0">
            <p className="text-[12px] font-bold text-neutral-900">{onTitle}</p>
            <p className="mt-0.5 text-[11px] font-medium text-neutral-500">{onSubtitle}</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            onClick={() => {
              onEnabledChange(!enabled);
              markDirty();
            }}
            className={`relative h-7 w-12 shrink-0 rounded-full transition ${
              live ? 'bg-emerald-500' : enabled ? 'bg-amber-500' : 'bg-neutral-300'
            }`}
          >
            <span
              className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${
                enabled ? 'left-[22px]' : 'left-0.5'
              }`}
            />
          </button>
        </div>
      </section>

      {!isNew && flowStatus === 'DRAFT' && (
        <div className="rounded-xl border border-amber-100 bg-amber-50 px-3.5 py-3 text-[12px] leading-relaxed text-amber-900">
          <p className="font-semibold">Saved as draft</p>
          <p className="mt-1">Customers won't see this until you publish it.</p>
          <AppButton className="mt-3" size="sm" icon={<Rocket size={14} />} loading={saving} onClick={onPublish}>
            Publish now
          </AppButton>
        </div>
      )}
    </div>
  );
}
