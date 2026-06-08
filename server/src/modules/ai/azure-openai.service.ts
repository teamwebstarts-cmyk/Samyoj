import { config } from '../../config';
import { AppError } from '../../utils/response';
import { createModuleLogger } from '../../utils/logger';
import { checkOrgTokenQuota, recordAiUsage, resolveAiConfig } from './org-ai.service';
import type { ResolvedAiConfig } from './types';

const log = createModuleLogger('azure-openai');

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionOptions {
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  organizationId?: string;
  botId?: string;
  conversationId?: string;
}

export interface ChatCompletionResult {
  content: string;
  finishReason: string | null;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

function getChatCompletionsUrl(cfg: ResolvedAiConfig, deployment: string): string {
  return `${cfg.endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${cfg.apiVersion}`;
}

export function isAzureOpenAIConfigured(): boolean {
  return Boolean(config.azureOpenAI.endpoint && config.azureOpenAI.apiKey);
}

export async function isAiConfigured(organizationId?: string): Promise<boolean> {
  if (organizationId) {
    const { isAiConfiguredForOrg } = await import('./org-ai.service');
    return isAiConfiguredForOrg(organizationId);
  }
  return isAzureOpenAIConfigured();
}

export async function createChatCompletion(
  options: ChatCompletionOptions
): Promise<ChatCompletionResult> {
  if (!options.organizationId) {
    throw new AppError(503, 'Organization context required for AI requests');
  }

  await checkOrgTokenQuota(options.organizationId);

  const cfg = await resolveAiConfig(options.organizationId);
  if (!cfg) {
    throw new AppError(503, 'Azure OpenAI is not configured');
  }

  const url = getChatCompletionsUrl(cfg, cfg.deployment);
  const start = Date.now();

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': cfg.apiKey,
    },
    body: JSON.stringify({
      messages: options.messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 500,
    }),
  });

  const body = (await response.json()) as {
    choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    error?: { message?: string; code?: string };
  };

  if (!response.ok) {
    const message = body.error?.message || `Azure OpenAI request failed (${response.status})`;
    log.error('Chat completion failed', {
      status: response.status,
      error: body.error,
      durationMs: Date.now() - start,
    });
    throw new AppError(502, message);
  }

  const content = body.choices?.[0]?.message?.content?.trim() || '';
  if (!content) {
    throw new AppError(502, 'Azure OpenAI returned an empty response');
  }

  const usage = body.usage
    ? {
        promptTokens: body.usage.prompt_tokens || 0,
        completionTokens: body.usage.completion_tokens || 0,
        totalTokens: body.usage.total_tokens || 0,
      }
    : undefined;

  if (usage) {
    await recordAiUsage({
      organizationId: options.organizationId,
      botId: options.botId,
      conversationId: options.conversationId,
      action: 'chat',
      usage,
    });
  }

  log.debug('Chat completion success', {
    durationMs: Date.now() - start,
    tokens: usage?.totalTokens,
    source: cfg.source,
  });

  return {
    content,
    finishReason: body.choices?.[0]?.finish_reason || null,
    usage,
  };
}
