import { describe, expect, it } from 'vitest';
import { isAgentOnlyChatMetadata } from './agent-only';

describe('isAgentOnlyChatMetadata', () => {
  it('treats call summaries as agent-only', () => {
    expect(isAgentOnlyChatMetadata({ isCallSummary: true, callId: 'c1' })).toBe(true);
  });

  it('treats explicit agentOnly as never-send', () => {
    expect(isAgentOnlyChatMetadata({ agentOnly: true })).toBe(true);
  });

  it('allows normal outbound chat through', () => {
    expect(isAgentOnlyChatMetadata({ templateName: 'hello' })).toBe(false);
    expect(isAgentOnlyChatMetadata(null)).toBe(false);
  });
});
