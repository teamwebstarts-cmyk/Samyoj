import type { Edge, Node } from '@xyflow/react';
import type { FlowNode, FlowNodeType } from '../../types';
import { buildStepEdge, buildTriggerEdge } from './flowEdgeUtils';
import { getNodeSummary } from './flowUtils';
import { createNode, nodeMeta } from './flowMeta';

export const TRIGGER_NODE_ID = '__trigger__';

/** Node types whose outgoing edges map to `branches`, not `next`. */
export const BRANCHING_NODE_TYPES: FlowNodeType[] = [
  'buttons',
  'list',
  'condition',
  'ab_split',
  'language',
];

const NODE_WIDTH = 260;
const NODE_HEIGHT = 120;
const H_GAP = 100;
const V_GAP = 120;

export interface FlowStepNodeData {
  flowNode: FlowNode;
  label: string;
  summary: string;
  index: number;
  isSelected: boolean;
  [key: string]: unknown;
}

export interface TriggerNodeData {
  triggerType: string;
  triggerLabel: string;
  triggerDetail: string;
  [key: string]: unknown;
}

export function getNodeHandles(node: FlowNode): Array<{ id: string; label: string }> {
  switch (node.type) {
    case 'buttons':
      if (node.buttonMode === 'url' || node.buttonMode === 'call') {
        return [{ id: 'next', label: 'Next' }];
      }
      return (node.buttons || []).map((b) => ({ id: b.id, label: b.title }));
    case 'list':
      return (node.listSections || []).flatMap((s) => s.rows).map((r) => ({ id: r.id, label: r.title }));
    case 'condition':
      return [
        { id: 'true', label: 'Yes' },
        { id: 'false', label: 'No' },
      ];
    case 'ab_split':
      return [
        { id: 'a', label: 'A (50%)' },
        { id: 'b', label: 'B (50%)' },
      ];
    case 'language':
      return [
        { id: 'match', label: 'Match' },
        { id: 'default', label: 'Default' },
      ];
    default:
      return [{ id: 'next', label: 'Next' }];
  }
}

export function autoLayoutNodes(nodes: FlowNode[], startNodeId?: string): FlowNode[] {
  if (nodes.length === 0) return nodes;

  const idSet = new Set(nodes.map((n) => n.id));
  const startId = startNodeId && idSet.has(startNodeId) ? startNodeId : nodes[0].id;
  const levels = new Map<string, number>();
  const queue: Array<{ id: string; level: number }> = [{ id: startId, level: 0 }];
  const visited = new Set<string>();

  while (queue.length) {
    const { id, level } = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    levels.set(id, Math.max(levels.get(id) ?? 0, level));

    const node = nodes.find((n) => n.id === id);
    if (!node) continue;

    const targets = new Set<string>();
    if (node.next) targets.add(node.next);
    if (node.branches) {
      for (const target of Object.values(node.branches)) {
        if (target) targets.add(target);
      }
    }
    for (const target of targets) {
      if (idSet.has(target)) queue.push({ id: target, level: level + 1 });
    }
  }

  for (const node of nodes) {
    if (!levels.has(node.id)) levels.set(node.id, 0);
  }

  const byLevel = new Map<number, FlowNode[]>();
  for (const node of nodes) {
    const level = levels.get(node.id) ?? 0;
    if (!byLevel.has(level)) byLevel.set(level, []);
    byLevel.get(level)!.push(node);
  }

  return nodes.map((node) => {
    const level = levels.get(node.id) ?? 0;
    const row = byLevel.get(level) || [];
    const indexInRow = row.findIndex((n) => n.id === node.id);
    const rowWidth = row.length;
    const x = (indexInRow - (rowWidth - 1) / 2) * (NODE_WIDTH + H_GAP);
    const y = level * (NODE_HEIGHT + V_GAP) + 40;
    return { ...node, position: node.position ?? { x, y } };
  });
}

