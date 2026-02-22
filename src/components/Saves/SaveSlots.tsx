'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { listLocalSavesForGame, type LocalSave } from '@/lib/utils/offline-sync';
import type { SaveType } from '@/lib/supabase/storage';

interface SaveSlotsProps {
  gameHash: string;
  /** Total number of slots to display */
  slotCount?: number;
  saveType?: SaveType;
  /** Called when user wants to load a slot into the emulator */
  onLoad?: (save: LocalSave) => void;
  /** Called when user wants to trigger a manual save to this slot */
  onSave?: (slot: number) => void | Promise<void>;
  /** Called when user wants to delete this slot */
  onDelete?: (slot: number) => void | Promise<void>;
}

function formatPlaytime(seconds: number): string {
  if (seconds === 0) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function SaveSlots({
  gameHash,
  slotCount = 3,
  saveType = 'sram',
  onLoad,
  onSave,
  onDelete,
}: SaveSlotsProps): React.ReactElement {
  const [saves, setSaves] = useState<Map<number, LocalSave>>(new Map());
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const all = await listLocalSavesForGame(gameHash);
    const filtered = all.filter((s) => s.saveType === saveType);
    const bySlot = new Map<number, LocalSave>();
    for (const s of filtered) bySlot.set(s.slot, s);
    setSaves(bySlot);
  }, [gameHash, saveType]);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const label = saveType === 'sram' ? 'Save Slot' : 'State Slot';

  return (
    <Card className="border-2 border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-bold uppercase tracking-tight">
            {saveType === 'sram' ? 'Save Files' : 'Save States'}
          </CardTitle>
          <Badge variant="outline" className="font-mono text-xs">
            {saves.size}/{slotCount} used
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          Array.from({ length: slotCount }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse bg-muted" />
          ))
        ) : (
          Array.from({ length: slotCount }).map((_, slot) => {
            const save = saves.get(slot);
            return (
              <div
                key={slot}
                className="flex items-center gap-3 border-2 border-border p-3"
              >
                {/* Slot number */}
                <div className="flex h-8 w-8 shrink-0 items-center justify-center border border-border bg-muted font-mono text-sm font-black">
                  {slot + 1}
                </div>

                {/* Slot info */}
                <div className="min-w-0 flex-1">
                  {save ? (
                    <>
                      <p className="text-xs font-bold">{label} {slot + 1}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(save.savedAt)} · {formatPlaytime(save.playtimeSeconds)}
                        {save.synced ? (
                          <span className="ml-2 text-green-600 dark:text-green-400">synced</span>
                        ) : (
                          <span className="ml-2 text-amber-600 dark:text-amber-400">local only</span>
                        )}
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">Empty slot</p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex shrink-0 gap-2">
                  {save && onLoad && (
                    <Button size="sm" variant="outline" onClick={() => onLoad(save)}>
                      Load
                    </Button>
                  )}
                  {onSave && (
                    <Button size="sm" onClick={async () => { await onSave(slot); await refresh(); }}>
                      {save ? 'Overwrite' : 'Save'}
                    </Button>
                  )}
                  {save && onDelete && (
                    <Button size="sm" variant="outline" onClick={async () => { await onDelete(slot); await refresh(); }}>
                      Delete
                    </Button>
                  )}
                </div>
              </div>
            );
          })
        )}

        <Separator className="my-2" />
        <p className="text-xs text-muted-foreground">
          Saves are stored locally and synced to the cloud when online.
        </p>
      </CardContent>
    </Card>
  );
}
