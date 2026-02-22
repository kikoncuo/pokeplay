'use client';

import { use, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmulatorWrapper } from '@/components/Emulator/EmulatorWrapper';
import { SaveSlots } from '@/components/Saves/SaveSlots';
import { getRom, getRomMeta, type StoredRomMeta } from '@/lib/rom/idb-store';
import { useSaveManager } from '@/hooks/useSaveManager';
import { createClient } from '@/lib/supabase/client';
import { upsertUserGame } from '@/lib/supabase/queries/user-games';
import { startSyncLoop, listLocalSavesForGame, type LocalSave } from '@/lib/utils/offline-sync';
import type { EmulatorManager } from '@/lib/emulator/emulator-manager';

interface PlayerPageProps {
  params: Promise<{ sha1: string }>;
  searchParams: Promise<{ load?: string }>;
}

export default function PlayerPage({ params, searchParams }: PlayerPageProps): React.ReactElement {
  const { sha1 } = use(params);
  const { load: loadParam } = use(searchParams);

  const [meta, setMeta] = useState<StoredRomMeta | null>(null);
  const [romData, setRomData] = useState<Uint8Array | null>(null);
  const [romUrl, setRomUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // Session playtime tracking
  const sessionStartRef = useRef<number>(Date.now());
  const playtimeSeconds = useCallback(
    () => Math.floor((Date.now() - sessionStartRef.current) / 1000),
    [],
  );

  // Load ROM from IndexedDB + get current user
  useEffect(() => {
    async function init() {
      try {
        const supabase = createClient();
        const [{ data: { user } }, storedMeta, storedRom] = await Promise.all([
          supabase.auth.getUser(),
          getRomMeta(sha1),
          getRom(sha1),
        ]);

        setUserId(user?.id ?? null);

        if (!storedRom || !storedMeta) {
          setError('ROM not found in your library. Please load it first.');
          return;
        }

        // Create a Blob URL so EmulatorWrapper can fetch it
        // Slice to a plain ArrayBuffer to satisfy the Blob constructor's strict typing
        const arrayBuffer = storedRom.data.buffer.slice(
          storedRom.data.byteOffset,
          storedRom.data.byteOffset + storedRom.data.byteLength,
        ) as ArrayBuffer;
        const blob = new Blob([arrayBuffer], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);

        setMeta(storedMeta);
        setRomData(storedRom.data);
        setRomUrl(url);
        sessionStartRef.current = Date.now();

        // Record this game as played
        if (user?.id && storedMeta.sha1) {
          upsertUserGame(supabase, user.id, sha1).catch(() => {/* non-critical */});
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load ROM');
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [sha1]);

  // Cleanup Blob URL on unmount
  useEffect(() => {
    return () => {
      if (romUrl) URL.revokeObjectURL(romUrl);
    };
  }, [romUrl]);

  // Start offline→cloud sync loop while the player is open
  useEffect(() => {
    const stop = startSyncLoop(30_000);
    return stop;
  }, []);

  // Record final playtime when navigating away
  useEffect(() => {
    return () => {
      if (!userId || !sha1) return;
      const seconds = playtimeSeconds();
      if (seconds < 5) return; // too short to bother recording
      const supabase = createClient();
      upsertUserGame(supabase, userId, sha1, seconds).catch(() => {});
    };
  }, [userId, sha1, playtimeSeconds]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-8">
        <div className="text-center">
          <div className="mx-auto mb-4 h-1 w-32 overflow-hidden bg-muted">
            <div className="h-full animate-pulse bg-primary" />
          </div>
          <p className="font-bold uppercase tracking-tight">Loading ROM...</p>
        </div>
      </div>
    );
  }

  if (error || !meta || !romData || !romUrl) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-8">
        <Card className="w-full max-w-sm border-2 border-border">
          <CardContent className="py-10 text-center">
            <p className="mb-2 font-bold text-destructive">ROM Not Found</p>
            <p className="mb-6 text-sm text-muted-foreground">{error}</p>
            <Button asChild>
              <Link href="/hacks">Go to Library</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <PlayerView
      sha1={sha1}
      meta={meta}
      romUrl={romUrl}
      userId={userId}
      playtimeSeconds={playtimeSeconds}
      loadParam={loadParam}
    />
  );
}

// ---------------------------------------------------------------------------
// Player view — separated so hooks always run with valid data
// ---------------------------------------------------------------------------

interface PlayerViewProps {
  sha1: string;
  meta: StoredRomMeta;
  romUrl: string;
  userId: string | null;
  playtimeSeconds: () => number;
  loadParam?: string;
}

function formatSlotDate(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function PlayerView({
  sha1,
  meta,
  romUrl,
  userId,
  playtimeSeconds,
  loadParam,
}: PlayerViewProps): React.ReactElement {
  const title = meta.metadata?.title ?? meta.filename;
  const system = meta.metadata?.system ?? '?';
  const isHack = meta.metadata?.isHack ?? false;

  // Save manager hook
  const { saveState, loadSlot, deleteSlot, slots, syncing } = useSaveManager({
    userId,
    gameHash: sha1,
    playtimeSeconds: 0,
  });

  // EmulatorManager ref (set when emulator is ready)
  const emulatorManagerRef = useRef<EmulatorManager | null>(null);

  // Slot picker dialog state
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);

  // Auto-load save on emulator ready: ?load= param or most recent
  const handleReady = useCallback(async (manager: EmulatorManager) => {
    emulatorManagerRef.current = manager;

    const saves = await listLocalSavesForGame(sha1);

    // If ?load=state:0 or ?load=sram:1 etc, load that specific slot
    if (loadParam) {
      const [type, slotStr] = loadParam.split(':');
      const slot = parseInt(slotStr, 10);
      if ((type === 'state' || type === 'sram') && !isNaN(slot)) {
        const target = saves.find((s) => s.saveType === type && s.slot === slot);
        if (target) {
          manager.loadState(target.data);
          return;
        }
      }
    }

    // Fallback: load most recent state save
    const stateSaves = saves
      .filter((s) => s.saveType === 'state')
      .sort((a, b) => b.savedAt - a.savedAt);

    if (stateSaves.length > 0) {
      manager.loadState(stateSaves[0].data);
      return;
    }

    // Fallback: load SRAM slot 0
    const sram = saves.find((s) => s.saveType === 'sram' && s.slot === 0);
    if (sram) {
      manager.loadState(sram.data);
    }
  }, [sha1, loadParam]);

  // Save button in emulator toolbar -> open slot picker dialog
  const handleSaveRequest = useCallback(() => {
    setSaveDialogOpen(true);
  }, []);

  // Capture state and save to a specific slot
  const captureAndSaveState = useCallback(async (slot: number) => {
    const manager = emulatorManagerRef.current;
    if (!manager) return;
    const state = manager.saveState();
    if (state) {
      await saveState(state, slot, playtimeSeconds());
    }
  }, [saveState, playtimeSeconds]);

  // Load a save into the emulator
  const handleLoadSave = useCallback(async (save: LocalSave) => {
    const manager = emulatorManagerRef.current;
    if (!manager) return;
    const data = await loadSlot(save.saveType, save.slot);
    if (data) {
      manager.loadState(data);
    }
  }, [loadSlot]);

  // Delete callbacks per save type
  const handleDeleteSramSlot = useCallback(async (slot: number) => {
    await deleteSlot('sram', slot);
  }, [deleteSlot]);

  const handleDeleteStateSlot = useCallback(async (slot: number) => {
    await deleteSlot('state', slot);
  }, [deleteSlot]);

  const [showSaves, setShowSaves] = useState(false);

  // State slots for the dialog
  const stateSlots = slots.filter((s) => s.saveType === 'state');

  return (
    <div className="flex flex-col h-screen">
      {/* Header bar */}
      <div className="shrink-0 flex items-center gap-3 border-b-2 border-border px-6 py-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/hacks">&larr; Library</Link>
        </Button>
        <Separator orientation="vertical" className="h-5" />
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono text-xs">
            {system}
          </Badge>
          {isHack && (
            <Badge className="bg-accent text-accent-foreground text-xs">Hack</Badge>
          )}
        </div>
        <h1 className="truncate font-bold uppercase tracking-tight">{title}</h1>

        <div className="ml-auto flex items-center gap-2">
          {syncing && (
            <span className="text-xs text-muted-foreground animate-pulse">Saving...</span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSaves((v) => !v)}
          >
            {showSaves ? 'Hide Saves' : 'Saves'}
          </Button>
          {!userId && (
            <Badge variant="outline" className="text-xs text-muted-foreground">
              Sign in to sync saves
            </Badge>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 gap-4 p-4 min-h-0 overflow-hidden">
        {/* Emulator — height-constrained to viewport */}
        <div className="flex-1 min-w-0 min-h-0 flex flex-col">
          <EmulatorWrapper
            romUrl={romUrl}
            romName={meta.filename}
            onReady={handleReady}
            onSaveState={handleSaveRequest}
            className="flex-1 min-h-0"
          />
        </div>

        {/* Save panel */}
        {showSaves && (
          <div className="w-72 shrink-0 space-y-4 overflow-y-auto">
            <SaveSlots
              gameHash={sha1}
              saveType="sram"
              slotCount={3}
              onLoad={handleLoadSave}
              onDelete={handleDeleteSramSlot}
            />
            <SaveSlots
              gameHash={sha1}
              saveType="state"
              slotCount={3}
              onLoad={handleLoadSave}
              onDelete={handleDeleteStateSlot}
            />
          </div>
        )}
      </div>

      {/* Slot picker dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save State</DialogTitle>
            <DialogDescription>Choose a slot to save your progress</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {stateSlots.map((s) => (
              <div
                key={s.slot}
                className="flex items-center gap-3 border-2 border-border p-3"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center border border-border bg-muted font-mono text-sm font-black">
                  {s.slot + 1}
                </div>
                <div className="min-w-0 flex-1">
                  {s.exists ? (
                    <>
                      <p className="text-xs font-bold">State Slot {s.slot + 1}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatSlotDate(s.savedAt!)}
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">Empty slot</p>
                  )}
                </div>
                <Button
                  size="sm"
                  onClick={async () => {
                    await captureAndSaveState(s.slot);
                    setSaveDialogOpen(false);
                  }}
                >
                  {s.exists ? 'Overwrite' : 'Save Here'}
                </Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
