import React from 'react';
import { Severity } from '@/types';
import { AlertOctagon, AlertTriangle, Info, CheckCircle } from 'lucide-react';

interface SeverityBadgeProps {
  severity: Severity;
  score?: number;
}

export const SeverityBadge: React.FC<SeverityBadgeProps> = ({ severity, score }) => {
  switch (severity) {
    case 'CRITICAL':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs font-semibold uppercase tracking-wider">
          <AlertOctagon className="w-3.5 h-3.5 text-rose-400" />
          Critical {score !== undefined && `(${score})`}
        </span>
      );

    case 'ELEVATED':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs font-semibold uppercase tracking-wider">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
          Elevated {score !== undefined && `(${score})`}
        </span>
      );

    case 'INFO':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 text-xs font-semibold uppercase tracking-wider">
          <Info className="w-3.5 h-3.5 text-cyan-400" />
          Notice {score !== undefined && `(${score})`}
        </span>
      );

    case 'NOMINAL':
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800/80 border border-slate-700/60 text-slate-400 text-xs font-medium uppercase tracking-wider">
          <CheckCircle className="w-3.5 h-3.5 text-slate-500" />
          Nominal
        </span>
      );
  }
};
