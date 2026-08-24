import { describe, it, expect } from 'vitest';
import { computeDeductionSplit } from './service';
import { tokensToChatCredits, callingSecondsToMinutes } from './catalog';
import { includedLimitForPlan } from './service';

describe('ai-credits deduction', () => {
  it('deduction-order-ok: uses included allowance before add-on balance', () => {
    const next = computeDeductionSplit({
      includedLimit: 5000,
      includedUsed: 4999,
      addonBalance: 100,
      amount: 1,
    });
    expect(next).toEqual({ includedUsed: 5000, addonBalance: 100 });
    console.log('deduction-order-ok');
  });

  it('deduction-order-ok: spills into add-on when included is exhausted', () => {
    const next = computeDeductionSplit({
      includedLimit: 5000,
      includedUsed: 5000,
      addonBalance: 5,
      amount: 1,
    });
    expect(next).toEqual({ includedUsed: 5000, addonBalance: 4 });
  });

  it('returns null when total balance is insufficient', () => {
    const next = computeDeductionSplit({
      includedLimit: 5000,
      includedUsed: 5000,
      addonBalance: 0,
      amount: 1,
    });
    expect(next).toBeNull();
  });
});

describe('ai-credits renewal', () => {
  it('renewal-reset-ok: included used resets while add-on balance stays', () => {
    const afterRenewal = computeDeductionSplit({
      includedLimit: 5000,
      includedUsed: 0,
      addonBalance: 250,
      amount: 100,
    });
    expect(afterRenewal).toEqual({ includedUsed: 100, addonBalance: 250 });
    console.log('renewal-reset-ok');
  });
});

describe('ai-credits topup stack', () => {
  it('topup-stack-ok: stacked add-on balance survives included exhaustion', () => {
    const stackedAddon = 1000 + 5000 + 1000;
    const next = computeDeductionSplit({
      includedLimit: 5000,
      includedUsed: 5000,
      addonBalance: stackedAddon,
      amount: 6001,
    });
    expect(next).toEqual({ includedUsed: 5000, addonBalance: 999 });
    console.log('topup-stack-ok');
  });
});

describe('ai-credits catalog helpers', () => {
  it('maps average reply to one chat credit', () => {
    expect(tokensToChatCredits(200, 50)).toBe(1);
  });

  it('calling-minutes-deducted: rounds up to whole minutes', () => {
    expect(callingSecondsToMinutes(95)).toBe(2);
  });

  it('balances-ok: growth plan includes 5000 chat credits', () => {
    expect(includedLimitForPlan('growth', 'chat')).toBe(5000);
    expect(includedLimitForPlan('pro', 'calling')).toBe(120);
  });
});
