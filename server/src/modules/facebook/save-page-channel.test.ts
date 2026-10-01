import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { saveFacebookPageChannel, saveLinkedInstagramChannel } from './save-page-channel';
import prisma from '../../config/database';

vi.mock('../../config/database', () => ({
  default: {
    channel: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    organization: {
      findUnique: vi.fn().mockResolvedValue({ settings: {} }),
      update: vi.fn().mockResolvedValue({}),
    },
  },
}));

vi.mock('../whatsapp/meta.service', () => ({
  MetaWhatsAppService: {
    encryptToken: (t: string) => `enc:${t}`,
  },
}));

vi.mock('./page-client', () => ({
  fetchPageInstagramAccount: vi.fn().mockResolvedValue(null),
  subscribePageToLeadgen: vi.fn().mockResolvedValue(undefined),
  subscribeInstagramAccount: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../config/redis', () => ({
  default: () => ({
    set: vi.fn().mockResolvedValue('OK'),
    get: vi.fn().mockResolvedValue(null),
    del: vi.fn().mockResolvedValue(1),
  }),
}));

const channelMock = vi.mocked(prisma.channel);

describe('saveFacebookPageChannel', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('rejects a Page already active in another organization without stealing it', async () => {
    channelMock.findFirst
      .mockResolvedValueOnce({ id: 'ch-other', organizationId: 'org-a' } as never);
    channelMock.create.mockResolvedValue({
      id: 'ch-new',
      organizationId: 'org-b',
      platformAccountId: 'page_1',
    } as never);

    await expect(saveFacebookPageChannel({
      organizationId: 'org-b',
      pageId: 'page_1',
      pageName: 'Acme',
      pageAccessToken: 'page-tok',
    })).rejects.toMatchObject({ statusCode: 409 });
    expect(channelMock.create).not.toHaveBeenCalled();
    expect(channelMock.update).not.toHaveBeenCalled();
    expect(channelMock.updateMany).not.toHaveBeenCalled();
  });

  it('rejects a linked Instagram account already active in another organization', async () => {
    const { fetchPageInstagramAccount } = await import('./page-client');
    vi.mocked(fetchPageInstagramAccount).mockResolvedValueOnce({
      id: 'ig_1',
      username: 'acme',
    });
    channelMock.findFirst.mockResolvedValueOnce({ id: 'ch-other', organizationId: 'org-a' } as never);

    await expect(
      saveLinkedInstagramChannel({
        organizationId: 'org-b',
        pageId: 'page_1',
        pageAccessToken: 'page-tok',
      })
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(channelMock.create).not.toHaveBeenCalled();
    expect(channelMock.update).not.toHaveBeenCalled();
    expect(channelMock.updateMany).not.toHaveBeenCalled();
  });

  it('does not hide a linked Instagram ownership conflict behind a successful Page connect', async () => {
    const { fetchPageInstagramAccount } = await import('./page-client');
    vi.mocked(fetchPageInstagramAccount).mockResolvedValueOnce({
      id: 'ig_1',
      username: 'acme',
    });
    channelMock.findFirst
      .mockResolvedValueOnce(null as never)
      .mockResolvedValueOnce(null as never)
      .mockResolvedValueOnce({ id: 'ch-ig-other', organizationId: 'org-a' } as never);
    channelMock.create.mockResolvedValue({
      id: 'ch-fb-new',
      organizationId: 'org-b',
      platformAccountId: 'page_1',
    } as never);
    channelMock.updateMany.mockResolvedValue({ count: 0 } as never);

    await expect(saveFacebookPageChannel({
      organizationId: 'org-b',
      pageId: 'page_1',
      pageName: 'Acme',
      pageAccessToken: 'page-tok',
    })).rejects.toMatchObject({ statusCode: 409 });
  });

  it('disconnecting a Page also soft-disconnects this org Instagram channel', async () => {
    const { disconnectFacebookPageChannel } = await import('./save-page-channel');
    channelMock.findFirst.mockResolvedValue({
      id: 'ch-fb',
      organizationId: 'org-b',
      platform: 'FB',
      platformAccountId: 'page_1',
    } as never);
    channelMock.update.mockResolvedValue({} as never);
    channelMock.updateMany.mockResolvedValue({ count: 1 } as never);
    await disconnectFacebookPageChannel('org-b', 'ch-fb');
    expect(channelMock.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId: 'org-b',
          platform: 'IG',
          parentPageId: 'page_1',
          isActive: true,
        },
        data: { isActive: false },
      })
    );
    expect(prisma.organization.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          settings: expect.objectContaining({
            meta: expect.not.objectContaining({ adsReadToken: expect.anything() }),
          }),
        }),
      })
    );
  });

  it('stores the encrypted user token for Ads read', async () => {
    channelMock.findFirst.mockResolvedValue(null as never);
    channelMock.create.mockResolvedValue({
      id: 'ch-fb-new',
      organizationId: 'org-b',
      platformAccountId: 'page_1',
    } as never);
    channelMock.updateMany.mockResolvedValue({ count: 0 } as never);

    await saveFacebookPageChannel({
      organizationId: 'org-b',
      pageId: 'page_1',
      pageName: 'Acme',
      pageAccessToken: 'page-tok',
      userAccessToken: 'user-tok',
    });

    expect(prisma.organization.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          settings: expect.objectContaining({
            meta: expect.objectContaining({ adsReadToken: 'enc:user-tok' }),
          }),
        }),
      })
    );
  });

  it('stores the parent Page when linking Instagram', async () => {
    const { fetchPageInstagramAccount } = await import('./page-client');
    vi.mocked(fetchPageInstagramAccount).mockResolvedValueOnce({
      id: 'ig_1',
      username: 'acme',
    });
    channelMock.findFirst
      .mockResolvedValueOnce(null as never)
      .mockResolvedValueOnce(null as never);
    channelMock.create.mockResolvedValue({
      id: 'ch-ig',
      organizationId: 'org-b',
      platform: 'IG',
      platformAccountId: 'ig_1',
      parentPageId: 'page_1',
    } as never);
    channelMock.updateMany.mockResolvedValue({ count: 0 } as never);

    await expect(saveLinkedInstagramChannel({
      organizationId: 'org-b',
      pageId: 'page_1',
      pageAccessToken: 'page-tok',
    })).resolves.toMatchObject({ channelId: 'ch-ig', igUserId: 'ig_1' });

    expect(channelMock.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        platform: 'IG',
        platformAccountId: 'ig_1',
        parentPageId: 'page_1',
      }),
    });
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
