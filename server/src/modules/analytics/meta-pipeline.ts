export type PipelineLead = {
  id: string;
  title: string;
  stage: string;
  amount: string | null;
  metaLeadId: string | null;
  createdAt: Date;
};

export type PipelinePlatform = 'all' | 'facebook' | 'instagram' | 'whatsapp';

export function money(value: number): string {
  return (Math.round(value * 100) / 100).toFixed(2);
}

/** Form-lead column only. Instagram DMs and WhatsApp chats are not leads. */
export function pipelineColumn(
  leads: PipelineLead[],
  platform: PipelinePlatform,
  from?: Date | null,
  to?: Date | null
): {
  qualified: number;
  won: number;
  revenue: string | null;
  note: string | null;
  wonLeads: Array<{ id: string; title: string; amount: string | null }>;
} {
  if (platform === 'instagram') {
    return {
      qualified: 0,
      won: 0,
      revenue: null,
      note: 'Instagram chats are not Instant Form leads.',
      wonLeads: [],
    };
  }
  if (platform === 'whatsapp') {
    return {
      qualified: 0,
      won: 0,
      revenue: null,
      note: 'WhatsApp chats are not counted unless a Meta Ads lead exists. This filter shows none.',
      wonLeads: [],
    };
  }

  const rows = leads.filter((lead) => {
    if (!lead.metaLeadId) return false;
    if (from && lead.createdAt < from) return false;
    if (to && lead.createdAt > to) return false;
    return true;
  });
  const wonRows = rows.filter((lead) => lead.stage === 'WON');
  const amounts = wonRows
    .map((lead) => (lead.amount == null ? null : Number(lead.amount)))
    .filter((value): value is number => value != null && Number.isFinite(value));

  return {
    qualified: rows.filter((lead) => lead.stage === 'QUALIFIED').length,
    won: wonRows.length,
    revenue: amounts.length ? money(amounts.reduce((sum, value) => sum + value, 0)) : null,
    note: null,
    wonLeads: wonRows.map((lead) => ({
      id: lead.id,
      title: lead.title,
      amount: lead.amount,
    })),
  };
}
