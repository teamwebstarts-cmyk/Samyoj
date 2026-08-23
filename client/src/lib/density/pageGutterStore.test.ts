import { describe, expect, it } from 'vitest';
import {
  PAGE_GUTTER,
  defaultPageGutterForDensity,
  isPageGutterStep,
} from './pageGutterStore';

describe('page gutter', () => {
  it('defaults to step 4 (4rem) for all densities', () => {
    expect(PAGE_GUTTER[4]).toBe('4rem');
    expect(defaultPageGutterForDensity('comfortable')).toBe(4);
    expect(defaultPageGutterForDensity('compact')).toBe(4);
  });

  it('accepts 1–7 including much-wider steps', () => {
    expect(isPageGutterStep(3)).toBe(true);
    expect(isPageGutterStep(7)).toBe(true);
    expect(PAGE_GUTTER[7]).toBe('10rem');
    expect(isPageGutterStep(0)).toBe(false);
    expect(isPageGutterStep(8)).toBe(false);
  });
});
