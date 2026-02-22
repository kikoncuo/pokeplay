import { createClient } from '@/lib/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { RoomPresence } from '@/types/room';
import type { PlayerStateWire } from './types';
import { deserializePlayerState } from './types';
import type { PlayerState } from '@/types/multiplayer';

export type PresenceJoinCallback = (members: RoomPresence[]) => void;
export type PresenceLeaveCallback = (userId: string) => void;
export type PositionUpdateCallback = (state: PlayerState) => void;

export interface RoomChannelHandlers {
  onPresenceJoin?: PresenceJoinCallback;
  onPresenceLeave?: PresenceLeaveCallback;
  onPositionUpdate?: PositionUpdateCallback;
}

const POSITION_EVENT = 'position';

export async function joinRoom(
  roomId: string,
  localPresence: RoomPresence,
  handlers: RoomChannelHandlers
): Promise<RealtimeChannel> {
  const supabase = createClient();
  const channelName = `room:${roomId}`;

  const channel = supabase.channel(channelName, {
    config: {
      presence: { key: localPresence.userId },
      broadcast: { self: false, ack: false },
    },
  });

  channel.on('presence', { event: 'join' }, ({ newPresences }) => {
    if (handlers.onPresenceJoin) {
      const members: RoomPresence[] = newPresences.map((p) => ({
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
    if (handlers.onPositionUpdate) {
      const state = deserializePlayerState(payload as PlayerStateWire);
      handlers.onPositionUpdate(state);
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
      }
    });
  });

  return channel;
}

export async function leaveRoom(channel: RealtimeChannel): Promise<void> {
  await channel.untrack();
  await channel.unsubscribe();
}

export function broadcastPosition(
  channel: RealtimeChannel,
  payload: PlayerStateWire
): void {
  channel.send({
    type: 'broadcast',
    event: POSITION_EVENT,
    payload,
  });
}
