import type { FlowNode } from './types';

const STEP_LABELS: Record<string, string> = {
  message: 'Send Message',
  buttons: 'Quick Buttons',
  list: 'List Menu',
  question: 'Ask Question',
  tag: 'Add Tag',
  remove_tag: 'Remove Tag',
  assign: 'Assign Agent',
  condition: 'Condition',
  handoff: 'Handoff',
  ai: 'AI Bot',
  end: 'End',
  template: 'Template',
  delay: 'Delay',
  schedule: 'Schedule',
  media: 'Media',
  webhook: 'Webhook',
  ab_split: 'A/B Split',
  language: 'Language Route',
  set_variable: 'Set Variable',
  goto_flow: 'Go to Flow',
  goto_step: 'Go to Step',
  request_callback: 'Request Callback',
  location: 'Send Location',
  contact_card: 'Contact Card',
  wa_flow: 'WhatsApp Flow',
};

export interface ActiveFlowInfo {
  flowId: string;
  flowName?: string;
  currentNodeId: string;
  currentStepLabel?: string;
  waitingFor?: string | null;
}

export function parseActiveFlow(botState: unknown, flowNodes?: FlowNode[]): ActiveFlowInfo | null {
  if (!botState || typeof botState !== 'object') return null;
  const state = botState as Record<string, unknown>;
  if (!state.flowId || !state.currentNodeId) return null;

  const currentNodeId = state.currentNodeId as string;
  let currentStepLabel: string | undefined;

  if (flowNodes?.length) {
    const node = flowNodes.find((n) => n.id === currentNodeId);
    if (node) currentStepLabel = STEP_LABELS[node.type] || node.type;
  }

  return {
    flowId: state.flowId as string,
    flowName: state.flowName as string | undefined,
    currentNodeId,
    currentStepLabel,
    waitingFor: (state.waitingFor as string | null) ?? null,
  };
}
