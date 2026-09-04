import React from 'react';
import { FreshnessStatus } from '@/types';
import { AlertCircle, Clock, Database, Sparkles } from 'lucide-react';

interface FreshnessBadgeProps {
  status: FreshnessStatus;
  size?: 'sm' | 'md';
}

export const FreshnessBadge: React.FC<FreshnessBadgeProps> = ({ status, size = 'md' }) => {
  const isSm = size === 'sm';

  switch (status) {
    case 'LIVE':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-medium ${
            isSm ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'
          }`}
          title="Verified Real-time Market Data"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          LIVE
        </span>
      );

    case 'DELAYED':
      return (
        <span
          className={`inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 font-medium ${
            isSm ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'
          }`}
          title="Exchange 15m Delayed Feed"
        >
          <Clock className="w-3 h-3" />
          DELAYED (15m)
        </span>
      );

    case 'STALE':
      return (
        <span
          className={`inline-flex items-center gap-1 rounded-full bg-orange-500/10 border border-orange-500/30 text-orange-400 font-medium ${
            isSm ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'
          }`}
          title="Data feed delayed or frozen"
        >
          <AlertCircle className="w-3 h-3" />
          STALE FEED
        </span>
      );

    case 'CACHED_FALLBACK':
      return (
        <span
          className={`inline-flex items-center gap-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 font-medium ${
            isSm ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'
          }`}
          title="Operating from local snapshot cache (circuit breaker active)"
        >
          <Database className="w-3 h-3" />
          CACHED FALLBACK
        </span>
      );

    case 'DEMO':
    default:
      return (
        <span
          className={`inline-flex items-center gap-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 font-medium ${
            isSm ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'
          }`}
          title="Deterministic Mock Engine Fixture"
        >
          <Sparkles className="w-3 h-3" />
          DEMO
        </span>
      );
  }
};
