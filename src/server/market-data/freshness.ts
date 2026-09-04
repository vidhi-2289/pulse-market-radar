/**
 * PULSE — Freshness Contract & Classification Engine
 * Centralized, reusable classification logic for market data freshness and latency tiers.
 *
 * Latency Tiers:
 * - DEMO: Synthetic/deterministic mock data for testing and demonstrations.
 * - CACHED_FALLBACK: Circuit-breaker fallback snapshot served when upstream provider is offline.
 * - LIVE: Real-time market print, received within <= 60 seconds of exchange execution.
 * - DELAYED: Standard exchange-delayed print (typically 15-minute delay, <= 20 minutes age).
 * - STALE: Data older than 20 minutes, indicating frozen feeds, closed markets, or disconnected streams.
 */

import { FreshnessStatus } from '@/types';

export interface FreshnessClassificationParams {
  /**
   * ISO 8601 string or Date of the underlying market quote/print.
   */
  marketTimestamp: string | Date;

  /**
   * ISO 8601 string or Date when Pulse ingested the data (optional).
   */
  fetchedAt?: string | Date;

  /**
   * Whether the data is synthetic/simulated demo data.
   */
  isSynthetic?: boolean;

  /**
   * Whether the data was served from a cached fallback due to upstream error.
   */
  isCachedFallback?: boolean;

  /**
   * Explicit wall-clock reference time (useful for deterministic unit testing).
   */
  now?: string | Date | number;
}

/**
 * Standard thresholds in seconds
 */
export const FRESHNESS_THRESHOLDS = {
  LIVE_MAX_AGE_SECONDS: 60, // 1 minute
  DELAYED_MAX_AGE_SECONDS: 20 * 60, // 20 minutes (15m exchange delay + 5m grace window)
} as const;

/**
 * Pure function classifying market data into canonical FreshnessStatus.
 */
export function classifyFreshness(params: FreshnessClassificationParams): FreshnessStatus {
  // 1. Synthetic / Demo data is unconditionally DEMO
  if (params.isSynthetic) {
    return 'DEMO';
  }

  // 2. Cached fallback data is unconditionally CACHED_FALLBACK
  if (params.isCachedFallback) {
    return 'CACHED_FALLBACK';
  }

  // 3. Evaluate age of underlying market quote
  const marketTime = new Date(params.marketTimestamp).getTime();
  if (isNaN(marketTime)) {
    return 'STALE';
  }

  const refTime = params.now
    ? new Date(params.now).getTime()
    : Date.now();

  const ageSeconds = Math.max(0, (refTime - marketTime) / 1000);

  if (ageSeconds <= FRESHNESS_THRESHOLDS.LIVE_MAX_AGE_SECONDS) {
    return 'LIVE';
  }

  if (ageSeconds <= FRESHNESS_THRESHOLDS.DELAYED_MAX_AGE_SECONDS) {
    return 'DELAYED';
  }

  return 'STALE';
}
