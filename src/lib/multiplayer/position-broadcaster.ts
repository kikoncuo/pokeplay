import type { RealtimeChannel } from '@supabase/supabase-js';
import type { PlayerState } from '@/types/multiplayer';
import { serializePlayerState } from './types';
import { broadcastPosition } from './room-channel';

const MAX_BROADCAST_HZ = 10;
const MIN_INTERVAL_MS = 1000 / MAX_BROADCAST_HZ;

export interface PositionBroadcasterOptions {
  channel: RealtimeChannel;
  rateHz?: number;
}

export class PositionBroadcaster {
  private channel: RealtimeChannel;
  private intervalMs: number;
  private timerId: ReturnType<typeof setInterval> | null = null;
  private pendingState: PlayerState | null = null;
  private lastSentState: PlayerState | null = null;

  constructor({ channel, rateHz = MAX_BROADCAST_HZ }: PositionBroadcasterOptions) {
    this.channel = channel;
    this.intervalMs = Math.max(MIN_INTERVAL_MS, 1000 / rateHz);
  }

  start(): void {
    if (this.timerId !== null) return;
    this.timerId = setInterval(() => this.flush(), this.intervalMs);
  }

  stop(): void {
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    this.pendingState = null;
    this.lastSentState = null;
  }

  updateState(state: PlayerState): void {
    this.pendingState = state;
  }

  private flush(): void {
    if (!this.pendingState) return;
    if (this.isSameState(this.pendingState, this.lastSentState)) return;

    const wire = serializePlayerState(this.pendingState);
    broadcastPosition(this.channel, wire);
    this.lastSentState = { ...this.pendingState };
    this.pendingState = null;
  }

  private isSameState(a: PlayerState, b: PlayerState | null): boolean {
    if (!b) return false;
    return (
      a.mapId === b.mapId &&
      a.x === b.x &&
      a.y === b.y &&
      a.facing === b.facing &&
      a.isInBattle === b.isInBattle
    );
  }
}
