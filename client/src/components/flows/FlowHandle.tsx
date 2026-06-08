import { Handle, Position } from '@xyflow/react';

type HandleVariant = 'target' | 'source' | 'trigger' | 'branch';

interface FlowHandleProps {
  type: 'source' | 'target';
  id: string;
  variant?: HandleVariant;
  style?: React.CSSProperties;
}

export function FlowHandle({ type, id, variant, style }: FlowHandleProps) {
  const v = variant || (type === 'target' ? 'target' : 'source');
  return (
    <Handle
      type={type}
      position={type === 'target' ? Position.Top : Position.Bottom}
      id={id}
      className={`flow-handle flow-handle--${v}`}
      style={style}
      isConnectable
    />
  );
}

export function branchHandleLeft(index: number, total: number): React.CSSProperties {
  const pct = ((index + 0.5) / total) * 100;
  return { left: `${pct}%` };
}
