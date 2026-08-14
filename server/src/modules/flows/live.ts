/** Engine only starts or continues a journey when it is published and turned on. */
export const LIVE_FLOW_WHERE = { enabled: true, status: 'PUBLISHED' as const };

export function isLiveFlow(flow: { enabled?: boolean | null; status?: string | null }): boolean {
  return flow.enabled === true && flow.status === 'PUBLISHED';
}

/** Inbox pause (`botActive: false`) must stop journeys, auto-replies, and AI. */
export function isBotPaused(conversation: { botActive?: boolean | null } | null | undefined): boolean {
  return conversation?.botActive === false;
}
