import prisma from '../../config/database';
import { config } from '../../config';
import { decrypt, encrypt } from '../../utils/crypto';
import { AppError } from '../../utils/response';
import type { OrgAiSettings, ResolvedAiConfig, TokenUsage, BrainProvider } from './types';

export function getDefaultEmbeddingDeployment(): string {
  // Azure embeddings still needed — Sarvam has no vector API
  return process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT || 'text-embedding-ada-002';
}

export async function getOrgAiSettings(organizationId: string): Promise<OrgAiSettings> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { settings: true },
  });
  const settings = (org?.settings as Record<string, unknown>) || {};
  return (settings.ai as OrgAiSettings) || {};
}

export async function saveOrgAiSettings(
  organizationId: string,
  input: OrgAiSettings
): Promise<OrgAiSettings> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { settings: true },
  });
  const current = (org?.settings as Record<string, unknown>) || {};
  const existing = (current.ai as OrgAiSettings) || {};

  const next: OrgAiSettings = {
    ...existing,
    ...input,
  };

  if (input.apiKey) {
    next.apiKeyEncrypted = encrypt(input.apiKey);
    delete next.apiKey;
  }

  await prisma.organization.update({
    where: { id: organizationId },
    data: {
      settings: {
        ...current,
        ai: next,
      } as object,
    },
  });

  return sanitizeSettingsForClient(next);
}

export function sanitizeSettingsForClient(settings: OrgAiSettings): OrgAiSettings {
  const { apiKeyEncrypted, apiKey, ...rest } = settings;
  return {
    ...rest,
    hasApiKey: Boolean(apiKeyEncrypted || apiKey),
  } as OrgAiSettings & { hasApiKey?: boolean };
}

/**
 * Resolve the active brain provider for this org.
 * Priority: org override → platform config → sarvam (default).
 */
function resolveOrgBrainProvider(orgSettings: OrgAiSettings): BrainProvider {
  if (orgSettings.brainProvider) return orgSettings.brainProvider;
  return config.ai.brainProvider;
}

export async function resolveAiConfig(organizationId: string): Promise<ResolvedAiConfig | null> {
  const orgSettings = await getOrgAiSettings(organizationId);
  const provider = resolveOrgBrainProvider(orgSettings);

  // Org-level custom config (Azure or any custom endpoint)
  if (orgSettings.useCustomConfig && orgSettings.endpoint) {
    const apiKey = orgSettings.apiKeyEncrypted
      ? decrypt(orgSettings.apiKeyEncrypted)
      : orgSettings.apiKey;
    if (!apiKey) return null;

    return {
      provider,
      endpoint: orgSettings.endpoint.replace(/\/$/, ''),
      apiKey,
      deployment: orgSettings.deployment || 'gpt-35-turbo',
      embeddingEndpoint: config.azure.endpoint || orgSettings.endpoint.replace(/\/$/, ''),
      embeddingApiKey: config.azure.apiKey || apiKey,
      embeddingDeployment:
        orgSettings.embeddingDeployment || getDefaultEmbeddingDeployment(),
      apiVersion: orgSettings.apiVersion || '2024-12-01-preview',
      source: 'org',
    };
  }

  // Sarvam is the platform default brain
  if (provider === 'sarvam' && config.sarvam.apiKey) {
    return {
      provider: 'sarvam',
      endpoint: config.sarvam.chatEndpoint,
      apiKey: config.sarvam.apiKey,
      deployment: config.sarvam.chatModel,
      embeddingEndpoint: config.azure.endpoint,
      embeddingApiKey: config.azure.apiKey,
      embeddingDeployment: getDefaultEmbeddingDeployment(),
      apiVersion: config.azure.apiVersion,
      source: 'global',
    };
  }

  // Azure fallback (legacy, kept for embeddings only)
  if (config.azure.endpoint && config.azure.apiKey) {
    return {
      provider: 'azure',
      endpoint: config.azure.endpoint,
      apiKey: config.azure.apiKey,
      deployment: config.azure.deployment,
      embeddingEndpoint: config.azure.endpoint,
      embeddingApiKey: config.azure.apiKey,
      embeddingDeployment: getDefaultEmbeddingDeployment(),
      apiVersion: config.azure.apiVersion,
      source: 'global',
    };
  }

  return null;
}

export async function isAiConfiguredForOrg(organizationId: string): Promise<boolean> {
  return Boolean(await resolveAiConfig(organizationId));
}

export async function checkOrgTokenQuota(organizationId: string): Promise<void> {
  const settings = await getOrgAiSettings(organizationId);
  const limit = settings.monthlyTokenLimit;
  if (!limit || limit <= 0) return;

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const used = await prisma.aiUsageLog.aggregate({
    where: {
      organizationId,
      createdAt: { gte: startOfMonth },
    },
    _sum: { totalTokens: true },
  });

  const total = used._sum.totalTokens || 0;
  if (total >= limit) {
    throw new AppError(429, 'Monthly AI token limit reached for your organization');
  }
}

export async function recordAiUsage(data: {
  organizationId: string;
  botId?: string;
  conversationId?: string;
  action: 'chat' | 'embedding';
  usage: TokenUsage;
}): Promise<void> {
  await prisma.aiUsageLog.create({
    data: {
      organizationId: data.organizationId,
      botId: data.botId,
      conversationId: data.conversationId,
      action: data.action,
      promptTokens: data.usage.promptTokens,
      completionTokens: data.usage.completionTokens,
      totalTokens: data.usage.totalTokens,
    },
  });
}

export async function getOrgUsageSummary(organizationId: string, days = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [periodUsage, monthUsage, settings] = await Promise.all([
    prisma.aiUsageLog.aggregate({
      where: { organizationId, createdAt: { gte: since } },
      _sum: { totalTokens: true, promptTokens: true, completionTokens: true },
      _count: true,
    }),
    prisma.aiUsageLog.aggregate({
      where: { organizationId, createdAt: { gte: startOfMonth } },
      _sum: { totalTokens: true },
    }),
    getOrgAiSettings(organizationId),
  ]);

  const byAction = await prisma.aiUsageLog.groupBy({
    by: ['action'],
    where: { organizationId, createdAt: { gte: since } },
    _sum: { totalTokens: true },
  });

  return {
    periodDays: days,
    totalRequests: periodUsage._count,
    totalTokens: periodUsage._sum.totalTokens || 0,
    promptTokens: periodUsage._sum.promptTokens || 0,
    completionTokens: periodUsage._sum.completionTokens || 0,
    monthTokens: monthUsage._sum.totalTokens || 0,
    monthlyTokenLimit: settings.monthlyTokenLimit || null,
    byAction: Object.fromEntries(byAction.map((r) => [r.action, r._sum.totalTokens || 0])),
  };
}
