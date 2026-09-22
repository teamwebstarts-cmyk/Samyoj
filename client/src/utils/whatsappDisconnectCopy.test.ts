import { describe, expect, it } from 'vitest';
import { isCoexistenceLinkedNumber, whatsappDisconnectDialogCopy } from './whatsappDisconnectCopy';

describe('whatsappDisconnectDialogCopy', () => {
  it('uses coexistence copy when the number is on the Business app', () => {
    const copy = whatsappDisconnectDialogCopy({ isOnBizApp: true, coexistenceStatus: 'active' });
    expect(copy.description).toMatch(/Business app on the phone/i);
    expect(copy.details.join(' ')).toMatch(/Meta Business settings/i);
  });

  it('uses standard copy for Cloud-only numbers', () => {
    const copy = whatsappDisconnectDialogCopy({ isOnBizApp: false, coexistenceStatus: null });
    expect(copy.details.join(' ')).toMatch(/Sending from Samyoj/i);
    expect(copy.description).not.toMatch(/portfolio/i);
  });

  it('treats offboarded coexistence as standard', () => {
    expect(
      isCoexistenceLinkedNumber({ isOnBizApp: true, coexistenceStatus: 'offboarded' })
    ).toBe(false);
  });
});
