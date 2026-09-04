/**
 * PULSE — Deterministic Meaningful Change Engine
 * Pure mathematical functions for market anomaly detection and factor attribution.
 *
 * Rules:
 * - Pure functions only
 * - No network calls
 * - No database calls
 * - No React dependencies
 * - Bounded output [0..100]
 * - Deterministic and 100% unit-testable
 */

import {
  AnomalyReason,
  FreshnessStatus,
  MarketSnapshot,
  RadarItemResult,
  Severity,
  SparklinePoint,
  WatchlistItem,
} from '@/types';

/**
 * 1. Calculate raw percentage return between two prices.
 * Returns decimal return (e.g. +0.024 for +2.4%).
 */
export function calculateRawReturn(currentPrice?: number | null, basePrice?: number | null): number {
  if (
    currentPrice === undefined ||
    currentPrice === null ||
    basePrice === undefined ||
    basePrice === null ||
    basePrice <= 0 ||
    !Number.isFinite(basePrice) ||
    !Number.isFinite(currentPrice) ||
    currentPrice < 0
  ) {
    return 0;
  }
  return (currentPrice - basePrice) / basePrice;
}

/**
 * 2. Calculate idiosyncratic return by removing market and sector beta drift.
 * R_idio = R_asset - (w_sec * R_sector + w_mkt * R_market)
 * Default weights: 70% sector, 30% broad market.
 * If sector benchmark is missing/unmapped: 100% broad market.
 */
export function calculateRelativeReturn(
  assetReturn: number,
  sectorReturn: number = 0,
  marketReturn: number = 0,
  hasSectorBenchmark: boolean = true
): number {
  if (!Number.isFinite(assetReturn)) return 0;
  const safeSector = Number.isFinite(sectorReturn) ? sectorReturn : 0;
  const safeMarket = Number.isFinite(marketReturn) ? marketReturn : 0;

  if (hasSectorBenchmark) {
    const wSec = 0.7;
    const wMkt = 0.3;
    const expectedMove = wSec * safeSector + wMkt * safeMarket;
    return assetReturn - expectedMove;
  }

  // Fallback to broad market only
  return assetReturn - safeMarket;
}

/**
 * 3. Calculate volume anomaly multiple.
 * Compares observed interval volume against time-of-day expected volume based on 20-day ADV.
 * A standard trading day has 390 minutes (9:30 AM to 4:00 PM EST).
 */
export function calculateVolumeRatio(
  currentCumulativeVolume?: number | null,
  checkpointCumulativeVolume?: number | null,
  avgDailyVolume?: number | null,
  elapsedMinutes: number = 60
): number {
  // If volume metrics or ADV are unsupplied by the provider, degrade gracefully to neutral 1.0x
  if (
    currentCumulativeVolume === undefined ||
    currentCumulativeVolume === null ||
    avgDailyVolume === undefined ||
    avgDailyVolume === null ||
    avgDailyVolume <= 0 ||
    !Number.isFinite(avgDailyVolume)
  ) {
    return 1.0; // Safe neutral ratio if ADV or volume is missing
  }

  const safeCurrent = Math.max(0, currentCumulativeVolume || 0);
  const safeCheckpoint = Math.max(0, checkpointCumulativeVolume || 0);
  
  // Observed volume during the window
  const intervalVolume =
    safeCurrent >= safeCheckpoint
      ? safeCurrent - safeCheckpoint
      : safeCurrent; // Fallback if counter reset

  // Elapsed trading minutes clamped between 1 and 390
  const effectiveMinutes = Math.min(390, Math.max(1, elapsedMinutes || 60));
  const fractionOfDay = effectiveMinutes / 390;
  const expectedVolume = avgDailyVolume * fractionOfDay;

  if (expectedVolume <= 0 || !Number.isFinite(expectedVolume)) {
    return 1.0;
  }

  const ratio = intervalVolume / expectedVolume;
  return Number.isFinite(ratio) ? Math.max(0, Math.round(ratio * 100) / 100) : 1.0;
}

