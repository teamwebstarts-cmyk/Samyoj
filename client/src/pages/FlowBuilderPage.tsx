import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  BarChart3,
  Check,
  Clock,
  Copy,
  FileEdit,
  FlaskConical,
  History,
  Rocket,
  Save,
  Settings2,
  SlidersHorizontal,
  Smartphone,
} from 'lucide-react';
import AppButton from '../components/ui/AppButton';
import AppInput from '../components/ui/AppInput';
import AppSelect from '../components/ui/AppSelect';
import AppTextarea from '../components/ui/AppTextarea';
import LoadingState from '../components/ui/LoadingState';
import PageShell from '../components/ui/PageShell';
import FlowAnalyticsPanel from '../components/flows/FlowAnalyticsPanel';
import FlowBuilderSidePanel, { type FlowBuilderPanelTab } from '../components/flows/FlowBuilderSidePanel';
import FlowValidationWarnings from '../components/flows/FlowValidationWarnings';
import FlowCanvas from '../components/flows/FlowCanvas';
import FlowMobileNav, { type FlowBuilderTab } from '../components/flows/FlowMobileNav';
import FlowNodePanel from '../components/flows/FlowNodePanel';
import FlowPhoneMockup from '../components/flows/FlowPhoneMockup';
import FlowStepPalette from '../components/flows/FlowStepPalette';
import FlowTestPanel from '../components/flows/FlowTestPanel';
import FlowVersionsPanel from '../components/flows/FlowVersionsPanel';
import { triggerMeta } from '../components/flows/flowMeta';
import { autoLayoutNodes, createNodeAtPosition } from '../components/flows/flowGraphUtils';
import { validateFlow } from '../components/flows/flowUtils';
import { flowApi } from '../services/api';
import { getErrorMessage } from '../utils/errors';
import { toastError, toastSuccess, toastValidationErrors } from '../utils/toast';
import type { FlowNode, FlowNodeType, FlowStatus, FlowTriggerType } from '../types';

const triggerOptions = Object.entries(triggerMeta).map(([value, meta]) => ({
  value,
  label: meta.label,
}));

type DesktopPanel = 'edit' | 'setup' | 'preview' | 'test' | 'analytics' | 'versions';

