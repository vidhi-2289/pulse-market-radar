import { describe, it, expect } from 'vitest';
import {
  calculateRawReturn,
  calculateRelativeReturn,
  calculateVolumeRatio,
  calculateGapPercent,
  calculateAttentionScore,
  calculateRawAttentionScore,
  classifySeverity,
  generateReasons,
  evaluateRadarItem,
} from '../src/server/engine/change-engine';
import { MarketSnapshot, WatchlistItem } from '../src/types';

describe('Deterministic Meaningful Change Engine', () => {
  describe('calculateRawReturn', () => {
    it('handles zero change accurately', () => {
      expect(calculateRawReturn(150, 150)).toBe(0);
    });

    it('calculates positive movement correctly', () => {
      const ret = calculateRawReturn(165, 150);
      expect(ret).toBeCloseTo(0.1, 5); // +10%
    });

    it('calculates negative movement correctly', () => {
      const ret = calculateRawReturn(135, 150);
      expect(ret).toBeCloseTo(-0.1, 5); // -10%
    });

    it('handles edge cases (zero or negative baseline)', () => {
      expect(calculateRawReturn(100, 0)).toBe(0);
      expect(calculateRawReturn(100, -50)).toBe(0);
      expect(calculateRawReturn(0, 100)).toBe(-1);
    });
  });

  describe('calculateRelativeReturn', () => {
    it('decouples idiosyncratic move from sector and market', () => {
      // Stock +4%, Sector +1%, Market 0% => Expected move = 0.7*0.01 + 0.3*0 = 0.007
      // Idiosyncratic = 0.04 - 0.007 = 0.033 (+3.3%)
      const idio = calculateRelativeReturn(0.04, 0.01, 0, true);
      expect(idio).toBeCloseTo(0.033, 4);
    });

    it('correctly attributes market beta tide', () => {
      // Stock +3%, Sector +3%, Market +3% => Idiosyncratic should be 0
      const idio = calculateRelativeReturn(0.03, 0.03, 0.03, true);
      expect(idio).toBeCloseTo(0, 5);
    });

    it('handles missing sector benchmark by falling back to broad market', () => {
      // Stock +4%, Market +1%, no sector benchmark
      const idio = calculateRelativeReturn(0.04, 0, 0.01, false);
      expect(idio).toBeCloseTo(0.03, 5); // 0.04 - 0.01
    });
  });

  describe('calculateVolumeRatio', () => {
    it('calculates expected interval volume ratio', () => {
      // ADV = 39,000,000. In 60 minutes, expected = 39M * (60/390) = 6,000,000
      // If observed volume is 12,000,000, ratio should be 2.0x
      const ratio = calculateVolumeRatio(12_000_000, 0, 39_000_000, 60);
      expect(ratio).toBeCloseTo(2.0, 1);
    });

    it('protects against division by zero when ADV is missing or zero', () => {
      expect(calculateVolumeRatio(500_000, 0, 0, 60)).toBe(1.0);
      expect(calculateVolumeRatio(500_000, 0, -100, 60)).toBe(1.0);
    });

    it('handles zero or negative elapsed minutes gracefully', () => {
      const ratio = calculateVolumeRatio(1_000_000, 0, 39_000_000, 0);
      expect(Number.isFinite(ratio)).toBe(true);
      expect(ratio).toBeGreaterThan(0);
    });
  });

  describe('calculateGapPercent', () => {
    it('identifies sustained gap up', () => {
      // PrevClose 100, Open 102, Current 103 => Gap +2%, Held = true
      const res = calculateGapPercent(102, 100, 103);
      expect(res.gapPercent).toBeCloseTo(0.02, 3);
      expect(res.gapHeld).toBe(true);
    });

    it('identifies faded gap up', () => {
      // PrevClose 100, Open 102, Current 101 => Gap +2%, Held = false
      const res = calculateGapPercent(102, 100, 101);
      expect(res.gapPercent).toBeCloseTo(0.02, 3);
      expect(res.gapHeld).toBe(false);
    });

    it('handles zero or missing prices', () => {
      const res = calculateGapPercent(0, 100);
      expect(res.gapPercent).toBe(0);
      expect(res.gapHeld).toBe(false);
    });
  });

  describe('calculateAttentionScore & Score Clamping', () => {
    it('returns 0 for zero delta / nominal conditions', () => {
      const score = calculateAttentionScore({
        idiosyncraticReturn: 0,
        volumeRatio: 1.0,
        gapPercent: 0,
        gapHeld: false,
      });
      expect(score).toBe(0);
    });

    it('produces high score for high idiosyncratic jump and volume surge', () => {
      // 5% idiosyncratic move = 5.0 * 18 = 90
      // 2.5x volume = 1.5 * 15 = 22.5
      // Total = 112.5 => Clamped to 100
      const score = calculateAttentionScore({
        idiosyncraticReturn: 0.05,
        volumeRatio: 2.5,
        gapPercent: 0.015,
        gapHeld: true,
      });
      expect(score).toBe(100);
    });

    it('strictly clamps between 0 and 100', () => {
      // Extreme outlier: +50% move on 10x volume
      const extremeScore = calculateAttentionScore({
        idiosyncraticReturn: 0.5,
        volumeRatio: 10.0,
        gapPercent: 0.2,
        gapHeld: true,
      });
      expect(extremeScore).toBe(100);

      // Negative values or zeros never go below 0
      const zeroScore = calculateAttentionScore({
        idiosyncraticReturn: 0,
        volumeRatio: 0.5,
        gapPercent: 0,
        gapHeld: false,
      });
      expect(zeroScore).toBe(0);
    });

    it('Raw score above 100 must produce final score 100', () => {
      // Raw calculation: (0.0657 * 100 * 18) + ((2.5 - 1) * 15) + (0.0255 * 100 * 10) = 118.26 + 22.5 + 25.5 = 166.26
      const raw = calculateRawAttentionScore({
        idiosyncraticReturn: 0.0657,
        volumeRatio: 2.5,
        gapPercent: 0.0255,
        gapHeld: true,
      });
      expect(raw).toBeGreaterThan(100);

      const finalScore = calculateAttentionScore({
        idiosyncraticReturn: 0.0657,
        volumeRatio: 2.5,
        gapPercent: 0.0255,
        gapHeld: true,
      });
      expect(finalScore).toBe(100);
    });

    it('Attribution may exceed 100 before final score clamping', () => {
      const reasons = generateReasons({
        symbol: 'NVDA',
        rawReturn: 0.068,
        idiosyncraticReturn: 0.0657,
        sectorReturn: 0.0027,
        marketReturn: 0.0014,
        volumeRatio: 2.5,
        gapPercent: 0.0255,
        gapHeld: true,
        sectorEtf: 'XLK',
      });

      const totalWeight = reasons.reduce((sum, r) => sum + r.contributionWeight, 0);
      expect(totalWeight).toBeGreaterThan(100);

      // Final attention score remains safely clamped at 100
      const finalScore = calculateAttentionScore({
        idiosyncraticReturn: 0.0657,
        volumeRatio: 2.5,
        gapPercent: 0.0255,
        gapHeld: true,
      });
      expect(finalScore).toBe(100);
    });

    it('guarantees displayed raw contribution strictly equals the sum of component rule attributions', () => {
      // Inputs corresponding to NVDA in Single-Stock Spike
      const idiosyncraticReturn = 0.0644;
      const volumeRatio = 2.5;
      const gapPercent = 0.0255;
      const gapHeld = true;

      const rawScore = calculateRawAttentionScore({
        idiosyncraticReturn,
        volumeRatio,
        gapPercent,
        gapHeld,
      });

      const reasons = generateReasons({
        symbol: 'NVDA',
        rawReturn: 0.068,
        idiosyncraticReturn,
        sectorReturn: 0.0036,
        marketReturn: 0.0014,
        volumeRatio,
        gapPercent,
        gapHeld,
        sectorEtf: 'XLK',
      });

      const attributionSum = reasons.reduce((sum, r) => sum + r.contributionWeight, 0);

      // Raw score must equal sum of individual rule weights exactly
      expect(rawScore).toBe(attributionSum);

      // Final attention score remains clamped at 100
      const finalScore = calculateAttentionScore({
        idiosyncraticReturn,
        volumeRatio,
        gapPercent,
        gapHeld,
      });
      expect(finalScore).toBe(100);
    });
  });

  describe('classifySeverity Boundaries', () => {
    it('maps scores strictly to canonical severity tiers', () => {
      expect(classifySeverity(0)).toBe('NOMINAL');
      expect(classifySeverity(29)).toBe('NOMINAL');
      expect(classifySeverity(30)).toBe('INFO');
      expect(classifySeverity(59)).toBe('INFO');
      expect(classifySeverity(60)).toBe('ELEVATED');
      expect(classifySeverity(84)).toBe('ELEVATED');
      expect(classifySeverity(85)).toBe('CRITICAL');
      expect(classifySeverity(100)).toBe('CRITICAL');
    });
  });

  describe('generateReasons', () => {
    it('generates structured reasons for idiosyncratic breakout', () => {
      const reasons = generateReasons({
        symbol: 'NVDA',
        rawReturn: 0.045,
        idiosyncraticReturn: 0.042,
        sectorReturn: 0.003,
        marketReturn: 0.001,
        volumeRatio: 2.8,
        gapPercent: 0.018,
        gapHeld: true,
        sectorEtf: 'XLK',
      });

      expect(reasons.length).toBeGreaterThanOrEqual(2);
      const alphaReason = reasons.find((r) => r.code === 'ALPHA_BREAKOUT');
      expect(alphaReason).toBeDefined();
      expect(alphaReason?.title).toBe('Company-Specific Divergence');
      expect(alphaReason?.description).toContain('NVDA');
      expect(alphaReason?.description).toContain('XLK');

      const volReason = reasons.find((r) => r.code === 'VOLUME_SURGE');
      expect(volReason).toBeDefined();
      expect(volReason?.metricValue).toBe(2.8);
    });

    it('generates Broad Market Beta reason when stock moves strictly with market', () => {
      const reasons = generateReasons({
        symbol: 'AAPL',
        rawReturn: -0.025,
        idiosyncraticReturn: 0.002, // Negligible idiosyncratic divergence
        sectorReturn: -0.026,
        marketReturn: -0.024,
        volumeRatio: 1.1,
        gapPercent: 0,
        gapHeld: false,
        sectorEtf: 'XLK',
      });

      expect(reasons.length).toBe(1);
      expect(reasons[0].code).toBe('BROAD_MARKET_BETA');
    });
  });

  describe('evaluateRadarItem Integration', () => {
    const mockItem: WatchlistItem = {
      symbol: 'NVDA',
      name: 'NVIDIA Corporation',
      sector: 'Technology',
      sectorEtf: 'XLK',
      displayOrder: 1,
    };

    const mockBaseSnapshot: MarketSnapshot = {
      symbol: 'NVDA',
      name: 'NVIDIA Corporation',
      price: 120.0,
      changePercent: 0,
      volume: 10_000_000,
      avgDailyVolume: 50_000_000,
      openPrice: 120.0,
      highPrice: 121.0,
      lowPrice: 119.5,
      previousClose: 120.0,
      timestamp: new Date().toISOString(),
      fetchedAt: new Date().toISOString(),
      provider: 'MOCK',
      freshness: 'DEMO',
      isSynthetic: true,
    };

    const mockCurrentSnapshot: MarketSnapshot = {
      ...mockBaseSnapshot,
      price: 126.0, // +5.0%
      volume: 35_000_000,
      openPrice: 122.0, // Gap up
      highPrice: 126.5,
    };

    const mockSectorSnapshot: MarketSnapshot = {
      symbol: 'XLK',
      name: 'Technology Select Sector SPDR',
      price: 200.0,
      changePercent: 0.002, // +0.2%
      volume: 10_000_000,
      avgDailyVolume: 15_000_000,
      openPrice: 200.0,
      highPrice: 200.5,
      lowPrice: 199.8,
      previousClose: 199.6,
      timestamp: new Date().toISOString(),
      fetchedAt: new Date().toISOString(),
      provider: 'MOCK',
      freshness: 'DEMO',
      isSynthetic: true,
    };

    const mockMarketSnapshot: MarketSnapshot = {
      symbol: 'SPY',
      name: 'SPDR S&P 500 ETF Trust',
      price: 550.0,
      changePercent: 0.001, // +0.1%
      volume: 25_000_000,
      avgDailyVolume: 70_000_000,
      openPrice: 550.0,
      highPrice: 551.0,
      lowPrice: 549.5,
      previousClose: 549.5,
      timestamp: new Date().toISOString(),
      fetchedAt: new Date().toISOString(),
      provider: 'MOCK',
      freshness: 'DEMO',
      isSynthetic: true,
    };

    it('evaluates complete radar item with high attention score for NVDA breakout', () => {
      const result = evaluateRadarItem({
        item: mockItem,
        currentSnapshot: mockCurrentSnapshot,
        checkpointSnapshot: mockBaseSnapshot,
        marketSnapshot: mockMarketSnapshot,
        sectorSnapshot: mockSectorSnapshot,
        elapsedMinutes: 120,
      });

      expect(result.symbol).toBe('NVDA');
      expect(result.priceChangePercent).toBeCloseTo(0.05, 3);
      expect(result.attentionScore).toBeGreaterThanOrEqual(80);
      expect(result.severity).toBe('CRITICAL');
      expect(result.reasons.length).toBeGreaterThan(0);
      expect(result.idiosyncraticChangePercent).toBeGreaterThan(0.04);
    });
  });
});
