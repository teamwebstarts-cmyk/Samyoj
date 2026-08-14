import { describe, expect, it } from 'vitest';
import { hasWaFlowResponse, shouldInterruptWait } from './inbound-wait';

describe('shouldInterruptWait', () => {
  it('interrupts delay waits so inbound is not swallowed', () => {
    expect(shouldInterruptWait('delay', {})).toBe(true);
  });

  it('interrupts Meta Form wait when the customer types instead of submitting', () => {
    expect(shouldInterruptWait('wa_flow', {})).toBe(true);
    expect(shouldInterruptWait('wa_flow', { waFlowResponse: {} })).toBe(true);
  });

  it('does not interrupt a real form completion', () => {
    expect(shouldInterruptWait('wa_flow', { waFlowResponse: { name: 'Ada' } })).toBe(false);
    expect(hasWaFlowResponse({ waFlowResponse: { name: 'Ada' } })).toBe(true);
  });

  it('leaves button and text waits alone', () => {
    expect(shouldInterruptWait('button', { waFlowResponse: { x: 1 } })).toBe(false);
    expect(shouldInterruptWait('text', {})).toBe(false);
  });
});
