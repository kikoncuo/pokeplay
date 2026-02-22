import { createClient } from '@/lib/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { RoomPresence } from '@/types/room';
import type { RoomChannelHandlers } from './room-channel';
import type { PlayerState } from '@/types/multiplayer';
import type { PlayerStateWire } from './types';
import { serializePlayerState, deserializePlayerState } from './types';

export type ChannelStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

const POSITION_EVENT = 'position';
const PING_EVENT = 'ping';
const HEARTBEAT_INTERVAL_MS = 30_000;
const STALE_THRESHOLD_MS = 5_000;

const MAX_BROADCAST_HZ = 10;
const BROADCAST_INTERVAL_MS = 1000 / MAX_BROADCAST_HZ;

/** Backoff delays in ms, capped at 30s. */
const BACKOFF_DELAYS_MS = [1_000, 2_000, 4_000, 8_000, 16_000, 30_000];

export type StatusChangeCallback = (status: ChannelStatus) => void;

export interface ConnectionManagerOptions {
  roomId: string;
  localPresence: RoomPresence;
  handlers: RoomChannelHandlers;
  onStatusChange: StatusChangeCallback;
  /** Called whenever a ping or position is received — updates last-seen for userId. */
  onPlayerSeen: (userId: string, ts: number) => void;
}

/**
 * Manages a Supabase Realtime channel with:
 * - Exponential backoff reconnect on drop
 * - 30s heartbeat ping broadcast
 * - Integrated 10Hz position broadcaster (call queuePosition to send)
 * - Per-player last-seen tracking via onPlayerSeen
 */
export class ConnectionManager {
  private opts: ConnectionManagerOptions;
  private channel: RealtimeChannel | null = null;
  private status: ChannelStatus = 'disconnected';

  // Heartbeat
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  // Reconnect backoff
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;

  // Integrated position broadcaster (10Hz, skip unchanged state)
  private broadcastTimer: ReturnType<typeof setInterval> | null = null;
  private pendingPosition: PlayerState | null = null;
  private lastSentPosition: PlayerState | null = null;

  private destroyed = false;

  constructor(opts: ConnectionManagerOptions) {
    this.opts = opts;
  }

  async connect(): Promise<void> {
    if (this.destroyed) return;
    this.setStatus('connecting');
    try {
      const channel = await this.buildChannel();
      if (this.destroyed) {
        await this.teardownChannel(channel);
        return;
      }
      this.channel = channel;
      this.reconnectAttempt = 0;
      this.setStatus('connected');
      this.startHeartbeat();
      this.startBroadcaster();
    } catch (err) {
      if (!this.destroyed) {
        console.error('[ConnectionManager] connect failed:', err);
        this.scheduleReconnect();
      }
    }
  }

  /** Queue a player state to be sent at the next 10Hz tick (if changed). */
  queuePosition(state: PlayerState): void {
    this.pendingPosition = state;
  }

  destroy(): void {
    this.destroyed = true;
    this.stopHeartbeat();
    this.stopBroadcaster();
    this.clearReconnectTimer();
    if (this.channel) {
      this.teardownChannel(this.channel).catch(console.error);
      this.channel = null;
    }
    this.setStatus('disconnected');
  }

  getStatus(): ChannelStatus {
    return this.status;
  }

  // ---------------------------------------------------------------------------
  // Internal — channel setup
  // ---------------------------------------------------------------------------

  private setStatus(status: ChannelStatus): void {
    if (this.status === status) return;
    this.status = status;
    this.opts.onStatusChange(status);
  }