/**
 * 4. Calculate opening gap percentage and determine if gap momentum held.
 * Gap% = (P_open - P_prev_close) / P_prev_close
 */
export function calculateGapPercent(
  openPrice?: number | null,
  previousClose?: number | null,
  currentPrice?: number | null
): { gapPercent: number; gapHeld: boolean } {
  // If open price or previous close is unavailable from provider, degrade gracefully to 0 gap
  if (
    openPrice === undefined ||
    openPrice === null ||
    previousClose === undefined ||
    previousClose === null ||
    openPrice <= 0 ||
    previousClose <= 0 ||
    !Number.isFinite(openPrice) ||
    !Number.isFinite(previousClose)
  ) {
    return { gapPercent: 0, gapHeld: false };
  }

  const gapPercent = (openPrice - previousClose) / previousClose;
  const safeCurrent = currentPrice && currentPrice > 0 ? currentPrice : openPrice;

  // Check if price held the gap direction
  let gapHeld = false;
  if (gapPercent > 0.005) {
    // Gap Up: held if current price remains at or above open price
    gapHeld = safeCurrent >= openPrice;
  } else if (gapPercent < -0.005) {
    // Gap Down: held if current price remains at or below open price
    gapHeld = safeCurrent <= openPrice;
  }

  return { gapPercent, gapHeld };
}

/**
 * 5a. Compute Raw Attention Score (unbounded sum of signals).
 * Documented Rounding Strategy:
 * To ensure visual and numerical consistency between the overall raw signal contribution
 * and the individual factor attribution rows displayed to the user, the component scores
 * are rounded to integer points (matching each rule's contributionWeight) and then summed.
 */
export function calculateRawAttentionScore(params: {
  idiosyncraticReturn: number;
  volumeRatio: number;
  gapPercent: number;
  gapHeld: boolean;
}): number {
  const { idiosyncraticReturn, volumeRatio, gapPercent, gapHeld } = params;

  // 1. Idiosyncratic Alpha Contribution (18 pts per 1.0% idiosyncratic return)
  const absIdioPct = Math.abs(idiosyncraticReturn) * 100;
  const alphaScore = Math.round(absIdioPct * 18.0);

  // 2. Volume Anomaly Contribution (15 pts per 1.0x excess volume above baseline 1.0x)
  const excessVolume = Math.max(0, volumeRatio - 1.0);
  const volumeScore = Math.round(excessVolume * 15.0);

  // 3. Gap Persistence Contribution (10 pts per 1.0% gap if held, 2 pts if faded)
  const absGapPct = Math.abs(gapPercent) * 100;
  const gapScore = Math.round(absGapPct * (gapHeld ? 10.0 : 2.0));

  const rawScore = alphaScore + volumeScore + gapScore;
  if (!Number.isFinite(rawScore) || rawScore <= 0) return 0;
  return rawScore;
}

/**
 * 5b. Compute Final Attention Score strictly clamped to [0..100].
 */
export function calculateAttentionScore(params: {
  idiosyncraticReturn: number;
  volumeRatio: number;
  gapPercent: number;
  gapHeld: boolean;
}): number {
  const rawScore = calculateRawAttentionScore(params);
  return Math.min(100, rawScore);
}

/**
 * 6. Classify Attention Score into discrete Severity tier.
 */
export function classifySeverity(attentionScore: number): Severity {
  if (attentionScore >= 85) return 'CRITICAL';
  if (attentionScore >= 60) return 'ELEVATED';
  if (attentionScore >= 30) return 'INFO';
  return 'NOMINAL';
}

/**
 * 7. Generate structured, human-readable reason objects explaining the score.
 */
