import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { saveFacebookPageChannel } from './save-page-channel';
import prisma from '../../config/database';

vi.mock('../../config/database', () => ({
  default: {
    channel: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

vi.mock('../whatsapp/meta.service', () => ({
  MetaWhatsAppService: {
    encryptToken: (t: string) => `enc:${t}`,
  },
}));

vi.mock('./page-client', () => ({
  subscribePageToLeadgen: vi.fn().mockResolvedValue(undefined),
}));

const channelMock = vi.mocked(prisma.channel);

describe('saveFacebookPageChannel', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('soft-deactivates other orgs active Channel for the same Page id', async () => {
    channelMock.findFirst.mockResolvedValue(null as never);
    channelMock.create.mockResolvedValue({
      id: 'ch-new',
      organizationId: 'org-b',
      platformAccountId: 'page_1',
    } as never);
    channelMock.updateMany.mockResolvedValue({ count: 1 } as never);

    await saveFacebookPageChannel({
      organizationId: 'org-b',
      pageId: 'page_1',
      pageName: 'Acme',
      pageAccessToken: 'page-tok',
    });

    expect(channelMock.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          platform: 'FB',
          platformAccountId: 'page_1',
          isActive: true,
          id: { not: 'ch-new' },
        }),
        data: { isActive: false },
      })
    );
  });
});

describe('page-client token transport', () => {
  it('uses Authorization Bearer and never puts access_token on the URL', () => {
    const src = readFileSync(join(__dirname, 'page-client.ts'), 'utf8');
    expect(src).toContain("Authorization: `Bearer ${accessToken}`");
    expect(src).not.toMatch(/access_token=\$\{encodeURIComponent/);
    expect(src).not.toMatch(/URLSearchParams\(\{[\s\S]*access_token: accessToken/);
  });
});

describe('facebook routes never select accessToken for API responses', () => {
  it('GET /page select list excludes accessToken', () => {
    const src = readFileSync(join(__dirname, 'routes.ts'), 'utf8');
    const pageHandler = src.slice(src.indexOf("'/page'"), src.indexOf("'/connect-url'"));
    expect(pageHandler).toContain('platformAccountId');
    expect(pageHandler).not.toContain('accessToken');
  });
});
