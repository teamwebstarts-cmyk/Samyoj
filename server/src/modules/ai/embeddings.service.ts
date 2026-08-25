import { AppError } from '../../utils/response';
import { createModuleLogger } from '../../utils/logger';
import { resolveAiConfig, recordAiUsage } from './org-ai.service';
import type { ResolvedAiConfig } from './types';
import { assertAiCreditsAvailable } from '../billing/ai-credits/service';

const log = createModuleLogger('embeddings');

function getEmbeddingsUrl(cfg: ResolvedAiConfig): string {
  return `${cfg.embeddingEndpoint}/openai/deployments/${cfg.embeddingDeployment}/embeddings?api-version=${cfg.apiVersion}`;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

export async function createEmbedding(
  organizationId: string,
  text: string,
  options?: { botId?: string; conversationId?: string; whatsappNumberId?: string }
): Promise<number[]> {
  const input = text.trim().slice(0, 8000);
  if (!input) return [];

  // Embeddings consume the same chat-credit pool as training and retrieval.
  // Check entitlement before provider configuration so Starter receives a
  // plan-feature response even when an add-on balance exists.
  await assertAiCreditsAvailable(organizationId, 'chat', 1);

  const cfg = await resolveAiConfig(organizationId);
  if (!cfg) throw new AppError(503, 'AI is not configured');

  const url = getEmbeddingsUrl(cfg);
  const start = Date.now();

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': cfg.embeddingApiKey,
    },
    body: JSON.stringify({ input }),
  });

  const body = (await response.json()) as {
    data?: Array<{ embedding?: number[] }>;
    usage?: { prompt_tokens?: number; total_tokens?: number };
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new AppError(502, body.error?.message || 'Embedding request failed');
  }

  const embedding = body.data?.[0]?.embedding;
  if (!embedding?.length) {
    throw new AppError(502, 'Empty embedding response');
  }

  const totalTokens = body.usage?.total_tokens || body.usage?.prompt_tokens || 0;
  await recordAiUsage({
    organizationId,
    botId: options?.botId,
    conversationId: options?.conversationId,
    whatsappNumberId: options?.whatsappNumberId,
    action: 'embedding',
    usage: { promptTokens: totalTokens, completionTokens: 0, totalTokens },
  });

  log.debug('Embedding created', { organizationId, durationMs: Date.now() - start, dims: embedding.length });
  return embedding;
}
