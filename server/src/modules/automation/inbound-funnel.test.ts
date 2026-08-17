import { describe, expect, it } from 'vitest';
import { FLOW_LOCK_BUSY } from '../flows/inbound-wait';
import { decideInboundFunnel } from './inbound-funnel';

describe('decideInboundFunnel', () => {
  it('skips journeys, auto-replies, and AI when Inbox paused the bot', () => {
    expect(decideInboundFunnel({ botActive: false, flowHandled: false })).toEqual({
      type: 'skip',
      reason: 'paused',
    });
  });

  it('requeues on lock busy instead of falling through to AI', () => {
    expect(
      decideInboundFunnel({ botActive: true, flowHandled: FLOW_LOCK_BUSY, lockRetry: 0 })
    ).toEqual({ type: 'requeue' });
  });

  it('gives up lock requeue after max attempts', () => {
    expect(
      decideInboundFunnel({ botActive: true, flowHandled: FLOW_LOCK_BUSY, lockRetry: 8 })
    ).toEqual({ type: 'skip', reason: 'lock_giveup' });
  });

  it('stops after a flow handled the inbound', () => {
    expect(decideInboundFunnel({ botActive: true, flowHandled: true })).toEqual({ type: 'flow_done' });
  });

  it('continues to support replies even when the contact opted out of marketing', () => {
    expect(decideInboundFunnel({ botActive: true, flowHandled: false, optedIn: false })).toEqual({
      type: 'continue_static',
    });
  });

  it('continues to static auto-replies when no flow matched', () => {
    expect(decideInboundFunnel({ botActive: true, flowHandled: false, optedIn: true })).toEqual({
      type: 'continue_static',
    });
  });
});
