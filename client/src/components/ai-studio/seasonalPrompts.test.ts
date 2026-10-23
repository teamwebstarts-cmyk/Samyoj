import { describe, expect, it } from 'vitest';
import { buildSeasonalStudioBrief, getComposeStarterIds, getVisibleSeasonalPrompts } from './seasonalPrompts';

describe('getVisibleSeasonalPrompts', () => {
  it('includes Diwali during October', () => {
    const visible = getVisibleSeasonalPrompts(new Date('2026-10-23'));
    expect(visible.some((c) => c.id === 'season-diwali')).toBe(true);
  });

  it('includes Christmas when December is near', () => {
    const visible = getVisibleSeasonalPrompts(new Date('2026-11-05'));
    expect(visible.some((c) => c.id === 'season-christmas')).toBe(true);
  });
});

describe('getComposeStarterIds', () => {
  it('always returns four ids including a season in October', () => {
    const ids = getComposeStarterIds(new Date('2026-10-23'));
    expect(ids).toHaveLength(4);
    expect(ids.some((id) => id.startsWith('season-'))).toBe(true);
    expect(ids).toContain('flash');
  });
});

describe('buildSeasonalStudioBrief', () => {
  it('personalizes with company and value props', () => {
    const brief = buildSeasonalStudioBrief('season-diwali', {
      companyName: 'Glow Jaipur',
      valueProps: ['Vitamin C serum', 'Free consultation'],
    });
    expect(brief).toContain('Glow Jaipur');
    expect(brief).toContain('Vitamin C serum');
  });
});
