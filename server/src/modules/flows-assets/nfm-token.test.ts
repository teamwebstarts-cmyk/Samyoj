import { describe, expect, it } from 'vitest';
import { mintNfmFlowToken, parseNfmFlowToken } from './nfm-token';

const SECRET = 'nfm-unit-test-secret';

describe('nfm flow tokens', () => {
  it('round-trips a signed token', () => {
    const token = mintNfmFlowToken({ conversationId: 'conv-1', nodeId: 'form-step' }, SECRET);
    const claims = parseNfmFlowToken(token, { secret: SECRET });
    expect(claims).toEqual(
      expect.objectContaining({
        conversationId: 'conv-1',
        nodeId: 'form-step',
      })
    );
    expect(claims?.nonce).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });

  it('rejects unsigned legacy conversationId:nodeId:uuid tokens', () => {
    expect(parseNfmFlowToken('conv-1:form-step:token', { secret: SECRET })).toBeNull();
  });

  it('rejects a forged signature', () => {
    const token = mintNfmFlowToken({ conversationId: 'conv-1', nodeId: 'form-step' }, SECRET);
    const tampered = `${token.slice(0, -2)}aa`;
    expect(parseNfmFlowToken(tampered, { secret: SECRET })).toBeNull();
  });

  it('rejects an expired token', () => {
    const token = mintNfmFlowToken(
      { conversationId: 'conv-1', nodeId: 'form-step', now: new Date('2020-01-01T00:00:00Z') },
      SECRET
    );
    expect(
      parseNfmFlowToken(token, { secret: SECRET, now: new Date('2020-01-03T00:00:00Z') })
    ).toBeNull();
  });
});
