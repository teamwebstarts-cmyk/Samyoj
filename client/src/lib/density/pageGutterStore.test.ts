import { describe, expect, it } from 'vitest';
import {
  PAGE_GUTTER,
  defaultPageGutterForDensity,
  isPageGutterStep,
} from './pageGutterStore';

describe('page gutter', () => {
  it('defaults wider than the old lg:px-6 (1.5rem)', () => {
    expect(PAGE_GUTTER[3]).toBe('2.5rem');
    expect(defaultPageGutterForDensity('comfortable')).toBe(3);
    expect(defaultPageGutterForDensity('compact')).toBe(2);
  });

  it('accepts 1–7 including much-wider steps', () => {
    expect(isPageGutterStep(3)).toBe(true);
    expect(isPageGutterStep(7)).toBe(true);
    expect(PAGE_GUTTER[7]).toBe('10rem');
    expect(isPageGutterStep(0)).toBe(false);
    expect(isPageGutterStep(8)).toBe(false);
  });
});
