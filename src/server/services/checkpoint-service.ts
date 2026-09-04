/**
 * PULSE — Checkpoint Management Service
 * Manages user's logical checkpoint state without mutating deterministic demo fixtures.
 */

import {
  getLatestCheckpoint as dbGetLatestCheckpoint,
  acknowledgeCheckpoint as dbAcknowledgeCheckpoint,
} from '../db/store';
import { PersistedCheckpoint } from '@/types';

/**
 * 1. Retrieve the latest persisted checkpoint for a user and watchlist
 */
export async function getUserLatestCheckpoint(
  userId: string,
  watchlistId: string
): Promise<PersistedCheckpoint | null> {
  return dbGetLatestCheckpoint(userId, watchlistId);
}

/**
 * 2. Acknowledge Checkpoint ("Mark as Seen")
 * Atomically updates user's baseline checkpoint to the current timestamp.
 */
export async function acknowledgeUserCheckpoint(
  userId: string,
  watchlistId: string,
  timestamp: Date = new Date(),
  label: string = 'User Acknowledged'
): Promise<PersistedCheckpoint> {
  return dbAcknowledgeCheckpoint(userId, watchlistId, timestamp, label);
}
