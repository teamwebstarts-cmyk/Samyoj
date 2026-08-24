import { config } from '../../config';
import { AppError } from '../../utils/response';
import { createModuleLogger } from '../../utils/logger';
import { recordAiUsage } from './org-ai.service';
import { estimateUsageUnits } from './ai-usage-actions';
import type { TokenUsage } from './types';

const log = createModuleLogger('sarvam-chat');

/**
 * Sarvam is a shared multi-tenant endpoint and returns 503 `model_overloaded`
 * under load, plus occasional 500s and 429s. These are transient — retrying
 * with backoff recovers most calls instead of failing the user's message/call.
 * 401/403 (auth) and other 4xx are NOT retried: retrying a bad key just wastes
 * time and quota.
 */
const SARVAM_RETRYABLE_STATUS = new Set([429, 500, 502, 503]);
const SARVAM_MAX_RETRIES = 3;
const SARVAM_RETRY_BASE_DELAY_MS = 400;

async function fetchSarvamWithRetry(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= SARVAM_MAX_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { ...init, signal: controller.signal });

      // Non-retryable immediately returns so the caller can throw a clean error.
      if (response.ok || !SARVAM_RETRYABLE_STATUS.has(response.status)) {
        return response;
      }

      // Retryable status (429/5xx): wait before the next attempt, except on the
      // final try where we return it for the caller to surface.
      lastError = response;
      if (attempt < SARVAM_MAX_RETRIES) {
        const backoff = SARVAM_RETRY_BASE_DELAY_MS * 2 ** attempt + Math.floor(Math.random() * 250);
        log.warn('Sarvam returned a transient error — retrying', {
          status: response.status,
          attempt: attempt + 1,
          maxRetries: SARVAM_MAX_RETRIES,
        });
        await new Promise((resolve) => setTimeout(resolve, backoff));
        continue;
      }
      return response;
    } catch (err) {
      lastError = err;
      const isTimeout = err instanceof Error && err.name === 'AbortError';
      // Only retry timeouts; other network errors (DNS, conn refused) are not
      // going to self-heal within the same call.
      if (isTimeout && attempt < SARVAM_MAX_RETRIES) {
        const backoff = SARVAM_RETRY_BASE_DELAY_MS * 2 ** attempt + Math.floor(Math.random() * 250);
        log.warn('Sarvam request timed out — retrying', {
          attempt: attempt + 1,
          maxRetries: SARVAM_MAX_RETRIES,
        });
        await new Promise((resolve) => setTimeout(resolve, backoff));
        continue;
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
  name?: string;
}

export interface ChatCompletionTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ToolCallResult {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ChatCompletionOptions {
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  organizationId?: string;
  botId?: string;
  conversationId?: string;
  whatsappNumberId?: string;
  /** Named Reports surface. Defaults to chat_bot. */
  usageAction?: import('./ai-usage-actions').RecordableAiAction;
  /** Sarvam function-calling tools. */
  tools?: ChatCompletionTool[];
  toolChoice?: 'auto' | 'none';
  /** Stream mode — returns SSE reader instead of full response. */
  stream?: boolean;
  /** Voice LLM turns bill per-call minutes — skip pre-flight chat credit check. */
  skipCreditCheck?: boolean;
  /** Optional per-call provider overrides (used when an org uses a custom endpoint/key). */
  endpoint?: string;
  apiKey?: string;
  model?: string;
  timeoutMs?: number;
}

export interface ChatCompletionResult {
  content: string;
  finishReason: string | null;
  usage?: TokenUsage;
  /** Populated when tools are present and model requests a function call. */
  toolCalls?: ToolCallResult[];
  provider: 'sarvam' | 'azure';
}

/** Streaming chunk delivered during SSE iteration. */
export interface ChatCompletionChunk {
  content: string;
  finishReason: string | null;
  done: boolean;
}

/**
 * Whether Sarvam chat is configured with a valid API key.
 */
export function isSarvamChatConfigured(): boolean {
  return Boolean(config.sarvam.apiKey);
}

/**
 * Read SSE stream from a Sarvam streaming response, yielding content deltas.
 */
export async function* streamSarvamChatCompletion(
  options: ChatCompletionOptions
): AsyncGenerator<ChatCompletionChunk> {
  const apiKey = options.apiKey || config.sarvam.apiKey;
  const endpoint = options.endpoint || config.sarvam.chatEndpoint;
  const model = options.model || config.sarvam.chatModel;
  const timeoutMs = options.timeoutMs || config.sarvam.chatTimeoutMs;

  if (!apiKey) {
    throw new AppError(503, 'Sarvam AI is not configured');
  }

  const isConversationsModel = model === 'sarvam-105b-conversations';
    const payload: Record<string, unknown> = {
      model,
      messages: options.messages,
      temperature: options.temperature ?? 0.2,
      max_tokens: options.maxTokens ?? 500,
      stream: true,
      frequency_penalty: 0.1,
    };
    if (!isConversationsModel) {
      payload.reasoning_effort = null;
    }
    if (options.tools?.length) {
      payload.tools = options.tools;
      payload.tool_choice = options.toolChoice ?? 'auto';
    }

    const response = await fetchSarvamWithRetry(
      `${endpoint}/chat/completions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-subscription-key': apiKey,
        },
        body: JSON.stringify(payload),
      },
      timeoutMs
    );

    if (!response.ok) {
      const body = await response.text();
      throw new AppError(502, `Sarvam stream failed (${response.status}): ${body}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new AppError(502, 'Sarvam returned empty stream');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;
        const data = trimmed.slice(5).trim();
        if (data === '[DONE]') {
          yield { content: '', finishReason: 'stop', done: true };
          return;
        }
        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta?.content || '';
          const finish = parsed.choices?.[0]?.finish_reason || null;
          if (delta || finish) {
            yield { content: delta, finishReason: finish, done: false };
          }
        } catch { /* skip unparseable lines */ }
      }
    }
    yield { content: '', finishReason: 'stop', done: true };
}

