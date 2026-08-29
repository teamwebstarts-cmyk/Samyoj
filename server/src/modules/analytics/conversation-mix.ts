const SERVICE_CATEGORIES = new Set(['UTILITY', 'AUTHENTICATION', 'SERVICE']);

export function mixConversationCharges(
  charges: Array<{ category: string; conversationCount: number }>
): { promoConversations: number | null; serviceConversations: number | null; hasCharges: boolean } {
  if (!charges.length) {
    return { promoConversations: null, serviceConversations: null, hasCharges: false };
  }

  let promo = 0;
  let service = 0;
  for (const row of charges) {
    const category = String(row.category || '').toUpperCase();
    const count = Number(row.conversationCount) || 0;
    if (category === 'MARKETING') promo += count;
    else if (SERVICE_CATEGORIES.has(category)) service += count;
  }

  return { promoConversations: promo, serviceConversations: service, hasCharges: true };
}

export function qualityLabel(rating: string | null | undefined): 'High' | 'Medium' | 'Low' | 'Unknown' {
  const value = String(rating || 'UNKNOWN').toUpperCase();
  if (value === 'GREEN') return 'High';
  if (value === 'YELLOW') return 'Medium';
  if (value === 'RED') return 'Low';
  return 'Unknown';
}
