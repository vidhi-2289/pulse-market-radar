import { NextRequest, NextResponse } from 'next/server';
import {
  resolveOrCreateGuestSession,
  PULSE_SESSION_COOKIE,
  SESSION_COOKIE_OPTIONS,
} from '@/server/services/session-service';
import {
  getUserLatestCheckpoint,
  acknowledgeUserCheckpoint,
} from '@/server/services/checkpoint-service';

export async function GET(request: NextRequest) {
  try {
    const existingToken = request.cookies.get(PULSE_SESSION_COOKIE)?.value;
    const session = await resolveOrCreateGuestSession(existingToken);

    const checkpoint =
      (await getUserLatestCheckpoint(session.user.id, session.watchlist.id)) ||
      session.checkpoint;

    const response = NextResponse.json({ checkpoint });
    if (session.isNewSession) {
      response.cookies.set(PULSE_SESSION_COOKIE, session.token, SESSION_COOKIE_OPTIONS);
    }
    return response;
  } catch (error) {
    console.error('[Pulse API] Error fetching checkpoint:', error);
    return NextResponse.json({ error: 'Failed to retrieve checkpoint' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const existingToken = request.cookies.get(PULSE_SESSION_COOKIE)?.value;
    const session = await resolveOrCreateGuestSession(existingToken);

    let label = 'User Acknowledged';
    try {
      const body = await request.json();
      if (body?.label) label = body.label;
    } catch {
      // Empty body is valid
    }

    const updated = await acknowledgeUserCheckpoint(
      session.user.id,
      session.watchlist.id,
      new Date(),
      label
    );

    const response = NextResponse.json({ checkpoint: updated });
    if (session.isNewSession) {
      response.cookies.set(PULSE_SESSION_COOKIE, session.token, SESSION_COOKIE_OPTIONS);
    }
    return response;
  } catch (error) {
    console.error('[Pulse API] Error acknowledging checkpoint:', error);
    return NextResponse.json({ error: 'Failed to acknowledge checkpoint' }, { status: 500 });
  }
}
