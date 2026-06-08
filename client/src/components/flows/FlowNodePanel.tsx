import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import AppButton from '../ui/AppButton';
import AppInput from '../ui/AppInput';
import AppSelect from '../ui/AppSelect';
import AppTextarea from '../ui/AppTextarea';
import { aiBotApi, teamApi, templateApi } from '../../services/api';
import type { AiBot, FlowNode, TeamAgent } from '../../types';
import { nodeMeta } from './flowMeta';

interface FlowNodePanelProps {
  node: FlowNode | null;
  nodeIndex: number;
  allNodes: FlowNode[];
  onChange: (patch: Partial<FlowNode>) => void;
  onRemove: () => void;
  canRemove: boolean;
}

function BranchSelect({
  label,
  value,
  branchKey,
  allNodes,
  currentNodeId,
  branches,
  onChange,
}: {
  label: string;
  value?: string;
  branchKey: string;
  allNodes: FlowNode[];
  currentNodeId: string;
  branches: Record<string, string>;
  onChange: (patch: Partial<FlowNode>) => void;
}) {
  const options = allNodes
    .filter((n) => n.id !== currentNodeId)
    .map((n, i) => ({ value: n.id, label: `${i + 1}. ${nodeMeta[n.type].label}` }));

  return (
    <AppSelect
      label={label}
      value={value || ''}
      options={[{ value: '', label: 'Next step (default)' }, ...options]}
      isSearchable={false}
      onChange={(e) => onChange({ branches: { ...branches, [branchKey]: e.target.value } })}
    />
  );
}

