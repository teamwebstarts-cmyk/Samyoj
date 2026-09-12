import { describe, expect, it } from 'vitest';
import { financialYearFor, taxBreakdown, validateGstin } from './invoice.service';
import { calculateUpgradeProration } from './subscription.service';

describe('production billing invariants', () => {
  it('keeps GST-inclusive totals and splits intra-state tax', () => {
    expect(
      taxBreakdown({
        totalPaise: 11800,
        taxablePaise: 10000,
        supplierStateCode: '27',
        recipientStateCode: '27',
      })
    ).toEqual({ cgstPaise: 900, sgstPaise: 900, igstPaise: 0 });
    expect(
      taxBreakdown({
        totalPaise: 11800,
        taxablePaise: 10000,
        supplierStateCode: '27',
        recipientStateCode: '29',
      })
    ).toEqual({ cgstPaise: 0, sgstPaise: 0, igstPaise: 1800 });
  });

  it('validates GSTIN and uses Indian financial years', () => {
    expect(validateGstin('27ABCDE1234F1Z5')).toBe('27ABCDE1234F1Z5');
    expect(() => validateGstin('not-a-gstin')).toThrowError(/GSTIN/);
    expect(financialYearFor(new Date('2026-03-31T18:30:00.000Z'))).toBe('2026-27');
    expect(financialYearFor(new Date('2026-03-31T17:00:00.000Z'))).toBe('2025-26');
  });

  it('calculates a non-negative upgrade debit after unused credit', () => {
    expect(
      calculateUpgradeProration({
        remainingDays: 15,
        currentPeriodDays: 30,
        currentAmountPaise: 11800,
        newPeriodDays: 30,
        newAmountPaise: 23600,
      })
    ).toEqual({ remainingDays: 15, unusedCredit: 5900, newDebit: 11800, netPaise: 5900 });
  });
});
