import { describe, expect, it } from 'vitest';
import { isPlatformAdminHost } from './admin-host';

describe('platform admin host serving', () => {
  it('matches admin.samyoj.com in production and not the customer app host', () => {
    expect(
      isPlatformAdminHost('admin.samyoj.com', 'https://admin.samyoj.com')
    ).toBe(true);
    expect(
      isPlatformAdminHost('app.samyoj.com', 'https://admin.samyoj.com')
    ).toBe(false);
  });

  it('does not serve admin from API localhost:8000 during local Vite :3001', () => {
    expect(
      isPlatformAdminHost('localhost:8000', 'http://localhost:3001')
    ).toBe(false);
    expect(
      isPlatformAdminHost('localhost:3001', 'http://localhost:3001')
    ).toBe(true);
  });
});
