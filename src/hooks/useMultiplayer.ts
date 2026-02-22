'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useMultiplayerStore } from '@/stores/multiplayer-store';
import { useRoomStore } from '@/stores/room-store';
import { ConnectionManager } from '@/lib/multiplayer/connection-health';
import { InterpolationRegistry } from '@/lib/multiplayer/interpolation';
import type { PlayerState } from '@/types/multiplayer';
import type { RoomPresence, RoomMember } from '@/types/room';
import type { ConnectionStatus } from '@/stores/multiplayer-store';

export interface UseMultiplayerOptions {
  roomId: string;
  localUserId: string;
  localUsername: string;
}

export interface UseMultiplayerReturn {
  status: ConnectionStatus;
  remotePlayers: Record<string, PlayerState>;
  interpolation: InterpolationRegistry;
  updateLocalPosition: (state: PlayerState) => void;
  disconnect: () => void;
}

export function useMultiplayer({
  roomId,
  localUserId,
  localUsername,
}: UseMultiplayerOptions): UseMultiplayerReturn {
  const managerRef = useRef<ConnectionManager | null>(null);
  const interpolationRef = useRef<InterpolationRegistry>(new InterpolationRegistry());

  const {
    status,
    remotePlayers,
    setStatus,
    setLocalPlayer,
    upsertRemotePlayer,
    removeRemotePlayer,
    markPlayerSeen,
    reset: resetMultiplayer,
  } = useMultiplayerStore();

  const { addMember, removeMember, reset: resetRoom } = useRoomStore();

  const disconnect = useCallback((): void => {
    managerRef.current?.destroy();
    managerRef.current = null;
    interpolationRef.current.clear();
    resetMultiplayer();
    resetRoom();
  }, [resetMultiplayer, resetRoom]);

  useEffect(() => {
    if (!roomId || !localUserId) return;

    const presence: RoomPresence = {
      userId: localUserId,
      username: localUsername,
      onlineAt: new Date().toISOString(),
    };

    const manager = new ConnectionManager({
      roomId,
      localPresence: presence,
      handlers: {
        onPresenceJoin: (members) => {
          for (const m of members) {
            if (m.userId === localUserId) continue;
            const member: RoomMember = {
              userId: m.userId,
              username: m.username,
              joinedAt: Date.now(),
              isHost: false,
            };
            addMember(member);
          }
        },
        onPresenceLeave: (userId) => {
          removeMember(userId);
          removeRemotePlayer(userId);
          interpolationRef.current.remove(userId);
        },
        onPositionUpdate: (state) => {
          if (state.userId === localUserId) return;
          upsertRemotePlayer(state);
          interpolationRef.current.update(state);
        },
      },
      onStatusChange: setStatus,
      onPlayerSeen: markPlayerSeen,
    });

    managerRef.current = manager;
    manager.connect();

    return () => {
      manager.destroy();
      managerRef.current = null;
      interpolationRef.current.clear();
      resetMultiplayer();
      resetRoom();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, localUserId]);

  const updateLocalPosition = useCallback(
    (state: PlayerState): void => {
      setLocalPlayer(state);
      managerRef.current?.queuePosition(state);
    },
    [setLocalPlayer]
  );

  return {
    status,
    remotePlayers,
    interpolation: interpolationRef.current,
    updateLocalPosition,
    disconnect,
  };
}
