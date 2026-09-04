import { NextRequest, NextResponse } from 'next/server';
import {
  resolveOrCreateGuestSession,
  PULSE_SESSION_COOKIE,
  SESSION_COOKIE_OPTIONS,
} from '@/server/services/session-service';

export async function GET(request: NextRequest) {
  try {
    const existingToken = request.cookies.get(PULSE_SESSION_COOKIE)?.value;
    const session = await resolveOrCreateGuestSession(existingToken);

    const response = NextResponse.json({
      user: session.user,
      watchlist: session.watchlist,
      checkpoint: session.checkpoint,
    });

    if (session.isNewSession) {
      response.cookies.set(PULSE_SESSION_COOKIE, session.token, SESSION_COOKIE_OPTIONS);
    }

    return response;
  } catch (error) {
    console.error('[Pulse API] Error resolving guest session:', error);
    return NextResponse.json(
      { error: 'Failed to resolve session' },
      { status: 500 }
    );
  }
}