/**
 * Call Sarvam chat completions — OpenAI-compatible, Sarvam brain only.
 */
export async function createSarvamChatCompletion(
  options: ChatCompletionOptions
): Promise<ChatCompletionResult> {
  const apiKey = options.apiKey || config.sarvam.apiKey;
  const endpoint = options.endpoint || config.sarvam.chatEndpoint;
  const model = options.model || config.sarvam.chatModel;
  const timeoutMs = options.timeoutMs || config.sarvam.chatTimeoutMs;

  if (!apiKey) {
    throw new AppError(503, 'Sarvam AI is not configured');
  }

  const start = Date.now();
  try {
    const isConversationsModel = model === 'sarvam-105b-conversations';
    const payload: Record<string, unknown> = {
      model,
      messages: options.messages,
      temperature: options.temperature ?? 0.2,
      max_tokens: options.maxTokens ?? 1024,
      frequency_penalty: 0.1,
    };
    // Only sarvam-105b needs reasoning disabled — conversations variant
    // doesn't support reasoning_effort and always operates in direct mode.
    if (!isConversationsModel) {
      payload.reasoning_effort = null;
    }
    if (options.tools?.length) {
      payload.tools = options.tools;
      payload.tool_choice = options.toolChoice ?? 'auto';
    }

    const response = await fetchSarvamWithRetry(
      `${endpoint}/chat/completions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-subscription-key': apiKey,
        },
        body: JSON.stringify(payload),
      },
      timeoutMs
    );

    // Graceful handling for rate limits (429) and auth errors (401/403)
    if (response.status === 429) {
      throw new AppError(429, 'Sarvam AI rate limit reached — please try again in a moment');
    }
    if (response.status === 401 || response.status === 403) {
      throw new AppError(503, 'Sarvam AI authentication failed — check SARVAM_API_KEY');
    }

    const body = (await response.json()) as {
      choices?: Array<{
        message?: { content?: string; tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }> };
        finish_reason?: string;
      }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
      error?: { message?: string; code?: string };
    };

    if (!response.ok) {
      const message = body.error?.message || `Sarvam request failed (${response.status})`;
      log.error('Chat completion failed', {
        status: response.status,
        error: body.error,
        durationMs: Date.now() - start,
      });
      throw new AppError(502, message);
    }

    const choice = body.choices?.[0];
    const content = choice?.message?.content?.trim() || '';

    // Parse tool calls if present (Sarvam returns tool_calls when function calling fires)
    let toolCalls: ToolCallResult[] | undefined;
    if (choice?.message?.tool_calls?.length) {
      toolCalls = choice.message.tool_calls.map((tc) => {
        let args: Record<string, unknown>;
        try { args = JSON.parse(tc.function.arguments); } catch { args = {}; }
        return { id: tc.id, name: tc.function.name, arguments: args };
      });
    }

    const usage: TokenUsage =
      body.usage && (body.usage.total_tokens || body.usage.prompt_tokens || body.usage.completion_tokens)
        ? {
            promptTokens: body.usage.prompt_tokens || 0,
            completionTokens: body.usage.completion_tokens || 0,
            totalTokens:
              body.usage.total_tokens ||
              (body.usage.prompt_tokens || 0) + (body.usage.completion_tokens || 0),
          }
        : estimateUsageUnits(
            options.messages.map((m) => String(m.content || '')).join('\n'),
            content
          );

    if (options.organizationId) {
      await recordAiUsage({
        organizationId: options.organizationId,
        botId: options.botId,
        conversationId: options.conversationId,
        whatsappNumberId: options.whatsappNumberId,
        action: options.usageAction || 'chat_bot',
        usage,
      });
    }

    log.debug('Sarvam chat completion success', {
      durationMs: Date.now() - start,
      tokens: usage?.totalTokens,
      hasToolCalls: Boolean(toolCalls?.length),
    });

    return {
      content,
      finishReason: choice?.finish_reason || null,
      usage,
      toolCalls,
      provider: 'sarvam',
    };
  } catch (err) {
    // AbortController timeout (from fetchSarvamWithRetry) or network failure
    if (err instanceof Error && err.name === 'AbortError') {
      throw new AppError(504, 'Sarvam AI request timed out — please try again');
    }
    throw err;
  }
}
