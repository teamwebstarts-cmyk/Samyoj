/** Inbox InternalNote body for an AI post-call summary. No call / Graph ids. */
export function formatCallSummaryInternalNote(summary: string, reason: string): string {
  return `📞 Call summary (${reason}):\n${summary}`.trim();
}

/** Inbox InternalNote body when the caller asked for a callback. No call ids. */
export function formatCallbackInternalNote(input: {
  when: string;
  reason?: string;
  ticketId: string;
}): string {
  return [
    'Callback requested via AI voice agent.',
    `When: ${input.when}`,
    input.reason ? `Reason: ${input.reason}` : null,
    `Ticket: ${input.ticketId}`,
  ]
    .filter(Boolean)
    .join('\n');
}
