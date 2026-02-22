'use client';

import { use, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { EmulatorWrapper } from '@/components/Emulator/EmulatorWrapper';
import { PlayerList } from '@/components/Multiplayer/PlayerList';
import { ChatPanel } from '@/components/Multiplayer/ChatPanel';
import type { ChatMessage } from '@/components/Multiplayer/ChatPanel';
import { useMultiplayer } from '@/hooks/useMultiplayer';
import { useConnectionHealth } from '@/hooks/useConnectionHealth';
import { useRoomStore } from '@/stores/room-store';
import { createClient } from '@/lib/supabase/client';
import { renderOverlay } from '@/lib/multiplayer/overlay-renderer';
import type { MpUpdatePositionFn } from '@/lib/emulator/multiplayer-bridge';
import { listRoms, getRom, type StoredRomMeta } from '@/lib/rom/idb-store';
import type { User } from '@supabase/supabase-js';

interface RoomPageProps {
  params: Promise<{ id: string }>;
}

export default function RoomPage({ params }: RoomPageProps): React.ReactElement {
  const { id: roomId } = use(params);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setAuthLoading(false);
    });
  }, []);

  if (authLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="font-mono text-xs text-muted-foreground">Authenticating...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-8">
        <Card className="max-w-sm w-full border border-border">
          <CardContent className="py-10 text-center">
            <p className="mb-4 font-bold">Sign in required</p>
            <Button asChild>
              <Link href="/login">Sign In</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <RoomSession
      roomId={roomId}
      userId={user.id}
      username={user.user_metadata?.display_name ?? user.email ?? user.id.slice(0, 8)}
    />
  );
}

interface RoomSessionProps {
  roomId: string;
  userId: string;
  username: string;
}