export function generateReasons(params: {
  symbol: string;
  rawReturn: number;
  idiosyncraticReturn: number;
  sectorReturn: number;
  marketReturn: number;
  volumeRatio: number;
  gapPercent: number;
  gapHeld: boolean;
  sectorEtf: string;
}): AnomalyReason[] {
  const {
    symbol,
    rawReturn,
    idiosyncraticReturn,
    sectorReturn,
    marketReturn,
    volumeRatio,
    gapPercent,
    gapHeld,
    sectorEtf,
  } = params;

  const reasons: AnomalyReason[] = [];
  const formatPct = (val: number) =>
    `${val >= 0 ? '+' : ''}${(val * 100).toFixed(1)}%`;

  // Factor 1: Idiosyncratic Alpha Divergence
  if (Math.abs(idiosyncraticReturn) >= 0.015) {
    const isCritical = Math.abs(idiosyncraticReturn) >= 0.04;
    const isElevated = Math.abs(idiosyncraticReturn) >= 0.025;
    const direction = idiosyncraticReturn > 0 ? 'outperformed' : 'lagged';

    reasons.push({
      code: 'ALPHA_BREAKOUT',
      title: 'Company-Specific Divergence',
      description: `${symbol} moved ${formatPct(rawReturn)} and ${direction} sector (${sectorEtf} ${formatPct(sectorReturn)}), decoupling by ${formatPct(idiosyncraticReturn)} on idiosyncratic news.`,
      severity: isCritical ? 'CRITICAL' : isElevated ? 'ELEVATED' : 'INFO',
      contributionWeight: Math.round(Math.abs(idiosyncraticReturn) * 100 * 18.0),
      metricValue: Math.round(idiosyncraticReturn * 1000) / 10,
      baselineValue: Math.round(sectorReturn * 1000) / 10,
    });
  }

  // Factor 2: Volume Anomaly
  if (volumeRatio >= 1.7) {
    const isCritical = volumeRatio >= 3.0;
    const isElevated = volumeRatio >= 2.2;

    reasons.push({
      code: 'VOLUME_SURGE',
      title: 'Abnormal Trading Volume',
      description: `Trading at ${volumeRatio.toFixed(1)}x expected volume for this interval, confirming institutional velocity.`,
      severity: isCritical ? 'CRITICAL' : isElevated ? 'ELEVATED' : 'INFO',
      contributionWeight: Math.round(Math.max(0, volumeRatio - 1.0) * 15.0),
      metricValue: volumeRatio,
      baselineValue: 1.0,
    });
  }

  // Factor 3: Opening Gap Persistence
  if (Math.abs(gapPercent) >= 0.01) {
    const gapType = gapPercent > 0 ? 'gap up' : 'gap down';
    const status = gapHeld ? 'held through the session' : 'faded';

    reasons.push({
      code: 'GAP_UNFILLED',
      title: gapHeld ? 'Opening Gap Sustained' : 'Opening Gap Faded',
      description: `Opened with a ${formatPct(gapPercent)} ${gapType} that has ${status}.`,
      severity: Math.abs(gapPercent) >= 0.025 && gapHeld ? 'ELEVATED' : 'INFO',
      contributionWeight: Math.round(Math.abs(gapPercent) * 100 * (gapHeld ? 10.0 : 2.0)),
      metricValue: Math.round(gapPercent * 1000) / 10,
      baselineValue: 0,
    });
  }

  // Factor 4: Broad Market Beta / Tide (if large move but low idiosyncratic)
  if (
    Math.abs(rawReturn) >= 0.02 &&
    Math.abs(idiosyncraticReturn) < 0.01 &&
    reasons.length === 0
  ) {
    reasons.push({
      code: 'BROAD_MARKET_BETA',
      title: 'Broad Market Alignment',
      description: `${symbol}'s move of ${formatPct(rawReturn)} closely mirrors broader market tide (${formatPct(marketReturn)}), with minimal company-specific anomaly.`,
      severity: 'INFO',
      contributionWeight: 10,
      metricValue: Math.round(rawReturn * 1000) / 10,
      baselineValue: Math.round(marketReturn * 1000) / 10,
    });
  }

  return reasons;
}

/**
 * 8. Evaluate a complete RadarItemResult for an asset.
 */
