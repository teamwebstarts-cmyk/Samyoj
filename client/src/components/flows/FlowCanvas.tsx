import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  ConnectionMode,
  ConnectionLineType,
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
  type Node,
  type Edge,
  type OnNodesChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './flow-canvas.css';
import { MousePointer2, Plus, Trash2, ZoomIn } from 'lucide-react';
import type { FlowNode, FlowNodeType } from '../../types';
import FlowEmptyState from './FlowEmptyState';
import { triggerMeta } from './flowMeta';
import { FlowStepNode } from './FlowStepNode';
import { TriggerNode } from './TriggerNode';
import { buildConnectEdge, defaultEdgeOptions } from './flowEdgeUtils';
import {
  TRIGGER_NODE_ID,
  applyGraphConnections,
  applyNodePositions,
  flowNodesToGraph,
} from './flowGraphUtils';

const nodeTypes = {
  flowStep: FlowStepNode,
  trigger: TriggerNode,
};

interface FlowCanvasProps {
  triggerType: string;
  keyword: string;
  startNodeId: string;
  nodes: FlowNode[];
  selectedNodeId: string | null;
  onSelect: (nodeId: string | null) => void;
  onChange: (nodes: FlowNode[], startNodeId: string) => void;
  onRemove: (nodeId: string) => void;
  onAdd: (type: FlowNodeType) => void;
  isNew?: boolean;
}

function structureKey(nodes: FlowNode[], startNodeId: string) {
  return JSON.stringify({
    startNodeId,
    nodes: nodes.map((n) => ({
      id: n.id,
      type: n.type,
      next: n.next,
      branches: n.branches,
      buttons: n.buttons?.map((b) => b.id),
      listRows: n.listSections?.flatMap((s) => s.rows.map((r) => r.id)),
    })),
  });
}

