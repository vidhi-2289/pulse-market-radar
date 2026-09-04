import { RadarItemResult, AttentionBudget, AttentionBudgetItem } from '@/types';

/**
 * Pure deterministic selector to calculate the Attention Budget from evaluated radar items.
 *
 * Implements Module 11 Attention Budget contract:
 * - Selects up to `maxBudget` (default 3) highest-priority meaningful changes.
 * - Only includes items with severity !== 'NOMINAL' (and attentionScore >= 30).
 * - Preserves existing Attention Score ranking priority.
 * - Generates clear natural-language messaging.
 * - Produces calm state when zero meaningful changes exist.
 * - Leaves all underlying engine scores and item objects pure and unmutated.
 */
export function computeAttentionBudget(
  items: RadarItemResult[],
  maxBudget: number = 3
): AttentionBudget {
  if (!items || !Array.isArray(items) || items.length === 0) {
    return {
      totalMeaningfulCount: 0,
      budgetCount: 0,
      items: [],
      isCalm: true,
      message: 'Nothing needs your attention.',
    };
  }

  // 1. Filter only meaningful changes according to existing engine classifications
  const meaningfulItems = items.filter(
    (item) => item.severity !== 'NOMINAL' && item.attentionScore >= 30
  );

  // 2. Sort descending by existing Attention Score (primary ranking contract)
  const sorted = [...meaningfulItems].sort((a, b) => {
    if (b.attentionScore !== a.attentionScore) {
      return b.attentionScore - a.attentionScore;
    }
    // Deterministic tie-breaker: absolute price return
    return Math.abs(b.priceChangePercent) - Math.abs(a.priceChangePercent);
  });

  // 3. Slice to budget limit
  const topItems = sorted.slice(0, Math.max(1, maxBudget));
  const count = topItems.length;

  // 4. Construct human-readable status message
  let message: string;
  if (count === 0) {
    message = 'Nothing needs your attention.';
  } else if (count === 1) {
    message = '1 thing worth your attention';
  } else {
    message = `${count} things worth your attention`;
  }

  // 5. Map to compact AttentionBudgetItem representations
  const budgetItems: AttentionBudgetItem[] = topItems.map((item, idx) => {
    const primaryReason = item.reasons && item.reasons.length > 0 ? item.reasons[0] : null;
    const headlineReason = primaryReason?.title || (
      item.priceChangePercent !== 0
        ? `${item.priceChangePercent >= 0 ? '+' : ''}${(item.priceChangePercent * 100).toFixed(1)}% price move`
        : 'Elevated attention score'
    );

    return {
      symbol: item.symbol,
      name: item.name,
      severity: item.severity,
      attentionScore: item.attentionScore,
      headlineReason,
      rank: idx + 1,
      priceChangePercent: item.priceChangePercent,
    };
  });

  return {
    totalMeaningfulCount: meaningfulItems.length,
    budgetCount: count,
    items: budgetItems,
    isCalm: count === 0,
    message,
  };
}
