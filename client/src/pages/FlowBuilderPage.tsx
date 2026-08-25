import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  BarChart3,
  FlaskConical,
  History,
  Settings2,
  SlidersHorizontal,
  Smartphone,
} from 'lucide-react';
import AppButton from '../components/ui/AppButton';
import { CanvasPageSkeleton } from '../components/ui/ListLayoutSkeleton';
import PageShell from '../components/ui/PageShell';
import FlowAnalyticsPanel from '../components/flows/FlowAnalyticsPanel';
import FlowBuilderHeader from '../components/flows/FlowBuilderHeader';
import FlowBuilderSidePanel, { type FlowBuilderPanelTab } from '../components/flows/FlowBuilderSidePanel';
import FlowValidationWarnings from '../components/flows/FlowValidationWarnings';
import FlowCanvas from '../components/flows/FlowCanvas';
import FlowMobileNav, { type FlowBuilderTab } from '../components/flows/FlowMobileNav';
import FlowNodePanel from '../components/flows/FlowNodePanel';
import FlowPreviewPanel from '../components/flows/FlowPreviewPanel';
import FlowStepPalette from '../components/flows/FlowStepPalette';
import FlowTestPanel from '../components/flows/FlowTestPanel';
import FlowSettingsPanel from '../components/flows/FlowSettingsPanel';
import FlowVersionsPanel from '../components/flows/FlowVersionsPanel';
import EntitlementNotice, { quotaUpgradeMessage } from '../components/billing/EntitlementNotice';
import { autoLayoutNodes, createNodeAtPosition } from '../components/flows/flowGraphUtils';
import { prepareNodesForSave, validateFlow } from '../components/flows/flowUtils';
import { flowApi, automationApi } from '../services/api';
import { getErrorMessage, normalizeError } from '../utils/errors';
import { toastError, toastSuccess, toastValidationErrors } from '../utils/toast';
import { notifySaveConflicts } from '../utils/automation-conflicts';
import {
  flowAudienceLabel,
  flowAudienceState,
  flowSaveSuccessMessage,
} from '../utils/flow-live';
import type { FlowNode, FlowNodeType, FlowStatus, FlowTriggerType } from '../types';
import { useWhatsAppNumber } from '../contexts/WhatsAppNumberContext';
import { useOnActiveNumberChange } from '../hooks/useOnActiveNumberChange';
import { useEntitlements } from '../hooks/useEntitlements';

type DesktopPanel = 'edit' | 'setup' | 'preview' | 'test' | 'analytics' | 'versions';