export default function FlowNodePanel({
  node,
  nodeIndex,
  allNodes,
  onChange,
  onRemove,
  canRemove,
}: FlowNodePanelProps) {
  if (!node) {
    return (
      <div className="flex min-h-[220px] flex-col items-center justify-center rounded-2xl border border-dashed border-violet-200/80 bg-gradient-to-br from-violet-50/30 to-white px-5 py-10 text-center">
        <p className="text-[15px] font-extrabold text-neutral-900">Select a step to edit</p>
        <p className="mt-2 max-w-[280px] text-[13px] leading-relaxed text-neutral-500">
          Click any step on the canvas, or add a new step from the left palette.
        </p>
      </div>
    );
  }

  const [bots, setBots] = useState<AiBot[]>([]);
  const [agents, setAgents] = useState<TeamAgent[]>([]);
  const [templates, setTemplates] = useState<Array<{ name: string; language: string; status: string }>>([]);

  useEffect(() => {
    aiBotApi.list().then(({ data }) => setBots(data.data.bots || data.data || [])).catch(() => {});
    teamApi.agents().then(({ data }) => setAgents(data.data.agents || [])).catch(() => {});
    templateApi.list().then(({ data }) => setTemplates(data.data.templates || [])).catch(() => {});
  }, []);

  const meta = nodeMeta[node.type];
  const Icon = meta.icon;
  const branches = node.branches || {};

  const setBranch = (patch: Record<string, string>) => {
    onChange({ branches: { ...branches, ...patch } });
  };

  const branchOptions = allNodes
    .filter((n) => n.id !== node.id)
    .map((n, i) => ({ value: n.id, label: `${i + 1}. ${nodeMeta[n.type].label}` }));

  return (
    <div className="min-w-0 space-y-4">
      <div className="rounded-xl border border-violet-100/80 bg-gradient-to-r from-violet-50/50 to-white p-3.5">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${meta.gradient} text-white shadow-sm`}
          >
            <Icon className="h-4 w-4" strokeWidth={2.25} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-violet-500">
              Step {nodeIndex + 1}
            </p>
            <p className="truncate text-[15px] font-extrabold text-neutral-900">{meta.label}</p>
          </div>
        </div>
        <p className="mt-2 text-[12px] leading-relaxed text-neutral-500">{meta.description}</p>
      </div>

      {['message', 'handoff', 'ai', 'end', 'assign'].includes(node.type) && (
        <AppTextarea
          label="Message"
          hint="Use {{name}} for customer name"
          value={node.text || ''}
          onChange={(e) => onChange({ text: e.target.value })}
          rows={4}
        />
      )}

      {node.type === 'ai' && (
        <AppSelect
          label="AI Bot"
          value={node.aiBotId || ''}
          options={[
            { value: '', label: 'Default bot' },
            ...bots.filter((b) => b.enabled).map((b) => ({ value: b.id, label: b.name })),
          ]}
          isSearchable
          onChange={(e) => onChange({ aiBotId: e.target.value || undefined })}
          hint="Which AI bot handles this conversation"
        />
      )}

      {node.type === 'assign' && (
        <AppSelect
          label="Assign to agent"
          value={node.assignAgentId || ''}
          options={[
            { value: '', label: 'Round-robin (any available)' },
            ...agents.map((a) => ({ value: a.id, label: a.name })),
          ]}
          isSearchable
          onChange={(e) => onChange({ assignAgentId: e.target.value || undefined })}
        />
      )}

      {node.type === 'buttons' && (
        <div className="space-y-3">
          <AppTextarea label="Message" value={node.text || ''} onChange={(e) => onChange({ text: e.target.value })} rows={2} />
          <p className="text-[12px] font-bold text-neutral-700">Buttons (max 3)</p>
          {(node.buttons || []).map((btn, btnIdx) => (
            <div key={btn.id} className="space-y-2 rounded-xl border border-neutral-100 bg-neutral-50/50 p-3">
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <AppInput
                    label={`Button ${btnIdx + 1}`}
                    value={btn.title}
                    onChange={(e) => {
                      const buttons = [...(node.buttons || [])];
                      buttons[btnIdx] = { ...buttons[btnIdx], title: e.target.value.slice(0, 20) };
                      onChange({ buttons });
                    }}
                  />
                </div>
                {(node.buttons?.length || 0) > 1 && (
                  <button
                    type="button"
                    onClick={() => onChange({ buttons: node.buttons!.filter((_, i) => i !== btnIdx) })}
                    className="mt-6 rounded-lg p-1.5 text-red-500 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
              {branchOptions.length > 0 && (
                <AppSelect
                  label="Go to step"
                  value={branches[btn.id] || ''}
                  options={[{ value: '', label: 'Next step (default)' }, ...branchOptions]}
                  isSearchable={false}
                  onChange={(e) => setBranch({ [btn.id]: e.target.value })}
                />
              )}
            </div>
          ))}
          {(node.buttons?.length || 0) < 3 && (
            <AppButton
              variant="secondary"
              size="sm"
              icon={<Plus size={14} />}
              onClick={() => {
                const buttons = [
                  ...(node.buttons || []),
                  { id: `btn-${Date.now()}`, title: `Option ${(node.buttons?.length || 0) + 1}` },
                ];
                onChange({ buttons });
              }}
            >
              Add button
            </AppButton>
          )}
        </div>
      )}

      {node.type === 'question' && (
        <div className="space-y-3">
          <AppTextarea label="Question" value={node.prompt || ''} onChange={(e) => onChange({ prompt: e.target.value })} rows={2} />
          <AppSelect
            label="Save answer to"
            value={node.field || 'name'}
            options={[
              { value: 'name', label: 'Contact name' },
              { value: 'email', label: 'Email' },
              { value: 'phone', label: 'Phone number' },
              { value: 'custom', label: 'Custom field' },
            ]}
            isSearchable={false}
            onChange={(e) => onChange({ field: e.target.value as FlowNode['field'] })}
          />
          {node.field === 'custom' && (
            <AppInput label="Field name" value={node.customField || ''} onChange={(e) => onChange({ customField: e.target.value })} />
          )}
          <AppInput label="Max retries" type="number" min={1} max={5} value={String(node.maxRetries ?? 2)} onChange={(e) => onChange({ maxRetries: Number(e.target.value) })} />
          <AppInput label="Retry message" value={node.retryMessage || ''} onChange={(e) => onChange({ retryMessage: e.target.value })} placeholder="Please try again." />
        </div>
      )}

      {node.type === 'tag' && (
        <AppInput label="Tag name" value={node.tag || ''} onChange={(e) => onChange({ tag: e.target.value })} placeholder="sales-lead" />
      )}

      {node.type === 'condition' && (
        <div className="space-y-3">
          <AppSelect
            label="Condition"
            value={node.conditionType || 'business_hours'}
            options={[
              { value: 'business_hours', label: 'Business hours check' },
              { value: 'has_tag', label: 'Contact has tag' },
              { value: 'language', label: 'Customer language' },
            ]}
            isSearchable={false}
            onChange={(e) => onChange({ conditionType: e.target.value as FlowNode['conditionType'] })}
          />
          {node.conditionType === 'has_tag' && (
            <AppInput label="Tag to check" value={node.conditionTag || ''} onChange={(e) => onChange({ conditionTag: e.target.value })} />
          )}
          {node.conditionType === 'language' && (
            <AppInput label="Language code" value={node.languageCode || ''} onChange={(e) => onChange({ languageCode: e.target.value })} placeholder="en" />
          )}
          <div className="rounded-xl border border-violet-100 bg-violet-50/50 p-3 space-y-2">
            <p className="text-[11px] font-bold uppercase text-violet-600">Branch paths</p>
            <BranchSelect label="If true → go to" value={branches.true} branchKey="true" allNodes={allNodes} currentNodeId={node.id} branches={branches} onChange={onChange} />
            <BranchSelect label="If false → go to" value={branches.false} branchKey="false" allNodes={allNodes} currentNodeId={node.id} branches={branches} onChange={onChange} />
          </div>
        </div>
      )}

      {node.type === 'template' && (
        <div className="space-y-3">
          <AppSelect
            label="Approved template"
            value={node.templateName || ''}
            options={[
              { value: '', label: 'Select a template...' },
              ...templates
                .filter((t) => t.status === 'APPROVED')
                .map((t) => ({ value: t.name, label: `${t.name} (${t.language})` })),
            ]}
            isSearchable
            onChange={(e) => {
              const selected = templates.find((t) => t.name === e.target.value);
              onChange({
                templateName: e.target.value,
                templateLanguage: selected?.language || node.templateLanguage || 'en_US',
              });
            }}
          />
          <AppInput label="Language code" value={node.templateLanguage || 'en_US'} onChange={(e) => onChange({ templateLanguage: e.target.value })} />
          <AppTextarea label="Fallback text" value={node.text || ''} onChange={(e) => onChange({ text: e.target.value })} rows={2} />
        </div>
      )}

      {node.type === 'delay' && (
        <AppInput label="Delay (seconds)" type="number" min={1} max={86400} value={String(node.delaySeconds || 30)} onChange={(e) => onChange({ delaySeconds: Number(e.target.value) })} hint="Max 24 hours" />
      )}

      {node.type === 'media' && (
        <div className="space-y-3">
          <AppSelect
            label="Media type"
            value={node.mediaType || 'image'}
            options={[
              { value: 'image', label: 'Image' },
              { value: 'document', label: 'Document' },
              { value: 'video', label: 'Video' },
            ]}
            isSearchable={false}
            onChange={(e) => onChange({ mediaType: e.target.value as FlowNode['mediaType'] })}
          />
          <AppInput label="Media URL" value={node.mediaUrl || ''} onChange={(e) => onChange({ mediaUrl: e.target.value })} placeholder="https://..." />
          <AppInput label="Caption" value={node.mediaCaption || ''} onChange={(e) => onChange({ mediaCaption: e.target.value })} />
        </div>
      )}

      {node.type === 'webhook' && (
        <div className="space-y-3">
          <AppInput label="Webhook URL" value={node.webhookUrl || ''} onChange={(e) => onChange({ webhookUrl: e.target.value })} placeholder="https://api.example.com/hook" />
          <AppSelect
            label="Method"
            value={node.webhookMethod || 'POST'}
            options={[
              { value: 'POST', label: 'POST' },
              { value: 'GET', label: 'GET' },
            ]}
            isSearchable={false}
            onChange={(e) => onChange({ webhookMethod: e.target.value as 'GET' | 'POST' })}
          />
        </div>
      )}

      {node.type === 'ab_split' && (
        <div className="rounded-xl border border-fuchsia-100 bg-fuchsia-50/50 p-3 space-y-2">
          <p className="text-[11px] font-bold uppercase text-fuchsia-600">A/B paths (50/50)</p>
          <BranchSelect label="Path A → go to" value={branches.a} branchKey="a" allNodes={allNodes} currentNodeId={node.id} branches={branches} onChange={onChange} />
          <BranchSelect label="Path B → go to" value={branches.b} branchKey="b" allNodes={allNodes} currentNodeId={node.id} branches={branches} onChange={onChange} />
        </div>
      )}

      {node.type === 'language' && (
        <div className="space-y-3">
          <AppInput label="Language code" value={node.languageCode || 'en'} onChange={(e) => onChange({ languageCode: e.target.value })} />
          <div className="rounded-xl border border-lime-100 bg-lime-50/50 p-3 space-y-2">
            <BranchSelect label="If match → go to" value={branches.match} branchKey="match" allNodes={allNodes} currentNodeId={node.id} branches={branches} onChange={onChange} />
            <BranchSelect label="Default → go to" value={branches.default} branchKey="default" allNodes={allNodes} currentNodeId={node.id} branches={branches} onChange={onChange} />
          </div>
        </div>
      )}

      {canRemove && (
        <AppButton variant="danger" size="sm" icon={<Trash2 size={14} />} onClick={onRemove}>
          Remove this step
        </AppButton>
      )}
    </div>
  );
}