export default function FlowCanvas({
  triggerType,
  keyword,
  startNodeId,
  nodes,
  selectedNodeId,
  onSelect,
  onChange,
  onRemove,
  onAdd,
  isNew,
}: FlowCanvasProps) {
  const trigger = triggerMeta[triggerType];
  const triggerDetail =
    triggerType === 'KEYWORD' && keyword ? `Contains "${keyword}"` : trigger?.description || '';

  const resolvedStartNodeId = startNodeId || nodes[0]?.id || '';

  const graph = useMemo(
    () =>
      flowNodesToGraph(
        nodes,
        resolvedStartNodeId,
        triggerType,
        trigger?.label || triggerType,
        triggerDetail,
        selectedNodeId
      ),
    [nodes, resolvedStartNodeId, triggerType, trigger?.label, triggerDetail, selectedNodeId]
  );

  const edgeStructureKey = useMemo(
    () => structureKey(nodes, startNodeId),
    [nodes, startNodeId]
  );

  const [rfNodes, setRfNodes, onNodesChange] = useNodesState(graph.rfNodes);
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState(graph.rfEdges);
  const positionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const lastEdgeStructureKey = useRef(edgeStructureKey);

  useEffect(() => {
    const edgesChanged = lastEdgeStructureKey.current !== edgeStructureKey;
    lastEdgeStructureKey.current = edgeStructureKey;

    setRfNodes(
      graph.rfNodes.map((n) => ({
        ...n,
        selected: n.id === selectedNodeId,
        position: positionsRef.current.get(n.id) ?? n.position,
      }))
    );

    if (edgesChanged) {
      setRfEdges(graph.rfEdges);
    }
  }, [graph, edgeStructureKey, selectedNodeId, setRfNodes, setRfEdges]);

  const handleNodesChange: OnNodesChange = useCallback(
    (changes) => {
      onNodesChange(changes);

      const removedIds = changes
        .filter((c) => c.type === 'remove')
        .map((c) => c.id)
        .filter((id) => id !== TRIGGER_NODE_ID);
      if (removedIds.length > 0) {
        for (const nodeId of removedIds) {
          onRemove(nodeId);
        }
        return;
      }

      for (const change of changes) {
        if (change.type === 'position' && change.position) {
          positionsRef.current.set(change.id, change.position);
        }
      }

      const dragEnded = changes.filter(
        (c) => c.type === 'position' && c.dragging === false && c.position
      );
      if (dragEnded.length === 0) return;

      const updatedRfNodes = rfNodes.map((n) => {
        const pos = positionsRef.current.get(n.id);
        return pos ? { ...n, position: pos } : n;
      });
      const withPositions = applyNodePositions(nodes, updatedRfNodes);
      onChange(withPositions, startNodeId);
    },
    [onNodesChange, onRemove, rfNodes, nodes, onChange, startNodeId]
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      const edge = buildConnectEdge(connection);
      const withoutDuplicate = rfEdges.filter(
        (e) =>
          !(
            e.source === edge.source &&
            (e.sourceHandle || 'next') === (edge.sourceHandle || 'next')
          )
      );
      const newEdges = addEdge(edge, withoutDuplicate);
      setRfEdges(newEdges);
      const { nodes: updated, startNodeId: newStart } = applyGraphConnections(
        nodes,
        newEdges,
        startNodeId
      );
      onChange(updated, newStart);
    },
    [rfEdges, setRfEdges, nodes, startNodeId, onChange]
  );

  const onReconnect = useCallback(
    (oldEdge: Edge, connection: Connection) => {
      const edge = buildConnectEdge(connection);
      const withoutOld = rfEdges.filter((e) => e.id !== oldEdge.id);
      const withoutDuplicate = withoutOld.filter(
        (e) =>
          !(
            e.source === edge.source &&
            (e.sourceHandle || 'next') === (edge.sourceHandle || 'next')
          )
      );
      const newEdges = addEdge({ ...edge, id: oldEdge.id }, withoutDuplicate);
      setRfEdges(newEdges);
      const { nodes: updated, startNodeId: newStart } = applyGraphConnections(
        nodes,
        newEdges,
        startNodeId
      );
      onChange(updated, newStart);
    },
    [rfEdges, setRfEdges, nodes, startNodeId, onChange]
  );

  const onEdgesDelete = useCallback(
    (deleted: Edge[]) => {
      const remaining = rfEdges.filter((e) => !deleted.some((d) => d.id === e.id));
      setRfEdges(remaining);
      const clearedNodes = nodes.map((node) => {
        const updated = { ...node, branches: node.branches ? { ...node.branches } : undefined };
        for (const edge of deleted) {
          if (edge.source !== node.id) continue;
          const handle = edge.sourceHandle || 'next';
          if (handle === 'next') {
            updated.next = undefined;
          } else if (updated.branches) {
            delete updated.branches[handle];
          }
        }
        return updated;
      });
      const { nodes: updated, startNodeId: newStart } = applyGraphConnections(
        clearedNodes,
        remaining,
        startNodeId
      );
      onChange(updated, newStart);
    },
    [rfEdges, setRfEdges, nodes, startNodeId, onChange]
  );

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (node.id === TRIGGER_NODE_ID) return;
      onSelect(node.id);
    },
    [onSelect]
  );

  const onPaneClick = useCallback(() => onSelect(null), [onSelect]);

  const handleRemoveSelected = useCallback(() => {
    if (!selectedNodeId || nodes.length <= 1) return;
    onRemove(selectedNodeId);
  }, [selectedNodeId, nodes.length, onRemove]);

  const isEmpty = nodes.length === 0;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-3xl border border-slate-200/60 bg-white shadow-[0_8px_32px_rgba(15,23,42,0.06)]">
      <div className="flex shrink-0 items-center justify-between border-b border-slate-100 bg-gradient-to-r from-slate-50/80 via-white to-emerald-50/30 px-5 py-3.5">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Flow canvas</p>
          <p className="text-[13px] font-medium text-slate-600">
            {isEmpty
              ? 'Add your first step below'
              : `${nodes.length} step${nodes.length === 1 ? '' : 's'}`}
          </p>
        </div>
        {!isEmpty && (
          <div className="hidden items-center gap-2 sm:flex">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-100">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Drag green dot to connect
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-bold text-violet-700 ring-1 ring-violet-100">
              <MousePointer2 className="h-3 w-3" />
              Pan · scroll to zoom
            </span>
          </div>
        )}
        {isNew && isEmpty && (
          <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-bold text-violet-700 ring-1 ring-violet-100">
            New
          </span>
        )}
      </div>

      <div className="relative min-h-[480px] flex-1">
        {isEmpty ? (
          <div className="flex h-full flex-col items-center justify-center bg-gradient-to-b from-slate-50/50 to-white p-8">
            <FlowEmptyState onAdd={onAdd} />
          </div>
        ) : (
          <ReactFlow
            className="flow-canvas"
            nodes={rfNodes}
            edges={rfEdges}
            onNodesChange={handleNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onReconnect={onReconnect}
            onEdgesDelete={onEdgesDelete}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            defaultEdgeOptions={defaultEdgeOptions}
            connectionMode={ConnectionMode.Loose}
            connectionRadius={48}
            reconnectRadius={32}
            edgesReconnectable
            connectionLineType={ConnectionLineType.SmoothStep}
            connectionLineStyle={{ stroke: '#25d366', strokeWidth: 2.5 }}
            snapToGrid
            snapGrid={[20, 20]}
            elevateNodesOnSelect
            elevateEdgesOnSelect
            panOnScroll
            zoomOnScroll
            minZoom={0.3}
            maxZoom={1.8}
            defaultViewport={{ x: 0, y: 0, zoom: 0.9 }}
            fitView
            fitViewOptions={{ padding: 0.35, maxZoom: 1 }}
            deleteKeyCode={['Backspace', 'Delete']}
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={24} size={1.5} color="#dce3dc" />
            <Controls
              showInteractive={false}
              position="bottom-left"
              className="!rounded-2xl !border-slate-200/80 !shadow-md"
            />
            <MiniMap
              nodeColor={(n) => (n.type === 'trigger' ? '#8b5cf6' : '#25d366')}
              nodeStrokeWidth={3}
              maskColor="rgba(241,245,249,0.75)"
              className="!rounded-2xl !border-slate-200/80 !shadow-md"
              position="bottom-right"
            />
            <Panel position="top-right" className="flex flex-col gap-2 sm:flex-row">
              {selectedNodeId && nodes.length > 1 && (
                <button
                  type="button"
                  onClick={handleRemoveSelected}
                  className="flex items-center gap-1.5 rounded-xl border border-red-200/80 bg-white/95 px-3 py-2 text-[12px] font-bold text-red-600 shadow-sm backdrop-blur-sm transition hover:bg-red-50 active:scale-95"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete step
                </button>
              )}
              <button
                type="button"
                onClick={() => onAdd('message')}
                className="flex items-center gap-1.5 rounded-xl border border-emerald-200/80 bg-white/95 px-3 py-2 text-[12px] font-bold text-emerald-700 shadow-sm backdrop-blur-sm transition hover:bg-emerald-50 active:scale-95"
              >
                <Plus className="h-3.5 w-3.5" />
                Add step
              </button>
            </Panel>
            <Panel position="top-left">
              <div className="flex items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white/90 px-2.5 py-1.5 text-[10px] font-bold text-slate-500 shadow-sm backdrop-blur-sm">
                <ZoomIn className="h-3 w-3 text-slate-400" />
                Scroll to zoom · drag canvas to pan
              </div>
            </Panel>
          </ReactFlow>
        )}
      </div>
    </div>
  );
}
