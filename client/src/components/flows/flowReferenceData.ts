import { aiBotApi, flowApi, teamApi, templateApi } from '../../services/api';
import type { AiBot, Flow, MessageTemplate, TeamAgent } from '../../types';

export type FlowReferenceData = {
  bots: AiBot[];
  agents: TeamAgent[];
  flows: Flow[];
  templates: MessageTemplate[];
};

let cache: FlowReferenceData | null = null;
let cacheScope: string | null = null;
let inflight: Promise<FlowReferenceData> | null = null;
let inflightScope: string | null = null;

export function getFlowReferenceData(scopeKey: string): Promise<FlowReferenceData> {
  if (cache && cacheScope === scopeKey) return Promise.resolve(cache);
  if (!inflight || inflightScope !== scopeKey) {
    inflightScope = scopeKey;
    inflight = Promise.all([
      aiBotApi.list(),
      teamApi.agents(),
      flowApi.list({ limit: '100' }),
      templateApi.list(),
    ])
      .then(([botsRes, agentsRes, flowsRes, templatesRes]) => {
        cache = {
          bots: botsRes.data.data.bots || botsRes.data.data || [],
          agents: agentsRes.data.data.agents || [],
          flows: flowsRes.data.data.flows || [],
          templates: templatesRes.data.data.templates || [],
        };
        cacheScope = scopeKey;
        return cache;
      })
      .finally(() => {
        if (inflightScope === scopeKey) {
          inflight = null;
          inflightScope = null;
        }
      });
  }
  return inflight;
}

export function invalidateFlowReferenceData() {
  cache = null;
  cacheScope = null;
  inflight = null;
  inflightScope = null;
}