export default function FlowBuilderPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === 'new';

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [mobileTab, setMobileTab] = useState<FlowBuilderTab>(isNew ? 'settings' : 'flow');
  const [desktopPanel, setDesktopPanel] = useState<DesktopPanel>(isNew ? 'setup' : 'edit');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [triggerType, setTriggerType] = useState<FlowTriggerType>('WELCOME');
  const [keyword, setKeyword] = useState('');
  const [exactMatch, setExactMatch] = useState(false);
  const [regexMatch, setRegexMatch] = useState(false);
  const [contactTag, setContactTag] = useState('');
  const [segmentTags, setSegmentTags] = useState('');
  const [startNodeId, setStartNodeId] = useState('');
  const [flowStatus, setFlowStatus] = useState<FlowStatus>('PUBLISHED');
  const [priority, setPriority] = useState(50);
  const [enabled, setEnabled] = useState(false);
  const [nodes, setNodes] = useState<FlowNode[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const triggerConfig = useMemo(() => {
    if (triggerType === 'KEYWORD') return { keyword, exactMatch, regex: regexMatch };
    if (triggerType === 'CONTACT_TAG') return { tag: contactTag };
    if (triggerType === 'SEGMENT') return { tags: segmentTags.split(',').map((t) => t.trim()).filter(Boolean) };
    return {};
  }, [triggerType, keyword, exactMatch, regexMatch, contactTag, segmentTags]);

  const selectedIndex = selectedNodeId ? nodes.findIndex((n) => n.id === selectedNodeId) : -1;
  const selectedNode = selectedIndex >= 0 ? nodes[selectedIndex] : null;

  const load = useCallback(() => {
    if (!id || isNew) return;
    setLoading(true);
    flowApi
      .get(id)
      .then(({ data }) => {
        const flow = data.data;
        setName(flow.name);
        setDescription(flow.description || '');
        setTriggerType(flow.triggerType);
        setKeyword((flow.triggerConfig?.keyword as string) || '');
        setExactMatch(Boolean(flow.triggerConfig?.exactMatch));
        setRegexMatch(Boolean(flow.triggerConfig?.regex));
        setContactTag((flow.triggerConfig?.tag as string) || '');
        setSegmentTags(((flow.triggerConfig?.tags as string[]) || []).join(', '));
        setStartNodeId(flow.startNodeId || '');
        setFlowStatus(flow.status || 'PUBLISHED');
        setPriority(flow.priority ?? 50);
        setEnabled(flow.enabled);
        const loadedNodes = flow.draftNodes?.length ? flow.draftNodes : flow.nodes?.length ? flow.nodes : [];
        const laid = autoLayoutNodes(loadedNodes, flow.startNodeId || loadedNodes[0]?.id);
        setNodes(laid);
        setSelectedNodeId(laid[0]?.id || null);
      })
      .catch((err) => toastError(getErrorMessage(err, 'Failed to load flow')))
      .finally(() => setLoading(false));
  }, [id, isNew]);

  useEffect(load, [load]);

  const runServerValidation = useCallback(async () => {
    if (nodes.length === 0) {
      setWarnings([]);
      return;
    }
    try {
      const { data } = await flowApi.validate({
        name: name.trim() || 'Untitled',
        triggerType,
        triggerConfig,
        nodes,
        startNodeId: startNodeId || nodes[0]?.id,
      });
      setWarnings(data.data.warnings || []);
    } catch {
      setWarnings([]);
    }
  }, [name, triggerType, triggerConfig, nodes, startNodeId]);

  useEffect(() => {
    const timer = setTimeout(runServerValidation, 600);
    return () => clearTimeout(timer);
  }, [runServerValidation]);

  const updateNode = (nodeId: string, patch: Partial<FlowNode>) => {
    setNodes((prev) => prev.map((n) => (n.id === nodeId ? { ...n, ...patch } : n)));
    setSaved(false);
  };

  const handleGraphChange = (updatedNodes: FlowNode[], newStartNodeId: string) => {
    setNodes(updatedNodes);
    setStartNodeId(newStartNodeId);
    setSaved(false);
  };

  const addNode = (type: FlowNodeType) => {
    const position = { x: 80 + nodes.length * 40, y: 80 + nodes.length * 60 };
    const node = createNodeAtPosition(type, position);
    const nextNodes = [...nodes, node];
    setNodes(nextNodes);
    if (!startNodeId && nextNodes.length === 1) setStartNodeId(node.id);
    setSelectedNodeId(node.id);
    setSaved(false);
    setMobileTab('edit');
    setDesktopPanel('edit');
  };

  const removeNode = (nodeId: string) => {
    const nextNodes = nodes
      .filter((n) => n.id !== nodeId)
      .map((n) => {
        const updated = { ...n };
        if (updated.next === nodeId) updated.next = undefined;
        if (updated.branches) {
          updated.branches = Object.fromEntries(
            Object.entries(updated.branches).map(([k, v]) => [k, v === nodeId ? '' : v])
          );
        }
        return updated;
      });
    setNodes(nextNodes);
    if (startNodeId === nodeId) setStartNodeId(nextNodes[0]?.id || '');
    setSelectedNodeId(nextNodes[0]?.id || null);
    setSaved(false);
  };

  const buildPayload = (asDraft = false) => ({
    name: name.trim(),
    description: description.trim() || undefined,
    triggerType,
    triggerConfig,
    nodes,
    startNodeId: startNodeId || nodes[0]?.id || undefined,
    enabled,
    priority,
    status: asDraft ? 'DRAFT' : flowStatus,
    saveAsDraft: asDraft,
  });

  const handleSave = async (asDraft = false) => {
    const validationErrors = validateFlow(name, triggerType, triggerConfig, keyword, nodes);
    if (validationErrors.length > 0) {
      toastValidationErrors(validationErrors);
      setMobileTab('settings');
      setDesktopPanel('setup');
      return;
    }

    setSaving(true);
    try {
      if (isNew) {
        const { data } = await flowApi.create(buildPayload(asDraft));
        toastSuccess(asDraft ? 'Flow draft created' : 'Flow created');
        navigate(`/automations/flows/${data.data.id}`, { replace: true });
      } else {
        await flowApi.update(id!, buildPayload(asDraft));
        setSaved(true);
        toastSuccess(asDraft ? 'Draft saved' : 'Flow saved');
        setTimeout(() => setSaved(false), 2000);
      }
    } catch (err: unknown) {
      toastError(getErrorMessage(err, 'Failed to save flow'));
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!id || isNew) return;
    setSaving(true);
    try {
      await flowApi.update(id, buildPayload());
      await flowApi.publish(id);
      setFlowStatus('PUBLISHED');
      setSaved(true);
      toastSuccess('Flow published');
      setTimeout(() => setSaved(false), 2000);
    } catch (err: unknown) {
      toastError(getErrorMessage(err, 'Failed to publish flow'));
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicate = async () => {
    if (!id || isNew) return;
    try {
      const { data } = await flowApi.duplicate(id);
      toastSuccess('Flow duplicated');
      navigate(`/automations/flows/${data.data.id}`);
    } catch (err: unknown) {
      toastError(getErrorMessage(err, 'Failed to duplicate flow'));
    }
  };

  const handleRestoreVersion = (restoredNodes: FlowNode[], version: number) => {
    const laid = autoLayoutNodes(restoredNodes, restoredNodes[0]?.id);
    setNodes(laid);
    setStartNodeId(laid[0]?.id || '');
    setSelectedNodeId(laid[0]?.id || null);
    setFlowStatus('DRAFT');
    toastSuccess(`Loaded version ${version} — save to apply`);
  };

  const startNodeOptions = nodes.map((n, i) => ({ value: n.id, label: `${i + 1}. ${n.type}` }));

  const settingsForm = (
    <div className="min-w-0 space-y-5">
      <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-100/80 bg-gradient-to-r from-emerald-50/70 to-white px-4 py-3">
        <div className="min-w-0">
          <p className="text-[12px] font-bold text-neutral-800">Flow status</p>
          <p className="mt-0.5 truncate text-[11px] font-medium text-neutral-500">
            {enabled ? 'Live and responding' : 'Paused'} · {flowStatus}
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setEnabled(!enabled); setSaved(false); }}
          className={`shrink-0 rounded-full px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wide transition ${
            enabled
              ? 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200/80 hover:bg-emerald-200/80'
              : 'bg-neutral-100 text-neutral-600 ring-1 ring-neutral-200/80 hover:bg-neutral-200/80'
          }`}
        >
          {enabled ? 'Live' : 'Paused'}
        </button>
      </div>

      <AppInput label="Flow name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Welcome journey" />
      <AppTextarea label="Description" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Optional" />
      <AppSelect label="Trigger" value={triggerType} options={triggerOptions} isSearchable={false} onChange={(e) => setTriggerType(e.target.value as FlowTriggerType)} />

      {triggerType === 'KEYWORD' && (
        <>
          <AppInput label="Keyword" value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="demo" />
          <label className="flex items-center gap-2 text-[12px] font-medium text-neutral-700">
            <input type="checkbox" checked={exactMatch} onChange={(e) => setExactMatch(e.target.checked)} /> Exact match
          </label>
          <label className="flex items-center gap-2 text-[12px] font-medium text-neutral-700">
            <input type="checkbox" checked={regexMatch} onChange={(e) => setRegexMatch(e.target.checked)} /> Regex match
          </label>
        </>
      )}

      {triggerType === 'CONTACT_TAG' && (
        <AppInput label="Required tag" value={contactTag} onChange={(e) => setContactTag(e.target.value)} placeholder="vip" />
      )}

      {triggerType === 'SEGMENT' && (
        <AppInput label="Tags (any match)" value={segmentTags} onChange={(e) => setSegmentTags(e.target.value)} placeholder="vip, lead, premium" hint="Comma-separated" />
      )}

      {(triggerType === 'BUSINESS_HOURS' || triggerType === 'OFF_HOURS') && (
        <Link to="/settings" className="flex items-center gap-2 rounded-xl border border-sky-100 bg-sky-50 px-3 py-2.5 text-[12px] font-semibold text-sky-700 hover:bg-sky-100">
          <Clock className="h-4 w-4" />
          Configure business hours in Settings →
        </Link>
      )}

      {nodes.length > 0 && (
        <AppSelect
          label="Start step"
          value={startNodeId || nodes[0]?.id || ''}
          options={startNodeOptions}
          isSearchable={false}
          onChange={(e) => setStartNodeId(e.target.value)}
          hint="First step after trigger — or drag from trigger node"
        />
      )}

      <AppInput label="Priority (0-100)" type="number" min={0} max={100} value={String(priority)} onChange={(e) => setPriority(Number(e.target.value))} hint="Higher priority runs first" />

      <div
        className={`rounded-xl border px-3.5 py-3 text-[12px] leading-relaxed ${
          triggerMeta[triggerType]?.accent || 'border-neutral-100 bg-neutral-50 text-neutral-600'
        }`}
      >
        {triggerMeta[triggerType]?.description}
      </div>

      {!isNew && flowStatus === 'DRAFT' && (
        <AppButton size="sm" icon={<Rocket size={14} />} loading={saving} onClick={handlePublish}>
          Publish flow
        </AppButton>
      )}
    </div>
  );

  const goToWarningStep = (nodeId: string) => {
    setSelectedNodeId(nodeId);
    setDesktopPanel('edit');
    setMobileTab('edit');
  };

  const desktopPanelTabs: FlowBuilderPanelTab<DesktopPanel>[] = [
    {
      value: 'edit',
      label: 'Edit',
      icon: SlidersHorizontal,
      description: 'Configure the selected step fields, branches, and messages.',
    },
    {
      value: 'setup',
      label: 'Setup',
      icon: Settings2,
      description: 'Set the flow name, trigger rules, priority, and publish status.',
    },
    {
      value: 'preview',
      label: 'Preview',
      icon: Smartphone,
      description: 'See how the conversation looks on WhatsApp for customers.',
    },
    {
      value: 'test',
      label: 'Test',
      icon: FlaskConical,
      description: 'Simulate incoming messages and verify the flow path.',
    },
    ...(!isNew
      ? [
          {
            value: 'analytics' as const,
            label: 'Stats',
            icon: BarChart3,
            description: 'Track starts, completions, handoffs, and drop-off points.',
          },
          {
            value: 'versions' as const,
            label: 'History',
            icon: History,
            description: 'Browse published versions and restore earlier snapshots.',
          },
        ]
      : []),
  ];

  const canvasProps = {
    triggerType,
    keyword,
    startNodeId,
    nodes,
    selectedNodeId,
    onSelect: setSelectedNodeId,
    onChange: handleGraphChange,
    onRemove: removeNode,
    onAdd: addNode,
    isNew,
  };

  if (loading) {
    return (
      <PageShell>
        <LoadingState label="Loading flow builder..." />
      </PageShell>
    );
  }

  return (
    <PageShell fullBleed className="!max-w-none !px-0">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-gradient-to-br from-slate-50 via-[#f6f8f7] to-emerald-50/20 pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-0">
        <header className="sticky top-0 z-30 border-b border-slate-200/50 bg-white/95 backdrop-blur-xl">
          <div className="mx-auto flex max-w-[1600px] items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-6 sm:py-3">
            <button
              type="button"
              onClick={() => navigate('/automations')}
              aria-label="Go back"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-neutral-200/80 bg-white text-neutral-700 transition hover:border-violet-200 hover:bg-violet-50"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-[14px] font-extrabold text-neutral-900 sm:text-[15px]">
                {isNew ? 'New flow' : name || 'Edit flow'}
              </h1>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-medium text-neutral-500 sm:text-[12px]">
                  {nodes.length === 0 ? 'Add steps to connect' : `${nodes.length} steps`}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
                    enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-neutral-100 text-neutral-500'
                  }`}
                >
                  {enabled ? 'Live' : 'Paused'}
                </span>
                {flowStatus === 'DRAFT' && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-700">
                    Draft
                  </span>
                )}
              </div>
            </div>
            {!isNew && (
              <button
                type="button"
                onClick={handleDuplicate}
                className="hidden h-10 items-center gap-1.5 rounded-xl border border-neutral-200 px-3 text-[12px] font-bold text-neutral-600 transition hover:bg-neutral-50 md:flex"
              >
                <Copy className="h-3.5 w-3.5" /> Duplicate
              </button>
            )}
            <AppButton
              size="sm"
              variant="secondary"
              className="hidden shrink-0 md:flex"
              icon={<FileEdit size={15} />}
              loading={saving}
              onClick={() => handleSave(true)}
            >
              Draft
            </AppButton>
            <AppButton
              size="sm"
              className="shrink-0"
              icon={saved ? <Check size={15} /> : <Save size={15} />}
              loading={saving}
              onClick={() => handleSave(false)}
            >
              <span className="sr-only sm:not-sr-only">{saved ? 'Saved' : 'Save'}</span>
            </AppButton>
          </div>
        </header>

        <FlowValidationWarnings
          warnings={warnings}
          nodes={nodes}
          onGoToStep={goToWarningStep}
        />

        <div className="mx-auto w-full max-w-[1600px] flex-1 lg:hidden">
          {mobileTab === 'flow' && (
            <div className="p-4">
              <FlowCanvas {...canvasProps} />
              {nodes.length > 0 && <div className="mt-4"><FlowStepPalette onAdd={addNode} variant="horizontal" /></div>}
            </div>
          )}
          {mobileTab === 'edit' && (
            <div className="p-3 sm:p-4">
              {nodes.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-violet-200/80 bg-gradient-to-br from-violet-50/40 to-white p-6 text-center shadow-sm">
                  <p className="text-[15px] font-extrabold text-neutral-900">No steps to edit yet</p>
                  <p className="mt-1 text-[13px] font-medium text-neutral-500">
                    Switch to the Flow tab and add your first step.
                  </p>
                  <AppButton className="mt-4" size="sm" onClick={() => setMobileTab('flow')}>
                    Go to Flow
                  </AppButton>
                </div>
              ) : (
                <div className="rounded-2xl border border-neutral-200/60 bg-white p-4 shadow-sm">
                  <FlowNodePanel
                    node={selectedNode}
                    nodeIndex={selectedIndex}
                    allNodes={nodes}
                    onChange={(patch) => selectedNodeId && updateNode(selectedNodeId, patch)}
                    onRemove={() => selectedNodeId && removeNode(selectedNodeId)}
                    canRemove={nodes.length > 1}
                  />
                </div>
              )}
            </div>
          )}
          {mobileTab === 'preview' && (
            <div className="flex justify-center p-4 sm:p-6">
              <FlowPhoneMockup nodes={nodes} selectedIndex={Math.max(0, selectedIndex)} />
            </div>
          )}
          {mobileTab === 'test' && !isNew && (
            <div className="p-4">
              <FlowTestPanel triggerType={triggerType} triggerConfig={triggerConfig} nodes={nodes} startNodeId={startNodeId} />
            </div>
          )}
          {mobileTab === 'analytics' && !isNew && id && (
            <div className="p-4"><FlowAnalyticsPanel flowId={id} nodes={nodes} /></div>
          )}
          {mobileTab === 'settings' && <div className="p-4"><div className="rounded-2xl border border-neutral-200/60 bg-white p-5 shadow-sm">{settingsForm}</div></div>}
        </div>

        <div className="mx-auto hidden min-h-0 w-full max-w-[1720px] flex-1 gap-4 overflow-hidden px-4 py-4 lg:grid lg:grid-cols-[minmax(220px,260px)_minmax(0,1fr)_minmax(400px,30vw)] lg:items-stretch xl:gap-5 xl:px-5 xl:py-5">
          <aside className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200/50 bg-white/80 shadow-[0_4px_24px_rgba(15,23,42,0.04)] backdrop-blur-sm">
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
              <FlowStepPalette onAdd={addNode} />
            </div>
          </aside>
          <main className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
            <FlowCanvas {...canvasProps} />
          </main>
          <div className="flex h-full min-h-0 min-w-0 flex-col">
            <FlowBuilderSidePanel active={desktopPanel} onChange={setDesktopPanel} tabs={desktopPanelTabs}>
            {desktopPanel === 'edit' && (
              <FlowNodePanel
                node={selectedNode}
                nodeIndex={selectedIndex}
                allNodes={nodes}
                onChange={(patch) => selectedNodeId && updateNode(selectedNodeId, patch)}
                onRemove={() => selectedNodeId && removeNode(selectedNodeId)}
                canRemove={nodes.length > 1}
              />
            )}
            {desktopPanel === 'setup' && settingsForm}
            {desktopPanel === 'preview' && (
              <div className="flex min-h-[580px] items-start justify-center py-1">
                <FlowPhoneMockup nodes={nodes} selectedIndex={Math.max(0, selectedIndex)} />
              </div>
            )}
            {desktopPanel === 'test' && (
              <FlowTestPanel
                triggerType={triggerType}
                triggerConfig={triggerConfig}
                nodes={nodes}
                startNodeId={startNodeId}
              />
            )}
            {desktopPanel === 'analytics' && !isNew && id && (
              <FlowAnalyticsPanel flowId={id} nodes={nodes} />
            )}
            {desktopPanel === 'versions' && !isNew && id && (
              <FlowVersionsPanel flowId={id} onRestore={handleRestoreVersion} />
            )}
          </FlowBuilderSidePanel>
          </div>
        </div>

        <FlowMobileNav active={mobileTab} onChange={setMobileTab} showTest={!isNew} showAnalytics={!isNew} />
      </div>
    </PageShell>
  );
}
