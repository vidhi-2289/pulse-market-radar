/**
 * PULSE — Guest Session Service
 * Manages anonymous guest identity via secure HTTP-only cookies and database persistence.
 */

import crypto from 'crypto';
import { cookies } from 'next/headers';
import {
  findUserBySessionToken,
  createGuestUserWithDefaults,
  findActiveWatchlist,
  getLatestCheckpoint,
} from '../db/store';
import { PersistedWatchlist, PersistedCheckpoint, UserSession } from '@/types';

export const PULSE_SESSION_COOKIE = 'pulse_guest_session';

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * 365, // 1 year persistence
};

export function generateSecureToken(): string {
  return `pulse_gst_${crypto.randomBytes(32).toString('hex')}`;
}

export interface GuestSessionResult {
  user: UserSession;
  watchlist: PersistedWatchlist;
  checkpoint: PersistedCheckpoint;
  isNewSession: boolean;
  token: string;
}

/**
 * Resolves an existing guest session by token or securely initializes a new guest user.
 */
export async function resolveOrCreateGuestSession(
  existingToken?: string | null
): Promise<GuestSessionResult> {
  if (existingToken && existingToken.trim().length > 0) {
    const user = await findUserBySessionToken(existingToken.trim());
    if (user) {
      let watchlist = await findActiveWatchlist(user.id);
      if (!watchlist) {
        // Self-heal default watchlist if missing
        const seeded = await createGuestUserWithDefaults(existingToken.trim());
        watchlist = seeded.watchlist;
      }

      let checkpoint = await getLatestCheckpoint(user.id, watchlist.id);
      if (!checkpoint) {
        const seeded = await createGuestUserWithDefaults(existingToken.trim());
        checkpoint = seeded.checkpoint;
      }

      return {
        user: {
          id: user.id,
          isGuest: user.isGuest,
          createdAt: user.createdAt.toISOString(),
        },
        watchlist,
        checkpoint,
        isNewSession: false,
        token: existingToken.trim(),
      };
    }
  }

  // Generate new guest session
  const newToken = generateSecureToken();
  const seeded = await createGuestUserWithDefaults(newToken);

  return {
    user: {
      id: seeded.user.id,
      isGuest: seeded.user.isGuest,
      createdAt: seeded.user.createdAt.toISOString(),
    },
    watchlist: seeded.watchlist,
    checkpoint: seeded.checkpoint,
    isNewSession: true,
    token: newToken,
  };
}

/**
 * Helper to read current guest session token from incoming Next.js request cookies.
 */
export async function getSessionTokenFromHeaders(): Promise<string | undefined> {
  try {
    const cookieStore = await cookies();
    return cookieStore.get(PULSE_SESSION_COOKIE)?.value;
  } catch {
    return undefined;
  }
}
