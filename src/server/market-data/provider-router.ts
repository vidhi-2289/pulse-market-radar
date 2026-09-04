/**
 * PULSE — Market Data Provider Router
 * Lightweight factory selecting the active market data provider based on runtime mode.
 */

import { DemoScenario } from '@/types';
import { IMarketDataProvider } from './provider-interface';
import { DemoMarketDataProvider } from './demo-provider';
import { DelayedMarketDataProvider } from './delayed-provider';

export type ProviderMode = 'DEMO' | 'MARKETDATA_LOCAL' | 'DELAYED';

export interface ProviderSelectionOptions {
  mode?: ProviderMode;
  scenario?: DemoScenario;
}

/**
 * Checks whether the current execution context is a production runtime.
 * Production environments strictly disallow external market feeds to adhere to redistribution policies.
 */
export function isProductionEnvironment(): boolean {
  return (
    process.env.NODE_ENV === 'production' ||
    process.env.NEXT_PUBLIC_APP_MODE === 'production'
  );
}

/**
 * Returns the appropriate IMarketDataProvider instance based on runtime mode and environment.
 * - DEMO: Always returns deterministic DemoMarketDataProvider (safe for public evaluation).
 * - MARKETDATA_LOCAL: Only activated when (1) running in local/dev environment AND (2) MARKETDATA_API_TOKEN exists.
 * If requested in production or without a token, safely refuses and falls back to DEMO mode.
 */
export function getMarketDataProvider(options: ProviderSelectionOptions = {}): IMarketDataProvider {
  const { mode = 'DEMO', scenario = 'STOCK_SPIKE' } = options;

  if (mode === 'MARKETDATA_LOCAL' || mode === 'DELAYED') {
    // Production Safety Check: refuse external provider in production runtime
    if (isProductionEnvironment()) {
      console.warn(
        '[Pulse Provider Router] MARKETDATA_LOCAL is restricted to local/development only. ' +
        'Production runtime detected; safely falling back to deterministic DEMO mode.'
      );
      return new DemoMarketDataProvider(scenario);
    }

    const token = process.env.MARKETDATA_API_TOKEN;
    if (token && token.trim().length > 0) {
      return new DelayedMarketDataProvider({ apiToken: token.trim() });
    }

    // Safe deterministic fallback when credentials are absent
    return new DemoMarketDataProvider(scenario);
  }

  // Default is guaranteed deterministic DEMO mode
  return new DemoMarketDataProvider(scenario);
}