export default function FlowBuilderPage() {
  const { activeNumber, resolved } = useWhatsAppNumber();
  const { entitlements, loading: entitlementsLoading } = useEntitlements();
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
  const [campaignId, setCampaignId] = useState('');
  const [withinHours, setWithinHours] = useState(168);
  const [startNodeId, setStartNodeId] = useState('');
  const [flowStatus, setFlowStatus] = useState<FlowStatus>(isNew ? 'DRAFT' : 'PUBLISHED');
  const [priority, setPriority] = useState(50);
  const [enabled, setEnabled] = useState(false);
  const [nodes, setNodes] = useState<FlowNode[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [expectedUpdatedAt, setExpectedUpdatedAt] = useState<string | null>(null);
  const activeNumberIdRef = useRef<string | null>(null);
  activeNumberIdRef.current = activeNumber?.id ?? null;
  const loadGenerationRef = useRef(0);
  const validationGenerationRef = useRef(0);

  const triggerConfig = useMemo(() => {
    if (triggerType === 'KEYWORD') return { keyword, exactMatch, regex: regexMatch };
    if (triggerType === 'CONTACT_TAG') return { tag: contactTag };
    if (triggerType === 'SEGMENT') return { tags: segmentTags.split(',').map((t) => t.trim()).filter(Boolean) };
    if (triggerType === 'CAMPAIGN_REPLY') return {
      ...(campaignId.trim() ? { campaignId: campaignId.trim() } : {}),
      withinHours,
    };
    return {};
  }, [triggerType, keyword, exactMatch, regexMatch, contactTag, segmentTags, campaignId, withinHours]);

  const selectedIndex = selectedNodeId ? nodes.findIndex((n) => n.id === selectedNodeId) : -1;
  const selectedNode = selectedIndex >= 0 ? nodes[selectedIndex] : null;

  const linkedNodes = useMemo(() => prepareNodesForSave(nodes), [nodes]);
  const audience = useMemo(
    () => flowAudienceState({ status: flowStatus, enabled, isNew }),
    [enabled, flowStatus, isNew]
  );
  const canPublishFlow =
    entitlementsLoading ||
    !entitlements ||
    (entitlements.canUseFeature('flowPublish') &&
      entitlements.canAddToQuota('publishedWorkflows'));
  const flowGateMessage =
    !entitlementsLoading && entitlements && !entitlements.canUseFeature('flowPublish')
      ? 'Flow publishing is unavailable while your plan is locked.'
      : entitlements && !entitlements.canAddToQuota('publishedWorkflows')
        ? quotaUpgradeMessage('publishedWorkflows')
        : null;

  const load = useCallback(() => {
    if (!id || isNew || !resolved || !activeNumber) return;
    const requestNumberId = activeNumber.id;
    const generation = ++loadGenerationRef.current;
    setLoading(true);
    setLoadError(null);
    flowApi
      .get(id)
      .then(({ data }) => {
        if (
          requestNumberId !== activeNumberIdRef.current ||
          generation !== loadGenerationRef.current
        ) return;
        const flow = data.data;
        setExpectedUpdatedAt(flow.updatedAt || null);
        setName(flow.name);
        setDescription(flow.description || '');
        setTriggerType(flow.triggerType);
        setKeyword((flow.triggerConfig?.keyword as string) || '');
        setExactMatch(Boolean(flow.triggerConfig?.exactMatch));
        setRegexMatch(Boolean(flow.triggerConfig?.regex));
        setContactTag((flow.triggerConfig?.tag as string) || '');
        setSegmentTags(((flow.triggerConfig?.tags as string[]) || []).join(', '));
        setCampaignId((flow.triggerConfig?.campaignId as string) || '');
        setWithinHours(typeof flow.triggerConfig?.withinHours === 'number' ? flow.triggerConfig.withinHours : 168);
        setStartNodeId(flow.startNodeId || '');
        setFlowStatus(flow.status || 'PUBLISHED');
        setPriority(flow.priority ?? 50);
        setEnabled(flow.enabled);
        const loadedNodes = flow.draftNodes?.length ? flow.draftNodes : flow.nodes?.length ? flow.nodes : [];
        const laid = autoLayoutNodes(loadedNodes, flow.startNodeId || loadedNodes[0]?.id);
        setNodes(laid);
        setSelectedNodeId(laid[0]?.id || null);
      })
      .catch((err) => {
        if (
          requestNumberId === activeNumberIdRef.current &&
          generation === loadGenerationRef.current
        ) {
          const message = getErrorMessage(err, 'Failed to load flow');
          setLoadError(message);
          toastError(message);
        }
      })
      .finally(() => {
        if (
          requestNumberId === activeNumberIdRef.current &&
          generation === loadGenerationRef.current
        ) {
          setLoading(false);
        }
      });
  }, [activeNumber, id, isNew, resolved]);

  useEffect(load, [load]);

  const runServerValidation = useCallback(async () => {
    if (nodes.length === 0 || !resolved || !activeNumber) {
      setWarnings([]);
      setValidationErrors([]);
      return;
    }
    const validationGeneration = ++validationGenerationRef.current;
    const requestNumberId = activeNumber.id;
    try {
      const { data } = await flowApi.validate({
        name: name.trim() || 'Untitled',
        triggerType,
        triggerConfig,
        nodes,
        startNodeId: startNodeId || nodes[0]?.id,
      });
      if (
        requestNumberId === activeNumberIdRef.current &&
        validationGeneration === validationGenerationRef.current
      ) {
        setValidationErrors(data.data.errors || []);
        setWarnings(data.data.warnings || []);
      }
    } catch (err) {
      if (
        requestNumberId !== activeNumberIdRef.current ||
        validationGeneration !== validationGenerationRef.current
      ) {
        return;
      }
      const normalized = normalizeError(err);
      const details = normalized.details;
      if (Array.isArray(details) && details.length > 0) {
        const messages = details.map((detail) => {
          if (typeof detail === 'object' && detail !== null && 'message' in detail) {
            const path = 'path' in detail && detail.path ? `${String(detail.path)}: ` : '';
            return `${path}${String((detail as { message: string }).message)}`;
          }
          return getErrorMessage(detail, 'Validation failed');
        });
        setValidationErrors(messages);
        setWarnings([]);
      } else {
        setValidationErrors(normalized.message ? [normalized.message] : []);
        setWarnings([]);
      }
    }
  }, [activeNumber, name, nodes, resolved, startNodeId, triggerConfig, triggerType]);

  useOnActiveNumberChange(({ isInitial }) => {
    if (isInitial) return;
    loadGenerationRef.current += 1;
    validationGenerationRef.current += 1;
    setLoading(!isNew);
    setSaved(false);
    setWarnings([]);
    setSelectedNodeId(null);
    setNodes([]);
    setName('');
    setDescription('');
    setTriggerType('WELCOME');
    setKeyword('');
    setExactMatch(false);
    setRegexMatch(false);
    setContactTag('');
    setSegmentTags('');
    setCampaignId('');
    setWithinHours(168);
    setStartNodeId('');
    setFlowStatus('DRAFT');
    setPriority(50);
    setEnabled(false);
    if (isNew) return;
    load();
  });

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
    const nextNodes = [...nodes];

    if (nextNodes.length === 0) {
      setStartNodeId(node.id);
    }

    nextNodes.push(node);
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
        if (updated.targetNodeId === nodeId) updated.targetNodeId = undefined;
        if (updated.branches) {
          updated.branches = Object.fromEntries(
            Object.entries(updated.branches).filter(([, v]) => v && v !== nodeId)
          );
        }
        return updated;
      });
    setNodes(nextNodes);
    if (startNodeId === nodeId) setStartNodeId(nextNodes[0]?.id || '');
    setSelectedNodeId(nextNodes[0]?.id || null);
    setSaved(false);
  };

  const buildPayload = (asDraft = false) => {
    const preparedNodes = prepareNodesForSave(nodes);
    return {
      name: name.trim(),
      description: description.trim() || undefined,
      triggerType,
      triggerConfig,
      nodes: preparedNodes,
      startNodeId: startNodeId || preparedNodes[0]?.id || undefined,
      enabled,
      priority,
      status: asDraft ? 'DRAFT' : 'PUBLISHED',
      saveAsDraft: asDraft,
    };
  };

  const warnLiveConflicts = async (asDraft: boolean) => {
    if (asDraft || !enabled) return true;
    try {
      const { data } = await automationApi.previewConflicts({
        kind: 'flow',
        excludeId: isNew ? undefined : id,
        name: name.trim(),
        triggerType,
        triggerConfig: triggerConfig as Record<string, unknown>,
        enabled,
        status: asDraft ? 'DRAFT' : 'PUBLISHED',
      });
      return notifySaveConflicts(data.data.conflicts || []);
    } catch {
      return true;
    }
  };

  const handleSave = async (asDraft = false) => {
    if (!isNew && loadError) {
      toastError('Cannot save until the flow loads successfully.');
      return;
    }
    if (validationErrors.length > 0) {
      toastValidationErrors(validationErrors);
      return;
    }
    if (!asDraft && !canPublishFlow) {
      toastError(flowGateMessage || quotaUpgradeMessage('publishedWorkflows'));
      return;
    }
    const preparedNodes = prepareNodesForSave(nodes);
    const clientValidationErrors = validateFlow(name, triggerType, triggerConfig, keyword, preparedNodes);
    if (clientValidationErrors.length > 0) {
      toastValidationErrors(clientValidationErrors);
      setMobileTab('settings');
      setDesktopPanel('setup');
      return;
    }

    setSaving(true);
    try {
      if (!(await warnLiveConflicts(asDraft))) return;
      if (isNew) {
        const { data } = await flowApi.create(buildPayload(asDraft));
        toastSuccess(flowSaveSuccessMessage({ asDraft, enabled, isNew: true }));
        navigate(`/automations/flows/${data.data.id}`, { replace: true });
      } else {
        await flowApi.update(id!, { ...buildPayload(asDraft), expectedUpdatedAt });
        setFlowStatus(asDraft ? 'DRAFT' : 'PUBLISHED');
        setSaved(true);
        toastSuccess(flowSaveSuccessMessage({ asDraft, enabled, isNew: false }));
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
    if (!canPublishFlow) {
      toastError(flowGateMessage || quotaUpgradeMessage('publishedWorkflows'));
      return;
    }
    setSaving(true);
    try {
      if (!(await warnLiveConflicts(false))) return;
      await flowApi.update(id, buildPayload(true));
      await flowApi.publish(id);
      setFlowStatus('PUBLISHED');
      setSaved(true);
      toastSuccess(
        enabled
          ? 'Published and live — customers can get this now.'
          : 'Published, but still off. Turn on when you are ready.'
      );
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
      toastSuccess('Draft copy created — not live yet.');
      navigate(`/automations/flows/${data.data.id}`);
    } catch (err: unknown) {
      toastError(getErrorMessage(err, 'Failed to duplicate flow'));
    }
  };

  const builderTitle = isNew ? 'New flow' : name || 'Edit flow';
  const builderSubtitle =
    nodes.length === 0 ? 'Add steps to connect your automation' : `${nodes.length} step${nodes.length === 1 ? '' : 's'}`;
  const builderBadge = flowAudienceLabel(audience);

  const handleRestoreVersion = (
    restoredFlow: {
      nodes: FlowNode[];
      startNodeId?: string | null;
      triggerType?: string;
      triggerConfig?: Record<string, unknown>;
      enabled?: boolean;
      priority?: number;
    },
    version: number
  ) => {
    const laid = autoLayoutNodes(restoredFlow.nodes, restoredFlow.startNodeId || restoredFlow.nodes[0]?.id);
    setNodes(laid);
    setStartNodeId(restoredFlow.startNodeId || laid[0]?.id || '');
    setSelectedNodeId(laid[0]?.id || null);
    if (restoredFlow.triggerType) setTriggerType(restoredFlow.triggerType as FlowTriggerType);
    const config = restoredFlow.triggerConfig || {};
    setKeyword(String(config.keyword || ''));
    setExactMatch(Boolean(config.exactMatch));
    setRegexMatch(Boolean(config.regex));
    setContactTag(String(config.tag || ''));
    setSegmentTags(Array.isArray(config.tags) ? config.tags.join(', ') : '');
    setCampaignId(String(config.campaignId || ''));
    setWithinHours(typeof config.withinHours === 'number' ? config.withinHours : 168);
    if (typeof restoredFlow.enabled === 'boolean') setEnabled(restoredFlow.enabled);
    if (typeof restoredFlow.priority === 'number') setPriority(restoredFlow.priority);
    setFlowStatus('DRAFT');
    setSaved(false);
    toastSuccess(`Restored version ${version} as draft — publish when ready`);
  };

  const settingsForm = (
    <FlowSettingsPanel
      name={name}
      description={description}
      triggerType={triggerType}
      enabled={enabled}
      keyword={keyword}
      exactMatch={exactMatch}
      regexMatch={regexMatch}
      contactTag={contactTag}
      segmentTags={segmentTags}
      campaignId={campaignId}
      withinHours={withinHours}
      startNodeId={startNodeId}
      priority={priority}
      nodes={nodes}
      flowStatus={flowStatus}
      isNew={isNew}
      saving={saving}
      onNameChange={setName}
      onDescriptionChange={setDescription}
      onTriggerTypeChange={setTriggerType}
      onEnabledChange={setEnabled}
      onKeywordChange={setKeyword}
      onExactMatchChange={setExactMatch}
      onRegexMatchChange={setRegexMatch}
      onContactTagChange={setContactTag}
      onSegmentTagsChange={setSegmentTags}
      onCampaignIdChange={setCampaignId}
      onWithinHoursChange={setWithinHours}
      onStartNodeIdChange={setStartNodeId}
      onPriorityChange={setPriority}
      onPublish={handlePublish}
      canPublish={canPublishFlow}
      onDirty={() => setSaved(false)}
    />
  );

  const goToWarningStep = (nodeId: string) => {
    setSelectedNodeId(nodeId);
    setDesktopPanel('edit');
    setMobileTab('edit');
  };

  const desktopPanelTabs: FlowBuilderPanelTab<DesktopPanel>[] = [
    {
      value: 'edit',
      label: 'Edit step',
      icon: SlidersHorizontal,
      description: 'Change the message, buttons, or options for the selected step.',
    },
    {
      value: 'setup',
      label: 'Settings',
      icon: Settings2,
      description: 'Name your flow, pick when it runs, and turn it on.',
    },
    {
      value: 'preview',
      label: 'Preview',
      icon: Smartphone,
      description: 'See the full conversation your customer gets on WhatsApp.',
    },
    {
      value: 'test',
      label: 'Try it',
      icon: FlaskConical,
      description: 'Send a sample message and check if your flow starts — no real WhatsApp needed.',
    },
    ...(!isNew
      ? [
          {
            value: 'analytics' as const,
            label: 'Stats',
            icon: BarChart3,
            description: 'See how many people started, finished, talked to your team, or stopped early.',
          },
          {
            value: 'versions' as const,
            label: 'History',
            icon: History,
            description: 'See saved versions and restore an older one.',
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
      <PageShell fullBleed className="!max-w-none !p-0">
        <CanvasPageSkeleton label="Loading flow builder" />
      </PageShell>
    );
  }

  if (!isNew && loadError) {
    return (
      <PageShell fullBleed className="!max-w-none !p-0">
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-8 text-center">
          <p className="text-lg font-semibold text-neutral-900">Could not load this flow</p>
          <p className="max-w-md text-sm text-neutral-600">{loadError}</p>
          <AppButton onClick={() => void load()}>Retry</AppButton>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell fullBleed className="!max-w-none !p-0">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-gradient-to-br from-slate-50 via-[#f6f8f7] to-emerald-50/20 pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-0">
        <FlowBuilderHeader
          title={builderTitle}
          subtitle={builderSubtitle}
          badge={builderBadge}
          isNew={isNew}
          saved={saved}
          saving={saving}
          enabled={enabled}
          onDuplicate={!isNew ? () => void handleDuplicate() : undefined}
          onSaveDraft={() => void handleSave(true)}
          onSave={() => void handleSave(false)}
        />

        <FlowValidationWarnings
          warnings={[...validationErrors, ...warnings]}
          nodes={nodes}
          onGoToStep={goToWarningStep}
        />
        {flowGateMessage && (
          <EntitlementNotice
            className="mx-4 mt-3 lg:mx-6"
            message={flowGateMessage}
            upgradePlan={entitlements?.isLocked ? 'growth' : entitlements?.getUpgradePlan('publishedWorkflows')}
          />
        )}

        <div className="mx-auto w-full max-w-[1440px] flex-1 lg:hidden">
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
            <div className="p-4">
              <FlowPreviewPanel nodes={linkedNodes} startNodeId={startNodeId} flowName={name} />
            </div>
          )}
          {mobileTab === 'test' && (
            <div className="p-4">
              <FlowTestPanel triggerType={triggerType} triggerConfig={triggerConfig} nodes={linkedNodes} startNodeId={startNodeId} />
            </div>
          )}
          {mobileTab === 'analytics' && !isNew && id && (
            <div className="p-4"><FlowAnalyticsPanel flowId={id} nodes={nodes} /></div>
          )}
          {mobileTab === 'settings' && <div className="p-4"><div className="rounded-2xl border border-neutral-200/60 bg-white p-5 shadow-sm">{settingsForm}</div></div>}
        </div>

        <div className="mx-auto hidden min-h-0 w-full max-w-[1560px] flex-1 gap-4 overflow-hidden px-4 py-4 lg:grid lg:grid-cols-[minmax(220px,248px)_minmax(0,1fr)_minmax(320px,28vw)] lg:items-stretch xl:gap-5 xl:px-5 xl:py-5 xl:grid-cols-[minmax(220px,260px)_minmax(0,1fr)_minmax(340px,26vw)]">
          <aside className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200/50 bg-white/80 shadow-[0_4px_24px_rgba(15,23,42,0.04)] backdrop-blur-sm">
            <div className="shrink-0 border-b border-slate-200/60 bg-gradient-to-r from-emerald-50/40 via-white to-slate-50/80 px-4 py-3">
              <p className="text-[14px] font-extrabold tracking-tight text-slate-900">Steps</p>
              <p className="mt-0.5 text-[11px] font-medium leading-relaxed text-slate-500">
                Tap a step type to add it to your flow
              </p>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
              <FlowStepPalette onAdd={addNode} hideIntro />
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
              <FlowPreviewPanel nodes={linkedNodes} startNodeId={startNodeId} flowName={name} />
            )}
            {desktopPanel === 'test' && (
              <FlowTestPanel
                triggerType={triggerType}
                triggerConfig={triggerConfig}
                nodes={linkedNodes}
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

        <FlowMobileNav active={mobileTab} onChange={setMobileTab} showTest showAnalytics={!isNew} />
      </div>
    </PageShell>
  );
}
