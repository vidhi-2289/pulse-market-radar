import React from 'react';
import { RadarItemResult } from '@/types';
import { SeverityBadge } from '../shared/SeverityBadge';
import { FreshnessBadge } from '../shared/FreshnessBadge';
import {
  ArrowUpRight,
  ArrowDownRight,
  ArrowRight,
  Zap,
} from 'lucide-react';

interface RadarCardProps {
  item: RadarItemResult;
  rank: number;
  onSelect: (item: RadarItemResult) => void;
}

export const RadarCard: React.FC<RadarCardProps> = ({ item, rank, onSelect }) => {
  const isPositive = item.priceChangePercent >= 0;
  const isCritical = item.severity === 'CRITICAL';
  const isElevated = item.severity === 'ELEVATED';

  const formatCurrency = (val: number) => `$${val.toFixed(2)}`;
  const formatPct = (val: number) => `${val >= 0 ? '+' : ''}${(val * 100).toFixed(2)}%`;

  const primaryReason = item.reasons[0];

  return (
    <div
      onClick={() => onSelect(item)}
      className={`group cursor-pointer rounded-2xl border bg-slate-900/80 p-5 sm:p-6 transition-all duration-200 hover:bg-slate-900 hover:shadow-xl ${
        isCritical
          ? 'border-rose-500/40 hover:border-rose-500/70 hover:shadow-rose-950/20'
          : isElevated
          ? 'border-amber-500/30 hover:border-amber-500/60 hover:shadow-amber-950/20'
          : 'border-slate-800 hover:border-slate-700'
      }`}
    >
      {/* 1. Ticker / Company & Current Movement */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        {/* Left: Ticker & Company */}
        <div className="flex items-center gap-3">
          <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-slate-800/80 text-slate-400 text-xs font-mono font-semibold border border-slate-700/60">
            #{rank}
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-bold font-mono text-white group-hover:text-cyan-300 transition-colors">
                {item.symbol}
              </h3>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800/80 text-slate-300 font-medium">
                {item.sector}
              </span>
            </div>
            <div className="text-xs text-slate-400">{item.name}</div>
          </div>
        </div>

        {/* Right: Price & Attention Metadata */}
        <div className="flex items-center gap-3 self-start sm:self-center">
          <div className="text-right">
            <div className="text-lg font-bold font-mono text-white">
              {formatCurrency(item.currentPrice)}
            </div>
            <div
              className={`text-xs font-semibold font-mono flex items-center justify-end gap-0.5 ${
                isPositive ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {isPositive ? (
                <ArrowUpRight className="w-3.5 h-3.5" />
              ) : (
                <ArrowDownRight className="w-3.5 h-3.5" />
              )}
              <span>{formatPct(item.priceChangePercent)}</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 pl-2 border-l border-slate-800">
            <SeverityBadge severity={item.severity} score={item.attentionScore} />
            <FreshnessBadge status={item.freshness} size="sm" />
          </div>
        </div>
      </div>

      {/* 2. Meaningful Reason (Primary focus) */}
      {primaryReason ? (
        <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 mb-3 space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-cyan-300">
            <Zap className="w-3.5 h-3.5 text-cyan-400" />
            <span>{primaryReason.title}</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            {primaryReason.description}
          </p>
        </div>
      ) : (
        <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800/60 text-xs text-slate-400 mb-3">
          Movement is nominal and aligned with typical baseline variance.
        </div>
      )}

      {/* 3. Secondary Signals & Context */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs pt-1">
        <div className="flex flex-wrap items-center gap-2">
          {/* Idiosyncratic Alpha */}
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800/60 text-slate-300 border border-slate-700/50">
            <span className="text-slate-400">Alpha vs {item.sectorEtf}:</span>
            <strong className="font-mono text-cyan-300">
              {formatPct(item.idiosyncraticChangePercent)}
            </strong>
          </span>

          {/* Volume Multiple */}
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800/60 text-slate-300 border border-slate-700/50">
            <span className="text-slate-400">Volume:</span>
            <strong className="font-mono text-amber-300">
              {item.volumeRatio.toFixed(1)}x
            </strong>
          </span>

          {/* Gap Status */}
          {Math.abs(item.gapPercent) >= 0.005 && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800/60 text-slate-300 border border-slate-700/50">
              <span className="text-slate-400">Gap:</span>
              <span className="font-mono text-slate-200">
                {formatPct(item.gapPercent)} ({item.gapHeld ? 'Held' : 'Faded'})
              </span>
            </span>
          )}
        </div>

        {/* View Details Prompt */}
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400 group-hover:text-cyan-400 transition-colors">
          <span>Inspect Factors</span>
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </span>
      </div>
    </div>
  );
};
