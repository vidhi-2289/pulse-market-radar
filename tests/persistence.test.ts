import { describe, it, expect, beforeEach } from 'vitest';
import { clearMemoryStore } from '../src/server/db/store';
import { resolveOrCreateGuestSession } from '../src/server/services/session-service';
import {
  addAssetToWatchlist,
  removeAssetFromWatchlist,
  getActiveWatchlist,
  MAX_WATCHLIST_SIZE,
} from '../src/server/services/watchlist-service';
import {
  getUserLatestCheckpoint,
  acknowledgeUserCheckpoint,
} from '../src/server/services/checkpoint-service';
import { evaluateRadar } from '../src/server/services/radar-service';
import { DemoScenario } from '../src/types';

describe('Persistent Application State & Guest Session Integration', { timeout: 20000 }, () => {
  beforeEach(() => {
    clearMemoryStore();
  });

  it('1. guest session creation: initializes new anonymous guest with secure token', async () => {
    const session = await resolveOrCreateGuestSession(null);

    expect(session.isNewSession).toBe(true);
    expect(session.token).toMatch(/^pulse_gst_[a-f0-9]{64}$/);
    expect(session.user.isGuest).toBe(true);
    expect(session.user.id).toBeDefined();
    expect(session.watchlist).toBeDefined();
    expect(session.checkpoint).toBeDefined();
  });

  it('2. repeat request resolves same user: retrieves consistent identity via session token', async () => {
    const firstSession = await resolveOrCreateGuestSession(null);
    const token = firstSession.token;

    const secondSession = await resolveOrCreateGuestSession(token);

    expect(secondSession.isNewSession).toBe(false);
    expect(secondSession.user.id).toBe(firstSession.user.id);
    expect(secondSession.watchlist.id).toBe(firstSession.watchlist.id);
    expect(secondSession.checkpoint.id).toBe(firstSession.checkpoint.id);
  });

  it('3. default watchlist creation: seeds canonical 8 tracked assets in Main Radar', async () => {
    const session = await resolveOrCreateGuestSession(null);
    const watchlist = session.watchlist;

    expect(watchlist.name).toBe('Main Radar');
    expect(watchlist.isDefault).toBe(true);
    expect(watchlist.items.length).toBe(8);

    const symbols = watchlist.items.map((i) => i.symbol);
    expect(symbols).toEqual(['NVDA', 'AAPL', 'MSFT', 'TSLA', 'JPM', 'XOM', 'SPY', 'QQQ']);
  });

  it('4. duplicate symbol rejection: prevents adding already tracked ticker', async () => {
    const session = await resolveOrCreateGuestSession(null);

    await expect(
      addAssetToWatchlist(session.watchlist, { symbol: 'NVDA' })
    ).rejects.toThrow(/already tracked/i);

    // Case-insensitive check
    await expect(
      addAssetToWatchlist(session.watchlist, { symbol: 'aapl' })
    ).rejects.toThrow(/already tracked/i);
  });

  it('4b. capacity bounds: enforces MAX_WATCHLIST_SIZE of 30 assets', async () => {
    const session = await resolveOrCreateGuestSession(null);
    let currentWatchlist = session.watchlist;

    // Fill up to 30 items
    for (let i = currentWatchlist.items.length; i < MAX_WATCHLIST_SIZE; i++) {
      currentWatchlist = await addAssetToWatchlist(currentWatchlist, {
        symbol: `SYM${i}`,
      });
    }

    expect(currentWatchlist.items.length).toBe(MAX_WATCHLIST_SIZE);

    // Attempting to add 31st item should reject
    await expect(
      addAssetToWatchlist(currentWatchlist, { symbol: 'OVERFLOW' })
    ).rejects.toThrow(/limit reached/i);
  }, 15000);

  it('5. watchlist persistence: supports adding and removing assets with persistent retrieval', async () => {
    const session = await resolveOrCreateGuestSession(null);

    // Add GOOGL
    const updatedWithAdd = await addAssetToWatchlist(session.watchlist, {
      symbol: 'GOOGL',
      name: 'Alphabet Inc.',
      sector: 'Communication Services',
      sectorEtf: 'XLC',
    });

    expect(updatedWithAdd.items.some((i) => i.symbol === 'GOOGL')).toBe(true);
    expect(updatedWithAdd.items.length).toBe(9);

    // Verify retrieval from active watchlist query
    const fetched = await getActiveWatchlist(session.user.id);
    expect(fetched).toBeDefined();
    expect(fetched?.items.some((i) => i.symbol === 'GOOGL')).toBe(true);

    // Remove AAPL
    const updatedWithRemove = await removeAssetFromWatchlist(session.watchlist.id, {
      symbol: 'AAPL',
    });

    expect(updatedWithRemove.items.some((i) => i.symbol === 'AAPL')).toBe(false);
    expect(updatedWithRemove.items.length).toBe(8);

    const refetched = await getActiveWatchlist(session.user.id);
    expect(refetched?.items.some((i) => i.symbol === 'AAPL')).toBe(false);
  });

  it('6. checkpoint persistence: persists initial and retrieved checkpoints', async () => {
    const session = await resolveOrCreateGuestSession(null);

    const checkpoint = await getUserLatestCheckpoint(session.user.id, session.watchlist.id);
    expect(checkpoint).toBeDefined();
    expect(checkpoint?.id).toBe(session.checkpoint.id);
    expect(checkpoint?.checkpointTimestamp).toBe(session.checkpoint.checkpointTimestamp);
  });

  it('7. Mark as Seen persistence: atomically updates user baseline checkpoint timestamp', async () => {
    const session = await resolveOrCreateGuestSession(null);
    const originalTimestamp = session.checkpoint.checkpointTimestamp;

    // Small delay to guarantee timestamp advance
    const acknowledgeTime = new Date();
    const updatedCheckpoint = await acknowledgeUserCheckpoint(
      session.user.id,
      session.watchlist.id,
      acknowledgeTime,
      'User Mark as Seen'
    );

    expect(updatedCheckpoint.checkpointTimestamp).not.toBe(originalTimestamp);
    expect(new Date(updatedCheckpoint.checkpointTimestamp).getTime()).toBeGreaterThan(
      new Date(originalTimestamp).getTime()
    );

    // Subsequent retrieval returns the updated checkpoint
    const latest = await getUserLatestCheckpoint(session.user.id, session.watchlist.id);
    expect(latest?.id).toBe(updatedCheckpoint.id);
    expect(latest?.checkpointTimestamp).toBe(updatedCheckpoint.checkpointTimestamp);
  });

  it('8. demo scenario does not mutate stored checkpoint: demo evaluations leave database state pure', async () => {
    const session = await resolveOrCreateGuestSession(null);
    const initialCheckpoint = await getUserLatestCheckpoint(session.user.id, session.watchlist.id);

    const allScenarios: DemoScenario[] = [
      'QUIET',
      'STOCK_SPIKE',
      'SECTOR_RUN',
      'MARKET_CRASH',
      'STALE',
      'PROVIDER_FAILURE',
    ];

    // Evaluate radar across all demo scenarios
    for (const sc of allScenarios) {
      evaluateRadar({
        scenario: sc,
        checkpointTimestamp: initialCheckpoint!.checkpointTimestamp,
      });
    }

    // Stored checkpoint in database must remain completely unaltered
    const checkpointAfter = await getUserLatestCheckpoint(session.user.id, session.watchlist.id);
    expect(checkpointAfter?.id).toBe(initialCheckpoint?.id);
    expect(checkpointAfter?.checkpointTimestamp).toBe(initialCheckpoint?.checkpointTimestamp);
  });

  it('9. demo scenario does not mutate watchlist: stored user universe remains immutable during demo evaluations', async () => {
    const session = await resolveOrCreateGuestSession(null);

    // User customized their watchlist by adding AMD
    await addAssetToWatchlist(session.watchlist, { symbol: 'AMD' });

    const beforeEvaluation = await getActiveWatchlist(session.user.id);
    expect(beforeEvaluation?.items.length).toBe(9);

    // Switch between various demo scenarios
    evaluateRadar({ scenario: 'MARKET_CRASH' });
    evaluateRadar({ scenario: 'STOCK_SPIKE' });
    evaluateRadar({ scenario: 'SECTOR_RUN' });

    // Stored user watchlist must remain exactly 9 items, including AMD
    const afterEvaluation = await getActiveWatchlist(session.user.id);
    expect(afterEvaluation?.items.length).toBe(9);
    expect(afterEvaluation?.items.map((i) => i.symbol)).toEqual(
      beforeEvaluation?.items.map((i) => i.symbol)
    );
  });
});