function RoomSession({ roomId, userId, username }: RoomSessionProps): React.ReactElement {
  const { members, currentRoom } = useRoomStore();
  const { status, remotePlayers, interpolation, updateLocalPosition, disconnect } =
    useMultiplayer({ roomId, localUserId: userId, localUsername: username });
  const health = useConnectionHealth(userId);

  // ROM selection state
  const [availableRoms, setAvailableRoms] = useState<StoredRomMeta[]>([]);
  const [romsLoading, setRomsLoading] = useState(true);
  const [selectedRom, setSelectedRom] = useState<StoredRomMeta | null>(null);
  const [romUrl, setRomUrl] = useState<string | null>(null);
  const [romError, setRomError] = useState<string | null>(null);

  // Load available ROMs from IndexedDB
  useEffect(() => {
    listRoms()
      .then((roms) => setAvailableRoms(roms.sort((a, b) => b.addedAt - a.addedAt)))
      .catch(() => {})
      .finally(() => setRomsLoading(false));
  }, []);

  // Load ROM data when one is selected
  const handleSelectRom = useCallback(async (rom: StoredRomMeta): Promise<void> => {
    setRomError(null);
    try {
      const stored = await getRom(rom.sha1);
      if (!stored) {
        setRomError('ROM data not found');
        return;
      }
      const arrayBuffer = stored.data.buffer.slice(
        stored.data.byteOffset,
        stored.data.byteOffset + stored.data.byteLength,
      ) as ArrayBuffer;
      const blob = new Blob([arrayBuffer], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      setSelectedRom(rom);
      setRomUrl(url);
    } catch {
      setRomError('Failed to load ROM');
    }
  }, []);

  // Cleanup blob URL on unmount or ROM change
  useEffect(() => {
    return () => {
      if (romUrl) URL.revokeObjectURL(romUrl);
    };
  }, [romUrl]);

  const overlayRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);

  // Canvas overlay render loop
  useEffect(() => {
    if (status !== 'connected') return;

    function frame(): void {
      const canvas = overlayRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const allUserIds = interpolation.getAllUserIds();
      const renderables = allUserIds
        .map((uid) => {
          const pos = interpolation.getInterpolated(uid);
          const state = interpolation.getLatestState(uid);
          if (!pos || !state) return null;
          return { state, position: pos };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null);

      // Use first remote player's mapId as reference, fallback 0
      const localMapId = renderables[0]?.state.mapId ?? 0;

      renderOverlay(ctx, renderables, {
        mapWidth: 20,
        mapHeight: 18,
        localMapId,
        cameraOffsetX: 0,
        cameraOffsetY: 0,
        scale: 1,
      });

      animFrameRef.current = requestAnimationFrame(frame);
    }

    animFrameRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [status, interpolation]);

  // Resize overlay when window resizes
  useEffect(() => {
    function handleResize(): void {
      const overlay = overlayRef.current;
      if (!overlay) return;
      overlay.width = overlay.offsetWidth;
      overlay.height = overlay.offsetHeight;
    }
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Expose updateLocalPosition globally so the multiplayer bridge can call it.
  useEffect(() => {
    (window as Window & { __mpUpdatePosition?: MpUpdatePositionFn }).__mpUpdatePosition =
      updateLocalPosition as unknown as MpUpdatePositionFn;
    return () => {
      delete (window as Window & { __mpUpdatePosition?: MpUpdatePositionFn }).__mpUpdatePosition;
    };
  }, [updateLocalPosition]);

  const [messages, setMessages] = useState<ChatMessage[]>([]);

  function handleSendMessage(text: string): void {
    const msg: ChatMessage = {
      id: crypto.randomUUID(),
      userId,
      username,
      text,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, msg]);
    // TODO: broadcast via Supabase Realtime broadcast once chat channel is wired
  }

  const remotePlayerCount = Object.keys(remotePlayers).length;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-4 border-b border-border px-6 py-3 shrink-0">
        <Button variant="ghost" size="sm" asChild onClick={disconnect}>
          <Link href="/rooms">&larr; Rooms</Link>
        </Button>
        <h1 className="font-mono text-sm font-bold uppercase tracking-widest truncate">
          {currentRoom?.name ?? `Room ${roomId.slice(0, 8)}`}
        </h1>
        {selectedRom && (
          <Badge variant="outline" className="font-mono text-[10px]">
            {selectedRom.metadata?.system ?? '?'}
          </Badge>
        )}
        <Badge
          variant={
            status === 'connected'
              ? 'default'
              : status === 'connecting' || status === 'reconnecting'
              ? 'secondary'
              : 'destructive'
          }
          className="font-mono text-[10px] ml-auto shrink-0"
        >
          {status}
        </Badge>
      </div>

      <div className="flex flex-1 gap-4 overflow-hidden p-4">
        {/* Main area: emulator + overlay */}
        <div className="flex-1 flex flex-col gap-4 min-w-0">
          <div className="relative flex-1 border border-border bg-black">
            {/* ROM selector (before emulator loads) */}
            {!selectedRom && (
              <div className="absolute inset-0 flex items-center justify-center z-20">
                <RomSelector
                  roms={availableRoms}
                  loading={romsLoading}
                  error={romError}
                  onSelect={handleSelectRom}
                />
              </div>
            )}

            {/* Emulator (once ROM is selected) */}
            {selectedRom && romUrl && (
              <div className="absolute inset-0">
                <EmulatorWrapper
                  romUrl={romUrl}
                  romName={selectedRom.filename}
                  className="w-full h-full"
                />
              </div>
            )}

            {/* Overlay canvas — always on top, pointer-events-none */}
            <canvas
              ref={overlayRef}
              className="absolute inset-0 w-full h-full pointer-events-none"
              style={{ zIndex: 10 }}
            />
          </div>

          <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
            <span>{remotePlayerCount} other player{remotePlayerCount !== 1 ? 's' : ''} in room</span>
            <Separator orientation="vertical" className="h-4" />
            <span>10Hz position updates</span>
          </div>
        </div>

        {/* Sidebar: player list + chat */}
        <div className="flex w-64 shrink-0 flex-col gap-4">
          <PlayerList
            members={members}
            localUserId={userId}
            maxPlayers={currentRoom?.max_players ?? 8}
            getHealth={health.getPlayerHealth}
          />
          <ChatPanel
            messages={messages}
            localUserId={userId}
            disabled={status !== 'connected'}
            onSend={handleSendMessage}
          />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ROM Selector — shown in the emulator area before a ROM is loaded
// ---------------------------------------------------------------------------

function RomSelector({
  roms,
  loading,
  error,
  onSelect,
}: {
  roms: StoredRomMeta[];
  loading: boolean;
  error: string | null;
  onSelect: (rom: StoredRomMeta) => Promise<void>;
}): React.ReactElement {
  const [selecting, setSelecting] = useState(false);

  if (loading) {
    return (
      <div className="text-center">
        <p className="font-mono text-xs text-muted-foreground">Loading ROMs...</p>
      </div>
    );
  }

  if (roms.length === 0) {
    return (
      <Card className="w-80 border-2 border-border bg-background">
        <CardContent className="py-8 text-center">
          <p className="mb-2 font-bold">No ROMs in your library</p>
          <p className="mb-4 text-sm text-muted-foreground">
            Load a ROM in the Library first to play in multiplayer.
          </p>
          <Button size="sm" asChild>
            <Link href="/hacks">Go to Library</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-80 max-h-96 border-2 border-border bg-background flex flex-col">
      <CardContent className="p-4 flex flex-col min-h-0">
        <p className="mb-3 text-sm font-bold uppercase tracking-tight">Select a ROM to play</p>
        {error && <p className="mb-2 text-xs text-destructive">{error}</p>}
        <div className="space-y-2 overflow-y-auto flex-1">
          {roms.map((rom) => {
            const title = rom.customName ?? rom.metadata?.title ?? rom.filename;
            const system = rom.metadata?.system ?? '?';
            return (
              <button
                key={rom.sha1}
                disabled={selecting}
                onClick={async () => {
                  setSelecting(true);
                  try {
                    await onSelect(rom);
                  } finally {
                    setSelecting(false);
                  }
                }}
                className="flex w-full items-center gap-2 border-2 border-border p-2 text-left transition-colors hover:border-primary hover:bg-primary/5 disabled:opacity-50"
              >
                <Badge variant="outline" className="font-mono text-xs shrink-0">
                  {system}
                </Badge>
                <span className="truncate text-sm font-bold">{title}</span>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
