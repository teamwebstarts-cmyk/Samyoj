import prisma from '../../config/database';

export interface AutomationConflictLink {
  label: string;
  href: string;
}

export interface AutomationConflict {
  type: string;
  severity: 'warning' | 'error';
  message: string;
  items: string[];
  links?: AutomationConflictLink[];
}

export interface ConflictAutomation {
  id?: string;
  name: string;
  triggerType: string;
  config: unknown;
}

export interface ConflictFlow {
  id?: string;
  name: string;
  triggerType: string;
  triggerConfig: unknown;
}

export interface ConflictPreviewInput {
  kind: 'automation' | 'flow';
  excludeId?: string;
  name: string;
  triggerType: string;
  config?: unknown;
  triggerConfig?: unknown;
  enabled?: boolean;
  status?: string;
}

function autoHref(): string {
  return '/automations?tab=quick';
}

function flowHref(id?: string): string {
  return id ? `/automations/flows/${id}` : '/automations';
}

function autoLinks(items: ConflictAutomation[]): AutomationConflictLink[] {
  return items.map((a) => ({ label: a.name, href: autoHref() }));
}

function flowLinks(items: ConflictFlow[]): AutomationConflictLink[] {
  return items.map((f) => ({ label: f.name, href: flowHref(f.id) }));
}

export function mergeProposedForConflicts(
  automations: ConflictAutomation[],
  flows: ConflictFlow[],
  proposed: ConflictPreviewInput
): { automations: ConflictAutomation[]; flows: ConflictFlow[] } {
  const nextAutomations = automations.filter((a) => a.id !== proposed.excludeId);
  const nextFlows = flows.filter((f) => f.id !== proposed.excludeId);

  const liveProposed =
    proposed.enabled !== false &&
    (proposed.kind === 'automation' || proposed.status !== 'DRAFT');

  if (!liveProposed) {
    return { automations: nextAutomations, flows: nextFlows };
  }

  if (proposed.kind === 'automation') {
    nextAutomations.push({
      id: proposed.excludeId,
      name: proposed.name,
      triggerType: proposed.triggerType,
      config: proposed.config ?? {},
    });
  } else {
    nextFlows.push({
      id: proposed.excludeId,
      name: proposed.name,
      triggerType: proposed.triggerType,
      triggerConfig: proposed.triggerConfig ?? proposed.config ?? {},
    });
  }

  return { automations: nextAutomations, flows: nextFlows };
}

