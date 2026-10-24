import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('admin in-release honesty', () => {
  it('shows flagsCatalog on the account file outside the SUPPORT write drawer', () => {
    const page = readFileSync(join(__dirname, '../pages/AccountDetailPage.tsx'), 'utf8');
    expect(page).toContain('Feature flags');
    expect(page.indexOf('detail.flagsCatalog.map')).toBeLessThan(page.indexOf("drawer === 'flags'"));
  });

  it('uses coverageNote on the AI tab instead of implying STT/TTS is fully logged', () => {
    const page = readFileSync(join(__dirname, '../pages/AccountDetailPage.tsx'), 'utf8');
    expect(page).toContain('detail.ai.coverageNote');
  });

  it('does not invent 131048 or AI-429 queues on Overview', () => {
    const page = readFileSync(join(__dirname, '../pages/OverviewPage.tsx'), 'utf8');
    expect(page).not.toMatch(/AI-429|131048 spike/);
    expect(page).toContain('topAiOrgs');
  });

  it('does not claim Meta pre-approval for the platform template library', () => {
    // Copy is shared by the catalog tooltip and the editor preview (library-catalog.ts).
    const shared = readFileSync(join(__dirname, 'library-catalog.ts'), 'utf8');
    expect(shared).toContain('cannot pre-approve');
    expect(shared).not.toMatch(/already approved on Meta|skip Meta review/i);
  });
});
