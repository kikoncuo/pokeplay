'use client';

import { useEffect, useState } from 'react';
import { useMultiplayerStore } from '@/stores/multiplayer-store';
import { getPlayerHealth, STALE_THRESHOLD_MS } from '@/lib/multiplayer/connection-health';
import type { PlayerHealthStatus } from '@/lib/multiplayer/connection-health';
import type { ConnectionStatus } from '@/stores/multiplayer-store';

export type { PlayerHealthStatus };

export interface ConnectionHealth {
  /** Overall channel connection status. */
  status: ConnectionStatus;
  /** Returns health status for a given player userId. */
  getPlayerHealth: (userId: string) => PlayerHealthStatus;
}

/**
 * Derives connection and per-player health state from the multiplayer store.
 * Re-evaluates staleness on a 1s tick so the UI stays responsive even when
 * no new messages arrive.
 */
export function useConnectionHealth(localUserId: string): ConnectionHealth {
  const status = useMultiplayerStore((s) => s.status);
  const playerLastSeen = useMultiplayerStore((s) => s.playerLastSeen);

  // Force a re-render on a 1-second tick to update stale indicators in real time
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 1_000);
    return () => clearInterval(timer);
  }, []);

  return {
    status,
    getPlayerHealth: (userId: string): PlayerHealthStatus =>
      getPlayerHealth(userId, localUserId, playerLastSeen[userId]),
  };
}
