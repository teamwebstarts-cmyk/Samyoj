import { describe, expect, it } from 'vitest';
import { buildCallSignalingPayload } from './signaling-response';

describe('buildCallSignalingPayload', () => {
  it('returns SDP from pending signaling', () => {
    expect(
      buildCallSignalingPayload({
        callId: 'c1',
        status: 'CONNECTING',
        pending: { sdpOffer: 'offer', sdpAnswer: 'answer', metaCallId: 'm1' },
      })
    ).toEqual({
      callId: 'c1',
      sdpOffer: 'offer',
      sdpAnswer: 'answer',
      metaCallId: 'm1',
      ended: false,
    });
  });

  it('marks ended calls so the browser stops polling', () => {
    expect(
      buildCallSignalingPayload({
        callId: 'c1',
        status: 'TERMINATED',
        pending: null,
      }).ended
    ).toBe(true);
  });

  it('keeps polling while the call is still live but Redis has no answer yet', () => {
    expect(
      buildCallSignalingPayload({
        callId: 'c1',
        status: 'RINGING',
        pending: null,
      })
    ).toMatchObject({ ended: false, sdpAnswer: null });
  });
});