  private async buildChannel(): Promise<RealtimeChannel> {
    const supabase = createClient();
    const channelName = `room:${this.opts.roomId}`;
    const { localPresence, handlers, onPlayerSeen } = this.opts;

    const channel = supabase.channel(channelName, {
      config: {
        presence: { key: localPresence.userId },
        broadcast: { self: false, ack: false },
      },
    });

    channel.on('presence', { event: 'join' }, ({ newPresences }) => {
      if (handlers.onPresenceJoin) {
        const members = newPresences.map((p) => ({
          userId: p['userId'] as string,
          username: p['username'] as string,
          onlineAt: p['onlineAt'] as string,
        }));
        handlers.onPresenceJoin(members);
      }
    });

    channel.on('presence', { event: 'leave' }, ({ leftPresences }) => {
      if (handlers.onPresenceLeave) {
        for (const p of leftPresences) {
          handlers.onPresenceLeave(p['userId'] as string);
        }
      }
    });

    channel.on('broadcast', { event: POSITION_EVENT }, ({ payload }) => {
      const state = deserializePlayerState(payload as PlayerStateWire);
      onPlayerSeen(state.userId, Date.now());
      handlers.onPositionUpdate?.(state);
    });

    channel.on('broadcast', { event: PING_EVENT }, ({ payload }) => {
      const userId = (payload as { u: string }).u;
      if (userId && userId !== localPresence.userId) {
        onPlayerSeen(userId, Date.now());
      }
    });

    await new Promise<void>((resolve, reject) => {
      channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            userId: localPresence.userId,
            username: localPresence.username,
            onlineAt: localPresence.onlineAt,
          });
          resolve();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          reject(new Error(`Channel subscription failed: ${status}`));
        } else if (status === 'CLOSED') {
          // Unexpected close after successful connect → reconnect
          if (this.status === 'connected' && !this.destroyed) {
            this.stopHeartbeat();
            this.stopBroadcaster();
            this.channel = null;
            this.scheduleReconnect();
          }
        }
      });
    });

    return channel;
  }

  private async teardownChannel(channel: RealtimeChannel): Promise<void> {
    try {
      await channel.untrack();
      await channel.unsubscribe();
    } catch {
      // best-effort
    }
  }

  // ---------------------------------------------------------------------------
  // Internal — heartbeat
  // ---------------------------------------------------------------------------

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.channel && this.status === 'connected') {
        this.channel.send({
          type: 'broadcast',
          event: PING_EVENT,
          payload: { u: this.opts.localPresence.userId },
        });
      }
    }, HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Internal — integrated position broadcaster
  // ---------------------------------------------------------------------------

  private startBroadcaster(): void {
    this.stopBroadcaster();
    this.broadcastTimer = setInterval(() => this.flushPosition(), BROADCAST_INTERVAL_MS);
  }

  private stopBroadcaster(): void {
    if (this.broadcastTimer !== null) {
      clearInterval(this.broadcastTimer);
      this.broadcastTimer = null;
    }
    this.pendingPosition = null;
    this.lastSentPosition = null;
  }

  private flushPosition(): void {
    if (!this.pendingPosition || !this.channel || this.status !== 'connected') return;
    if (this.isSamePosition(this.pendingPosition, this.lastSentPosition)) return;

    const wire = serializePlayerState(this.pendingPosition);
    this.channel.send({ type: 'broadcast', event: POSITION_EVENT, payload: wire });
    this.lastSentPosition = { ...this.pendingPosition };
    this.pendingPosition = null;
  }

  private isSamePosition(a: PlayerState, b: PlayerState | null): boolean {
    if (!b) return false;
    return (
      a.mapId === b.mapId &&
      a.x === b.x &&
      a.y === b.y &&
      a.facing === b.facing &&
      a.isInBattle === b.isInBattle
    );
  }

  // ---------------------------------------------------------------------------
  // Internal — reconnect backoff
  // ---------------------------------------------------------------------------

  private scheduleReconnect(): void {
    if (this.destroyed) return;
    this.setStatus('reconnecting');

    const delayMs =
      BACKOFF_DELAYS_MS[Math.min(this.reconnectAttempt, BACKOFF_DELAYS_MS.length - 1)];
    this.reconnectAttempt += 1;

    console.info(
      `[ConnectionManager] reconnect attempt ${this.reconnectAttempt} in ${delayMs}ms`
    );

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.destroyed) this.connect();
    }, delayMs);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}

// ---------------------------------------------------------------------------
// Staleness helper — used by useConnectionHealth and PlayerList
// ---------------------------------------------------------------------------

export type PlayerHealthStatus = 'active' | 'stale' | 'unknown';

/**
 * Returns whether a player is active or stale based on last-seen timestamp.
 * The local player is always 'active'.
 */
export function getPlayerHealth(
  userId: string,
  localUserId: string,
  lastSeenMs: number | undefined
): PlayerHealthStatus {
  if (userId === localUserId) return 'active';
  if (!lastSeenMs) return 'unknown';
  return Date.now() - lastSeenMs < STALE_THRESHOLD_MS ? 'active' : 'stale';
}

export { STALE_THRESHOLD_MS };
