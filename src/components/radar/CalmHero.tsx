import React from 'react';
import { ShieldCheck, SlidersHorizontal, Activity } from 'lucide-react';

interface CalmHeroProps {
  totalAssets: number;
  onExploreScenarios?: () => void;
}

export const CalmHero: React.FC<CalmHeroProps> = ({
  totalAssets,
  onExploreScenarios,
}) => {
  return (
    <div className="relative rounded-2xl border border-emerald-500/30 bg-gradient-to-b from-emerald-950/20 via-slate-900/90 to-slate-950/95 p-8 sm:p-12 text-center shadow-2xl overflow-hidden backdrop-blur-xl">
      {/* Ambient glowing radial backdrop */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-2xl mx-auto space-y-4">
        {/* Serene Icon with subtle radar wave animation */}
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 shadow-lg shadow-emerald-950/50 mb-2">
          <ShieldCheck className="w-9 h-9" />
        </div>

        {/* Primary Headline */}
        <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
          Nothing meaningful changed.
        </h2>

        {/* Supporting text */}
        <p className="text-lg text-emerald-300/90 font-medium">
          Your watchlist is quiet. Check back later.
        </p>

        {/* Reassuring Context Box */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 text-sm text-slate-300 leading-relaxed text-left space-y-2">
          <div className="flex items-center gap-2 font-semibold text-xs uppercase tracking-wider text-emerald-400">
            <Activity className="w-3.5 h-3.5" />
            <span>Radar Verification Report</span>
          </div>
          <p className="text-xs text-slate-400">
            All <strong>{totalAssets} tracked assets</strong> are currently drifting within nominal volatility
            parameters (under $\pm 0.3\%$) with standard trading volume. The change engine evaluated:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-xs">
            <div className="px-2.5 py-1.5 rounded bg-slate-950/60 border border-slate-800/80 text-slate-300">
              ✓ <span className="text-slate-400">Zero alpha breakouts</span>
            </div>
            <div className="px-2.5 py-1.5 rounded bg-slate-950/60 border border-slate-800/80 text-slate-300">
              ✓ <span className="text-slate-400">Normal volume multiples</span>
            </div>
            <div className="px-2.5 py-1.5 rounded bg-slate-950/60 border border-slate-800/80 text-slate-300">
              ✓ <span className="text-slate-400">No unconfirmed gaps</span>
            </div>
          </div>
        </div>

        {/* Demo Callout */}
        <div className="pt-2">
          <button
            onClick={onExploreScenarios}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60 transition-colors"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400" />
            <span>Simulate Anomaly (Demo Mode)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
