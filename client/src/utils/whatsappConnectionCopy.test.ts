import { describe, expect, it } from 'vitest';
import { whatsappNotConnectedCopy } from './whatsappConnectionCopy';

describe('whatsappNotConnectedCopy', () => {
  it('explains a disconnected number instead of a first-time connect', () => {
    const copy = whatsappNotConnectedCopy(
      [{ phoneNumber: '15551977746' }],
      { task: 'send templates' }
    );
    expect(copy.disconnected).toBe(true);
    expect(copy.title.toLowerCase()).toMatch(/disconnected/);
    expect(copy.cta).toMatch(/Reconnect/i);
    expect(copy.description.toLowerCase()).toMatch(/send templates/);
  });
});
