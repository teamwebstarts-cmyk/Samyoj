import { describe, expect, it } from 'vitest';
import { ROOT_META, routeMetaForTest } from './Topbar-route-meta';

describe('admin topbar routeMeta', () => {
  it('maps every nav root to a title', () => {
    for (const root of ['/', '/accounts', '/billing', '/library', '/errors', '/outreach', '/operators', '/audit']) {
      expect(routeMetaForTest(root).title).toBeTruthy();
      expect(ROOT_META[root]).toBeDefined();
    }
  });

  it('nests library wizard and account detail under their nav roots', () => {
    expect(routeMetaForTest('/library/new')).toMatchObject({ root: 'Templates', title: 'New template', detail: null });
    expect(routeMetaForTest('/library/abc123/edit')).toMatchObject({ root: 'Templates', title: 'Edit template', detail: 'abc123' });
    expect(routeMetaForTest('/accounts/org-9')).toMatchObject({ root: 'Organizations', title: 'Account', detail: 'org-9' });
  });

  it('falls back to Console for unknown roots', () => {
    expect(routeMetaForTest('/nope')).toMatchObject({ title: 'Console', detail: null });
  });
});