export function evaluateRadarItem(params: {
  item: WatchlistItem;
  currentSnapshot: MarketSnapshot;
  checkpointSnapshot: MarketSnapshot;
  marketSnapshot?: MarketSnapshot;
  sectorSnapshot?: MarketSnapshot;
  elapsedMinutes?: number;
  freshness?: FreshnessStatus;
  sparkline?: SparklinePoint[];
  isAcknowledged?: boolean;
}): RadarItemResult {
  const {
    item,
    currentSnapshot,
    checkpointSnapshot,
    marketSnapshot,
    sectorSnapshot,
    elapsedMinutes = 60,
    freshness = 'DEMO',
    sparkline = [],
    isAcknowledged = false,
  } = params;

  // When user acknowledges ("Mark as Seen"), baseline is reset to the current moment.
  // All deltas since checkpoint are zero, producing a calm nominal state.
  if (isAcknowledged) {
    return {
      symbol: item.symbol,
      name: item.name,
      sector: item.sector,
      sectorEtf: item.sectorEtf,
      currentPrice: currentSnapshot.price,
      checkpointPrice: currentSnapshot.price,
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
      freshness,
      reasons: [],
      sparkline,
    };
  }

  // 1. Raw return since checkpoint
  const rawReturn = calculateRawReturn(
    currentSnapshot.price,
    checkpointSnapshot.price
  );

  // 2. Sector and Market returns since checkpoint
  const marketReturn = marketSnapshot
    ? calculateRawReturn(marketSnapshot.price, marketSnapshot.previousClose)
    : 0;

  const sectorReturn = sectorSnapshot
    ? calculateRawReturn(sectorSnapshot.price, sectorSnapshot.previousClose)
    : marketReturn;

  const hasSector = Boolean(sectorSnapshot && sectorSnapshot.symbol !== 'SPY');

  // 3. Idiosyncratic return
  const idioReturn = calculateRelativeReturn(
    rawReturn,
    sectorReturn,
    marketReturn,
    hasSector
  );

  // 4. Volume ratio
  const volumeRatio = calculateVolumeRatio(
    currentSnapshot.volume,
    checkpointSnapshot.volume,
    currentSnapshot.avgDailyVolume,
    elapsedMinutes
  );

  // 5. Gap analysis
  const { gapPercent, gapHeld } = calculateGapPercent(
    currentSnapshot.openPrice,
    currentSnapshot.previousClose,
    currentSnapshot.price
  );

  // 6. Attention score (raw & bounded)
  const rawScore = calculateRawAttentionScore({
    idiosyncraticReturn: idioReturn,
    volumeRatio,
    gapPercent,
    gapHeld,
  });

  const attentionScore = calculateAttentionScore({
    idiosyncraticReturn: idioReturn,
    volumeRatio,
    gapPercent,
    gapHeld,
  });

  // 7. Severity tier
  const severity = classifySeverity(attentionScore);

  // 8. Reason attribution
  const reasons = generateReasons({
    symbol: item.symbol,
    rawReturn,
    idiosyncraticReturn: idioReturn,
    sectorReturn,
    marketReturn,
    volumeRatio,
    gapPercent,
    gapHeld,
    sectorEtf: item.sectorEtf,
  });

  // Ensure displayed raw score strictly equals the sum of displayed factor attributions
  const attributionSum = reasons.reduce((sum, r) => sum + r.contributionWeight, 0);
  const finalRawScore = reasons.length > 0 ? attributionSum : rawScore;

  return {
    symbol: item.symbol,
    name: item.name,
    sector: item.sector,
    sectorEtf: item.sectorEtf,
    currentPrice: currentSnapshot.price,
    checkpointPrice: checkpointSnapshot.price,
    priceChangePercent: rawReturn,
    idiosyncraticChangePercent: idioReturn,
    benchmarkChangePercent: marketReturn,
    sectorChangePercent: sectorReturn,
    volumeRatio,
    gapPercent,
    gapHeld,
    rawScore: finalRawScore,
    attentionScore,
    severity,
    freshness,
    reasons,
    sparkline,
  };
}
