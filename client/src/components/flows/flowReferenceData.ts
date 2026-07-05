import { aiBotApi, flowApi, teamApi, templateApi } from '../../services/api';
import type { AiBot, Flow, TeamAgent } from '../../types';

export type FlowReferenceData = {
  bots: AiBot[];
  agents: TeamAgent[];
  flows: Flow[];
  templates: Array<{ name: string; language: string; status: string }>;
};

let cache: FlowReferenceData | null = null;
let inflight: Promise<FlowReferenceData> | null = null;

export function getFlowReferenceData(): Promise<FlowReferenceData> {
  if (cache) return Promise.resolve(cache);
  if (!inflight) {
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
        return cache;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export function invalidateFlowReferenceData() {
  cache = null;
  inflight = null;
}
