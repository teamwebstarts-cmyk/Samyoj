import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { config } from '../../config';
import prisma from '../../config/database';
import {
  ORG_META_CREDENTIALS_LOCKED_MESSAGE,
  rejectOrgMetaConfigWrite,
  resolveMetaCredentials,
  sanitizeMetaSettingsForClient,
  saveOrgMetaSettings,
  stripLeftoverOrgMetaCredentials,
} from './org-meta.service';

vi.mock('../../config/database', () => ({
  default: {
    organization: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

const organizationMock = vi.mocked(prisma.organization);
const originalMeta = {
  appId: config.meta.appId,
  appSecret: config.meta.appSecret,
};

function mockOrgMeta(meta: Record<string, unknown> = {}) {
  organizationMock.findUnique.mockResolvedValue({
    settings: { meta },
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  config.meta.appId = '';
  config.meta.appSecret = '';
});

afterEach(() => {
  config.meta.appId = originalMeta.appId;
  config.meta.appSecret = originalMeta.appSecret;
});

describe('sanitizeMetaSettingsForClient', () => {
  it('never returns appId, appSecret, or encrypted secret material', () => {
    config.meta.appId = '111111111111';
    config.meta.appSecret = 'platform-secret';

    const payload = sanitizeMetaSettingsForClient({
      appId: '999999999999',
      appSecret: 'plaintext-org-secret',
      appSecretEncrypted: 'iv:tag:ciphertext',
    });

    expect(payload).toEqual({
      hasAppSecret: true,
      configured: true,
      usingPlatform: true,
    });
    expect(payload).not.toHaveProperty('appId');
    expect(payload).not.toHaveProperty('appSecret');
    expect(payload).not.toHaveProperty('appSecretEncrypted');
    expect(JSON.stringify(payload)).not.toContain('999999999999');
    expect(JSON.stringify(payload)).not.toContain('plaintext-org-secret');
    expect(JSON.stringify(payload)).not.toContain('ciphertext');
    expect(JSON.stringify(payload)).not.toContain('platform-secret');
  });

  it('reports configured without exposing credentials when only org override exists', () => {
    const payload = sanitizeMetaSettingsForClient({
      appId: '999999999999',
      appSecretEncrypted: 'iv:tag:ciphertext',
    });

    expect(payload).toEqual({
      hasAppSecret: true,
      configured: true,
      usingPlatform: false,
    });
    expect(payload).not.toHaveProperty('appId');
  });
});

describe('org meta-config writes', () => {
  it('fails closed with 410 Gone and does not touch the database', async () => {
    try {
      rejectOrgMetaConfigWrite();
      throw new Error('expected 410 Gone');
    } catch (err) {
      expect(err).toMatchObject({
        statusCode: 410,
        message: ORG_META_CREDENTIALS_LOCKED_MESSAGE,
      });
    }

    await expect(
      saveOrgMetaSettings('org-1', { appId: '1234567890', appSecret: 'org-secret' })
    ).rejects.toMatchObject({
      statusCode: 410,
      message: ORG_META_CREDENTIALS_LOCKED_MESSAGE,
    });
    await expect(saveOrgMetaSettings('org-1', {})).rejects.toMatchObject({
      statusCode: 410,
    });
    expect(organizationMock.findUnique).not.toHaveBeenCalled();
    expect(organizationMock.update).not.toHaveBeenCalled();
  });
});

describe('resolveMetaCredentials', () => {
  it('prefers platform env over a leftover org override', async () => {
    config.meta.appId = '111111111111';
    config.meta.appSecret = 'platform-secret';
    mockOrgMeta({ appId: '999999999999', appSecret: 'org-secret' });

    await expect(resolveMetaCredentials('org-1')).resolves.toEqual({
      appId: '111111111111',
      appSecret: 'platform-secret',
    });
    expect(organizationMock.findUnique).not.toHaveBeenCalled();
  });

  it('falls back to org credentials only when platform env is missing', async () => {
    mockOrgMeta({ appId: '999999999999', appSecret: 'org-secret' });

    await expect(resolveMetaCredentials('org-1')).resolves.toEqual({
      appId: '999999999999',
      appSecret: 'org-secret',
    });
  });

  it('fails closed when neither platform nor org credentials exist', async () => {
    mockOrgMeta({});

    await expect(resolveMetaCredentials('org-1')).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining('META_APP_ID'),
    });
  });
});

describe('stripLeftoverOrgMetaCredentials', () => {
  it('removes leftover org App ID/Secret when platform env is set', async () => {
    config.meta.appId = '111111111111';
    config.meta.appSecret = 'platform-secret';
    organizationMock.findUnique.mockResolvedValue({
      settings: { timezone: 'Asia/Kolkata', meta: { appId: '999', appSecret: 'org-secret' } },
    } as never);
    organizationMock.update.mockResolvedValue({} as never);

    await expect(stripLeftoverOrgMetaCredentials('org-1')).resolves.toBe(true);
    expect(organizationMock.update).toHaveBeenCalledWith({
      where: { id: 'org-1' },
      data: { settings: { timezone: 'Asia/Kolkata' } },
    });
    const written = organizationMock.update.mock.calls[0][0].data.settings as Record<string, unknown>;
    expect(JSON.stringify(written)).not.toContain('org-secret');
    expect(JSON.stringify(written)).not.toContain('999');
  });

  it('does not delete leftover org secrets when platform env is missing', async () => {
    mockOrgMeta({ appId: '999', appSecret: 'org-secret' });

    await expect(stripLeftoverOrgMetaCredentials('org-1')).resolves.toBe(false);
    expect(organizationMock.update).not.toHaveBeenCalled();
  });

  it('is a no-op when there are no leftover org secrets', async () => {
    config.meta.appId = '111111111111';
    config.meta.appSecret = 'platform-secret';
    mockOrgMeta({});

    await expect(stripLeftoverOrgMetaCredentials('org-1')).resolves.toBe(false);
    expect(organizationMock.update).not.toHaveBeenCalled();
  });
});
