import { describe, expect, it } from 'vitest';
import { canApplyRemoteAnswer } from './webrtcSignaling';

describe('canApplyRemoteAnswer', () => {
  it('rejects a second answer once the peer is already stable', () => {
    expect(canApplyRemoteAnswer('stable', false)).toBe(false);
    expect(canApplyRemoteAnswer('have-local-offer', true)).toBe(false);
  });

  it('accepts the first Meta answer while we still have a local offer', () => {
    expect(canApplyRemoteAnswer('have-local-offer', false)).toBe(true);
    expect(canApplyRemoteAnswer('have-remote-pranswer', false)).toBe(true);
  });
});
