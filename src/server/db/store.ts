/**
 * PULSE — Persistent Application State Store
 * Unified data access layer bridging Prisma (PostgreSQL) and resilient in-memory fallback.
 */

import { prisma, isDatabaseConfigured } from './prisma';
import { DEFAULT_WATCHLIST } from '../market-data/mock-fixtures';
import { PersistedWatchlist, PersistedCheckpoint } from '@/types';

interface MemoryUser {
  id: string;
  isGuest: boolean;
  sessionToken: string;
  createdAt: Date;
  updatedAt: Date;
}

interface MemoryWatchlist {
  id: string;
  userId: string;
  name: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface MemoryWatchlistItem {
  id: string;
  watchlistId: string;
  symbol: string;
  name: string | null;
  sector: string | null;
  sectorEtf: string | null;
  displayOrder: number;
  exchange: string | null;
  createdAt: Date;
}

interface MemoryCheckpoint {
  id: string;
  userId: string;
  watchlistId: string;
  checkpointTimestamp: Date;
  label: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// In-memory fallback stores
const memoryUsers = new Map<string, MemoryUser>(); // sessionToken -> User
const memoryUsersById = new Map<string, MemoryUser>(); // id -> User
const memoryWatchlists = new Map<string, MemoryWatchlist>(); // id -> Watchlist
const memoryWatchlistItems = new Map<string, MemoryWatchlistItem[]>(); // watchlistId -> Items[]
const memoryCheckpoints = new Map<string, MemoryCheckpoint[]>(); // `${userId}:${watchlistId}` -> Checkpoints[]

export function clearMemoryStore(): void {
  memoryUsers.clear();
  memoryUsersById.clear();
  memoryWatchlists.clear();
  memoryWatchlistItems.clear();
  memoryCheckpoints.clear();
}

/**
 * 1. Find User by Session Token
 */
export async function findUserBySessionToken(token: string): Promise<MemoryUser | null> {
  if (isDatabaseConfigured()) {
    try {
      const user = await prisma.user.findUnique({
        where: { sessionToken: token },
      });
      if (user) {
        return {
          id: user.id,
          isGuest: user.isGuest,
          sessionToken: user.sessionToken || token,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        };
      }
    } catch (err) {
      console.warn('[Pulse DB] Failed to query user from PostgreSQL, checking fallback store:', err);
    }
  }

  return memoryUsers.get(token) || null;
}

/**
 * 2. Create Guest User with Initial Seeding
 */
export async function createGuestUserWithDefaults(token: string): Promise<{
  user: MemoryUser;
  watchlist: PersistedWatchlist;
  checkpoint: PersistedCheckpoint;
}> {
  if (isDatabaseConfigured()) {
    try {
      const initialTimestamp = new Date(Date.now() - 2 * 60 * 60 * 1000);

      const created = await prisma.user.create({
        data: {
          isGuest: true,
          sessionToken: token,
          watchlists: {
            create: {
              name: 'Main Radar',
              isDefault: true,
              items: {
                create: DEFAULT_WATCHLIST.map((item) => ({
                  symbol: item.symbol,
                  name: item.name,
                  sector: item.sector,
                  sectorEtf: item.sectorEtf,
                  displayOrder: item.displayOrder,
                })),
              },
            },
          },
        },
        include: {
          watchlists: {
            include: {
              items: {
                orderBy: { displayOrder: 'asc' },
              },
            },
          },
        },
      });

      const defaultWatchlist = created.watchlists[0];

      const checkpoint = await prisma.userCheckpoint.create({
        data: {
          userId: created.id,
          watchlistId: defaultWatchlist.id,
          checkpointTimestamp: initialTimestamp,
          label: 'Session Baseline (2h ago)',
        },
      });

      return {
        user: {
          id: created.id,
          isGuest: created.isGuest,
          sessionToken: created.sessionToken || token,
          createdAt: created.createdAt,
          updatedAt: created.updatedAt,
        },
        watchlist: {
          id: defaultWatchlist.id,
          name: defaultWatchlist.name,
          isDefault: defaultWatchlist.isDefault,
          items: defaultWatchlist.items.map((i) => ({
            id: i.id,
            symbol: i.symbol,
            name: i.name,
            sector: i.sector,
            sectorEtf: i.sectorEtf,
            displayOrder: i.displayOrder,
            exchange: i.exchange,
          })),
        },
        checkpoint: {
          id: checkpoint.id,
          userId: checkpoint.userId,
          watchlistId: checkpoint.watchlistId,
          checkpointTimestamp: checkpoint.checkpointTimestamp.toISOString(),
          label: checkpoint.label,
        },
      };
    } catch (err) {
      console.warn('[Pulse DB] Failed to seed user in PostgreSQL, falling back to memory store:', err);
    }
  }

  // Fallback in-memory creation
  const now = new Date();
  const userId = `usr_mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const watchlistId = `wtl_mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const checkpointId = `chk_mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const user: MemoryUser = {
    id: userId,
    isGuest: true,
    sessionToken: token,
    createdAt: now,
    updatedAt: now,
  };

  const watchlist: MemoryWatchlist = {
    id: watchlistId,
    userId,
    name: 'Main Radar',
    isDefault: true,
    createdAt: now,
    updatedAt: now,
  };

  const items: MemoryWatchlistItem[] = DEFAULT_WATCHLIST.map((item, idx) => ({
    id: `itm_${watchlistId}_${idx}`,
    watchlistId,
    symbol: item.symbol,
    name: item.name,
    sector: item.sector,
    sectorEtf: item.sectorEtf,
    displayOrder: item.displayOrder,
    exchange: null,
    createdAt: now,
  }));

  const checkpointTimestamp = new Date(Date.now() - 2 * 60 * 60 * 1000);
  const checkpoint: MemoryCheckpoint = {
    id: checkpointId,
    userId,
    watchlistId,
    checkpointTimestamp,
    label: 'Session Baseline (2h ago)',
    createdAt: now,
    updatedAt: now,
  };

  memoryUsers.set(token, user);
  memoryUsersById.set(userId, user);
  memoryWatchlists.set(watchlistId, watchlist);
  memoryWatchlistItems.set(watchlistId, items);
  memoryCheckpoints.set(`${userId}:${watchlistId}`, [checkpoint]);

  return {
    user,
    watchlist: {
      id: watchlist.id,
      name: watchlist.name,
      isDefault: watchlist.isDefault,
      items: items.map((i) => ({
        id: i.id,
        symbol: i.symbol,
        name: i.name,
        sector: i.sector,
        sectorEtf: i.sectorEtf,
        displayOrder: i.displayOrder,
      })),
    },
    checkpoint: {
      id: checkpoint.id,
      userId: checkpoint.userId,
      watchlistId: checkpoint.watchlistId,
      checkpointTimestamp: checkpoint.checkpointTimestamp.toISOString(),
      label: checkpoint.label,
    },
  };
}

/**
 * 3. Find Active Watchlist for a User
 */
export async function findActiveWatchlist(userId: string): Promise<PersistedWatchlist | null> {
  if (isDatabaseConfigured()) {
    try {
      const watchlist = await prisma.watchlist.findFirst({
        where: { userId, isDefault: true },
        include: {
          items: {
            orderBy: { displayOrder: 'asc' },
          },
        },
      });

      if (watchlist) {
        return {
          id: watchlist.id,
          name: watchlist.name,
          isDefault: watchlist.isDefault,
          items: watchlist.items.map((i) => ({
            id: i.id,
            symbol: i.symbol,
            name: i.name,
            sector: i.sector,
            sectorEtf: i.sectorEtf,
            displayOrder: i.displayOrder,
            exchange: i.exchange,
          })),
        };
      }
    } catch (err) {
      console.warn('[Pulse DB] Failed to fetch watchlist from PostgreSQL, checking fallback store:', err);
    }
  }

  // Fallback in-memory search
  for (const wl of memoryWatchlists.values()) {
    if (wl.userId === userId && wl.isDefault) {
      const items = memoryWatchlistItems.get(wl.id) || [];
      return {
        id: wl.id,
        name: wl.name,
        isDefault: wl.isDefault,
        items: [...items]
          .sort((a, b) => a.displayOrder - b.displayOrder)
          .map((i) => ({
            id: i.id,
            symbol: i.symbol,
            name: i.name,
            sector: i.sector,
            sectorEtf: i.sectorEtf,
            displayOrder: i.displayOrder,
            exchange: i.exchange,
          })),
      };
    }
  }

  return null;
}

/**
 * 4. Add an item to the Watchlist
 */
export async function addWatchlistItem(
  watchlistId: string,
  data: { symbol: string; name?: string; sector?: string; sectorEtf?: string; exchange?: string; displayOrder: number }
): Promise<PersistedWatchlist> {
  const upperSymbol = data.symbol.toUpperCase();

  if (isDatabaseConfigured()) {
    try {
      await prisma.watchlistItem.create({
        data: {
          watchlistId,
          symbol: upperSymbol,
          name: data.name || null,
          sector: data.sector || null,
          sectorEtf: data.sectorEtf || null,
          exchange: data.exchange || null,
          displayOrder: data.displayOrder,
        },
      });

      const updated = await prisma.watchlist.findUniqueOrThrow({
        where: { id: watchlistId },
        include: {
          items: { orderBy: { displayOrder: 'asc' } },
        },
      });

      return {
        id: updated.id,
        name: updated.name,
        isDefault: updated.isDefault,
        items: updated.items.map((i) => ({
          id: i.id,
          symbol: i.symbol,
          name: i.name,
          sector: i.sector,
          sectorEtf: i.sectorEtf,
          displayOrder: i.displayOrder,
          exchange: i.exchange,
        })),
      };
    } catch (err) {
      console.warn('[Pulse DB] Failed to add watchlistItem in PostgreSQL, updating fallback store:', err);
    }
  }

  // Fallback in-memory update
  const items = memoryWatchlistItems.get(watchlistId) || [];
  const newItem: MemoryWatchlistItem = {
    id: `itm_${watchlistId}_${Date.now()}`,
    watchlistId,
    symbol: upperSymbol,
    name: data.name || null,
    sector: data.sector || null,
    sectorEtf: data.sectorEtf || null,
    displayOrder: data.displayOrder,
    exchange: data.exchange || null,
    createdAt: new Date(),
  };

  items.push(newItem);
  memoryWatchlistItems.set(watchlistId, items);

  const wl = memoryWatchlists.get(watchlistId);
  return {
    id: watchlistId,
    name: wl?.name || 'Main Radar',
    isDefault: wl?.isDefault ?? true,
    items: [...items]
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((i) => ({
        id: i.id,
        symbol: i.symbol,
        name: i.name,
        sector: i.sector,
        sectorEtf: i.sectorEtf,
        displayOrder: i.displayOrder,
      })),
  };
}

/**
 * 5. Remove an item from the Watchlist
 */
export async function removeWatchlistItem(
  watchlistId: string,
  symbol: string
): Promise<PersistedWatchlist> {
  const upperSymbol = symbol.toUpperCase();

  if (isDatabaseConfigured()) {
    try {
      await prisma.watchlistItem.deleteMany({
        where: {
          watchlistId,
          symbol: upperSymbol,
        },
      });

      const updated = await prisma.watchlist.findUniqueOrThrow({
        where: { id: watchlistId },
        include: {
          items: { orderBy: { displayOrder: 'asc' } },
        },
      });

      return {
        id: updated.id,
        name: updated.name,
        isDefault: updated.isDefault,
        items: updated.items.map((i) => ({
          id: i.id,
          symbol: i.symbol,
          name: i.name,
          sector: i.sector,
          sectorEtf: i.sectorEtf,
          displayOrder: i.displayOrder,
          exchange: i.exchange,
        })),
      };
    } catch (err) {
      console.warn('[Pulse DB] Failed to remove watchlistItem in PostgreSQL, updating fallback store:', err);
    }
  }

  // Fallback in-memory update
  const items = memoryWatchlistItems.get(watchlistId) || [];
  const filtered = items.filter((i) => i.symbol !== upperSymbol);
  memoryWatchlistItems.set(watchlistId, filtered);

  const wl = memoryWatchlists.get(watchlistId);
  return {
    id: watchlistId,
    name: wl?.name || 'Main Radar',
    isDefault: wl?.isDefault ?? true,
    items: [...filtered]
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((i) => ({
        id: i.id,
        symbol: i.symbol,
        name: i.name,
        sector: i.sector,
        sectorEtf: i.sectorEtf,
        displayOrder: i.displayOrder,
        exchange: i.exchange,
      })),
  };
}

/**
 * 6. Restore default items to Watchlist
 */
export async function restoreDefaultWatchlist(watchlistId: string): Promise<PersistedWatchlist> {
  if (isDatabaseConfigured()) {
    try {
      await prisma.$transaction([
        prisma.watchlistItem.deleteMany({ where: { watchlistId } }),
        prisma.watchlistItem.createMany({
          data: DEFAULT_WATCHLIST.map((item) => ({
            watchlistId,
            symbol: item.symbol,
            name: item.name,
            sector: item.sector,
            sectorEtf: item.sectorEtf,
            displayOrder: item.displayOrder,
          })),
        }),
      ]);

      const updated = await prisma.watchlist.findUniqueOrThrow({
        where: { id: watchlistId },
        include: {
          items: { orderBy: { displayOrder: 'asc' } },
        },
      });

      return {
        id: updated.id,
        name: updated.name,
        isDefault: updated.isDefault,
        items: updated.items.map((i) => ({
          id: i.id,
          symbol: i.symbol,
          name: i.name,
          sector: i.sector,
          sectorEtf: i.sectorEtf,
          displayOrder: i.displayOrder,
          exchange: i.exchange,
        })),
      };
    } catch (err) {
      console.warn('[Pulse DB] Failed to restore default watchlist in PostgreSQL, updating fallback store:', err);
    }
  }

  // Fallback in-memory restore
  const now = new Date();
  const freshItems: MemoryWatchlistItem[] = DEFAULT_WATCHLIST.map((item, idx) => ({
    id: `itm_${watchlistId}_restored_${idx}`,
    watchlistId,
    symbol: item.symbol,
    name: item.name,
    sector: item.sector,
    sectorEtf: item.sectorEtf,
    displayOrder: item.displayOrder,
    exchange: null,
    createdAt: now,
  }));

  memoryWatchlistItems.set(watchlistId, freshItems);

  const wl = memoryWatchlists.get(watchlistId);
  return {
    id: watchlistId,
    name: wl?.name || 'Main Radar',
    isDefault: wl?.isDefault ?? true,
    items: freshItems.map((i) => ({
      id: i.id,
      symbol: i.symbol,
      name: i.name,
      sector: i.sector,
      sectorEtf: i.sectorEtf,
      displayOrder: i.displayOrder,
      exchange: i.exchange,
    })),
  };
}

/**
 * 7. Get Latest Checkpoint for User + Watchlist
 */
export async function getLatestCheckpoint(
  userId: string,
  watchlistId: string
): Promise<PersistedCheckpoint | null> {
  if (isDatabaseConfigured()) {
    try {
      const checkpoint = await prisma.userCheckpoint.findFirst({
        where: { userId, watchlistId },
        orderBy: { checkpointTimestamp: 'desc' },
      });

      if (checkpoint) {
        return {
          id: checkpoint.id,
          userId: checkpoint.userId,
          watchlistId: checkpoint.watchlistId,
          checkpointTimestamp: checkpoint.checkpointTimestamp.toISOString(),
          label: checkpoint.label,
        };
      }
    } catch (err) {
      console.warn('[Pulse DB] Failed to fetch checkpoint from PostgreSQL, checking fallback store:', err);
    }
  }

  // Fallback in-memory search
  const checkpoints = memoryCheckpoints.get(`${userId}:${watchlistId}`) || [];
  if (checkpoints.length === 0) return null;

  const sorted = [...checkpoints].sort(
    (a, b) => b.checkpointTimestamp.getTime() - a.checkpointTimestamp.getTime()
  );

  const latest = sorted[0];
  return {
    id: latest.id,
    userId: latest.userId,
    watchlistId: latest.watchlistId,
    checkpointTimestamp: latest.checkpointTimestamp.toISOString(),
    label: latest.label,
  };
}

/**
 * 8. Acknowledge Checkpoint ("Mark as Seen")
 */
export async function acknowledgeCheckpoint(
  userId: string,
  watchlistId: string,
  timestamp: Date = new Date(),
  label: string = 'User Acknowledged'
): Promise<PersistedCheckpoint> {
  if (isDatabaseConfigured()) {
    try {
      const checkpoint = await prisma.userCheckpoint.create({
        data: {
          userId,
          watchlistId,
          checkpointTimestamp: timestamp,
          label,
        },
      });

      return {
        id: checkpoint.id,
        userId: checkpoint.userId,
        watchlistId: checkpoint.watchlistId,
        checkpointTimestamp: checkpoint.checkpointTimestamp.toISOString(),
        label: checkpoint.label,
      };
    } catch (err) {
      console.warn('[Pulse DB] Failed to create checkpoint in PostgreSQL, updating fallback store:', err);
    }
  }

  // Fallback in-memory create
  const now = new Date();
  const checkpoint: MemoryCheckpoint = {
    id: `chk_ack_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    userId,
    watchlistId,
    checkpointTimestamp: timestamp,
    label,
    createdAt: now,
    updatedAt: now,
  };

  const list = memoryCheckpoints.get(`${userId}:${watchlistId}`) || [];
  list.unshift(checkpoint);
  memoryCheckpoints.set(`${userId}:${watchlistId}`, list);

  return {
    id: checkpoint.id,
    userId: checkpoint.userId,
    watchlistId: checkpoint.watchlistId,
    checkpointTimestamp: checkpoint.checkpointTimestamp.toISOString(),
    label: checkpoint.label,
  };
}
