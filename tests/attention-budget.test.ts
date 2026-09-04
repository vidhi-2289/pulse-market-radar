import { describe, it, expect } from 'vitest';
import { computeAttentionBudget } from '../src/server/engine/attention-budget';
import { evaluateRadar } from '../src/server/services/radar-service';
import { RadarItemResult, Severity } from '../src/types';
import { INITIAL_CHECKPOINT } from '../src/server/market-data/mock-fixtures';

function createMockRadarItem(overrides: Partial<RadarItemResult>): RadarItemResult {
  return {
    symbol: 'MOCK',
    name: 'Mock Corporation',
    sector: 'Technology',
    sectorEtf: 'XLK',
    currentPrice: 150,
    checkpointPrice: 150,
    priceChangePercent: 0,
    idiosyncraticChangePercent: 0,
    benchmarkChangePercent: 0,
    sectorChangePercent: 0,
    volumeRatio: 1.0,
    gapPercent: 0,
    gapHeld: false,
    rawScore: 0,
    attentionScore: 0,
    severity: 'NOMINAL',
    freshness: 'DEMO',
    reasons: [],
    sparkline: [],
    ...overrides,
  };
}

describe('Module 11 — Attention Budget & Prioritized Radar Tests', () => {
  it('1. zero meaningful changes → empty calming budget', () => {
    const nominalItems: RadarItemResult[] = [
      createMockRadarItem({ symbol: 'AAPL', severity: 'NOMINAL', attentionScore: 5 }),
      createMockRadarItem({ symbol: 'MSFT', severity: 'NOMINAL', attentionScore: 12 }),
      createMockRadarItem({ symbol: 'GOOGL', severity: 'NOMINAL', attentionScore: 0 }),
    ];

    const budget = computeAttentionBudget(nominalItems, 3);

    expect(budget.isCalm).toBe(true);
    expect(budget.budgetCount).toBe(0);
    expect(budget.totalMeaningfulCount).toBe(0);
    expect(budget.items).toHaveLength(0);
    expect(budget.message).toBe('Nothing needs your attention.');
  });

  it('2. empty items array → safe calming budget', () => {
    const budget = computeAttentionBudget([], 3);

    expect(budget.isCalm).toBe(true);
    expect(budget.budgetCount).toBe(0);
    expect(budget.items).toHaveLength(0);
    expect(budget.message).toBe('Nothing needs your attention.');
  });

  it('3. one meaningful change → exactly one item with singular message', () => {
    const items: RadarItemResult[] = [
      createMockRadarItem({ symbol: 'AAPL', severity: 'NOMINAL', attentionScore: 10 }),
      createMockRadarItem({
        symbol: 'NVDA',
        name: 'NVIDIA Corporation',
        severity: 'CRITICAL',
        attentionScore: 100,
        priceChangePercent: 0.068,
        reasons: [
          {
            code: 'ALPHA_BREAKOUT',
            title: 'Company-Specific Outlier',
            description: 'Significant idiosyncratic divergence',
            severity: 'CRITICAL',
            contributionWeight: 115,
            metricValue: 6.4,
            baselineValue: 0.4,
          },
        ],
      }),
      createMockRadarItem({ symbol: 'MSFT', severity: 'NOMINAL', attentionScore: 15 }),
    ];

    const budget = computeAttentionBudget(items, 3);

    expect(budget.isCalm).toBe(false);
    expect(budget.budgetCount).toBe(1);
    expect(budget.totalMeaningfulCount).toBe(1);
    expect(budget.message).toBe('1 thing worth your attention');
    expect(budget.items).toHaveLength(1);
    expect(budget.items[0]).toEqual({
      symbol: 'NVDA',
      name: 'NVIDIA Corporation',
      severity: 'CRITICAL',
      attentionScore: 100,
      headlineReason: 'Company-Specific Outlier',
      rank: 1,
      priceChangePercent: 0.068,
    });
  });

  it('4. multiple meaningful changes (4+) → top 3 only, bounded by attention priority', () => {
    const items: RadarItemResult[] = [
      createMockRadarItem({
        symbol: 'NVDA',
        name: 'NVIDIA Corp',
        severity: 'CRITICAL',
        attentionScore: 100,
        reasons: [{ code: 'ALPHA_BREAKOUT', title: 'Company-Specific Outlier', description: '', severity: 'CRITICAL', contributionWeight: 50, metricValue: 5, baselineValue: 0 }],
      }),
      createMockRadarItem({
        symbol: 'XOM',
        name: 'Exxon Mobil',
        severity: 'ELEVATED',
        attentionScore: 65,
        reasons: [{ code: 'SECTOR_DIVERGENCE', title: 'Energy Sector Outlier', description: '', severity: 'ELEVATED', contributionWeight: 40, metricValue: 4, baselineValue: 0 }],
      }),
      createMockRadarItem({
        symbol: 'TSLA',
        name: 'Tesla Inc',
        severity: 'INFO',
        attentionScore: 42,
        reasons: [{ code: 'VOLUME_SURGE', title: 'Abnormal Trading Volume', description: '', severity: 'INFO', contributionWeight: 20, metricValue: 2, baselineValue: 1 }],
      }),
      createMockRadarItem({
        symbol: 'AMD',
        name: 'Advanced Micro Devices',
        severity: 'INFO',
        attentionScore: 35,
        reasons: [{ code: 'ALPHA_BREAKOUT', title: 'Mild Divergence', description: '', severity: 'INFO', contributionWeight: 15, metricValue: 1.5, baselineValue: 0 }],
      }),
      createMockRadarItem({
        symbol: 'INTC',
        name: 'Intel Corp',
        severity: 'INFO',
        attentionScore: 31,
      }),
    ];

    const budget = computeAttentionBudget(items, 3);

    expect(budget.isCalm).toBe(false);
    expect(budget.budgetCount).toBe(3);
    expect(budget.totalMeaningfulCount).toBe(5);
    expect(budget.message).toBe('3 things worth your attention');
    expect(budget.items).toHaveLength(3);

    // Strictly ordered by attentionScore descending
    expect(budget.items[0].symbol).toBe('NVDA');
    expect(budget.items[0].attentionScore).toBe(100);
    expect(budget.items[0].rank).toBe(1);

    expect(budget.items[1].symbol).toBe('XOM');
    expect(budget.items[1].attentionScore).toBe(65);
    expect(budget.items[1].rank).toBe(2);

    expect(budget.items[2].symbol).toBe('TSLA');
    expect(budget.items[2].attentionScore).toBe(42);
    expect(budget.items[2].rank).toBe(3);

    // 4th and 5th items are omitted from the budget
    expect(budget.items.some((i) => i.symbol === 'AMD')).toBe(false);
    expect(budget.items.some((i) => i.symbol === 'INTC')).toBe(false);
  });

  it('5. ordering strictly follows existing attention priority', () => {
    // Deliberately unsorted input
    const items: RadarItemResult[] = [
      createMockRadarItem({ symbol: 'MID', severity: 'ELEVATED', attentionScore: 60 }),
      createMockRadarItem({ symbol: 'LOW', severity: 'INFO', attentionScore: 32 }),
      createMockRadarItem({ symbol: 'HIGH', severity: 'CRITICAL', attentionScore: 95 }),
    ];

    const budget = computeAttentionBudget(items, 3);

    expect(budget.items.map((i) => i.symbol)).toEqual(['HIGH', 'MID', 'LOW']);
    expect(budget.items.map((i) => i.rank)).toEqual([1, 2, 3]);
  });

  it('6. nominal assets never appear in budget even if budget has unfilled slots', () => {
    const items: RadarItemResult[] = [
      createMockRadarItem({ symbol: 'CRIT', severity: 'CRITICAL', attentionScore: 90 }),
      createMockRadarItem({ symbol: 'NOM1', severity: 'NOMINAL', attentionScore: 25 }),
      createMockRadarItem({ symbol: 'NOM2', severity: 'NOMINAL', attentionScore: 10 }),
      createMockRadarItem({ symbol: 'NOM3', severity: 'NOMINAL', attentionScore: 0 }),
    ];

    const budget = computeAttentionBudget(items, 3);

    expect(budget.budgetCount).toBe(1);
    expect(budget.totalMeaningfulCount).toBe(1);
    expect(budget.items).toHaveLength(1);
    expect(budget.items[0].symbol).toBe('CRIT');
    // None of NOM1, NOM2, NOM3 are included
    expect(budget.items.some((i) => i.symbol.startsWith('NOM'))).toBe(false);
  });

  it('7. works seamlessly when watchlist contains fewer than 3 assets (1 or 2 stocks)', () => {
    // 1-stock watchlist with anomaly
    const singleStockList: RadarItemResult[] = [
      createMockRadarItem({ symbol: 'NVDA', severity: 'CRITICAL', attentionScore: 100 }),
    ];
    const singleBudget = computeAttentionBudget(singleStockList, 3);
    expect(singleBudget.budgetCount).toBe(1);
    expect(singleBudget.message).toBe('1 thing worth your attention');

    // 2-stock watchlist with 2 anomalies
    const twoStockList: RadarItemResult[] = [
      createMockRadarItem({ symbol: 'NVDA', severity: 'CRITICAL', attentionScore: 100 }),
      createMockRadarItem({ symbol: 'AAPL', severity: 'ELEVATED', attentionScore: 70 }),
    ];
    const twoBudget = computeAttentionBudget(twoStockList, 3);
    expect(twoBudget.budgetCount).toBe(2);
    expect(twoBudget.message).toBe('2 things worth your attention');
    expect(twoBudget.items).toHaveLength(2);
  });

  it('8. works with 30-stock maximum watchlist capacity', () => {
    const largeWatchlist: RadarItemResult[] = Array.from({ length: 30 }, (_, idx) => {
      const score = idx === 0 ? 95 : idx === 1 ? 75 : idx === 2 ? 65 : idx === 3 ? 50 : 10;
      const severity: Severity = score >= 85 ? 'CRITICAL' : score >= 60 ? 'ELEVATED' : score >= 30 ? 'INFO' : 'NOMINAL';
      return createMockRadarItem({
        symbol: `SYM${idx + 1}`,
        name: `Asset ${idx + 1}`,
        attentionScore: score,
        severity,
      });
    });

    const budget = computeAttentionBudget(largeWatchlist, 3);

    expect(budget.budgetCount).toBe(3);
    expect(budget.totalMeaningfulCount).toBe(4); // 95, 75, 65, 50
    expect(budget.items).toHaveLength(3);
    expect(budget.items[0].symbol).toBe('SYM1');
    expect(budget.items[1].symbol).toBe('SYM2');
    expect(budget.items[2].symbol).toBe('SYM3');
  });

  it('9. immutability: budget extraction leaves input items and scores strictly unmutated', () => {
    const originalItem = createMockRadarItem({
      symbol: 'NVDA',
      attentionScore: 100,
      severity: 'CRITICAL',
      rawScore: 164,
    });
    const items = [originalItem];
    const snapshotBefore = JSON.stringify(items);

    const budget = computeAttentionBudget(items, 3);

    expect(JSON.stringify(items)).toBe(snapshotBefore);
    expect(originalItem.rawScore).toBe(164);
    expect(originalItem.attentionScore).toBe(100);
    expect(budget.items[0].attentionScore).toBe(100);
  });

  describe('Integration with Live Demo Scenarios', () => {
    it('Scenario 1 (QUIET): produces 0 things worth attention (calm state)', () => {
      const res = evaluateRadar({
        checkpoint: INITIAL_CHECKPOINT,
        scenario: 'QUIET',
      });

      expect(res.attentionBudget).toBeDefined();
      expect(res.attentionBudget!.isCalm).toBe(true);
      expect(res.attentionBudget!.budgetCount).toBe(0);
      expect(res.attentionBudget!.message).toBe('Nothing needs your attention.');
      expect(res.attentionBudget!.items).toHaveLength(0);
    });

    it('Scenario 2 (STOCK_SPIKE): establishes NVDA as #1 in attention budget', () => {
      const res = evaluateRadar({
        checkpoint: INITIAL_CHECKPOINT,
        scenario: 'STOCK_SPIKE',
      });

      expect(res.attentionBudget).toBeDefined();
      expect(res.attentionBudget!.isCalm).toBe(false);
      expect(res.attentionBudget!.budgetCount).toBe(1);
      expect(res.attentionBudget!.message).toBe('1 thing worth your attention');
      expect(res.attentionBudget!.items[0].symbol).toBe('NVDA');
      expect(res.attentionBudget!.items[0].severity).toBe('CRITICAL');
      expect(res.attentionBudget!.items[0].attentionScore).toBe(100);
      expect(res.attentionBudget!.items[0].headlineReason).toBe('Company-Specific Divergence');
    });

    it('Scenario 3 (SECTOR_RUN): surfaces energy anomaly (XOM) in attention budget', () => {
      const res = evaluateRadar({
        checkpoint: INITIAL_CHECKPOINT,
        scenario: 'SECTOR_RUN',
      });

      expect(res.attentionBudget).toBeDefined();
      expect(res.attentionBudget!.isCalm).toBe(false);
      expect(res.attentionBudget!.items.some((i) => i.symbol === 'XOM')).toBe(true);
      const xom = res.attentionBudget!.items.find((i) => i.symbol === 'XOM')!;
      expect(xom.severity).not.toBe('NOMINAL');
    });

    it('Scenario 4 (MARKET_CRASH): caps at top 3 anomalies with broad-market context', () => {
      const res = evaluateRadar({
        checkpoint: INITIAL_CHECKPOINT,
        scenario: 'MARKET_CRASH',
      });

      expect(res.attentionBudget).toBeDefined();
      // Only meaningful anomalies appear, never padded with nominal assets
      expect(res.attentionBudget!.budgetCount).toBe(res.summary.anomaliesDetected);
      expect(res.attentionBudget!.budgetCount).toBeLessThanOrEqual(3);
      if (res.attentionBudget!.budgetCount > 0) {
        expect(res.attentionBudget!.items[0].severity).not.toBe('NOMINAL');
      }
    });

    it('Scenario 5 (STALE): does not manufacture synthetic attention urgency purely from stale timestamp', () => {
      const res = evaluateRadar({
        checkpoint: INITIAL_CHECKPOINT,
        scenario: 'STALE',
      });

      expect(res.attentionBudget).toBeDefined();
      // STALE scenario has nominal equities; it shouldn't manufacture critical false alerts
      expect(res.attentionBudget!.items.every((i) => i.severity !== 'CRITICAL')).toBe(true);
    });

    it('Scenario 6 (PROVIDER_FAILURE): does not invent new anomalies during cached fallback', () => {
      const res = evaluateRadar({
        checkpoint: INITIAL_CHECKPOINT,
        scenario: 'PROVIDER_FAILURE',
      });

      expect(res.attentionBudget).toBeDefined();
      expect(res.attentionBudget!.isCalm).toBe(true);
      expect(res.attentionBudget!.budgetCount).toBe(0);
    });
  });
});
