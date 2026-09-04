import { NextRequest, NextResponse } from 'next/server';
import { evaluateRadarAsync } from '@/server/services/radar-service';
import { ProviderMode } from '@/server/market-data';
import {
  resolveOrCreateGuestSession,
  PULSE_SESSION_COOKIE,
  SESSION_COOKIE_OPTIONS,
} from '@/server/services/session-service';
import { DemoScenario, WatchlistItem } from '@/types';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const scenario = (searchParams.get('scenario') as DemoScenario) || 'STOCK_SPIKE';
  const mode = (searchParams.get('mode') as ProviderMode) || 'DEMO';
  const acknowledgedParam = searchParams.get('acknowledged');
  const isAcknowledged = acknowledgedParam === 'true';

  try {
    const existingToken = request.cookies.get(PULSE_SESSION_COOKIE)?.value;
    const session = await resolveOrCreateGuestSession(existingToken);

    const watchlistItems: WatchlistItem[] = session.watchlist.items.map((i) => ({
      symbol: i.symbol,
      name: i.name || i.symbol,
      sector: i.sector || 'General',
      sectorEtf: i.sectorEtf || 'SPY',
      displayOrder: i.displayOrder,
    }));

    const radarData = await evaluateRadarAsync({
      scenario,
      mode,
      isAcknowledged,
      watchlistItems,
      checkpointTimestamp: session.checkpoint.checkpointTimestamp,
    });

    const response = NextResponse.json({
      ...radarData,
      userWatchlist: session.watchlist,
      userCheckpoint: session.checkpoint,
    });

    if (session.isNewSession) {
      response.cookies.set(PULSE_SESSION_COOKIE, session.token, SESSION_COOKIE_OPTIONS);
    }

    return response;
  } catch (error) {
    console.error('[Pulse API] Error evaluating radar:', error);
    return NextResponse.json(
      { error: 'Failed to evaluate market radar' },
      { status: 500 }
    );
  }
}
