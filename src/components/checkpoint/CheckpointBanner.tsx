import React from 'react';
import { RadarResponse } from '@/types';
import { CheckCircle2, RotateCcw, Clock, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface CheckpointBannerProps {
  radarData: RadarResponse;
  onAcknowledgeCheckpoint: () => void;
  onResetCheckpoint: () => void;
  isCustomCheckpoint: boolean;
}

const emptySubscribe = () => () => {};

export const CheckpointBanner: React.FC<CheckpointBannerProps> = ({
  radarData,
  onAcknowledgeCheckpoint,
  onResetCheckpoint,
  isCustomCheckpoint,
}) => {
  const { summary, marketContext } = radarData;

  const formatElapsed = (minutes: number) => {
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    const remainingMins = minutes % 60;
    return remainingMins > 0 ? `${hours}h ${remainingMins}m ago` : `${hours}h ago`;
  };

  const isClient = React.useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  const checkpointTime = isClient
    ? new Date(summary.checkpointTimestamp).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  const spyReturn = marketContext.benchmarkChangePercent;
  const isSpyPositive = spyReturn >= 0;

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 sm:p-7 shadow-lg backdrop-blur-md">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        {/* Left Side: Primary Focal Question & Narrative */}
        <div className="space-y-2 max-w-2xl">
          {/* Subtle Context Line */}
          <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span suppressHydrationWarning>
              Since you last checked {formatElapsed(summary.elapsedMinutes)}
              {checkpointTime ? ` (${checkpointTime})` : ''}
            </span>
            <span className="text-slate-600">·</span>
            <span className="inline-flex items-center gap-1 text-slate-300 font-mono">
              SPY {isSpyPositive ? <ArrowUpRight className="w-3 h-3 text-emerald-400" /> : <ArrowDownRight className="w-3 h-3 text-rose-400" />}
              <span className={isSpyPositive ? 'text-emerald-400' : 'text-rose-400'}>
                {isSpyPositive ? '+' : ''}{(spyReturn * 100).toFixed(2)}%
              </span>
            </span>
          </div>

          {/* Primary Message: What meaningfully changed? */}
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            What meaningfully changed?
          </h2>

          {/* Direct plain-language answer */}
          <p className="text-sm text-slate-300 leading-relaxed">
            {summary.isCalmState ? (
              <span className="text-emerald-400 font-medium">
                Nothing meaningful changed across your {summary.totalAssetsTracked} tracked assets. The market is quiet.
              </span>
            ) : (
              <span>
                <strong className="text-rose-400 font-semibold">
                  {summary.anomaliesDetected} asset{summary.anomaliesDetected === 1 ? '' : 's'}
                </strong>{' '}
                exhibited company-specific divergence or abnormal volume velocity since your baseline print.
              </span>
            )}
          </p>
        </div>

        {/* Right Side: Action Control */}
        <div className="flex items-center gap-3 shrink-0 self-start md:self-center">
          <button
            onClick={onAcknowledgeCheckpoint}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs tracking-wide bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950/40 hover:shadow-emerald-900/50 transition-all duration-150 active:scale-[0.98]"
            title="Mark as seen to set baseline to current market prices"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Mark as Seen</span>
          </button>

          {isCustomCheckpoint && (
            <button
              onClick={onResetCheckpoint}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 transition-colors"
              title="Reset baseline back to 2h ago demo state"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Baseline</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
