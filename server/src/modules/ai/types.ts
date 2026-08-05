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
}

export interface ResolvedAiConfig {
  /** Which brain serves this request. */
  provider: BrainProvider;
  endpoint: string;
  apiKey: string;
  deployment: string;
  embeddingDeployment: string;
  apiVersion: string;
  source: 'org' | 'global';
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}
