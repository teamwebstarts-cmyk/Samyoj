import prisma from '../../config/database';

export interface BotAnalyticsSummary {
  totalReplies: number;
  successfulReplies: number;
  skippedReplies: number;
  failedReplies: number;
  handoffs: number;
  avgDurationMs: number;
  totalTokens: number;
  skipReasons: Record<string, number>;
  handoffReasons: Record<string, number>;
  recentRuns: Array<{
    id: string;
    status: string;
    action: string;
    durationMs: number | null;
    createdAt: Date;
    conversationId: string | null;
    error: string | null;
  }>;
}

function botIdFromLogInput(input: unknown): string | undefined {
  if (!input || typeof input !== 'object') return undefined;
  const record = input as Record<string, unknown>;
  return (record.botId as string) || undefined;
}

function tokensFromLogOutput(output: unknown): number {
  if (!output || typeof output !== 'object') return 0;
  const record = output as Record<string, unknown>;
  return typeof record.totalTokens === 'number' ? record.totalTokens : 0;
}

export async function getBotAnalytics(
  botId: string,
  organizationId: string,
  days = 30
): Promise<BotAnalyticsSummary> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const logs = await prisma.automationLog.findMany({
    where: {
      organizationId,
      triggerType: 'AI_CHATBOT',
      createdAt: { gte: since },
    },
    orderBy: { createdAt: 'desc' },
    take: 500,
    select: {
      id: true,
      status: true,
      action: true,
      input: true,
      output: true,
      error: true,
      durationMs: true,
      createdAt: true,
      conversationId: true,
    },
  });

  const botLogs = logs.filter((entry) => {
    const id = botIdFromLogInput(entry.input) || botIdFromLogInput(entry.output);
    return id === botId || entry.action === 'generate_reply';
  });

  const generateLogs = botLogs.filter((l) => l.action === 'generate_reply');
  const sendLogs = botLogs.filter((l) => l.action === 'send_reply');

  const skipReasons: Record<string, number> = {};
  const handoffReasons: Record<string, number> = {};
  let handoffs = 0;
  let totalTokens = 0;

  for (const entry of generateLogs) {
    const input = entry.input as Record<string, unknown> | null;
    const output = entry.output as Record<string, unknown> | null;
    if (entry.status === 'skipped' && typeof input?.reason === 'string') {
      skipReasons[input.reason] = (skipReasons[input.reason] || 0) + 1;
    }
    if (output?.handoff === true && typeof output.handoffReason === 'string') {
      handoffs += 1;
      handoffReasons[output.handoffReason] =
        (handoffReasons[output.handoffReason] || 0) + 1;
    }
    totalTokens += tokensFromLogOutput(entry.output);
  }

  const durations = [...generateLogs, ...sendLogs]
    .map((l) => l.durationMs)
    .filter((d): d is number => typeof d === 'number');
  const avgDurationMs =
    durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;

  return {
    totalReplies: sendLogs.length,
    successfulReplies: sendLogs.filter((l) => l.status === 'success').length,
    skippedReplies: generateLogs.filter((l) => l.status === 'skipped').length,
    failedReplies: sendLogs.filter((l) => l.status === 'failed').length,
    handoffs,
    avgDurationMs,
    totalTokens,
    skipReasons,
    handoffReasons,
    recentRuns: botLogs.slice(0, 30).map((l) => ({
      id: l.id,
      status: l.status,
      action: l.action,
      durationMs: l.durationMs,
      createdAt: l.createdAt,
      conversationId: l.conversationId,
      error: l.error,
    })),
  };
}
