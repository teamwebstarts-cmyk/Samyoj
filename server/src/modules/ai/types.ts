export interface OrgAiSettings {
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