export function findAutomationConflicts(
  automations: ConflictAutomation[],
  flows: ConflictFlow[]
): AutomationConflict[] {
  const conflicts: AutomationConflict[] = [];

  const welcomeAutomations = automations.filter((a) => a.triggerType === 'WELCOME');
  if (welcomeAutomations.length > 1) {
    conflicts.push({
      type: 'duplicate_welcome',
      severity: 'warning',
      message: 'Multiple active welcome quick replies — only the oldest will run',
      items: welcomeAutomations.map((a) => a.name),
      links: autoLinks(welcomeAutomations),
    });
  }

  const welcomeFlows = flows.filter((f) => f.triggerType === 'WELCOME');
  if (welcomeFlows.length > 0 && welcomeAutomations.length > 0) {
    conflicts.push({
      type: 'welcome_overlap',
      severity: 'warning',
      message: 'Welcome quick replies and flows both active — flows run first',
      items: [...welcomeFlows.map((f) => `Flow: ${f.name}`), ...welcomeAutomations.map((a) => a.name)],
      links: [...flowLinks(welcomeFlows), ...autoLinks(welcomeAutomations)],
    });
  }

  const keywordMap = new Map<string, ConflictAutomation[]>();
  for (const a of automations.filter((x) => x.triggerType === 'KEYWORD')) {
    const kw = String((a.config as Record<string, unknown>).keyword || '').toLowerCase();
    if (!kw) continue;
    keywordMap.set(kw, [...(keywordMap.get(kw) || []), a]);
  }
  for (const [kw, rows] of keywordMap) {
    if (rows.length > 1) {
      conflicts.push({
        type: 'duplicate_keyword',
        severity: 'warning',
        message: `Keyword "${kw}" used in multiple quick replies`,
        items: rows.map((a) => a.name),
        links: autoLinks(rows),
      });
    }
  }

  const awayAutomations = automations.filter((a) => a.triggerType === 'AWAY');
  const businessHoursAutomations = automations.filter((a) => a.triggerType === 'BUSINESS_HOURS');
  const offHoursFlows = flows.filter((f) => f.triggerType === 'OFF_HOURS');
  const businessHoursFlows = flows.filter((f) => f.triggerType === 'BUSINESS_HOURS');

  const awayCount = awayAutomations.length + businessHoursAutomations.length;
  if (awayCount > 2) {
    const awayRows = [...awayAutomations, ...businessHoursAutomations];
    conflicts.push({
      type: 'away_overlap',
      severity: 'warning',
      message: 'Multiple away/business-hours quick replies may overlap',
      items: awayRows.map((a) => `${a.name} (${a.triggerType})`),
      links: autoLinks(awayRows),
    });
  }

  if (offHoursFlows.length > 0 && awayAutomations.length > 0) {
    conflicts.push({
      type: 'off_hours_away_overlap',
      severity: 'warning',
      message: 'After-hours flows and away quick replies both active — flows run first',
      items: [...offHoursFlows.map((f) => `Flow: ${f.name}`), ...awayAutomations.map((a) => a.name)],
      links: [...flowLinks(offHoursFlows), ...autoLinks(awayAutomations)],
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
      links: [...flowLinks(offHoursFlows), ...autoLinks(businessHoursAutomations)],
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
      links: [...flowLinks(businessHoursFlows), ...autoLinks(businessHoursAutomations)],
    });
  }

  const flowKeywordMap = new Map<string, ConflictFlow[]>();
  for (const f of flows.filter((x) => x.triggerType === 'KEYWORD')) {
    const kw = String((f.triggerConfig as Record<string, unknown>).keyword || '').toLowerCase();
    if (!kw) continue;
    flowKeywordMap.set(kw, [...(flowKeywordMap.get(kw) || []), f]);
  }
  for (const [kw, flowRows] of flowKeywordMap) {
    const quickRows = keywordMap.get(kw);
    if (quickRows?.length) {
      conflicts.push({
        type: 'keyword_flow_overlap',
        severity: 'warning',
        message: `Keyword "${kw}" matches both flows and quick replies — flows take priority`,
        items: [...flowRows.map((f) => `Flow: ${f.name}`), ...quickRows.map((a) => a.name)],
        links: [...flowLinks(flowRows), ...autoLinks(quickRows)],
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
      links: flowLinks(missedCallFlows),
    });
  }

  const tagFlows = flows.filter((f) => f.triggerType === 'CONTACT_TAG' || f.triggerType === 'SEGMENT');
  if (tagFlows.length > 0) {
    conflicts.push({
      type: 'tag_reentry',
      severity: 'warning',
      message:
        'Tag/segment journeys start on every inbound while the contact stays tagged — they can re-enter the tree',
      items: tagFlows.map((f) => `Flow: ${f.name}`),
      links: flowLinks(tagFlows),
    });
  }

  const anyMessageFlows = flows.filter((f) => f.triggerType === 'ANY_MESSAGE');
  const keywordFlows = flows.filter((f) => f.triggerType === 'KEYWORD');
  if (anyMessageFlows.length > 0 && keywordFlows.length > 0) {
    conflicts.push({
      type: 'any_message_vs_keyword',
      severity: 'warning',
      message:
        'ANY_MESSAGE is a catch-all: it only runs when no other published flow matches. Keyword journeys still win.',
      items: [
        ...keywordFlows.map((f) => `Keyword: ${f.name}`),
        ...anyMessageFlows.map((f) => `Catch-all: ${f.name}`),
      ],
      links: [...flowLinks(keywordFlows), ...flowLinks(anyMessageFlows)],
    });
  }
  if (anyMessageFlows.length > 1) {
    conflicts.push({
      type: 'duplicate_any_message',
      severity: 'warning',
      message: 'Multiple ANY_MESSAGE catch-all flows — highest priority catch-all runs if nothing else matches',
      items: anyMessageFlows.map((f) => f.name),
      links: flowLinks(anyMessageFlows),
    });
  }

  for (const [kw, flowRows] of flowKeywordMap) {
    if (flowRows.length > 1) {
      conflicts.push({
        type: 'duplicate_flow_keyword',
        severity: 'warning',
        message: `Keyword "${kw}" used in multiple conversation flows — highest priority wins`,
        items: flowRows.map((f) => `Flow: ${f.name}`),
        links: flowLinks(flowRows),
      });
    }
  }

  return conflicts;
}

function toConflictRows(automations: Array<{ id: string; name: string; triggerType: string; config: unknown }>, flows: Array<{
  id: string;
  name: string;
  triggerType: string;
  triggerConfig: unknown;
}>) {
  return {
    automations: automations.map((a) => ({
      id: a.id,
      name: a.name,
      triggerType: a.triggerType,
      config: a.config,
    })),
    flows: flows.map((f) => ({
      id: f.id,
      name: f.name,
      triggerType: f.triggerType,
      triggerConfig: f.triggerConfig,
    })),
  };
}

export async function detectAutomationConflicts(organizationId: string): Promise<AutomationConflict[]> {
  const [automations, flows] = await Promise.all([
    prisma.automation.findMany({ where: { organizationId, enabled: true } }),
    prisma.flow.findMany({ where: { organizationId, enabled: true, status: 'PUBLISHED' } }),
  ]);

  const rows = toConflictRows(automations, flows);
  return findAutomationConflicts(rows.automations, rows.flows);
}

export async function previewAutomationConflicts(
  organizationId: string,
  proposed: ConflictPreviewInput
): Promise<AutomationConflict[]> {
  const [automations, flows] = await Promise.all([
    prisma.automation.findMany({ where: { organizationId, enabled: true } }),
    prisma.flow.findMany({ where: { organizationId, enabled: true, status: 'PUBLISHED' } }),
  ]);

  const rows = toConflictRows(automations, flows);
  const merged = mergeProposedForConflicts(rows.automations, rows.flows, proposed);
  return findAutomationConflicts(merged.automations, merged.flows);
}
