import { describe, expect, it } from 'vitest';
import { chooseConnectPhone } from './connect-phone';

const phones = [
  { wabaId: 'w1', phoneNumberId: 'p1' },
  { wabaId: 'w1', phoneNumberId: 'p2' },
  { wabaId: 'w2', phoneNumberId: 'p3' },
];

describe('chooseConnectPhone', () => {
  it('saves the number Embedded Signup already finished', () => {
    expect(chooseConnectPhone(phones, { wabaId: 'w1', phoneNumberId: 'p2' })).toEqual({
      chosen: phones[1],
      options: [],
    });
  });

  it('does not ask again when the account has one number', () => {
    expect(chooseConnectPhone([phones[2]], {})).toEqual({
      chosen: phones[2],
      options: [],
    });
  });

  it('asks only when Meta did not say which number', () => {
    const result = chooseConnectPhone(phones, { wabaId: 'w1' });
    expect(result.chosen).toBeNull();
    expect(result.options.map((phone) => phone.phoneNumberId)).toEqual(['p1', 'p2']);
  });
});
