import { NextRequest, NextResponse } from 'next/server';
import {
  resolveOrCreateGuestSession,
  PULSE_SESSION_COOKIE,
  SESSION_COOKIE_OPTIONS,
} from '@/server/services/session-service';
import {
  addAssetToWatchlist,
  removeAssetFromWatchlist,
  resetWatchlistToDefault,
} from '@/server/services/watchlist-service';
import { ZodError } from 'zod';

export async function GET(request: NextRequest) {
  try {
    const existingToken = request.cookies.get(PULSE_SESSION_COOKIE)?.value;
    const session = await resolveOrCreateGuestSession(existingToken);

    const response = NextResponse.json({ watchlist: session.watchlist });
    if (session.isNewSession) {
      response.cookies.set(PULSE_SESSION_COOKIE, session.token, SESSION_COOKIE_OPTIONS);
    }
    return response;
  } catch (error) {
    console.error('[Pulse API] Error getting watchlist:', error);
    return NextResponse.json({ error: 'Failed to retrieve watchlist' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const existingToken = request.cookies.get(PULSE_SESSION_COOKIE)?.value;
    const session = await resolveOrCreateGuestSession(existingToken);
    const body = await request.json();

    const updated = await addAssetToWatchlist(session.watchlist, body);

    const response = NextResponse.json({ watchlist: updated });
    if (session.isNewSession) {
      response.cookies.set(PULSE_SESSION_COOKIE, session.token, SESSION_COOKIE_OPTIONS);
    }
    return response;
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || 'Invalid input' },
        { status: 400 }
      );
    }
    const message = error instanceof Error ? error.message : 'Failed to add item';
    const status = message.includes('already tracked') || message.includes('limit reached') ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const existingToken = request.cookies.get(PULSE_SESSION_COOKIE)?.value;
    const session = await resolveOrCreateGuestSession(existingToken);

    const searchParams = request.nextUrl.searchParams;
    const symbol = searchParams.get('symbol');

    if (!symbol) {
      return NextResponse.json({ error: 'Symbol query parameter is required' }, { status: 400 });
    }

    const updated = await removeAssetFromWatchlist(session.watchlist.id, { symbol });

    const response = NextResponse.json({ watchlist: updated });
    if (session.isNewSession) {
      response.cookies.set(PULSE_SESSION_COOKIE, session.token, SESSION_COOKIE_OPTIONS);
    }
    return response;
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || 'Invalid symbol' },
        { status: 400 }
      );
    }
    const message = error instanceof Error ? error.message : 'Failed to remove item';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const existingToken = request.cookies.get(PULSE_SESSION_COOKIE)?.value;
    const session = await resolveOrCreateGuestSession(existingToken);

    const updated = await resetWatchlistToDefault(session.watchlist.id);

    const response = NextResponse.json({ watchlist: updated });
    if (session.isNewSession) {
      response.cookies.set(PULSE_SESSION_COOKIE, session.token, SESSION_COOKIE_OPTIONS);
    }
    return response;
  } catch (error) {
    console.error('[Pulse API] Error restoring default watchlist:', error);
    return NextResponse.json({ error: 'Failed to restore default watchlist' }, { status: 500 });
  }
}
