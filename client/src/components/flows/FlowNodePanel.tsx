import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import AppButton from '../ui/AppButton';
import AppInput from '../ui/AppInput';
import AppSelect from '../ui/AppSelect';
import AppTextarea from '../ui/AppTextarea';
import FlowStepPreview from './FlowStepPreview';
import WaFormPicker from './WaFormPicker';
import { aiBotApi, flowApi, teamApi, templateApi } from '../../services/api';
import type { AiBot, Flow, FlowNode, TeamAgent } from '../../types';
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
      options={[{ value: '', label: 'Go to next step' }, ...options]}
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
          Tap any step on the canvas, or add one from the left.
        </p>
      </div>
    );
  }

  return (
    <FlowNodePanelForm
      node={node}
      nodeIndex={nodeIndex}
      allNodes={allNodes}
      onChange={onChange}
      onRemove={onRemove}
      canRemove={canRemove}
    />
  );
}

function FlowNodePanelForm({
  node,
  nodeIndex,
  allNodes,
  onChange,
  onRemove,
  canRemove,
}: FlowNodePanelProps & { node: FlowNode }) {
  const [bots, setBots] = useState<AiBot[]>([]);
  const [agents, setAgents] = useState<TeamAgent[]>([]);
  const [flows, setFlows] = useState<Flow[]>([]);
  const [templates, setTemplates] = useState<Array<{ name: string; language: string; status: string }>>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    aiBotApi.list().then(({ data }) => setBots(data.data.bots || data.data || [])).catch(() => {});
    teamApi.agents().then(({ data }) => setAgents(data.data.agents || [])).catch(() => {});
    flowApi.list({ limit: '100' }).then(({ data }) => setFlows(data.data.flows || [])).catch(() => {});
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
          label="Message to send"
          hint="Tip: type {{name}} to use the customer's name"
          value={node.text || ''}
          onChange={(e) => onChange({ text: e.target.value })}
          rows={4}
          placeholder="Write what the customer will see..."
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
            { value: '', label: 'Next available agent' },
            ...agents.map((a) => ({ value: a.id, label: a.name })),
          ]}
          isSearchable
          onChange={(e) => onChange({ assignAgentId: e.target.value || undefined })}
        />
      )}

      {node.type === 'buttons' && (
        <div className="space-y-3">
          <AppSelect
            label="What should the button do?"
            value={node.buttonMode || 'reply'}
            options={[
              { value: 'reply', label: 'Let customer tap to reply' },
              { value: 'url', label: 'Open a website link' },
              { value: 'call', label: 'Call a phone number' },
            ]}
            isSearchable={false}
            onChange={(e) => onChange({ buttonMode: e.target.value as FlowNode['buttonMode'] })}
          />
          <AppTextarea
            label="Message above the button"
            value={node.text || ''}
            onChange={(e) => onChange({ text: e.target.value })}
            rows={2}
            placeholder="Please choose an option:"
          />
          {node.buttonMode === 'url' && (
            <>
              <AppInput label="Button text" value={node.ctaLabel || ''} onChange={(e) => onChange({ ctaLabel: e.target.value })} placeholder="Visit website" />
              <AppInput label="Website link" value={node.ctaUrl || ''} onChange={(e) => onChange({ ctaUrl: e.target.value })} placeholder="https://yoursite.com" />
            </>
          )}
          {node.buttonMode === 'call' && (
            <>
              <AppInput label="Button text" value={node.ctaLabel || ''} onChange={(e) => onChange({ ctaLabel: e.target.value })} placeholder="Call us" />
              <AppInput label="Phone number" value={node.ctaPhone || ''} onChange={(e) => onChange({ ctaPhone: e.target.value })} placeholder="+91 98765 43210" />
            </>
          )}
          {(!node.buttonMode || node.buttonMode === 'reply') && (
            <>
          <p className="text-[12px] font-bold text-neutral-700">Reply buttons (max 3, 20 characters each)</p>
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
                  label="After customer taps this"
                  value={branches[btn.id] || ''}
                  options={[{ value: '', label: 'Go to next step' }, ...branchOptions]}
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
            </>
          )}
        </div>
      )}

      {node.type === 'list' && (
        <div className="space-y-3">
          <AppTextarea
            label="Message above the menu"
            value={node.text || ''}
            onChange={(e) => onChange({ text: e.target.value })}
            rows={2}
            placeholder="Please select from the menu:"
          />
          <AppInput
            label="Menu button text"
            value={node.listButtonLabel || ''}
            onChange={(e) => onChange({ listButtonLabel: e.target.value })}
            placeholder="View options"
            hint="The button customer taps to open the menu"
          />
          {(node.listSections || []).map((section, sIdx) => (
            <div key={sIdx} className="space-y-2 rounded-xl border border-neutral-100 bg-neutral-50/50 p-3">
              <AppInput
                label={`Section ${sIdx + 1} title`}
                value={section.title || ''}
                onChange={(e) => {
                  const listSections = [...(node.listSections || [])];
                  listSections[sIdx] = { ...listSections[sIdx], title: e.target.value };
                  onChange({ listSections });
                }}
              />
              {section.rows.map((row, rIdx) => (
                <div key={row.id} className="space-y-2 rounded-lg border border-neutral-100 bg-white p-2">
                  <AppInput
                    label={`Option ${rIdx + 1} title`}
                    hint="Max 24 characters"
                    value={row.title}
                    onChange={(e) => {
                      const listSections = [...(node.listSections || [])];
                      const rows = [...listSections[sIdx].rows];
                      rows[rIdx] = { ...rows[rIdx], title: e.target.value.slice(0, 24) };
                      listSections[sIdx] = { ...listSections[sIdx], rows };
                      onChange({ listSections });
                    }}
                  />
                  <AppInput
                    label="Short description (optional)"
                    hint="Max 72 characters"
                    value={row.description || ''}
                    onChange={(e) => {
                      const listSections = [...(node.listSections || [])];
                      const rows = [...listSections[sIdx].rows];
                      rows[rIdx] = { ...rows[rIdx], description: e.target.value.slice(0, 72) };
                      listSections[sIdx] = { ...listSections[sIdx], rows };
                      onChange({ listSections });
                    }}
                  />
                  {branchOptions.length > 0 && (
                    <AppSelect
                      label="After customer picks this"
                      value={branches[row.id] || ''}
                      options={[{ value: '', label: 'Go to next step' }, ...branchOptions]}
                      isSearchable={false}
                      onChange={(e) => setBranch({ [row.id]: e.target.value })}
                    />
                  )}
                </div>
              ))}
              <AppButton
                variant="secondary"
                size="sm"
                icon={<Plus size={14} />}
                onClick={() => {
                  const listSections = [...(node.listSections || [])];
                  const rows = [...(listSections[sIdx]?.rows || []), { id: `row-${Date.now()}`, title: `Option ${(listSections[sIdx]?.rows.length || 0) + 1}` }];
                  listSections[sIdx] = { ...listSections[sIdx], rows };
                  onChange({ listSections });
                }}
              >
                Add item
              </AppButton>
            </div>
          ))}
        </div>
      )}

      {node.type === 'question' && (
        <div className="space-y-3">
          <AppTextarea
            label="Question to ask"
            value={node.prompt || ''}
            onChange={(e) => onChange({ prompt: e.target.value })}
            rows={2}
            placeholder="What is your name?"
          />
          <AppSelect
            label="Save their answer as"
            value={node.field || 'name'}
            options={[
              { value: 'name', label: 'Contact name' },
              { value: 'email', label: 'Email address' },
              { value: 'phone', label: 'Phone number' },
              { value: 'custom', label: 'Custom field' },
            ]}
            isSearchable={false}
            onChange={(e) => onChange({ field: e.target.value as FlowNode['field'] })}
          />
          {node.field === 'custom' && (
            <AppInput label="Field name" value={node.customField || ''} onChange={(e) => onChange({ customField: e.target.value })} placeholder="e.g. company_name" />
          )}
        </div>
      )}

      {node.type === 'tag' && (
        <AppInput label="Tag name" value={node.tag || ''} onChange={(e) => onChange({ tag: e.target.value })} placeholder="sales-lead" />
      )}

      {node.type === 'remove_tag' && (
        <AppInput label="Tag to remove" value={node.tag || ''} onChange={(e) => onChange({ tag: e.target.value })} placeholder="sales-lead" />
      )}

      {node.type === 'set_variable' && (
        <div className="space-y-3">
          <AppInput label="Saved answer name" value={node.variableName || ''} onChange={(e) => onChange({ variableName: e.target.value })} placeholder="discount_code" />
          <AppInput label="Value to save" hint="Use {{name}} for customer name" value={node.variableValue || ''} onChange={(e) => onChange({ variableValue: e.target.value })} />
        </div>
      )}

      {node.type === 'goto_flow' && (
        <AppSelect
          label="Other auto-reply to switch to"
          value={node.targetFlowId || ''}
          options={[
            { value: '', label: 'Select a flow...' },
            ...flows.map((f) => ({ value: f.id, label: f.name })),
          ]}
          isSearchable
          onChange={(e) => onChange({ targetFlowId: e.target.value || undefined })}
        />
      )}

      {node.type === 'request_callback' && (
        <div className="space-y-3">
          <AppTextarea label="Message to send" value={node.text || ''} onChange={(e) => onChange({ text: e.target.value })} rows={2} placeholder="We will call you back shortly!" />
          <AppInput label="Tag for callback requests" value={node.callbackTag || ''} onChange={(e) => onChange({ callbackTag: e.target.value })} placeholder="callback-requested" hint="Helps your team find these contacts" />
          <AppSelect
            label="Assign to agent"
            value={node.assignAgentId || ''}
            options={[
              { value: '', label: 'No assignment' },
              { value: '*', label: 'Next available agent' },
              ...agents.map((a) => ({ value: a.id, label: a.name })),
            ]}
            isSearchable
            onChange={(e) => onChange({ assignAgentId: e.target.value || undefined })}
          />
        </div>
      )}

      {node.type === 'condition' && (
        <div className="space-y-3">
          <AppSelect
            label="What to check"
            value={node.conditionType || 'business_hours'}
            options={[
              { value: 'business_hours', label: 'Is it business hours?' },
              { value: 'has_tag', label: 'Contact has a tag' },
              { value: 'language', label: 'Customer language' },
              { value: 'variable_equals', label: 'Saved answer equals…' },
              { value: 'variable_contains', label: 'Saved answer includes…' },
              { value: 'webhook_ok', label: 'App connection worked' },
            ]}
            isSearchable={false}
            onChange={(e) => onChange({ conditionType: e.target.value as FlowNode['conditionType'] })}
          />
          {node.conditionType === 'has_tag' && (
            <AppInput label="Tag to check" value={node.conditionTag || ''} onChange={(e) => onChange({ conditionTag: e.target.value })} />
          )}
          {node.conditionType === 'language' && (
            <AppInput label="Language" value={node.languageCode || ''} onChange={(e) => onChange({ languageCode: e.target.value })} placeholder="English" />
          )}
          {(node.conditionType === 'variable_equals' || node.conditionType === 'variable_contains') && (
            <>
              <AppInput label="Saved answer name" value={node.conditionVariable || ''} onChange={(e) => onChange({ conditionVariable: e.target.value })} />
              <AppInput label="Value to match" value={node.conditionValue || ''} onChange={(e) => onChange({ conditionValue: e.target.value })} />
            </>
          )}
          <div className="rounded-xl border border-violet-100 bg-violet-50/50 p-3 space-y-2">
            <p className="text-[11px] font-bold uppercase text-violet-600">What happens next</p>
            <BranchSelect label="If yes → go to" value={branches.true} branchKey="true" allNodes={allNodes} currentNodeId={node.id} branches={branches} onChange={onChange} />
            <BranchSelect label="If no → go to" value={branches.false} branchKey="false" allNodes={allNodes} currentNodeId={node.id} branches={branches} onChange={onChange} />
          </div>
        </div>
      )}

      {node.type === 'template' && (
        <div className="space-y-3">
          <AppSelect
            label="Choose approved template"
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
          <AppTextarea
            label="Preview text (shown in builder)"
            value={node.text || ''}
            onChange={(e) => onChange({ text: e.target.value })}
            rows={2}
            placeholder="What the template roughly says..."
          />
        </div>
      )}

      {node.type === 'delay' && (
        <AppInput
          label="Wait before next step"
          type="number"
          min={1}
          max={86400}
          value={String(node.delaySeconds || 30)}
          onChange={(e) => onChange({ delaySeconds: Number(e.target.value) })}
          hint="Seconds to wait (max 24 hours)"
        />
      )}

      {node.type === 'schedule' && (
        <div className="space-y-3">
          <AppInput
            label="Send at specific date & time"
            type="datetime-local"
            value={node.scheduleAt?.slice(0, 16) || ''}
            onChange={(e) => onChange({ scheduleAt: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
          />
          <AppInput
            label="Or wait this many seconds"
            type="number"
            min={1}
            max={604800}
            value={String(node.delaySeconds || 3600)}
            onChange={(e) => onChange({ delaySeconds: Number(e.target.value) })}
            hint="Used if no date is set above"
          />
        </div>
      )}

      {node.type === 'media' && (
        <div className="space-y-3">
          <AppSelect
            label="What are you sending?"
            value={node.mediaType || 'image'}
            options={[
              { value: 'image', label: 'Image' },
              { value: 'document', label: 'Document' },
              { value: 'video', label: 'Video' },
              { value: 'audio', label: 'Audio' },
            ]}
            isSearchable={false}
            onChange={(e) => onChange({ mediaType: e.target.value as FlowNode['mediaType'] })}
          />
          <AppInput
            label="File link (URL)"
            value={node.mediaUrl || ''}
            onChange={(e) => onChange({ mediaUrl: e.target.value })}
            placeholder="https://yoursite.com/image.jpg"
            hint="Paste a public link to your image, video, or file"
          />
          <AppInput
            label="Caption (optional)"
            value={node.mediaCaption || ''}
            onChange={(e) => onChange({ mediaCaption: e.target.value })}
            placeholder="Check out our latest offer!"
          />
        </div>
      )}

      {node.type === 'webhook' && (
        <div className="space-y-3">
          <AppInput label="App notification URL" value={node.webhookUrl || ''} onChange={(e) => onChange({ webhookUrl: e.target.value })} placeholder="https://your-app.com/notify" />
          <AppSelect
            label="How to send"
            value={node.webhookMethod || 'POST'}
            options={[
              { value: 'POST', label: 'POST' },
              { value: 'GET', label: 'GET' },
            ]}
            isSearchable={false}
            onChange={(e) => onChange({ webhookMethod: e.target.value as 'GET' | 'POST' })}
          />
          <AppInput label="Save app reply as" value={node.webhookVariable || ''} onChange={(e) => onChange({ webhookVariable: e.target.value })} placeholder="app_result" hint="Use this saved answer in later steps" />
        </div>
      )}

      {node.type === 'goto_step' && (
        <AppSelect
          label="Jump to step"
          value={node.targetNodeId || ''}
          options={[
            { value: '', label: 'Select a step...' },
            ...allNodes
              .filter((n) => n.id !== node.id)
              .map((n, i) => ({ value: n.id, label: `${i + 1}. ${nodeMeta[n.type].label}` })),
          ]}
          isSearchable
          onChange={(e) => onChange({ targetNodeId: e.target.value || undefined })}
          hint="Use to loop back to a menu or earlier step"
        />
      )}

      {node.type === 'location' && (
        <div className="space-y-3">
          <AppTextarea label="Message with location" value={node.text || ''} onChange={(e) => onChange({ text: e.target.value })} rows={2} placeholder="Here is our location:" />
          <AppInput label="Place name" value={node.locationName || ''} onChange={(e) => onChange({ locationName: e.target.value })} placeholder="Our office" />
          <AppInput label="Address (optional)" value={node.locationAddress || ''} onChange={(e) => onChange({ locationAddress: e.target.value })} placeholder="123 Main Street, Mumbai" />
          <div className="grid grid-cols-2 gap-3">
            <AppInput label="Latitude" type="number" step="any" value={String(node.latitude ?? '')} onChange={(e) => onChange({ latitude: Number(e.target.value) })} placeholder="19.0760" />
            <AppInput label="Longitude" type="number" step="any" value={String(node.longitude ?? '')} onChange={(e) => onChange({ longitude: Number(e.target.value) })} placeholder="72.8777" />
          </div>
        </div>
      )}

      {node.type === 'contact_card' && (
        <div className="space-y-3">
          <AppTextarea label="Message with contact" value={node.text || ''} onChange={(e) => onChange({ text: e.target.value })} rows={2} placeholder="Save our contact:" />
          <AppInput label="Contact name" value={node.contactName || ''} onChange={(e) => onChange({ contactName: e.target.value })} placeholder="Support Team" />
          <AppInput label="Phone number" value={node.contactPhone || ''} onChange={(e) => onChange({ contactPhone: e.target.value })} placeholder="+91 98765 43210" hint="Include country code (e.g. +91 for India)" />
          <AppInput label="Email (optional)" value={node.contactEmail || ''} onChange={(e) => onChange({ contactEmail: e.target.value })} />
        </div>
      )}

      {node.type === 'wa_flow' && (
        <div className="space-y-3">
          <WaFormPicker
            value={node.waFlowId}
            onChange={(formId) => onChange({ waFlowId: formId || undefined, waFlowToken: undefined })}
          />
          <AppTextarea
            label="Message above the form"
            value={node.text || ''}
            onChange={(e) => onChange({ text: e.target.value })}
            rows={2}
            placeholder="Please fill out this quick form:"
          />
          <AppInput
            label="Open button text"
            value={node.waFlowCta || ''}
            onChange={(e) => onChange({ waFlowCta: e.target.value.slice(0, 20) })}
            placeholder="Open form"
            hint="Max 20 characters — e.g. Fill form, Book now"
          />
          <p className="text-[11px] leading-relaxed text-neutral-500">
            Meta Forms run inside WhatsApp and are different from your Automations. When the customer
            submits, their answers are saved automatically and the automation continues.
          </p>
        </div>
      )}

      {(node.type === 'buttons' || node.type === 'list') && (
        <div>
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex w-full items-center justify-between rounded-xl border border-dashed border-neutral-200/80 px-3 py-2.5 text-left transition hover:border-sky-200 hover:bg-sky-50/30"
          >
            <span className="text-[12px] font-bold text-neutral-700">
              {showAdvanced ? 'Hide typing shortcuts' : 'Typing shortcuts (optional)'}
            </span>
            {showAdvanced ? <ChevronUp className="h-4 w-4 text-neutral-400" /> : <ChevronDown className="h-4 w-4 text-neutral-400" />}
          </button>
          {showAdvanced && (
        <div className="mt-2 space-y-2 rounded-xl border border-sky-100 bg-sky-50/50 p-3">
          <p className="text-[11px] leading-relaxed text-neutral-500">
            If a customer types words instead of tapping, match keywords to the right option.
          </p>
          {(node.intentRoutes || []).map((route, idx) => (
            <div key={idx} className="space-y-2 rounded-lg border border-white bg-white p-2">
              <AppInput
                label="Words to match"
                value={route.keywords.join(', ')}
                onChange={(e) => {
                  const intentRoutes = [...(node.intentRoutes || [])];
                  intentRoutes[idx] = {
                    ...intentRoutes[idx],
                    keywords: e.target.value.split(',').map((k) => k.trim()).filter(Boolean),
                  };
                  onChange({ intentRoutes });
                }}
                placeholder="help, support, menu"
              />
              <AppSelect
                label="Treat as if customer picked"
                value={route.branchKey}
                options={[
                  { value: '', label: 'Select option...' },
                  ...(node.type === 'buttons'
                    ? (node.buttons || []).map((b) => ({ value: b.id, label: b.title }))
                    : (node.listSections || []).flatMap((s) => s.rows).map((r) => ({ value: r.id, label: r.title }))),
                ]}
                isSearchable={false}
                onChange={(e) => {
                  const intentRoutes = [...(node.intentRoutes || [])];
                  intentRoutes[idx] = { ...intentRoutes[idx], branchKey: e.target.value };
                  onChange({ intentRoutes });
                }}
              />
              <button type="button" className="text-[11px] font-bold text-red-600" onClick={() => onChange({ intentRoutes: node.intentRoutes!.filter((_, i) => i !== idx) })}>
                Remove
              </button>
            </div>
          ))}
          <AppButton
            variant="secondary"
            size="sm"
            icon={<Plus size={14} />}
            onClick={() =>
              onChange({
                intentRoutes: [...(node.intentRoutes || []), { keywords: ['help'], branchKey: '' }],
              })
            }
          >
            Add typing shortcut
          </AppButton>
        </div>
          )}
        </div>
      )}

      {node.type === 'ab_split' && (
        <div className="rounded-xl border border-fuchsia-100 bg-fuchsia-50/50 p-3 space-y-2">
          <AppInput label="Send this % down path A" type="number" min={1} max={99} value={String(node.splitRatio ?? 50)} onChange={(e) => onChange({ splitRatio: Number(e.target.value) })} />
          <p className="text-[11px] font-bold uppercase text-fuchsia-600">Two paths to compare</p>
          <BranchSelect label="Path A → go to" value={branches.a} branchKey="a" allNodes={allNodes} currentNodeId={node.id} branches={branches} onChange={onChange} />
          <BranchSelect label="Path B → go to" value={branches.b} branchKey="b" allNodes={allNodes} currentNodeId={node.id} branches={branches} onChange={onChange} />
        </div>
      )}

      {node.type === 'language' && (
        <div className="space-y-3">
          <AppInput label="Language (e.g. en for English)" value={node.languageCode || 'en'} onChange={(e) => onChange({ languageCode: e.target.value })} />
          <div className="rounded-xl border border-lime-100 bg-lime-50/50 p-3 space-y-2">
            <BranchSelect label="If language matches → go to" value={branches.match} branchKey="match" allNodes={allNodes} currentNodeId={node.id} branches={branches} onChange={onChange} />
            <BranchSelect label="Otherwise → go to" value={branches.default} branchKey="default" allNodes={allNodes} currentNodeId={node.id} branches={branches} onChange={onChange} />
          </div>
        </div>
      )}

      <FlowStepPreview node={node} />

      {canRemove && (
        <AppButton variant="danger" size="sm" icon={<Trash2 size={14} />} onClick={onRemove}>
          Remove this step
        </AppButton>
      )}
    </div>
  );
}
