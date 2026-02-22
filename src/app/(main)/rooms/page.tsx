'use client';

import { useState } from 'react';
import { Separator } from '@/components/ui/separator';
import { RoomBrowser } from '@/components/Multiplayer/RoomBrowser';
import { RoomCreator } from '@/components/Multiplayer/RoomCreator';
import { useRoom } from '@/hooks/useRoom';
import type { CreateRoomInput } from '@/types/room';
import type { Tables } from '@/lib/supabase/database.types';

type DbRoom = Tables<'rooms'>;

function dbRoomToUiRoom(room: DbRoom, memberCount: number) {
  return {
    id: room.id,
    name: room.name,
    hostUserId: room.created_by,
    visibility: room.password_hash ? ('private' as const) : ('public' as const),
    maxPlayers: room.max_players,
    playerCount: memberCount,
    createdAt: room.created_at,
  };
}

export default function RoomsPage(): React.ReactElement {
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const { rooms, isLoading, error, refresh, createRoom, joinRoom } = useRoom();

  async function handleCreate(input: CreateRoomInput): Promise<void> {
    setIsCreating(true);
    try {
      const room = await createRoom(
        input.name,
        input.maxPlayers,
        undefined
      );
      setCreatorOpen(false);
      joinRoom(room.id);
    } catch {
      // error already in store, keep dialog open
    } finally {
      setIsCreating(false);
    }
  }

  const uiRooms = rooms.map((r) =>
    dbRoomToUiRoom(r, (r as DbRoom & { member_count?: number }).member_count ?? 0)
  );

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-black uppercase tracking-tighter">Multiplayer</h1>
        <p className="text-muted-foreground">Create or join rooms to play with friends</p>
      </div>

      <Separator className="mb-8" />

      {error && (
        <p className="mb-4 font-mono text-xs text-destructive border border-destructive px-3 py-2">
          {error}
        </p>
      )}

      <div className="max-w-lg">
        <RoomBrowser
          rooms={uiRooms}
          isLoading={isLoading}
          onJoinRoom={joinRoom}
          onCreateRoom={() => setCreatorOpen(true)}
          onRefresh={refresh}
        />
      </div>

      <RoomCreator
        open={creatorOpen}
        isSubmitting={isCreating}
        onOpenChange={setCreatorOpen}
        onSubmit={handleCreate}
      />
    </div>
  );
}
