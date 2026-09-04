import React, { useState, useRef, useEffect } from 'react';
import { DemoScenario } from '@/types';
import { ProviderMode } from '@/server/market-data';
import { DEMO_SCENARIOS } from '@/server/market-data/mock-fixtures';
import {
  ChevronDown,
  ShieldCheck,
  TrendingUp,
  Flame,
  TrendingDown,
  ClockAlert,
  ServerCrash,
  Check,
  Sliders,
  Radio,
  Sparkles,
} from 'lucide-react';

interface ScenarioSelectorProps {
  activeMode?: ProviderMode;
  onSelectMode?: (mode: ProviderMode) => void;
  activeScenario: DemoScenario;
  onSelectScenario: (scenario: DemoScenario) => void;
}

const SCENARIO_ICONS: Record<DemoScenario, React.ReactNode> = {
  QUIET: <ShieldCheck className="w-4 h-4 text-emerald-400" />,
  STOCK_SPIKE: <TrendingUp className="w-4 h-4 text-rose-400" />,
  SECTOR_RUN: <Flame className="w-4 h-4 text-amber-400" />,
  MARKET_CRASH: <TrendingDown className="w-4 h-4 text-red-400" />,
  STALE: <ClockAlert className="w-4 h-4 text-orange-400" />,
  PROVIDER_FAILURE: <ServerCrash className="w-4 h-4 text-purple-400" />,
};

export const ScenarioSelector: React.FC<ScenarioSelectorProps> = ({
  activeMode = 'DEMO',
  onSelectMode,
  activeScenario,
  onSelectScenario,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentDef = DEMO_SCENARIOS.find((s) => s.id === activeScenario);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      {/* Compact Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-all shadow-sm focus:outline-none focus:ring-1 focus:ring-cyan-500/50 ${
          activeMode === 'MARKETDATA_LOCAL' || activeMode === 'DELAYED'
            ? 'bg-amber-950/40 hover:bg-amber-900/50 text-amber-200 border-amber-700/70 hover:border-amber-600'
            : 'bg-slate-900/90 hover:bg-slate-800 text-slate-200 border-slate-700/80 hover:border-slate-600'
        }`}
        title={activeMode === 'MARKETDATA_LOCAL' || activeMode === 'DELAYED' ? 'Market Data · 24H Delayed (Local Development Only)' : 'Demo Mode (Deterministic Public Judging Baseline)'}
        aria-expanded={isOpen}
      >
        <span className="flex items-center gap-1.5">
          {activeMode === 'MARKETDATA_LOCAL' || activeMode === 'DELAYED' ? (
            <>
              <Radio className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              <span className="text-amber-300 font-semibold">Market Data · 24H Delayed</span>
              <span className="text-[10px] uppercase font-mono px-1 rounded bg-amber-900/60 text-amber-300 border border-amber-700/50">
                Local Only
              </span>
            </>
          ) : (
            <>
              <Sliders className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-slate-400">Demo Mode:</span>
              <strong className="text-white font-semibold flex items-center gap-1">
                {SCENARIO_ICONS[activeScenario]}
                {currentDef?.name.split('(')[0].trim() || activeScenario}
              </strong>
            </>
          )}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-150 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Popover Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl bg-slate-900 border border-slate-700/90 shadow-2xl p-2.5 z-50 backdrop-blur-xl animate-in fade-in-0 zoom-in-95 duration-100">
          {/* Mode Selector Header Pill */}
          <div className="flex items-center p-1 bg-slate-950/80 rounded-lg border border-slate-800 mb-2">
            <button
              onClick={() => onSelectMode?.('DEMO')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                activeMode === 'DEMO'
                  ? 'bg-cyan-950/80 text-cyan-200 border border-cyan-700/60 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Demo Mode</span>
            </button>
            <button
              onClick={() => onSelectMode?.('MARKETDATA_LOCAL')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                activeMode === 'MARKETDATA_LOCAL' || activeMode === 'DELAYED'
                  ? 'bg-amber-950/80 text-amber-200 border border-amber-700/60 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>Market Data · 24H Delayed</span>
            </button>
          </div>

          {activeMode === 'DEMO' ? (
            <>
              <div className="px-2 py-1.5 border-b border-slate-800 text-xs">
                <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Deterministic Market Scenarios</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Simulated market states guaranteeing reproducible evaluations without external network dependencies.
                </p>
              </div>

              <div className="py-1 space-y-1 max-h-72 overflow-y-auto">
                {DEMO_SCENARIOS.map((scenario) => {
                  const isActive = scenario.id === activeScenario;
                  return (
                    <button
                      key={scenario.id}
                      onClick={() => {
                        onSelectScenario(scenario.id);
                        setIsOpen(false);
                      }}
                      className={`w-full flex items-start gap-3 p-2 rounded-lg text-left transition-colors ${
                        isActive
                          ? 'bg-cyan-950/50 border border-cyan-500/40 text-white'
                          : 'hover:bg-slate-800/60 text-slate-300 border border-transparent'
                      }`}
                    >
                      <div className="mt-0.5 shrink-0">{SCENARIO_ICONS[scenario.id]}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-semibold text-xs text-white">
                            {scenario.name.split('(')[0].trim()}
                          </span>
                          {isActive && <Check className="w-3.5 h-3.5 text-cyan-400 shrink-0" />}
                        </div>
                        <p className="text-[11px] text-slate-400 line-clamp-2 mt-0.5 leading-snug">
                          {scenario.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {currentDef && (
                <div className="mt-1 p-2 rounded-lg bg-slate-950/70 border border-slate-800 text-[11px] text-slate-400">
                  <span className="text-cyan-400 font-semibold">Active Simulation: </span>
                  {currentDef.description}
                </div>
              )}
            </>
          ) : (
            <div className="p-2 space-y-2.5">
              <div className="p-3 rounded-lg bg-amber-950/20 border border-amber-800/40">
                <div className="flex items-center gap-2">
                  <Radio className="w-4 h-4 text-amber-400 animate-pulse" />
                  <span className="font-semibold text-xs text-amber-200">
                    Market Data · 24H Delayed (Local Development Only)
                  </span>
                </div>
                <p className="text-[11px] text-amber-300/80 mt-1 leading-relaxed">
                  Local developer diagnostic feed powered by Market Data API. This feed is strictly for local engineering evaluation and is <strong>not licensed for public redistribution</strong>.
                </p>
              </div>

              <div className="space-y-1.5 text-[11px] text-slate-300 bg-slate-950/70 p-2.5 rounded-lg border border-slate-800">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Runtime Scope:</span>
                  <span className="font-mono text-amber-300">Local Only (Refused in Prod)</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Latency Tier:</span>
                  <span className="font-mono text-amber-300">24H Delayed (Never Live)</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Public / Judging Path:</span>
                  <span className="text-cyan-400 font-medium">Guaranteed Demo Mode</span>
                </div>
              </div>

              <p className="text-[11px] text-slate-400 leading-snug italic">
                * Note: Production runtimes automatically refuse external feeds and safely default to deterministic Demo Mode.
              </p>

              <button
                onClick={() => {
                  onSelectMode?.('DEMO');
                  setIsOpen(false);
                }}
                className="w-full py-1.5 px-3 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
              >
                Return to Demo Mode
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

