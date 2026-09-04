import React, { useEffect } from 'react';
import { RadarItemResult } from '@/types';
import { SeverityBadge } from '../shared/SeverityBadge';
import { FreshnessBadge } from '../shared/FreshnessBadge';
import {
  X,
  ArrowUpRight,
  ArrowDownRight,
  Layers,
  Activity,
} from 'lucide-react';

interface StockDetailModalProps {
  item: RadarItemResult | null;
  onClose: () => void;
}

export const StockDetailModal: React.FC<StockDetailModalProps> = ({ item, onClose }) => {
  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!item) return null;

  const isPositive = item.priceChangePercent >= 0;
  const formatCurrency = (val: number) => `$${val.toFixed(2)}`;
  const formatPct = (val: number) => `${val >= 0 ? '+' : ''}${(val * 100).toFixed(2)}%`;

  // Raw score sum vs bounded score
  // Always consistent with individual rule attribution rows:
  const attributionSum = item.reasons.reduce((acc, r) => acc + r.contributionWeight, 0);
  const rawScore = item.reasons.length > 0 ? attributionSum : (item.rawScore ?? item.attentionScore);
  const isCapped = rawScore > 100;

  // Sparkline coordinates
  const sparkline = item.sparkline || [];
  const prices = sparkline.map((p) => p.price);
  const minPrice = Math.min(...prices, item.checkpointPrice, item.currentPrice);
  const maxPrice = Math.max(...prices, item.checkpointPrice, item.currentPrice);
  const range = maxPrice - minPrice || 1;

  const svgWidth = 600;
  const svgHeight = 120;
  const padding = 20;

  const pointsString = sparkline
    .map((pt, i) => {
      const x = padding + (i / (sparkline.length - 1 || 1)) * (svgWidth - 2 * padding);
      const y =
        svgHeight -
        padding -
        ((pt.price - minPrice) / range) * (svgHeight - 2 * padding);
      return `${x},${y}`;
    })
    .join(' ');

  const startX = padding;
  const startY =
    svgHeight -
    padding -
    ((item.checkpointPrice - minPrice) / range) * (svgHeight - 2 * padding);

  const endX = svgWidth - padding;
  const endY =
    svgHeight -
    padding -
    ((item.currentPrice - minPrice) / range) * (svgHeight - 2 * padding);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-8 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150">
      <div
        className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-slate-900 border border-slate-700/80 shadow-2xl p-6 sm:p-8 text-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-2 rounded-xl text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 transition-colors"
          title="Close (Esc)"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Top Header */}
        <div className="space-y-1.5 pb-6 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <h3 className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-white">
              {item.symbol}
            </h3>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-medium">
              {item.sector} ({item.sectorEtf})
            </span>
            <SeverityBadge severity={item.severity} score={item.attentionScore} />
            <FreshnessBadge status={item.freshness} size="sm" />
          </div>
          <p className="text-sm text-slate-400 font-medium">{item.name}</p>
        </div>

        {/* Price & Delta Comparison */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-6 border-b border-slate-800/80 text-xs">
          <div>
            <span className="text-slate-400 uppercase tracking-wider text-[11px] block mb-1 font-medium">
              Current Price
            </span>
            <div className="text-xl font-bold font-mono text-white">
              {formatCurrency(item.currentPrice)}
            </div>
          </div>

          <div>
            <span className="text-slate-400 uppercase tracking-wider text-[11px] block mb-1 font-medium">
              Checkpoint Baseline
            </span>
            <div className="text-xl font-bold font-mono text-slate-300">
              {formatCurrency(item.checkpointPrice)}
            </div>
          </div>

          <div>
            <span className="text-slate-400 uppercase tracking-wider text-[11px] block mb-1 font-medium">
              Change Since Checkpoint
            </span>
            <div
              className={`text-xl font-bold font-mono flex items-center gap-1 ${
                isPositive ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {isPositive ? (
                <ArrowUpRight className="w-5 h-5" />
              ) : (
                <ArrowDownRight className="w-5 h-5" />
              )}
              {formatPct(item.priceChangePercent)}
            </div>
            <span className="text-[11px] text-slate-400">
              {isPositive ? '+' : ''}
              {formatCurrency(item.currentPrice - item.checkpointPrice)}
            </span>
          </div>

          <div>
            <span className="text-slate-400 uppercase tracking-wider text-[11px] block mb-1 font-medium">
              Attention Score
            </span>
            <div className="text-xl font-extrabold font-mono text-cyan-400">
              {item.attentionScore} <span className="text-xs text-slate-500 font-normal">/100</span>
            </div>
            <div className="text-[11px] text-slate-400">
              {isCapped ? (
                <span className="text-amber-300 font-mono">Raw: {rawScore} (capped at 100)</span>
              ) : (
                <span>Severity: {item.severity}</span>
              )}
            </div>
          </div>
        </div>

        {/* Timeline & Price Trajectory */}
        <div className="py-6 border-b border-slate-800/80">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              Trajectory Since Checkpoint
            </span>
            <div className="flex items-center gap-4 text-xs font-mono text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-500" />
                Checkpoint: <strong>{formatCurrency(item.checkpointPrice)}</strong>
              </span>
              <span className="flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-full ${isPositive ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                Current: <strong>{formatCurrency(item.currentPrice)}</strong>
              </span>
            </div>
          </div>

          {/* SVG Sparkline */}
          <div className="rounded-xl bg-slate-950/60 p-4 border border-slate-800/80">
            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="w-full h-24 overflow-visible"
            >
              {/* Baseline reference line */}
              <line
                x1={padding}
                y1={startY}
                x2={svgWidth - padding}
                y2={startY}
                stroke="rgba(148, 163, 184, 0.2)"
                strokeDasharray="4 4"
                strokeWidth="1.5"
              />

              {/* Sparkline curve */}
              {pointsString && (
                <polyline
                  fill="none"
                  stroke={isPositive ? '#10b981' : '#f43f5e'}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={pointsString}
                />
              )}

              {/* Checkpoint marker */}
              <circle cx={startX} cy={startY} r="4" fill="#94a3b8" />

              {/* Current state marker */}
              <circle
                cx={endX}
                cy={endY}
                r="5"
                fill={isPositive ? '#10b981' : '#f43f5e'}
                className="animate-pulse"
              />
            </svg>
            <div className="flex justify-between text-[11px] text-slate-500 font-mono mt-1">
              <span>T₀ (Checkpoint Baseline)</span>
              <span>T₁ (Current Verified Print)</span>
            </div>
          </div>
        </div>

        {/* Structured "Why am I seeing this?" Factor Analysis */}
        <div className="pt-6 space-y-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-400" />
            Structured Factor Decomposition
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            {/* Factor 1: Idiosyncratic Alpha */}
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
              <div className="text-slate-400 font-medium mb-1">Idiosyncratic Alpha</div>
              <div className="text-lg font-bold font-mono text-cyan-300 mb-1">
                {formatPct(item.idiosyncraticChangePercent)}
              </div>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                Raw return {formatPct(item.priceChangePercent)} isolated against {item.sectorEtf} ({formatPct(item.sectorChangePercent)}) and SPY ({formatPct(item.benchmarkChangePercent)}).
              </p>
            </div>

            {/* Factor 2: Volume Anomaly */}
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
              <div className="text-slate-400 font-medium mb-1">Abnormal Volume</div>
              <div className="text-lg font-bold font-mono text-amber-300 mb-1">
                {item.volumeRatio.toFixed(1)}x Multiple
              </div>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                Observed trading volume prorated against 20-day Average Daily Volume for elapsed market hours.
              </p>
            </div>

            {/* Factor 3: Opening Gap */}
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
              <div className="text-slate-400 font-medium mb-1">Opening Gap</div>
              <div className="text-lg font-bold font-mono text-slate-200 mb-1">
                {formatPct(item.gapPercent)} ({item.gapHeld ? 'Held' : 'Faded'})
              </div>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                Measures whether opening directional momentum persisted through intraday sessions.
              </p>
            </div>
          </div>

          {/* Triggered Reason Rules & Clamping Clarification */}
          {item.reasons.length > 0 && (
            <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800/80 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300 block">
                  Rule Attributions ({item.reasons.length}):
                </span>
                {isCapped && (
                  <span className="text-[11px] text-amber-300/90 font-mono">
                    Score capped at 100 max
                  </span>
                )}
              </div>

              {/* Explicit Clamping Clarification Box */}
              {isCapped && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl bg-slate-950/80 border border-amber-500/30 text-xs">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-slate-400">Raw signal contribution:</span>
                    <strong className="font-mono text-cyan-300 font-bold">{rawScore} pts</strong>
                    <span className="text-slate-500">→</span>
                    <span className="text-slate-400">Final attention score:</span>
                    <strong className="font-mono text-rose-400 font-bold">{item.attentionScore}</strong>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-slate-400">Status:</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/30 uppercase tracking-wide">
                      capped at maximum
                    </span>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {item.reasons.map((r, i) => (
                  <div
                    key={i}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs p-2.5 rounded-lg bg-slate-900 border border-slate-800"
                  >
                    <div>
                      <strong className="text-cyan-400 font-mono">[{r.code}]</strong>{' '}
                      <span className="text-slate-200 font-medium">{r.title}:</span>{' '}
                      <span className="text-slate-400">{r.description}</span>
                    </div>
                    <span className="text-[11px] text-slate-400 font-mono shrink-0">
                      +{r.contributionWeight} pts
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Action Footer */}
        <div className="mt-8 pt-4 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
