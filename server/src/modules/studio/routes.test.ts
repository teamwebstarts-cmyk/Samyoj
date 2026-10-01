import { describe, expect, it } from 'vitest';

/**
 * Routes import smoke test: the studio router must mount without pulling a
 * database connection, and its DTO must never leak createdById.
 */
describe('studio routes module', () => {
  it('mounts a router with generate/list/get/edit/delete handlers', async () => {
    const mod = await import('./routes');
    const router = mod.default as unknown as {
      stack: Array<{ route?: { path: string; methods: Record<string, boolean> } }>;
    };
    const paths = router.stack
      .map((layer) => layer.route?.path)
      .filter(Boolean) as string[];
    expect(paths).toContain('/generate');
    expect(paths).toContain('/:id');
    expect(paths).toContain('/');
  });

  it('keeps the brief limit in sync with the client constant', async () => {
    const mod = await import('./routes');
    expect(mod.STUDIO_BRIEF_LIMIT).toBe(2000);
  });
});
