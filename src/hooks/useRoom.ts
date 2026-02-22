'use client';

import { useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useRoomStore } from '@/stores/room-store';
import type { Tables } from '@/lib/supabase/database.types';

type DbRoom = Tables<'rooms'>;

async function fetchRooms(): Promise<DbRoom[]> {
  const res = await fetch('/api/rooms');
  if (!res.ok) throw new Error(`Failed to fetch rooms: ${res.statusText}`);
  return res.json() as Promise<DbRoom[]>;
}

async function postCreateRoom(input: {
  name: string;
  system: string;
  max_players: number;
  password_hash?: string;
}): Promise<DbRoom> {
  const res = await fetch('/api/rooms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `Create room failed: ${res.statusText}`);
  }
  return res.json() as Promise<DbRoom>;
}

export interface UseRoomReturn {
  rooms: DbRoom[];
  currentRoom: DbRoom | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createRoom: (name: string, maxPlayers: number, password?: string) => Promise<DbRoom>;
  joinRoom: (roomId: string) => void;
}

export function useRoom(): UseRoomReturn {
  const router = useRouter();
  const { rooms, currentRoom, isLoading, error, setRooms, setLoading, setError } =
    useRoomStore();

  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchRooms();
      setRooms(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load rooms');
    } finally {
      setLoading(false);
    }
  }, [setRooms, setLoading, setError]);

  // Initial load
  useEffect(() => {
    refresh();
  }, [refresh]);

  const createRoom = useCallback(
    async (name: string, maxPlayers: number, password?: string): Promise<DbRoom> => {
      setLoading(true);
      setError(null);
      try {
        const room = await postCreateRoom({
          name,
          system: 'gb',
          max_players: maxPlayers,
          password_hash: password,
        });
        // Optimistically add to list
        setRooms([room, ...rooms]);
        return room;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to create room';
        setError(msg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [rooms, setRooms, setLoading, setError]
  );

  const joinRoom = useCallback(
    (roomId: string): void => {
      router.push(`/rooms/${roomId}`);
    },
    [router]
  );

  return { rooms, currentRoom, isLoading, error, refresh, createRoom, joinRoom };
}
