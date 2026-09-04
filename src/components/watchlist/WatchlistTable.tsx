import React, { useState } from 'react';
import { RadarItemResult } from '@/types';
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
} from 'lucide-react';

interface WatchlistTableProps {
  items: RadarItemResult[];
  onSelectStock: (item: RadarItemResult) => void;
  onRemoveSymbol: (symbol: string) => void;
  onRestoreDefault: () => void;
  isCustomWatchlist: boolean;
  onAddSymbol?: (symbol: string) => Promise<void> | void;
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
  const [newSymbolInput, setNewSymbolInput] = useState('');
  const [addNotice, setAddNotice] = useState<string | null>(null);

  const formatCurrency = (val: number) => `$${val.toFixed(2)}`;
  const formatPct = (val: number) => `${val >= 0 ? '+' : ''}${(val * 100).toFixed(2)}%`;

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const sym = newSymbolInput.trim().toUpperCase();
    if (!sym) return;

    if (onAddSymbol) {
      try {
        await onAddSymbol(sym);
        setNewSymbolInput('');
        setAddNotice(null);
      } catch (err) {
        const msg = err instanceof Error ? err.message : `Failed to add "${sym}".`;
        setAddNotice(msg);
        setTimeout(() => setAddNotice(null), 4000);
      }
    } else {
      setAddNotice(`Symbol "${sym}" is monitored in core universe.`);
      setNewSymbolInput('');
      setTimeout(() => setAddNotice(null), 3000);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-md overflow-hidden shadow-lg">
      {/* Watchlist Header / Toggle Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-5 border-b border-slate-800/80 gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-slate-800 text-cyan-400">
            <Bookmark className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white tracking-wide">
                Tracked Watchlist
              </h3>
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
          {/* Quick Add Symbol Mock Bar */}
          <form onSubmit={handleAddSubmit} className="flex items-center gap-2 max-w-sm">
            <input
              type="text"
              value={newSymbolInput}
              onChange={(e) => setNewSymbolInput(e.target.value)}
              placeholder="Add symbol (e.g. GOOGL)..."
              className="flex-1 bg-slate-950/80 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/60 font-mono"
            />
            <button
              type="submit"
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add</span>
            </button>
          </form>

          {addNotice && (
            <div className="text-xs text-amber-300 bg-amber-950/40 border border-amber-800/60 px-3 py-1.5 rounded-lg">
              {addNotice}
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
                            <span className="font-bold font-mono text-white text-sm group-hover:text-cyan-300 transition-colors">
                              {item.symbol}
                            </span>
                            <span className="text-[11px] text-slate-400 truncate max-w-[160px]">
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
