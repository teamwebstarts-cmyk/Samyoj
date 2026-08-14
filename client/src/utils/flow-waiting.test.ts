import { describe, expect, it } from 'vitest';
import { waitingForLabel } from './flow-waiting';

describe('waitingForLabel', () => {
  it('humanizes button waits', () => {
    expect(waitingForLabel('button')).toBe('Waiting for a button tap');
    expect(waitingForLabel('button', 'short')).toBe('Button');
  });

  it('humanizes form and delay waits', () => {
    expect(waitingForLabel('wa_flow')).toBe('Waiting for a WhatsApp Form');
    expect(waitingForLabel('delay', 'short')).toBe('Wait');
  });

  it('returns null when the bot is not waiting', () => {
    expect(waitingForLabel(null)).toBeNull();
    expect(waitingForLabel(undefined)).toBeNull();
  });
});
