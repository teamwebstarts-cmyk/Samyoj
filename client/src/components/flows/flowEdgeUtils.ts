import { MarkerType, type DefaultEdgeOptions, type Edge } from '@xyflow/react';

const TRIGGER_ID = '__trigger__';

export const defaultEdgeOptions: DefaultEdgeOptions = {
  type: 'smoothstep',
  markerEnd: {
    type: MarkerType.ArrowClosed,
    width: 16,
    height: 16,
    color: '#94a3b8',
  },
  style: { strokeWidth: 2, stroke: '#cbd5e1' },
};

export function buildTriggerEdge(target: string): Edge {
  return {
    id: `trigger-${target}`,
    source: TRIGGER_ID,
    target,
    sourceHandle: 'start',
    targetHandle: 'in',
    type: 'smoothstep',
    animated: true,
    markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18, color: '#8b5cf6' },
    style: { stroke: '#8b5cf6', strokeWidth: 2.5 },
  };
}

export function buildStepEdge(
  sourceId: string,
  targetId: string,
  sourceHandle: string,
  label?: string
): Edge {
  return {
    id: `${sourceId}-${sourceHandle}-${targetId}`,
    source: sourceId,
    target: targetId,
    sourceHandle,
    targetHandle: 'in',
    type: 'smoothstep',
    label,
    labelStyle: { fontSize: 10, fontWeight: 700, fill: '#64748b' },
    labelBgStyle: { fill: '#f8fafc', fillOpacity: 0.92 },
    labelBgPadding: [6, 3] as [number, number],
    labelBgBorderRadius: 6,
    markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: '#94a3b8' },
    style: { strokeWidth: 2, stroke: '#cbd5e1' },
  };
}

export function buildConnectEdge(connection: {
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}): Edge {
  const isTrigger = connection.source === TRIGGER_ID;
  if (isTrigger) return buildTriggerEdge(connection.target);

  return {
    id: `${connection.source}-${connection.sourceHandle || 'next'}-${connection.target}`,
    ...connection,
    type: 'smoothstep',
    markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: '#94a3b8' },
    style: { strokeWidth: 2, stroke: '#cbd5e1' },
  };
}
