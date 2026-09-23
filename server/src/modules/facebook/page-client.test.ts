import { describe, expect, it } from 'vitest';
import { mapManagedPages } from './page-client';

describe('mapManagedPages', () => {
  it('uses /me/accounts when Page tokens are present', () => {
    const pages = mapManagedPages(
      [{ id: 'p1', name: 'Shop', access_token: 'page-token' }],
      { id: 'user1', name: 'Ada' },
      'user-token'
    );
    expect(pages).toEqual([{ id: 'p1', name: 'Shop', accessToken: 'page-token' }]);
  });

  it('treats /me as the Page when Facebook returned a Page token', () => {
    const pages = mapManagedPages(
      [],
      { id: 'page99', name: 'Samyoj Page', metadata: { type: 'page' } },
      'already-page-token'
    );
    expect(pages).toEqual([
      { id: 'page99', name: 'Samyoj Page', accessToken: 'already-page-token' },
    ]);
  });

  it('stays empty when the user has no Page', () => {
    expect(mapManagedPages([], { id: 'user1', name: 'Ada' }, 'user-token')).toEqual([]);
  });
});
