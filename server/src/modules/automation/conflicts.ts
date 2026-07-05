import prisma from '../../config/database';

export interface AutomationConflict {
  type: string;
  severity: 'warning' | 'error';
  message: string;
  items: string[];
}

export async function detectAutomationConflicts(organizationId: string): Promise<AutomationConflict[]> {
  const [automations, flows] = await Promise.all([
    prisma.automation.findMany({ where: { organizationId, enabled: true } }),
    prisma.flow.findMany({ where: { organizationId, enabled: true, status: 'PUBLISHED' } }),
  ]);

  const conflicts: AutomationConflict[] = [];

  const welcomeAutomations = automations.filter((a) => a.triggerType === 'WELCOME');
  if (welcomeAutomations.length > 1) {
    conflicts.push({
      type: 'duplicate_welcome',
      severity: 'warning',
      message: 'Multiple active welcome quick replies — only the oldest will run',
      items: welcomeAutomations.map((a) => a.name),
    });
  }

  const welcomeFlows = flows.filter((f) => f.triggerType === 'WELCOME');
  if (welcomeFlows.length > 0 && welcomeAutomations.length > 0) {
    conflicts.push({
      type: 'welcome_overlap',
      severity: 'warning',
      message: 'Welcome quick replies and flows both active — flows run first',
      items: [...welcomeFlows.map((f) => `Flow: ${f.name}`), ...welcomeAutomations.map((a) => a.name)],
    });
  }

  const keywordMap = new Map<string, string[]>();
  for (const a of automations.filter((x) => x.triggerType === 'KEYWORD')) {
    const kw = String((a.config as Record<string, unknown>).keyword || '').toLowerCase();
    if (!kw) continue;
    keywordMap.set(kw, [...(keywordMap.get(kw) || []), a.name]);
  }
  for (const [kw, names] of keywordMap) {
    if (names.length > 1) {
      conflicts.push({
        type: 'duplicate_keyword',
        severity: 'warning',
        message: `Keyword "${kw}" used in multiple quick replies`,
        items: names,
      });
    }
  }

  const awayAutomations = automations.filter((a) => a.triggerType === 'AWAY');
  const businessHoursAutomations = automations.filter((a) => a.triggerType === 'BUSINESS_HOURS');
  const offHoursFlows = flows.filter((f) => f.triggerType === 'OFF_HOURS');
  const businessHoursFlows = flows.filter((f) => f.triggerType === 'BUSINESS_HOURS');

  const awayCount = awayAutomations.length + businessHoursAutomations.length;
  if (awayCount > 2) {
    conflicts.push({
      type: 'away_overlap',
      severity: 'warning',
      message: 'Multiple away/business-hours quick replies may overlap',
      items: [...awayAutomations, ...businessHoursAutomations].map((a) => `${a.name} (${a.triggerType})`),
    });
  }

  if (offHoursFlows.length > 0 && awayAutomations.length > 0) {
    conflicts.push({
      type: 'off_hours_away_overlap',
      severity: 'warning',
      message: 'After-hours flows and away quick replies both active — flows run first',
      items: [...offHoursFlows.map((f) => `Flow: ${f.name}`), ...awayAutomations.map((a) => a.name)],
    });
  }

  if (offHoursFlows.length > 0 && businessHoursAutomations.length > 0) {
    conflicts.push({
      type: 'off_hours_business_hours_overlap',
      severity: 'warning',
      message: 'After-hours flows and business-hours quick replies may both reply outside working hours — flows run first',
      items: [
        ...offHoursFlows.map((f) => `Flow: ${f.name}`),
        ...businessHoursAutomations.map((a) => a.name),
      ],
    });
  }

  if (businessHoursFlows.length > 0 && businessHoursAutomations.length > 0) {
    conflicts.push({
      type: 'business_hours_overlap',
      severity: 'warning',
      message: 'During-hours flows and business-hours quick replies both active — flows run first',
      items: [
        ...businessHoursFlows.map((f) => `Flow: ${f.name}`),
        ...businessHoursAutomations.map((a) => a.name),
      ],
    });
  }

  const flowKeywordMap = new Map<string, string[]>();
  for (const f of flows.filter((x) => x.triggerType === 'KEYWORD')) {
    const kw = String((f.triggerConfig as Record<string, unknown>).keyword || '').toLowerCase();
    if (!kw) continue;
    flowKeywordMap.set(kw, [...(flowKeywordMap.get(kw) || []), `Flow: ${f.name}`]);
  }
  for (const [kw, flowNames] of flowKeywordMap) {
    const quickNames = keywordMap.get(kw);
    if (quickNames?.length) {
      conflicts.push({
        type: 'keyword_flow_overlap',
        severity: 'warning',
        message: `Keyword "${kw}" matches both flows and quick replies — flows take priority`,
        items: [...flowNames, ...quickNames],
      });
    }
  }

  const missedCallFlows = flows.filter((f) => f.triggerType === 'MISSED_CALL');
  if (missedCallFlows.length > 1) {
    conflicts.push({
      type: 'duplicate_missed_call',
      severity: 'warning',
      message: 'Multiple missed-call flows — highest priority runs',
      items: missedCallFlows.map((f) => f.name),
    });
  }

  return conflicts;
}
