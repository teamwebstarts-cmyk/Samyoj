export type BrainProvider = 'sarvam' | 'azure';

export interface OrgAiSettings {
  /** Per-org brain provider override. Defaults to platform AI_BRAIN_PROVIDER (sarvam). */
  brainProvider?: BrainProvider;
  useCustomConfig?: boolean;
  endpoint?: string;
  apiKey?: string;
  apiKeyEncrypted?: string;
  deployment?: string;
  embeddingDeployment?: string;
  apiVersion?: string;
  monthlyTokenLimit?: number;
  /** Platform-admin kill switch for WhatsApp chat AI. Default true. */
  chatEnabled?: boolean;
  /** Platform-admin kill switch for calling AI. Default true. */
  callingEnabled?: boolean;
}

export interface ResolvedAiConfig {
  /** Which brain serves this request. */
  provider: BrainProvider;
  /** Chat/brain endpoint + key. */
  endpoint: string;
  apiKey: string;
  deployment: string;
  /** Embeddings always use Azure (Sarvam has no vector API). */
  embeddingEndpoint: string;
  embeddingApiKey: string;
  embeddingDeployment: string;
  apiVersion: string;
  source: 'org' | 'global';
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}
