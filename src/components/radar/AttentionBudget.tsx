import React from 'react';
import { AttentionBudget as AttentionBudgetType, RadarItemResult, Severity } from '@/types';
import {
  Compass,
  ArrowUpRight,
  ArrowDownRight,
  AlertOctagon,
  AlertTriangle,
  Info,
  CheckCircle2,
  SlidersHorizontal,
} from 'lucide-react';

interface AttentionBudgetProps {
  budget: AttentionBudgetType;
  radarItems: RadarItemResult[];
  onSelectStock: (item: RadarItemResult) => void;
}

export const AttentionBudget: React.FC<AttentionBudgetProps> = ({
  budget,
  radarItems,
  onSelectStock,
}) => {
  const formatPct = (val: number) => `${val >= 0 ? '+' : ''}${(val * 100).toFixed(1)}%`;

  const renderSeverityTag = (severity: Severity, score: number) => {
    switch (severity) {
      case 'CRITICAL':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-bold uppercase tracking-wider bg-rose-500/15 border border-rose-500/40 text-rose-300">
            <AlertOctagon className="w-3 h-3 text-rose-400" />
            CRITICAL · {score}
          </span>
        );
      case 'ELEVATED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-bold uppercase tracking-wider bg-amber-500/15 border border-amber-500/40 text-amber-300">
            <AlertTriangle className="w-3 h-3 text-amber-400" />
            ELEVATED · {score}
          </span>
        );
      case 'INFO':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-bold uppercase tracking-wider bg-cyan-500/15 border border-cyan-500/40 text-cyan-300">
            <Info className="w-3 h-3 text-cyan-400" />
            NOTICE · {score}
          </span>
        );
    }
  };

  return (
    <section
      aria-labelledby="attention-budget-heading"
      className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 sm:p-5 backdrop-blur-md space-y-3.5 shadow-lg"
    >
      {/* 1. Header & Rationale Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-slate-900">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-cyan-400">
            <Compass className="w-3.5 h-3.5 text-cyan-400" />
            <span>Attention Budget</span>
          </div>
          <h2
            id="attention-budget-heading"
            className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2"
          >
            <span>{budget.message}</span>
            {budget.totalMeaningfulCount > budget.budgetCount && (
              <span className="text-xs font-normal text-slate-400">
                (Top {budget.budgetCount} of {budget.totalMeaningfulCount} anomalies)
              </span>
            )}
          </h2>
        </div>

        {/* Ordering Rationale Explanation */}
        <div
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 bg-slate-900/90 px-2.5 py-1 rounded-lg border border-slate-800/80 self-start sm:self-center"
          title="Priority order is calculated directly from multi-factor Attention Scores (0–100) reflecting idiosyncratic alpha, volume surges, and opening gaps."
        >
          <SlidersHorizontal className="w-3 h-3 text-cyan-400" />
          <span>
            Ranked by <strong className="text-slate-200 font-semibold">Attention Priority</strong>
          </span>
        </div>
      </div>

      {/* 2. Content: Calm State or Prioritized Item Cards */}
      {budget.isCalm ? (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/20 text-xs text-emerald-300">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>
            All tracked assets are drifting within nominal variance. Nothing requires immediate triage.
          </span>
        </div>
      ) : (
        <div
          role="list"
          aria-label="Prioritized Attention Budget Items"
          className="grid grid-cols-1 md:grid-cols-3 gap-3"
        >
          {budget.items.map((item) => {
            const isCritical = item.severity === 'CRITICAL';
            const isElevated = item.severity === 'ELEVATED';
            const isPositive = item.priceChangePercent >= 0;

            return (
              <button
                key={item.symbol}
                type="button"
                role="listitem"
                onClick={() => {
                  const fullItem = radarItems.find((i) => i.symbol === item.symbol);
                  if (fullItem) {
                    onSelectStock(fullItem);
                  }
                }}
                aria-label={`Inspect ${item.symbol}: ${item.severity} severity, score ${item.attentionScore}, reason: ${item.headlineReason}`}
                className={`group text-left p-3.5 rounded-xl border transition-all duration-150 relative overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                  isCritical
                    ? 'bg-gradient-to-b from-rose-950/25 via-slate-900/90 to-slate-900/90 border-rose-500/40 hover:border-rose-500/70 hover:shadow-lg hover:shadow-rose-950/30'
                    : isElevated
                    ? 'bg-gradient-to-b from-amber-950/25 via-slate-900/90 to-slate-900/90 border-amber-500/40 hover:border-amber-500/70 hover:shadow-lg hover:shadow-amber-950/30'
                    : 'bg-gradient-to-b from-cyan-950/20 via-slate-900/90 to-slate-900/90 border-cyan-500/30 hover:border-cyan-500/60 hover:shadow-lg hover:shadow-cyan-950/30'
                }`}
              >
                {/* Header: Rank + Symbol + Severity Pill */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center justify-center w-5 h-5 rounded bg-slate-800/90 text-slate-300 text-[11px] font-mono font-bold border border-slate-700/60">
                      #{item.rank}
                    </span>
                    <strong className="font-mono text-base font-bold text-white group-hover:text-cyan-300 transition-colors">
                      {item.symbol}
                    </strong>
                  </div>
                  {renderSeverityTag(item.severity, item.attentionScore)}
                </div>

                {/* Subtitle / Headline Reason */}
                <div className="text-xs font-semibold text-slate-200 line-clamp-1 mb-2 group-hover:text-white transition-colors">
                  {item.headlineReason}
                </div>

                {/* Footer: Price Change % & Inspect Prompt */}
                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800/80">
                  <span
                    className={`inline-flex items-center gap-0.5 font-mono font-semibold ${
                      isPositive ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {isPositive ? (
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    ) : (
                      <ArrowDownRight className="w-3.5 h-3.5" />
                    )}
                    <span>{formatPct(item.priceChangePercent)}</span>
                  </span>

                  <span className="text-[11px] font-medium text-slate-400 group-hover:text-cyan-300 transition-colors">
                    Inspect &rarr;
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
};
