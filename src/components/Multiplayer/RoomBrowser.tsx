'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import type { Room } from '@/types/room';

interface RoomBrowserProps {
  rooms: Room[];
  isLoading?: boolean;
  onJoinRoom: (roomId: string) => void;
  onCreateRoom: () => void;
  onRefresh: () => void;
}

export function RoomBrowser({
  rooms,
  isLoading = false,
  onJoinRoom,
  onCreateRoom,
  onRefresh,
}: RoomBrowserProps): React.ReactElement {
  const [search, setSearch] = useState('');

  const filtered = rooms.filter((r) =>
    r.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Card className="w-full border border-border shadow-[3px_3px_0px_0px] shadow-foreground">
      <CardHeader className="flex flex-row items-center justify-between border-b border-border pb-3">
        <CardTitle className="font-mono text-sm font-bold uppercase tracking-widest">
          Rooms
        </CardTitle>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isLoading}
            className="border border-border font-mono text-xs"
          >
            {isLoading ? 'Loading...' : 'Refresh'}
          </Button>
          <Button
            size="sm"
            onClick={onCreateRoom}
            className="font-mono text-xs"
          >
            + New Room
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-3 space-y-3">
        <Input
          placeholder="Search rooms..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-border font-mono text-xs"
        />

        <ScrollArea className="h-64">
          {filtered.length === 0 ? (
            <p className="py-8 text-center font-mono text-xs text-muted-foreground">
              {isLoading ? 'Loading rooms...' : 'No rooms found.'}
            </p>
          ) : (
            <div className="space-y-1">
              {filtered.map((room, idx) => (
                <div key={room.id}>
                  <RoomRow room={room} onJoin={onJoinRoom} />
                  {idx < filtered.length - 1 && <Separator />}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

interface RoomRowProps {
  room: Room;
  onJoin: (roomId: string) => void;
}

function RoomRow({ room, onJoin }: RoomRowProps): React.ReactElement {
  const isFull = room.playerCount >= room.maxPlayers;

  return (
    <div className="flex items-center justify-between px-1 py-2 hover:bg-muted">
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="font-mono text-xs font-semibold truncate">{room.name}</span>
        <div className="flex items-center gap-2">
          <Badge
            variant={room.visibility === 'public' ? 'secondary' : 'outline'}
            className="font-mono text-[10px] px-1 py-0"
          >
            {room.visibility}
          </Badge>
          <span className="font-mono text-[10px] text-muted-foreground">
            {room.playerCount}/{room.maxPlayers}
          </span>
        </div>
      </div>
      <Button
        size="sm"
        variant={isFull ? 'outline' : 'default'}
        disabled={isFull}
        onClick={() => onJoin(room.id)}
        className="ml-3 shrink-0 font-mono text-xs"
      >
        {isFull ? 'Full' : 'Join'}
      </Button>
    </div>
  );
}
