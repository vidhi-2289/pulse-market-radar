import React from 'react';
import { DemoScenario, FreshnessStatus } from '@/types';
import { ProviderMode } from '@/server/market-data';
import { FreshnessBadge } from '../shared/FreshnessBadge';
import { ScenarioSelector } from '../demo/ScenarioSelector';
import { Radar } from 'lucide-react';

interface RadarHeaderProps {
  freshnessStatus: FreshnessStatus;
  activeMode?: ProviderMode;
  onSelectMode?: (mode: ProviderMode) => void;
  activeScenario: DemoScenario;
  onSelectScenario: (scenario: DemoScenario) => void;
}

export const RadarHeader: React.FC<RadarHeaderProps> = ({
  freshnessStatus,
  activeMode = 'DEMO',
  onSelectMode,
  activeScenario,
  onSelectScenario,
}) => {
  return (
    <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Logo & Brand */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-950/40">
            <Radar className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-black tracking-wider text-white">PULSE</span>
              <span className="text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-800/50 font-mono">
                Market Radar
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              Meaningful change detection · Asynchronous & calm
            </p>
          </div>
        </div>

        {/* Right: Demo Mode Popover Control & Freshness Badge */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          <ScenarioSelector
            activeMode={activeMode}
            onSelectMode={onSelectMode}
            activeScenario={activeScenario}
            onSelectScenario={onSelectScenario}
          />
          <FreshnessBadge status={freshnessStatus} size="sm" />
        </div>
      </div>
    </header>
  );
};
