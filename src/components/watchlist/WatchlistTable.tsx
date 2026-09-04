import React, { useState, useEffect, useRef, useCallback } from 'react';
import { RadarItemResult, InstrumentSearchResult } from '@/types';
import { SeverityBadge } from '../shared/SeverityBadge';
import {
  ChevronDown,
  ChevronUp,
  ArrowUpRight,
  ArrowDownRight,
  Trash2,
  ExternalLink,
  Plus,
  Bookmark,
  RotateCcw,
  Search,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Globe2,
} from 'lucide-react';

export interface AddSymbolPayload {
  symbol: string;
  name?: string;
  exchange?: string;
  sector?: string;
  sectorEtf?: string;
}

interface WatchlistTableProps {
  items: RadarItemResult[];
  onSelectStock: (item: RadarItemResult) => void;
  onRemoveSymbol: (symbol: string) => void;
  onRestoreDefault: () => void;
  isCustomWatchlist: boolean;
  onAddSymbol?: (payload: AddSymbolPayload | string) => Promise<void> | void;
}

export const WatchlistTable: React.FC<WatchlistTableProps> = ({
  items,
  onSelectStock,
  onRemoveSymbol,
  onRestoreDefault,
  isCustomWatchlist,
  onAddSymbol,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Search & Autocomplete state
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<InstrumentSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const [searchNotice, setSearchNotice] = useState<string | null>(null);

  // Feedback notifications
  const [addNotice, setAddNotice] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const formatCurrency = (val: number) => `$${val.toFixed(2)}`;
  const formatPct = (val: number) => `${val >= 0 ? '+' : ''}${(val * 100).toFixed(2)}%`;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    if (val.trim().length < 2) {
      setSuggestions([]);
      setIsDropdownOpen(false);
      setIsSearching(false);
      setSearchNotice(null);
    }
  };

  // Debounced search query (300ms)
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) return;

    let isMounted = true;
    const timer = setTimeout(async () => {
      if (isMounted) setIsSearching(true);
      try {
        const res = await fetch(`/api/instruments/search?q=${encodeURIComponent(trimmed)}`);
        if (res.ok && isMounted) {
          const data = await res.json();
          setSuggestions(data.results || []);
          setSearchNotice(data.notice || null);
          setIsDropdownOpen(true);
          setSelectedIndex(-1);
        }
      } catch (err) {
        console.warn('[Pulse Frontend] Instrument search failed:', err);
      } finally {
        if (isMounted) {
          setIsSearching(false);
        }
      }
    }, 300);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [searchQuery]);

  // Handle selection of a suggested instrument
  const handleSelectInstrument = useCallback(
    async (instrument: InstrumentSearchResult) => {
      if (!onAddSymbol) return;

      setIsDropdownOpen(false);
      setAddNotice(null);

      try {
        await onAddSymbol({
          symbol: instrument.symbol,
          name: instrument.companyName,
          exchange: instrument.exchange,
          sector: instrument.sector,
          sectorEtf: instrument.sectorBenchmark,
        });

        setSearchQuery('');
        setSuccessNotice(`Added ${instrument.symbol} (${instrument.companyName}) to your radar.`);
        setTimeout(() => setSuccessNotice(null), 4000);
      } catch (err) {
        const msg = err instanceof Error ? err.message : `Failed to add "${instrument.symbol}".`;
        setAddNotice(msg);
        setTimeout(() => setAddNotice(null), 5000);
      }
    },
    [onAddSymbol]
  );

  // Handle Form Submit / Enter Key
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchQuery.trim().toUpperCase();
    if (!query) return;

    // 1. If an item is actively highlighted with keyboard, choose it
    if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
      await handleSelectInstrument(suggestions[selectedIndex]);
      return;
    }

    // 2. If there is an exact symbol match in suggestions, choose it
    const exactMatch = suggestions.find((s) => s.symbol.toUpperCase() === query);
    if (exactMatch) {
      await handleSelectInstrument(exactMatch);
      return;
    }

    // 3. If there is at least one suggestion, pick the top result
    if (suggestions.length > 0) {
      await handleSelectInstrument(suggestions[0]);
      return;
    }

    // 4. Disallow unverified free-text input
    setAddNotice('Please select a verified instrument from the search suggestions.');
    setTimeout(() => setAddNotice(null), 4000);
  };

  // Keyboard navigation inside dropdown
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isDropdownOpen || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === 'Escape') {
      setIsDropdownOpen(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-md overflow-visible shadow-lg">
      {/* Watchlist Header / Toggle Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-5 border-b border-slate-800/80 gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-slate-800 text-cyan-400">
            <Bookmark className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white tracking-wide">Tracked Watchlist</h3>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                {items.length} assets
              </span>
              {isCustomWatchlist && (
                <button
                  onClick={onRestoreDefault}
                  className="text-[11px] text-cyan-400 hover:underline flex items-center gap-1"
                  title="Restore original 8 assets"
                >
                  <RotateCcw className="w-3 h-3" />
                  Restore All
                </button>
              )}
            </div>
            <p className="text-[11px] text-slate-400">
              Active universe scanned against baseline checkpoints
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-300 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 transition-colors"
          >
            <span>{isExpanded ? 'Collapse List' : 'Expand Watchlist'}</span>
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Collapsed Pill Summary */}
      {!isExpanded && (
        <div className="p-4 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-500 text-[11px] uppercase tracking-wider font-semibold mr-1">
            Tracked:
          </span>
          {items.map((item) => {
            const isPos = item.priceChangePercent >= 0;
            return (
              <button
                key={item.symbol}
                onClick={() => onSelectStock(item)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/40 hover:bg-slate-800/80 border border-slate-700/40 text-slate-300 transition-colors font-mono"
              >
                <span className="font-bold text-white">{item.symbol}</span>
                <span className={isPos ? 'text-emerald-400' : 'text-rose-400'}>
                  {formatPct(item.priceChangePercent)}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Expanded Watchlist View */}
      {isExpanded && (
        <div className="p-4 space-y-4">
          {/* Smart Autocomplete Search Bar */}
          <div className="relative max-w-md" ref={containerRef}>
            <form onSubmit={handleFormSubmit} className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  ref={inputRef}
                  type="text"
                  value={searchQuery}
                  onChange={handleSearchInputChange}
                  onFocus={() => {
                    if (suggestions.length > 0) setIsDropdownOpen(true);
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="Search company or ticker (e.g. Apple, NVDA)..."
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-lg pl-9 pr-8 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/60 transition-colors font-sans"
                />
                {isSearching && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-cyan-400 animate-spin" />
                )}
              </div>
              <button
                type="submit"
                disabled={searchQuery.trim().length < 2}
                className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:hover:bg-slate-800 text-cyan-300 border border-slate-700 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            </form>

            {/* Floating Autocomplete Dropdown */}
            {isDropdownOpen && (
              <div className="absolute left-0 right-0 mt-1.5 bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 rounded-xl shadow-2xl z-40 overflow-hidden text-xs animate-in fade-in-50 zoom-in-95 duration-100">
                {suggestions.length > 0 ? (
                  <div className="max-h-72 overflow-y-auto divide-y divide-slate-800/60">
                    <div className="px-3 py-1.5 bg-slate-950/60 text-[10px] uppercase font-semibold tracking-wider text-slate-400 flex items-center justify-between">
                      <span>Verified Market Instruments</span>
                      <span className="font-mono text-cyan-400">{suggestions.length} suggestions</span>
                    </div>

                    {suggestions.map((item, idx) => {
                      const isHighlighted = idx === selectedIndex;
                      return (
                        <button
                          key={`${item.symbol}-${idx}`}
                          type="button"
                          onClick={() => handleSelectInstrument(item)}
                          className={`w-full text-left px-3 py-2.5 flex items-center justify-between gap-3 transition-colors ${
                            isHighlighted
                              ? 'bg-cyan-950/60 border-l-2 border-cyan-400'
                              : 'hover:bg-slate-800/60'
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-white text-xs tracking-wide">
                                {item.symbol}
                              </span>
                              {item.exchange && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-mono">
                                  {item.exchange}
                                </span>
                              )}
                              {item.assetType && (
                                <span className="text-[10px] text-slate-400 font-sans">
                                  · {item.assetType}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-300 truncate mt-0.5 font-sans">
                              {item.companyName}
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            {item.sector ? (
                              <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800/80 text-cyan-300 border border-slate-700/60">
                                {item.sector}
                              </span>
                            ) : item.region ? (
                              <span className="text-[10px] text-slate-400 flex items-center gap-1 justify-end">
                                <Globe2 className="w-3 h-3 text-slate-500" />
                                {item.region}
                              </span>
                            ) : null}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  !isSearching && (
                    <div className="p-4 text-center text-slate-400 flex flex-col items-center gap-1">
                      <AlertCircle className="w-4 h-4 text-slate-500" />
                      <span>No matching instruments found.</span>
                      <span className="text-[10px] text-slate-500">
                        Try searching by full company name or global ticker symbol.
                      </span>
                    </div>
                  )
                )}

                {/* Footer Notice */}
                {searchNotice && (
                  <div className="px-3 py-1.5 bg-slate-950/80 border-t border-slate-800 text-[10px] text-slate-400 text-center">
                    {searchNotice}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Feedback Notices */}
          {addNotice && (
            <div className="flex items-center gap-2 text-xs text-amber-300 bg-amber-950/40 border border-amber-800/60 px-3 py-2 rounded-lg max-w-md">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{addNotice}</span>
            </div>
          )}

          {successNotice && (
            <div className="flex items-center gap-2 text-xs text-emerald-300 bg-emerald-950/40 border border-emerald-800/60 px-3 py-2 rounded-lg max-w-md animate-in fade-in-50 duration-150">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successNotice}</span>
            </div>
          )}

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-slate-400 font-semibold border-b border-slate-800/80 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-2.5 px-3">Asset</th>
                  <th className="py-2.5 px-3">Sector</th>
                  <th className="py-2.5 px-3 text-right">Current Price</th>
                  <th className="py-2.5 px-3 text-right">Movement</th>
                  <th className="py-2.5 px-3 text-center">Attention Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-slate-500">
                      No assets on watchlist.{' '}
                      <button
                        onClick={onRestoreDefault}
                        className="text-cyan-400 hover:underline font-semibold"
                      >
                        Restore Default Universe
                      </button>
                    </td>
                  </tr>
                ) : (
                  items.map((item) => {
                    const isPos = item.priceChangePercent >= 0;
                    return (
                      <tr
                        key={item.symbol}
                        className="hover:bg-slate-800/30 transition-colors group"
                      >
                        {/* Symbol & Name */}
                        <td className="py-3 px-3">
                          <button
                            onClick={() => onSelectStock(item)}
                            className="text-left font-sans flex flex-col"
                          >
                            <span className="font-bold font-mono text-white text-sm group-hover:text-cyan-300 transition-colors flex items-center gap-1.5">
                              {item.symbol}
                              {item.exchange && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-mono font-normal">
                                  {item.exchange}
                                </span>
                              )}
                            </span>
                            <span className="text-[11px] text-slate-400 truncate max-w-[180px]">
                              {item.name}
                            </span>
                          </button>
                        </td>

                        {/* Sector */}
                        <td className="py-3 px-3 text-slate-400 font-sans">
                          {item.sector}
                        </td>

                        {/* Current Price */}
                        <td className="py-3 px-3 text-right font-mono font-bold text-white">
                          {formatCurrency(item.currentPrice)}
                        </td>

                        {/* Movement */}
                        <td className="py-3 px-3 text-right font-mono font-semibold">
                          <div
                            className={`flex items-center justify-end gap-0.5 ${
                              isPos ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {isPos ? (
                              <ArrowUpRight className="w-3.5 h-3.5" />
                            ) : (
                              <ArrowDownRight className="w-3.5 h-3.5" />
                            )}
                            {formatPct(item.priceChangePercent)}
                          </div>
                        </td>

                        {/* Attention Status */}
                        <td className="py-3 px-3 text-center">
                          <SeverityBadge severity={item.severity} score={item.attentionScore} />
                        </td>

                        {/* Actions: Inspect & Remove */}
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => onSelectStock(item)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-slate-800/80 transition-colors"
                              title="Inspect Factor Analysis"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => onRemoveSymbol(item.symbol)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 transition-colors"
                              title={`Remove ${item.symbol} from Watchlist`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
