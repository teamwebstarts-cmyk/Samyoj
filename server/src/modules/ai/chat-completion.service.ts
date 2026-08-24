import { config } from '../../config';
import { AppError } from '../../utils/response';
import { createModuleLogger } from '../../utils/logger';
import { checkOrgTokenQuota, recordAiUsage, resolveAiConfig } from './org-ai.service';
import { createSarvamChatCompletion, streamSarvamChatCompletion } from './sarvam-chat.service';
import type {
  ChatMessage,
  ChatCompletionOptions,
  ChatCompletionResult,
  ChatCompletionTool,
  ToolCallResult,
  ChatCompletionChunk,
} from './sarvam-chat.service';

const log = createModuleLogger('chat-completion');

export type {
  ChatMessage,
  ChatCompletionOptions,
  ChatCompletionResult,
  ChatCompletionTool,
  ToolCallResult,
  ChatCompletionChunk,
} from './sarvam-chat.service';

export async function isAiConfigured(organizationId?: string): Promise<boolean> {
  if (organizationId) {
    const { isAiConfiguredForOrg } = await import('./org-ai.service');
    return isAiConfiguredForOrg(organizationId);
  }
  return Boolean(config.sarvam.apiKey || config.azure.apiKey);
}

/**
 * Single entry point for ALL chat completions — chat bot + voice calling.
 * Routes to Sarvam by default; Azure kept only for embeddings/fallback.
 */
export async function createChatCompletion(
  options: ChatCompletionOptions
): Promise<ChatCompletionResult> {
  if (!options.organizationId) {
    throw new AppError(503, 'Organization context required for AI requests');
  }

  await checkOrgTokenQuota(options.organizationId);
  if (!options.skipCreditCheck) {
    const { assertAiCreditsAvailable } = await import('../billing/ai-credits/service');
    await assertAiCreditsAvailable(options.organizationId, 'chat', 1);
  }

  const cfg = await resolveAiConfig(options.organizationId);
  if (!cfg) {
    throw new AppError(503, 'No AI brain configured. Set SARVAM_API_KEY in server/.env.');
  }

  const start = Date.now();

  // Sarvam brain — all chat + voice
  if (cfg.provider === 'sarvam') {
    const result = await createSarvamChatCompletion({
      ...options,
      tools: options.tools,
      // Pass resolved org config through so custom endpoint/key/model are honored.
      // options.model overrides cfg.deployment — voice calls pass sarvam-105b-conversations.
      endpoint: cfg.endpoint,
      apiKey: cfg.apiKey,
      model: options.model || cfg.deployment,
    });

    log.debug('Chat completion via Sarvam', { durationMs: Date.now() - start, tokens: result.usage?.totalTokens });
    return result;
  }

  // Azure fallback — legacy path
  const result = await createAzureCompletion(options, cfg);

  log.debug('Chat completion via Azure (fallback)', { durationMs: Date.now() - start, tokens: result.usage?.totalTokens });
  return result;
}

/**
 * Streaming Sarvam completions for low-latency voice (SSE → TTS).
 * Azure fallback is not streamed — callers should use createChatCompletion instead.
 */
export async function* streamChatCompletion(
  options: ChatCompletionOptions
): AsyncGenerator<ChatCompletionChunk> {
  if (!options.organizationId) {
    throw new AppError(503, 'Organization context required for AI requests');
  }

  await checkOrgTokenQuota(options.organizationId);
  if (!options.skipCreditCheck) {
    const { assertAiCreditsAvailable } = await import('../billing/ai-credits/service');
    await assertAiCreditsAvailable(options.organizationId, 'chat', 1);
  }

  const cfg = await resolveAiConfig(options.organizationId);
  if (!cfg || cfg.provider !== 'sarvam') {
    throw new AppError(503, 'Streaming requires Sarvam brain. Set AI_BRAIN_PROVIDER=sarvam.');
  }

  yield* streamSarvamChatCompletion({
    ...options,
    endpoint: cfg.endpoint,
    apiKey: cfg.apiKey,
    model: options.model || cfg.deployment,
  });
}

/** Legacy Azure completion. Kept for orgs that explicitly set provider=azure. */
async function createAzureCompletion(
  options: ChatCompletionOptions,
  cfg: { endpoint: string; apiKey: string; deployment: string; apiVersion: string }
): Promise<ChatCompletionResult> {
  const url = `${cfg.endpoint}/openai/deployments/${cfg.deployment}/chat/completions?api-version=${cfg.apiVersion}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': cfg.apiKey,
    },
    body: JSON.stringify({
      messages: options.messages,
      temperature: options.temperature ?? 0.2,
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
    throw new AppError(502, message);
  }

  const content = body.choices?.[0]?.message?.content?.trim() || '';
  if (!content) {
    throw new AppError(502, 'Azure OpenAI returned an empty response');
  }

  const usage = body.usage
    ? { promptTokens: body.usage.prompt_tokens || 0, completionTokens: body.usage.completion_tokens || 0, totalTokens: body.usage.total_tokens || 0 }
    : undefined;

  if (usage && options.organizationId) {
    await recordAiUsage({
      organizationId: options.organizationId,
      botId: options.botId,
      conversationId: options.conversationId,
      whatsappNumberId: options.whatsappNumberId,
      action: options.usageAction || 'chat_bot',
      usage,
    });
  }

  return { content, finishReason: body.choices?.[0]?.finish_reason || null, usage, provider: 'azure' };
}
