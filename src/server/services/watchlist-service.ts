/**
 * PULSE — Watchlist Management Service
 * Validates and persists user watchlists with duplicate prevention and size bounds.
 */

import {
  findActiveWatchlist,
  addWatchlistItem as dbAddWatchlistItem,
  removeWatchlistItem as dbRemoveWatchlistItem,
  restoreDefaultWatchlist as dbRestoreDefaultWatchlist,
} from '../db/store';
import {
  AddWatchlistItemSchema,
  RemoveWatchlistItemSchema,
  AddWatchlistItemDto,
  RemoveWatchlistItemDto,
} from '../validation/schemas';
import { PersistedWatchlist } from '@/types';

export const MAX_WATCHLIST_SIZE = 30;

// Known metadata lookup for common market tickers
const KNOWN_TICKERS: Record<string, { name: string; sector: string; sectorEtf: string }> = {
  NVDA: { name: 'NVIDIA Corporation', sector: 'Technology', sectorEtf: 'XLK' },
  AAPL: { name: 'Apple Inc.', sector: 'Technology', sectorEtf: 'XLK' },
  MSFT: { name: 'Microsoft Corporation', sector: 'Technology', sectorEtf: 'XLK' },
  TSLA: { name: 'Tesla, Inc.', sector: 'Consumer Discretionary', sectorEtf: 'XLY' },
  JPM: { name: 'JPMorgan Chase & Co.', sector: 'Financials', sectorEtf: 'XLF' },
  XOM: { name: 'Exxon Mobil Corporation', sector: 'Energy', sectorEtf: 'XLE' },
  SPY: { name: 'SPDR S&P 500 ETF Trust', sector: 'Market Benchmark', sectorEtf: 'SPY' },
  QQQ: { name: 'Invesco QQQ Trust', sector: 'Tech Benchmark', sectorEtf: 'QQQ' },
  AMZN: { name: 'Amazon.com, Inc.', sector: 'Consumer Discretionary', sectorEtf: 'XLY' },
  GOOGL: { name: 'Alphabet Inc.', sector: 'Communication Services', sectorEtf: 'XLC' },
  META: { name: 'Meta Platforms, Inc.', sector: 'Communication Services', sectorEtf: 'XLC' },
  AMD: { name: 'Advanced Micro Devices, Inc.', sector: 'Technology', sectorEtf: 'XLK' },
  BAC: { name: 'Bank of America Corp.', sector: 'Financials', sectorEtf: 'XLF' },
  CVX: { name: 'Chevron Corporation', sector: 'Energy', sectorEtf: 'XLE' },
};

/**
 * 1. Get active watchlist for a user
 */
export async function getActiveWatchlist(userId: string): Promise<PersistedWatchlist | null> {
  return findActiveWatchlist(userId);
}

/**
 * 2. Add an asset to the active watchlist
 */
export async function addAssetToWatchlist(
  watchlist: PersistedWatchlist,
  rawInput: AddWatchlistItemDto
): Promise<PersistedWatchlist> {
  // Validate input
  const input = AddWatchlistItemSchema.parse(rawInput);
  const symbol = input.symbol.toUpperCase();

  // Enforce maximum watchlist size
  if (watchlist.items.length >= MAX_WATCHLIST_SIZE) {
    throw new Error(`Watchlist limit reached. Maximum ${MAX_WATCHLIST_SIZE} assets allowed.`);
  }

  // Prevent duplicate symbols
  const isDuplicate = watchlist.items.some((i) => i.symbol === symbol);
  if (isDuplicate) {
    throw new Error(`Symbol "${symbol}" is already tracked in your watchlist.`);
  }

  const known = KNOWN_TICKERS[symbol];
  const name = input.name || known?.name || `${symbol} Common Stock`;
  const sector = input.sector || known?.sector || 'Diversified';
  const sectorEtf = input.sectorEtf || known?.sectorEtf || 'SPY';

  const nextOrder =
    watchlist.items.length > 0
      ? Math.max(...watchlist.items.map((i) => i.displayOrder)) + 1
      : 1;

  return dbAddWatchlistItem(watchlist.id, {
    symbol,
    name,
    sector,
    sectorEtf,
    exchange: input.exchange,
    displayOrder: nextOrder,
  });
}

/**
 * 3. Remove an asset from the watchlist
 */
export async function removeAssetFromWatchlist(
  watchlistId: string,
  rawInput: RemoveWatchlistItemDto
): Promise<PersistedWatchlist> {
  const input = RemoveWatchlistItemSchema.parse(rawInput);
  return dbRemoveWatchlistItem(watchlistId, input.symbol);
}

/**
 * 4. Restore the canonical 8-asset watchlist
 */
export async function resetWatchlistToDefault(watchlistId: string): Promise<PersistedWatchlist> {
  return dbRestoreDefaultWatchlist(watchlistId);
}
