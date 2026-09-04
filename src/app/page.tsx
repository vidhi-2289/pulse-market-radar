'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { DemoScenario, RadarItemResult, RadarResponse, WatchlistItem } from '@/types';
import { evaluateRadar } from '@/server/services/radar-service';
import { ProviderMode } from '@/server/market-data';
import { DEFAULT_WATCHLIST } from '@/server/market-data/mock-fixtures';
import { RadarHeader } from '@/components/header/RadarHeader';
import { CheckpointBanner } from '@/components/checkpoint/CheckpointBanner';
import { RadarCard } from '@/components/radar/RadarCard';
import { CalmHero } from '@/components/radar/CalmHero';
import { AttentionBudget } from '@/components/radar/AttentionBudget';
import { computeAttentionBudget } from '@/server/engine/attention-budget';
import { WatchlistTable } from '@/components/watchlist/WatchlistTable';
import { StockDetailModal } from '@/components/detail/StockDetailModal';
import { AlertTriangle, BellRing, Loader2 } from 'lucide-react';

export default function HomePage() {
  // 1. Runtime Provider Mode: DEMO (guaranteed deterministic) vs DELAYED (external Market Data API)
  const [providerMode, setProviderMode] = useState<ProviderMode>('DEMO');
  const [delayedRadarData, setDelayedRadarData] = useState<RadarResponse | null>(null);
  const [isLoadingDelayed, setIsLoadingDelayed] = useState(false);

  // 2. Interactive Demo Scenario state (Default to STOCK_SPIKE for immediate visual impact)
  const [scenario, setScenario] = useState<DemoScenario>('STOCK_SPIKE');

  // 3. Checkpoint acknowledged state & persisted timestamp
  const [isAcknowledged, setIsAcknowledged] = useState(false);
  const [persistedCheckpointTimestamp, setPersistedCheckpointTimestamp] = useState<string | null>(null);

  // 4. Stock Detail Drawer / Modal state
  const [selectedStock, setSelectedStock] = useState<RadarItemResult | null>(null);

  // 5. Persisted Watchlist state (seeded with DEFAULT_WATCHLIST for immediate SSR)
  const [persistedItems, setPersistedItems] = useState<WatchlistItem[]>(DEFAULT_WATCHLIST);

  // Load persisted session, watchlist, and checkpoint on mount
  useEffect(() => {
    let isMounted = true;

    async function loadSession() {
      try {
        const res = await fetch('/api/session');
        if (!res.ok) return;
        const data = await res.json();
        if (isMounted && data.watchlist?.items) {
          const items: WatchlistItem[] = data.watchlist.items.map(
            (i: { symbol: string; name: string | null; sector: string | null; sectorEtf: string | null; exchange?: string | null; displayOrder: number }) => ({
              symbol: i.symbol,
              name: i.name || i.symbol,
              sector: i.sector || 'General',
              sectorEtf: i.sectorEtf || 'SPY',
              exchange: i.exchange || undefined,
              displayOrder: i.displayOrder,
            })
          );
          setPersistedItems(items);
          if (data.checkpoint?.checkpointTimestamp) {
            setPersistedCheckpointTimestamp(data.checkpoint.checkpointTimestamp);
          }
        }
      } catch (err) {
        console.warn('[Pulse Frontend] Failed to load session from API:', err);
      }
    }

    loadSession();
    return () => {
      isMounted = false;
    };
  }, []);

  // 6. Deterministic Radar Evaluation using persisted watchlist & checkpoint (for Demo Mode)
  const rawRadarData = useMemo(() => {
    return evaluateRadar({
      scenario,
      isAcknowledged,
      watchlistItems: persistedItems,
      checkpointTimestamp: persistedCheckpointTimestamp || undefined,
      elapsedMinutes: isAcknowledged ? 0 : undefined,
    });
  }, [scenario, isAcknowledged, persistedItems, persistedCheckpointTimestamp]);

  // Fetch delayed market data from API when in external mode (MARKETDATA_LOCAL or legacy DELAYED)
  const isExternalMode = providerMode === 'MARKETDATA_LOCAL' || providerMode === 'DELAYED';

  useEffect(() => {
    let isMounted = true;
    if (!isExternalMode) return;

    async function loadDelayedData() {
      try {
        const res = await fetch(
          `/api/radar?mode=${providerMode}&scenario=${scenario}&acknowledged=${isAcknowledged}`
        );
        if (res.ok && isMounted) {
          const data: RadarResponse = await res.json();
          setDelayedRadarData(data);
        }
      } catch (err) {
        console.warn('[Pulse Frontend] Failed to fetch delayed market data:', err);
      } finally {
        if (isMounted) {
          setIsLoadingDelayed(false);
        }
      }
    }

    loadDelayedData();
    return () => {
      isMounted = false;
    };
  }, [isExternalMode, providerMode, scenario, isAcknowledged]);

  // Active Radar Data: External response when in external mode, otherwise instant deterministic demo
  const activeRadarData = useMemo(() => {
    if (isExternalMode && delayedRadarData) {
      return delayedRadarData;
    }
    return rawRadarData;
  }, [isExternalMode, delayedRadarData, rawRadarData]);

  const activeAnomalies = useMemo(() => {
    return activeRadarData.items.filter((item) => item.severity !== 'NOMINAL');
  }, [activeRadarData.items]);

  const attentionBudget = useMemo(() => {
    return activeRadarData.attentionBudget || computeAttentionBudget(activeRadarData.items, 3);
  }, [activeRadarData]);

  const isCalm = activeAnomalies.length === 0;

  // Sync selectedStock if items re-evaluate
  const currentSelectedStock = useMemo(() => {
    if (!selectedStock) return null;
    return activeRadarData.items.find((i) => i.symbol === selectedStock.symbol) || null;
  }, [selectedStock, activeRadarData.items]);

  // Handle Mode switching with loading indicator
  const handleSelectMode = useCallback((mode: ProviderMode) => {
    setProviderMode(mode);
    if (mode === 'MARKETDATA_LOCAL' || mode === 'DELAYED') {
      setIsLoadingDelayed(true);
      setIsAcknowledged(false);
    }
  }, []);

  // Handle "Mark as Seen" with backend persistence
  const handleAcknowledgeCheckpoint = useCallback(async () => {
    setIsAcknowledged(true);
    if (providerMode === 'MARKETDATA_LOCAL' || providerMode === 'DELAYED') {
      setIsLoadingDelayed(true);
    }
    try {
      const res = await fetch('/api/checkpoint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: 'User Acknowledged' }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.checkpoint?.checkpointTimestamp) {
          setPersistedCheckpointTimestamp(data.checkpoint.checkpointTimestamp);
        }
      }
    } catch (err) {
      console.warn('[Pulse Frontend] Failed to persist checkpoint:', err);
    }
  }, [providerMode]);

  // Handle Reset Checkpoint back to 2h demo baseline
  const handleResetCheckpoint = useCallback(() => {
    setIsAcknowledged(false);
  }, []);

  // Switching scenario resets acknowledged state so the new scenario shows its canonical fixture
  // Demo mode safety: switching scenarios NEVER mutates database persistence
  const handleSelectScenario = useCallback((newScenario: DemoScenario) => {
    setScenario(newScenario);
    setIsAcknowledged(false);
  }, []);

  // Watchlist Removal with persistence
  const handleRemoveSymbol = useCallback(async (symbol: string) => {
    // Optimistic UI update
    setPersistedItems((prev) => prev.filter((i) => i.symbol !== symbol));
    if (selectedStock?.symbol === symbol) {
      setSelectedStock(null);
    }

    try {
      await fetch(`/api/watchlist?symbol=${encodeURIComponent(symbol)}`, {
        method: 'DELETE',
      });
    } catch (err) {
      console.warn('[Pulse Frontend] Failed to persist removal:', err);
    }
  }, [selectedStock]);

  // Watchlist Addition with persistence
  const handleAddSymbol = useCallback(
    async (input: { symbol: string; name?: string; exchange?: string; sector?: string; sectorEtf?: string } | string) => {
      const payload = typeof input === 'string' ? { symbol: input } : input;
      const res = await fetch('/api/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Failed to add "${payload.symbol}"`);
      }

      const data = await res.json();
      if (data.watchlist?.items) {
        const items: WatchlistItem[] = data.watchlist.items.map(
          (i: { symbol: string; name: string | null; sector: string | null; sectorEtf: string | null; exchange?: string | null; displayOrder: number }) => ({
            symbol: i.symbol,
            name: i.name || i.symbol,
            sector: i.sector || 'General',
            sectorEtf: i.sectorEtf || 'SPY',
            exchange: i.exchange || undefined,
            displayOrder: i.displayOrder,
          })
        );
        setPersistedItems(items);
      }
    },
    []
  );

  // Restore Default Watchlist with persistence
  const handleRestoreDefaultWatchlist = useCallback(async () => {
    setPersistedItems(DEFAULT_WATCHLIST);
    try {
      const res = await fetch('/api/watchlist', { method: 'PUT' });
      if (res.ok) {
        const data = await res.json();
        if (data.watchlist?.items) {
          const items: WatchlistItem[] = data.watchlist.items.map(
            (i: { symbol: string; name: string | null; sector: string | null; sectorEtf: string | null; exchange?: string | null; displayOrder: number }) => ({
              symbol: i.symbol,
              name: i.name || i.symbol,
              sector: i.sector || 'General',
              sectorEtf: i.sectorEtf || 'SPY',
              exchange: i.exchange || undefined,
              displayOrder: i.displayOrder,
            })
          );
          setPersistedItems(items);
        }
      }
    } catch (err) {
      console.warn('[Pulse Frontend] Failed to restore default watchlist:', err);
    }
  }, []);

  const isCustomWatchlist = useMemo(() => {
    if (persistedItems.length !== DEFAULT_WATCHLIST.length) return true;
    const defaultSymbols = new Set(DEFAULT_WATCHLIST.map((i) => i.symbol));
    return persistedItems.some((i) => !defaultSymbols.has(i.symbol));
  }, [persistedItems]);

  return (
    <div className="flex flex-col min-h-screen">
      {/* 1. Header with Pulse Brand, Compact Demo Mode Popover, & Freshness Badge */}
      <RadarHeader
        freshnessStatus={activeRadarData.freshness.status}
        activeMode={providerMode}
        onSelectMode={handleSelectMode}
        activeScenario={scenario}
        onSelectScenario={handleSelectScenario}
      />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Loading Indicator for Delayed Feed */}
        {isLoadingDelayed && (
          <div className="flex items-center justify-center gap-2 p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-slate-300 text-xs animate-pulse">
            <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
            <span>Fetching Market Data · 24H Delayed quotes (Local Development Only)...</span>
          </div>
        )}

        {/* Notice alert for Stale or Fallback status */}
        {activeRadarData.freshness.notice && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-950/40 border border-amber-500/30 text-amber-200 text-xs backdrop-blur-md">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <div className="flex-1">
              <strong className="font-semibold text-amber-300">
                System Resilience Notice:
              </strong>{' '}
              <span>{activeRadarData.freshness.notice}</span>
            </div>
          </div>
        )}

        {/* 2. "Since You Last Checked" Focal Anchor Banner */}
        <CheckpointBanner
          radarData={{
            ...activeRadarData,
            summary: {
              ...activeRadarData.summary,
              totalAssetsTracked: activeRadarData.items.length,
              anomaliesDetected: activeAnomalies.length,
              isCalmState: isCalm,
            },
          }}
          onAcknowledgeCheckpoint={handleAcknowledgeCheckpoint}
          onResetCheckpoint={handleResetCheckpoint}
          isCustomCheckpoint={isAcknowledged}
        />

        {/* 2.5 Prioritized Attention Budget Summary */}
        <AttentionBudget
          budget={attentionBudget}
          radarItems={activeRadarData.items}
          onSelectStock={(selected) => setSelectedStock(selected)}
        />

        {/* 3. Attention Radar Feed or Calm State */}
        <section className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <BellRing className="w-4 h-4 text-cyan-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Meaningful Changes
              </h3>
            </div>
            <div className="text-xs text-slate-400">
              Ranked by <span className="text-cyan-400 font-semibold font-mono">Attention Priority</span>
            </div>
          </div>

          {isCalm ? (
            /* CALM STATE: Reassuring, high-polish zero state */
            <CalmHero
              totalAssets={activeRadarData.items.length}
              onExploreScenarios={() => handleSelectScenario('STOCK_SPIKE')}
            />
          ) : (
            /* ATTENTION CARDS: Rebalanced hierarchy, clickable to open detail */
            <div className="space-y-3.5">
              {activeAnomalies.map((item, index) => (
                <RadarCard
                  key={item.symbol}
                  item={item}
                  rank={index + 1}
                  onSelect={(selected) => setSelectedStock(selected)}
                />
              ))}
            </div>
          )}
        </section>

        {/* 4. Complete Watchlist Section */}
        <section className="pt-2">
          <WatchlistTable
            items={activeRadarData.items}
            onSelectStock={(selected) => setSelectedStock(selected)}
            onRemoveSymbol={handleRemoveSymbol}
            onRestoreDefault={handleRestoreDefaultWatchlist}
            onAddSymbol={handleAddSymbol}
            isCustomWatchlist={isCustomWatchlist}
          />
        </section>
      </main>

      {/* 5. Stock Detail Modal / Drawer */}
      <StockDetailModal
        item={currentSelectedStock}
        onClose={() => setSelectedStock(null)}
      />

      {/* Footer */}
      <footer className="border-t border-slate-900/80 bg-slate-950/60 py-6 text-xs text-slate-500">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>
            <strong className="text-slate-300">PULSE</strong> — Market Change Radar
          </div>
          <div className="text-center sm:text-right">
            Observational market intelligence · Respecting your attention
          </div>
        </div>
      </footer>
    </div>
  );
}
