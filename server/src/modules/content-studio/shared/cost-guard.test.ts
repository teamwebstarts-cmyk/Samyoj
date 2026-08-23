import { describe, expect, it } from 'vitest';
import { resolveContentStudioPlan } from './cost-guard';

describe('resolveContentStudioPlan', () => {
  it('maps legacy business to pro', () => {
    expect(resolveContentStudioPlan('business')).toBe('pro');
  });

  it('keeps current catalog ids', () => {
    expect(resolveContentStudioPlan('launch')).toBe('launch');
    expect(resolveContentStudioPlan('starter')).toBe('starter');
    expect(resolveContentStudioPlan('growth')).toBe('growth');
    expect(resolveContentStudioPlan('pro')).toBe('pro');
    expect(resolveContentStudioPlan('enterprise')).toBe('enterprise');
  });

  it('falls back to starter for unknown or empty plans', () => {
    expect(resolveContentStudioPlan(null)).toBe('starter');
    expect(resolveContentStudioPlan('gold')).toBe('starter');
  });
});
