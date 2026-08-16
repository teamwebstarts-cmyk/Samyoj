export function isAgentOnlyChatMetadata(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== 'object') return false;
  const meta = metadata as Record<string, unknown>;
  return Boolean(
    meta.agentOnly || meta.isCallSummary || meta.isCallEvent || meta.isInternalNote
  );
}