export function flowNodesToGraph(
  nodes: FlowNode[],
  startNodeId: string,
  triggerType: string,
  triggerLabel: string,
  triggerDetail: string,
  selectedNodeId: string | null
): { rfNodes: Node[]; rfEdges: Edge[] } {
  const positioned = nodes.some((n) => n.position) ? nodes : autoLayoutNodes(nodes, startNodeId);
  const rfNodes: Node[] = [
    {
      id: TRIGGER_NODE_ID,
      type: 'trigger',
      position: { x: 0, y: -120 },
      data: { triggerType, triggerLabel, triggerDetail } satisfies TriggerNodeData,
      draggable: false,
      selectable: false,
    },
    ...positioned.map((node, index) => ({
      id: node.id,
      type: 'flowStep' as const,
      position: node.position ?? { x: 0, y: index * (NODE_HEIGHT + V_GAP) },
      data: {
        flowNode: node,
        label: nodeMeta[node.type].label,
        summary: getNodeSummary(node),
        index,
        isSelected: selectedNodeId === node.id,
      } satisfies FlowStepNodeData,
    })),
  ];

  const rfEdges: Edge[] = [];

  if (startNodeId) {
    rfEdges.push(buildTriggerEdge(startNodeId));
  }

  for (const node of positioned) {
    const handles = getNodeHandles(node);
    const isBranching = handles.length > 1 || (node.type === 'buttons' && handles.length > 0);

    if (isBranching && node.branches) {
      for (const handle of handles) {
        const target = node.branches[handle.id];
        if (target) {
          rfEdges.push(buildStepEdge(node.id, target, handle.id, handle.label));
        }
      }
    } else if (node.next) {
      rfEdges.push(buildStepEdge(node.id, node.next, 'next'));
    }
  }

  return { rfNodes, rfEdges };
}

export function applyGraphConnections(
  nodes: FlowNode[],
  edges: Edge[],
  startNodeId: string
): { nodes: FlowNode[]; startNodeId: string } {
  const preservedBranches = new Map(nodes.map((n) => [n.id, { ...(n.branches || {}) }]));
  const validTargets = new Set(nodes.map((n) => n.id));

  const updated = nodes.map((node) => {
    const clone = { ...node };
    if (BRANCHING_NODE_TYPES.includes(node.type)) {
      clone.branches = {};
      clone.next = undefined;
    } else {
      clone.next = undefined;
    }
    return clone;
  });

  const nodeMap = new Map(updated.map((n) => [n.id, n]));
  const wiredHandles = new Map<string, Set<string>>();
  let newStartNodeId = startNodeId;

  for (const edge of edges) {
    if (edge.source === TRIGGER_NODE_ID) {
      newStartNodeId = edge.target;
      continue;
    }

    const source = nodeMap.get(edge.source);
    if (!source) continue;
    const handle = edge.sourceHandle || 'next';

    if (BRANCHING_NODE_TYPES.includes(source.type)) {
      source.branches = { ...(source.branches || {}), [handle]: edge.target };
      if (!wiredHandles.has(source.id)) wiredHandles.set(source.id, new Set());
      wiredHandles.get(source.id)!.add(handle);
    } else {
      source.next = edge.target;
    }
  }

  // Keep panel-configured routes when the canvas has no wire for that button/row.
  for (const node of nodeMap.values()) {
    if (node.type !== 'buttons' && node.type !== 'list') continue;
    const preserved = preservedBranches.get(node.id) || {};
    const wired = wiredHandles.get(node.id) || new Set();
    for (const handle of getNodeHandles(node)) {
      if (wired.has(handle.id)) continue;
      const target = preserved[handle.id];
      if (target && validTargets.has(target)) {
        node.branches = { ...(node.branches || {}), [handle.id]: target };
      }
    }
  }

  return { nodes: Array.from(nodeMap.values()), startNodeId: newStartNodeId };
}

export function applyNodePositions(nodes: FlowNode[], rfNodes: Node[]): FlowNode[] {
  const posMap = new Map(
    rfNodes.filter((n) => n.id !== TRIGGER_NODE_ID).map((n) => [n.id, n.position])
  );
  return nodes.map((node) => {
    const pos = posMap.get(node.id);
    return pos ? { ...node, position: { x: pos.x, y: pos.y } } : node;
  });
}

export function createNodeAtPosition(type: FlowNodeType, position: { x: number; y: number }): FlowNode {
  return { ...createNode(type, 0), position };
}
