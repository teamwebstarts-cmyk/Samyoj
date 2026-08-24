import { describe, expect, it, beforeEach, vi } from 'vitest';

/* ── Mock dependencies ──────────────────────────────────────────────── */

vi.mock('../../config', () => ({
  config: {
    sarvam: { apiKey: 'test-sarvam-key', chatEndpoint: 'https://api.sarvam.ai/v1', chatModel: 'sarvam-105b' },
    azure: { endpoint: '', apiKey: '', deployment: 'gpt-35-turbo', apiVersion: '2024-12-01-preview' },
    ai: { brainProvider: 'sarvam' },
  },
}));

vi.mock('../../config/database', () => ({
  default: {
    organization: { findUnique: vi.fn() },
    aiUsageLog: { aggregate: vi.fn(), create: vi.fn() },
  },
}));

vi.mock('./org-ai.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./org-ai.service')>();
  return {
    ...actual,
    isAiConfiguredForOrg: vi.fn(),
    resolveAiConfig: vi.fn(),
    checkOrgTokenQuota: vi.fn().mockResolvedValue(undefined),
    recordAiUsage: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock('./sarvam-chat.service', () => ({
  createSarvamChatCompletion: vi.fn(),
  streamSarvamChatCompletion: vi.fn(),
}));

vi.mock('../billing/ai-credits/service', () => ({
  assertAiCreditsAvailable: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../utils/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  createModuleLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

/* ── Imports (after mocks) ───────────────────────────────────────────── */

import { isAiConfigured, createChatCompletion } from './chat-completion.service';
import { isAiConfiguredForOrg, resolveAiConfig, checkOrgTokenQuota } from './org-ai.service';
import { createSarvamChatCompletion } from './sarvam-chat.service';

/* ── isAiConfigured ─────────────────────────────────────────────────── */

describe('isAiConfigured', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns true when org has AI config', async () => {
    (isAiConfiguredForOrg as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    await expect(isAiConfigured('org-1')).resolves.toBe(true);
    expect(isAiConfiguredForOrg).toHaveBeenCalledWith('org-1');
  });

  it('returns false when org has no AI config', async () => {
    (isAiConfiguredForOrg as ReturnType<typeof vi.fn>).mockResolvedValue(false);
    await expect(isAiConfigured('org-1')).resolves.toBe(false);
  });

  it('falls back to platform config when no orgId', async () => {
    // The mock config has sarvam.apiKey set, so it should be truthy
    await expect(isAiConfigured()).resolves.toBe(true);
  });
});

/* ── createChatCompletion ───────────────────────────────────────────── */

describe('createChatCompletion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (checkOrgTokenQuota as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
  });

  it('throws 503 when organizationId is missing', async () => {
    await expect(
      createChatCompletion({ messages: [{ role: 'user', content: 'hi' }] })
    ).rejects.toThrow(/organization context required/i);
  });

  it('throws 503 when no AI config is resolved', async () => {
    (resolveAiConfig as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await expect(
      createChatCompletion({
        messages: [{ role: 'user', content: 'hi' }],
        organizationId: 'org-1',
      })
    ).rejects.toThrow(/no ai brain configured/i);
  });

  it('routes to Sarvam when provider is sarvam', async () => {
    const sarvamConfig = {
      provider: 'sarvam' as const,
      endpoint: 'https://api.sarvam.ai/v1',
      apiKey: 'sk-test',
      deployment: 'sarvam-105b',
      embeddingEndpoint: '',
      embeddingApiKey: '',
      embeddingDeployment: 'text-embedding-ada-002',
      apiVersion: '2024-12-01-preview',
      source: 'global' as const,
    };
    (resolveAiConfig as ReturnType<typeof vi.fn>).mockResolvedValue(sarvamConfig);
    (createSarvamChatCompletion as ReturnType<typeof vi.fn>).mockResolvedValue({
      content: 'Hello!',
      finishReason: 'stop',
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      provider: 'sarvam',
    });

    const result = await createChatCompletion({
      messages: [{ role: 'user', content: 'hi' }],
      organizationId: 'org-1',
    });

    expect(result.content).toBe('Hello!');
    expect(result.provider).toBe('sarvam');
    expect(createSarvamChatCompletion).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: 'https://api.sarvam.ai/v1',
        apiKey: 'sk-test',
      })
    );
  });

  it('falls back to Azure when provider is azure', async () => {
    const azureConfig = {
      provider: 'azure' as const,
      endpoint: 'https://my-openai.openai.azure.com',
      apiKey: 'azure-key',
      deployment: 'gpt-35-turbo',
      embeddingEndpoint: 'https://my-openai.openai.azure.com',
      embeddingApiKey: 'azure-key',
      embeddingDeployment: 'text-embedding-ada-002',
      apiVersion: '2024-12-01-preview',
      source: 'global' as const,
    };
    (resolveAiConfig as ReturnType<typeof vi.fn>).mockResolvedValue(azureConfig);

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: 'Azure reply' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 8, completion_tokens: 4, total_tokens: 12 },
        }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await createChatCompletion({
      messages: [{ role: 'user', content: 'hi' }],
      organizationId: 'org-1',
    });

    expect(result.content).toBe('Azure reply');
    expect(result.provider).toBe('azure');
    vi.unstubAllGlobals();
  });

  it('throws on Azure empty response', async () => {
    const azureConfig = {
      provider: 'azure' as const,
      endpoint: 'https://my-openai.openai.azure.com',
      apiKey: 'azure-key',
      deployment: 'gpt-35-turbo',
      embeddingEndpoint: '',
      embeddingApiKey: '',
      embeddingDeployment: 'text-embedding-ada-002',
      apiVersion: '2024-12-01-preview',
      source: 'global' as const,
    };
    (resolveAiConfig as ReturnType<typeof vi.fn>).mockResolvedValue(azureConfig);

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [{ message: { content: '' }, finish_reason: 'stop' }],
          }),
      })
    );

    await expect(
      createChatCompletion({
        messages: [{ role: 'user', content: 'hi' }],
        organizationId: 'org-1',
      })
    ).rejects.toThrow(/empty response/i);

    vi.unstubAllGlobals();
  });

  it('checks token quota before making request', async () => {
    (resolveAiConfig as ReturnType<typeof vi.fn>).mockResolvedValue({
      provider: 'sarvam' as const,
      endpoint: 'https://api.sarvam.ai/v1',
      apiKey: 'sk-test',
      deployment: 'sarvam-105b',
      embeddingEndpoint: '',
      embeddingApiKey: '',
      embeddingDeployment: 'text-embedding-ada-002',
      apiVersion: '2024-12-01-preview',
      source: 'global' as const,
    });
    (createSarvamChatCompletion as ReturnType<typeof vi.fn>).mockResolvedValue({
      content: 'ok',
      finishReason: 'stop',
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
      provider: 'sarvam',
    });

    await createChatCompletion({
      messages: [{ role: 'user', content: 'hi' }],
      organizationId: 'org-1',
    });

    expect(checkOrgTokenQuota).toHaveBeenCalledWith('org-1');
  });

  it('propagates quota exceeded error', async () => {
    (checkOrgTokenQuota as ReturnType<typeof vi.fn>).mockRejectedValue(
      new (await import('../../errors')).AppError(429, 'Monthly AI token limit reached for your organization')
    );

    await expect(
      createChatCompletion({
        messages: [{ role: 'user', content: 'hi' }],
        organizationId: 'org-1',
      })
    ).rejects.toThrow(/token limit/i);
  });
});
