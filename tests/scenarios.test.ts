import { describe, it, expect } from 'vitest';
import { evaluateRadar } from '../src/server/services/radar-service';
import { INITIAL_CHECKPOINT } from '../src/server/market-data/mock-fixtures';

describe('Radar Scenarios Integration Tests', () => {
  it('Scenario 1: QUIET produces zero meaningful anomalies with nominal volumes', () => {
    const res = evaluateRadar({
      checkpoint: INITIAL_CHECKPOINT,
      scenario: 'QUIET',
    });

    // Zero meaningful anomalies
    expect(res.summary.isCalmState).toBe(true);
    expect(res.summary.anomaliesDetected).toBe(0);
    expect(res.summary.overallMarketStatus).toBe('NOMINAL');

    // All tracked equities remain nominal
    expect(res.items.every((i) => i.severity === 'NOMINAL')).toBe(true);
    expect(res.items.every((i) => i.attentionScore < 30)).toBe(true);
    expect(res.items.every((i) => i.reasons.length === 0)).toBe(true);

    // Normal, non-anomalous volumes (~1.0x volume ratio, no artificial extremes)
    expect(res.items.every((i) => i.volumeRatio >= 0.8 && i.volumeRatio <= 1.2)).toBe(true);
  });

  it('Scenario 2: STOCK_SPIKE establishes NVDA as the genuine single-stock anomaly', () => {
    const res = evaluateRadar({
      checkpoint: INITIAL_CHECKPOINT,
      scenario: 'STOCK_SPIKE',
    });

    expect(res.summary.isCalmState).toBe(false);

    // 1. NVDA is highest-ranked
    const topItem = res.items[0];
    expect(topItem.symbol).toBe('NVDA');

    // 2. NVDA is CRITICAL with genuine catalyst signals
    expect(topItem.severity).toBe('CRITICAL');
    expect(topItem.attentionScore).toBe(100);
    expect(topItem.priceChangePercent).toBeGreaterThan(0.06); // +6.8%
    expect(topItem.volumeRatio).toBeCloseTo(3.4, 1); // 3.4x elevated volume
    expect(topItem.gapHeld).toBe(true);
    expect(topItem.reasons.some((r) => r.code === 'ALPHA_BREAKOUT')).toBe(true);
    expect(topItem.reasons.some((r) => r.code === 'VOLUME_SURGE')).toBe(true);
    expect(topItem.reasons.some((r) => r.code === 'GAP_UNFILLED')).toBe(true);

    // 3. Unrelated equities do NOT become CRITICAL solely from fixture volume
    const otherEquities = res.items.filter((i) => i.symbol !== 'NVDA');
    expect(otherEquities.every((i) => i.severity !== 'CRITICAL')).toBe(true);
    expect(otherEquities.every((i) => i.severity !== 'ELEVATED')).toBe(true);

    // Verify unrelated equities maintain normal volume (near 1.0x) and zero accidental alerts
    otherEquities.forEach((item) => {
      expect(item.volumeRatio).toBeLessThanOrEqual(1.2);
      expect(Math.abs(item.priceChangePercent)).toBeLessThan(0.01);
      expect(item.severity).toBe('NOMINAL');
    });
  });

  it('Scenario 3: SECTOR_RUN decouples sector tide from company-specific breakouts', () => {
    const res = evaluateRadar({
      checkpoint: INITIAL_CHECKPOINT,
      scenario: 'SECTOR_RUN',
    });

    // Dominant sector move detected as Energy (XLE)
    expect(res.marketContext.dominantSectorMove).toBeDefined();
    expect(res.marketContext.dominantSectorMove?.sectorEtf).toBe('XLE');
    expect(res.marketContext.dominantSectorMove?.changePercent).toBeGreaterThan(0.035);

    // XOM moves with XLE
    const xom = res.items.find((i) => i.symbol === 'XOM');
    expect(xom).toBeDefined();
    expect(xom!.priceChangePercent).toBeGreaterThan(0.04); // +4.5%

    // Sector context explains most of XOM move; idiosyncratic score remains limited
    expect(xom!.sectorChangePercent).toBeGreaterThan(0.035);
    expect(Math.abs(xom!.idiosyncraticChangePercent)).toBeLessThan(0.025); // ~1.57% idio, not an isolated breakout
    expect(xom!.severity).not.toBe('CRITICAL'); // Limited idiosyncratic score, not critical

    // Non-energy equities remain nominal with normal volume
    const nonEnergy = res.items.filter((i) => i.symbol !== 'XOM');
    expect(nonEnergy.every((i) => i.severity === 'NOMINAL')).toBe(true);
    expect(nonEnergy.every((i) => i.volumeRatio <= 1.2)).toBe(true);
  });

  it('Scenario 4: MARKET_CRASH reflects benchmark-relative context without false company alerts', () => {
    const res = evaluateRadar({
      checkpoint: INITIAL_CHECKPOINT,
      scenario: 'MARKET_CRASH',
    });

    // Macro tide reflected
    expect(res.summary.overallMarketStatus).toBe('HIGH_VOLATILITY');
    expect(res.marketContext.benchmarkChangePercent).toBeLessThan(-0.025);

    // Multiple equities decline in unison
    const fallingEquities = res.items.filter((i) => i.priceChangePercent < -0.02);
    expect(fallingEquities.length).toBeGreaterThanOrEqual(4);

    // Broad market context is reflected: equities are not falsely characterized as company-specific failures
    const hasBroadMarketBeta = res.items.some((i) =>
      i.reasons.some((r) => r.code === 'BROAD_MARKET_BETA')
    );
    expect(hasBroadMarketBeta).toBe(true);

    // Realistic volumes during selloff (1.4x-1.8x, no absurd 30x-300x volume multiples)
    expect(res.items.every((i) => i.volumeRatio < 3.0)).toBe(true);
  });

  it('Scenario 5: STALE highlights data integrity without manufactured volume anomalies', () => {
    const res = evaluateRadar({
      checkpoint: INITIAL_CHECKPOINT,
      scenario: 'STALE',
    });

    // Freshness is STALE
    expect(res.freshness.status).toBe('STALE');
    expect(res.freshness.notice).toContain('delayed');
    expect(res.freshness.staleTickerCount).toBeGreaterThan(0);

    // Underlying values do not manufacture extreme volume anomalies
    expect(res.items.every((i) => i.volumeRatio <= 1.2)).toBe(true);
  });

  it('Scenario 6: PROVIDER_FAILURE engages cached fallback circuit breaker with coherent data', () => {
    const res = evaluateRadar({
      checkpoint: INITIAL_CHECKPOINT,
      scenario: 'PROVIDER_FAILURE',
    });

    // Freshness is CACHED_FALLBACK
    expect(res.freshness.status).toBe('CACHED_FALLBACK');
    expect(res.freshness.notice).toContain('offline');
    expect(res.items.length).toBe(8);

    // Coherent baseline cached values
    expect(res.items.every((i) => i.volumeRatio <= 1.2)).toBe(true);
    expect(res.items.every((i) => i.severity === 'NOMINAL')).toBe(true);
    expect(res.items.every((i) => i.attentionScore < 30)).toBe(true);
  });

  describe('Regression Safety: Scenario Switching & Checkpoint Consistency', () => {
    it('1. Switching from QUIET → STOCK_SPIKE produces expected state transitions', () => {
      // Step 1: Evaluate QUIET
      const quietRes = evaluateRadar({ scenario: 'QUIET' });
      expect(quietRes.summary.isCalmState).toBe(true);
      expect(quietRes.summary.anomaliesDetected).toBe(0);

      // Step 2: Switch to STOCK_SPIKE
      const spikeRes = evaluateRadar({ scenario: 'STOCK_SPIKE' });
      expect(spikeRes.summary.isCalmState).toBe(false);
      expect(spikeRes.summary.anomaliesDetected).toBe(1);

      const topItem = spikeRes.items[0];
      expect(topItem.symbol).toBe('NVDA');
      expect(topItem.severity).toBe('CRITICAL');
      expect(topItem.attentionScore).toBe(100);
      expect(topItem.priceChangePercent).toBeCloseTo(0.068, 3);
      expect(topItem.gapHeld).toBe(true);

      const attributionSum = topItem.reasons.reduce((sum, r) => sum + r.contributionWeight, 0);
      expect(topItem.rawScore).toBe(attributionSum);

      // Other 7 items remain NOMINAL
      expect(spikeRes.items.slice(1).every((i) => i.severity === 'NOMINAL')).toBe(true);
    });

    it('2. Switching from STOCK_SPIKE → QUIET clears anomalies into calm state', () => {
      // Step 1: Evaluate STOCK_SPIKE
      const spikeRes = evaluateRadar({ scenario: 'STOCK_SPIKE' });
      expect(spikeRes.summary.anomaliesDetected).toBe(1);

      // Step 2: Switch to QUIET
      const quietRes = evaluateRadar({ scenario: 'QUIET' });
      expect(quietRes.summary.isCalmState).toBe(true);
      expect(quietRes.summary.anomaliesDetected).toBe(0);
      expect(quietRes.items.every((i) => i.severity === 'NOMINAL')).toBe(true);
    });

    it('3. Switching scenarios after Mark as Seen does not corrupt subsequent scenario fixtures', () => {
      // Step 1: User is on STOCK_SPIKE and clicks "Mark as Seen"
      const acknowledgedSpike = evaluateRadar({
        scenario: 'STOCK_SPIKE',
        isAcknowledged: true,
      });
      expect(acknowledgedSpike.summary.isCalmState).toBe(true);
      expect(acknowledgedSpike.summary.anomaliesDetected).toBe(0);

      // Step 2: User switches to SECTOR_RUN - must evaluate fresh against canonical baseline
      const sectorRun = evaluateRadar({
        scenario: 'SECTOR_RUN',
        isAcknowledged: false,
      });
      expect(sectorRun.summary.isCalmState).toBe(false);
      const xom = sectorRun.items.find((i) => i.symbol === 'XOM');
      expect(xom).toBeDefined();
      expect(xom?.priceChangePercent).toBeGreaterThan(0.04);
      expect(sectorRun.marketContext.dominantSectorMove?.sectorEtf).toBe('XLE');

      // Step 3: User switches back to STOCK_SPIKE - must produce full original NVDA anomaly
      const resetSpike = evaluateRadar({
        scenario: 'STOCK_SPIKE',
        isAcknowledged: false,
      });
      expect(resetSpike.summary.isCalmState).toBe(false);
      expect(resetSpike.items[0].symbol).toBe('NVDA');
      expect(resetSpike.items[0].severity).toBe('CRITICAL');
      expect(resetSpike.items[0].attentionScore).toBe(100);
      expect(resetSpike.items.slice(1).every((i) => i.severity === 'NOMINAL')).toBe(true);
    });

    it('4. Evaluating with custom checkpointTimestamp does not distort demo scenario volume ratios', () => {
      // When evaluated through API where session checkpoint timestamp is recent (e.g. 1 minute ago)
      const res = evaluateRadar({
        scenario: 'STOCK_SPIKE',
        checkpointTimestamp: new Date(Date.now() - 60 * 1000).toISOString(),
      });

      // NVDA should still be 3.4x volume and CRITICAL
      const nvda = res.items.find((i) => i.symbol === 'NVDA');
      expect(nvda?.severity).toBe('CRITICAL');
      expect(nvda?.volumeRatio).toBeCloseTo(3.4, 1);

      // AAPL and other equities must NOT explode to 30x-300x volume multiples
      const aapl = res.items.find((i) => i.symbol === 'AAPL');
      expect(aapl?.volumeRatio).toBeCloseTo(1.0, 1);
      expect(aapl?.severity).toBe('NOMINAL');

      const otherEquities = res.items.filter((i) => i.symbol !== 'NVDA');
      expect(otherEquities.every((i) => i.volumeRatio <= 1.2)).toBe(true);
      expect(otherEquities.every((i) => i.severity === 'NOMINAL')).toBe(true);
    });

    it('5. Demo scenarios must NEVER report LIVE freshness', () => {
      const allScenarios = [
        'QUIET',
        'STOCK_SPIKE',
        'SECTOR_RUN',
        'MARKET_CRASH',
        'STALE',
        'PROVIDER_FAILURE',
      ] as const;

      allScenarios.forEach((scenario) => {
        const res = evaluateRadar({ scenario });

        // Freshness status must never be 'LIVE' for deterministic demo/mock scenarios
        expect(res.freshness.status).not.toBe('LIVE');
        expect(res.items.every((i) => i.freshness !== 'LIVE')).toBe(true);

        if (scenario === 'STALE') {
          expect(res.freshness.status).toBe('STALE');
        } else if (scenario === 'PROVIDER_FAILURE') {
          expect(res.freshness.status).toBe('CACHED_FALLBACK');
        } else {
          expect(res.freshness.status).toBe('DEMO');
        }
      });
    });
  });
});
