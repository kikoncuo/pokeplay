'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { listRoms, updateRomName, type StoredRomMeta } from '@/lib/rom/idb-store';
import {
  listLocalSavesForGame,
  readLocalSave,
  writeLocalSave,
  deleteLocalSave,
  updateLocalSaveName,
  type LocalSave,
} from '@/lib/utils/offline-sync';
import type { SaveType } from '@/lib/supabase/storage';

interface RomWithSaves {
  rom: StoredRomMeta;
  saves: LocalSave[];
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatPlaytime(seconds: number): string {
  if (seconds === 0) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function SavesPage(): React.ReactElement {
  const router = useRouter();
  const [romData, setRomData] = useState<RomWithSaves[]>([]);
  const [loading, setLoading] = useState(true);

  // Rename dialog state
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [renameTarget, setRenameTarget] = useState<
    | { type: 'rom'; sha1: string }
    | { type: 'save'; gameHash: string; saveType: SaveType; slot: number }
    | null
  >(null);

  // Hidden file input ref for upload
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadTarget, setUploadTarget] = useState<{
    gameHash: string;
    saveType: SaveType;
    slot: number;
  } | null>(null);

  const loadAll = useCallback(async () => {
    const romList = await listRoms();
    const sorted = romList.sort((a, b) => b.addedAt - a.addedAt);

    const withSaves: RomWithSaves[] = await Promise.all(
      sorted.map(async (rom) => {
        const saves = await listLocalSavesForGame(rom.sha1);
        return { rom, saves };
      }),
    );

    setRomData(withSaves);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAll(); // eslint-disable-line react-hooks/set-state-in-effect -- data fetch on mount
  }, [loadAll]);

  // --- Rename handlers ---
  const openRenameRom = (sha1: string, currentName: string): void => {
    setRenameTarget({ type: 'rom', sha1 });
    setRenameValue(currentName);
    setRenameOpen(true);
  };

  const openRenameSave = (
    gameHash: string,
    saveType: SaveType,
    slot: number,
    currentName: string,
  ): void => {
    setRenameTarget({ type: 'save', gameHash, saveType, slot });
    setRenameValue(currentName);
    setRenameOpen(true);
  };

  const handleRenameConfirm = async (): Promise<void> => {
    if (!renameTarget || !renameValue.trim()) return;
    if (renameTarget.type === 'rom') {
      await updateRomName(renameTarget.sha1, renameValue.trim());
    } else {
      await updateLocalSaveName(
        renameTarget.gameHash,
        renameTarget.saveType,
        renameTarget.slot,
        renameValue.trim(),
      );
    }
    setRenameOpen(false);
    setRenameTarget(null);
    await loadAll();
  };

  // --- Delete handler ---
  const handleDelete = async (
    gameHash: string,
    saveType: SaveType,
    slot: number,
  ): Promise<void> => {
    await deleteLocalSave(gameHash, saveType, slot);
    await loadAll();
  };

  // --- Download handler ---
  const handleDownload = async (
    gameHash: string,
    saveType: SaveType,
    slot: number,
    displayName: string,
  ): Promise<void> => {
    const save = await readLocalSave(gameHash, saveType, slot);
    if (!save) return;
    const ext = saveType === 'sram' ? '.sav' : '.state';
    const arrayBuffer = save.data.buffer.slice(
      save.data.byteOffset,
      save.data.byteOffset + save.data.byteLength,
    ) as ArrayBuffer;
    const blob = new Blob([arrayBuffer], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${displayName}_slot${slot + 1}${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // --- Upload handler ---
  const handleUploadClick = (
    gameHash: string,
    saveType: SaveType,
    slot: number,
  ): void => {
    setUploadTarget({ gameHash, saveType, slot });
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ): Promise<void> => {
    const file = e.target.files?.[0];
    if (!file || !uploadTarget) return;

    const arrayBuffer = await file.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);
    const key = `${uploadTarget.gameHash}:${uploadTarget.saveType}:${uploadTarget.slot}`;

    const localSave: LocalSave = {
      key,
      gameHash: uploadTarget.gameHash,
      saveType: uploadTarget.saveType,
      slot: uploadTarget.slot,
      data,
      checksum: null,
      playtimeSeconds: 0,
      savedAt: Date.now(),
      synced: false,
      name: file.name,
    };

    await writeLocalSave(localSave);
    setUploadTarget(null);
    // Reset the input so the same file can be re-selected
    e.target.value = '';
    await loadAll();
  };

  // --- Continue handler ---
  const handleContinue = (sha1: string, saveType: SaveType, slot: number): void => {
    router.push(`/play/${sha1}?load=${saveType}:${slot}`);
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-black uppercase tracking-tighter">Save Manager</h1>
        <p className="text-muted-foreground">Manage your game saves</p>
      </div>

      <Separator className="mb-8" />

      {loading ? (
        <div className="max-w-3xl space-y-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse bg-muted" />
          ))}
        </div>
      ) : romData.length === 0 ? (
        <Card className="max-w-md border-2 border-dashed border-border">
          <CardContent className="py-12 text-center">
            <p className="mb-2 font-bold">No ROMs in library</p>
            <p className="text-sm text-muted-foreground">
              Load a ROM from the Library to manage its saves.
            </p>
            <Button size="sm" className="mt-4" asChild>
              <a href="/hacks">Go to Library</a>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="max-w-3xl space-y-10">
          {romData.map(({ rom, saves }) => {
            const displayName =
              rom.customName ?? rom.metadata?.title ?? rom.filename;
            const system = rom.metadata?.system ?? '?';

            const stateSaves = saves.filter((s) => s.saveType === 'state');
            const sramSaves = saves.filter((s) => s.saveType === 'sram');

            return (
              <section key={rom.sha1}>
                {/* ROM header */}
                <div className="mb-4 flex items-center gap-2">
                  <Badge variant="outline" className="font-mono text-xs">
                    {system}
                  </Badge>
                  <h2 className="font-bold uppercase tracking-tight">
                    {displayName}
                  </h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-muted-foreground"
                    onClick={() => openRenameRom(rom.sha1, displayName)}
                  >
                    Rename
                  </Button>
                </div>

                {/* Save States */}
                <SaveSection
                  title="Save States"
                  saveType="state"
                  slotCount={3}
                  saves={stateSaves}
                  gameHash={rom.sha1}
                  displayName={displayName}
                  onContinue={handleContinue}
                  onRename={openRenameSave}
                  onDownload={handleDownload}
                  onDelete={handleDelete}
                  onUpload={handleUploadClick}
                />

                {/* Save Files (SRAM) */}
                <SaveSection
                  title="Save Files"
                  saveType="sram"
                  slotCount={3}
                  saves={sramSaves}
                  gameHash={rom.sha1}
                  displayName={displayName}
                  onContinue={handleContinue}
                  onRename={openRenameSave}
                  onDownload={handleDownload}
                  onDelete={handleDelete}
                  onUpload={handleUploadClick}
                />
              </section>
            );
          })}
        </div>
      )}

      {/* Shared rename dialog */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Rename {renameTarget?.type === 'rom' ? 'ROM' : 'Save'}
            </DialogTitle>
            <DialogDescription>
              Enter a new name below.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleRenameConfirm();
            }}
          >
            <Input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              autoFocus
              className="mb-4"
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setRenameOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!renameValue.trim()}>
                Save
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Hidden file input for upload */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".sav,.state,.ss0,.ss1,.ss2,.srm"
        onChange={handleFileSelected}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// SaveSection — renders 3 slots for a save type under a ROM
// ---------------------------------------------------------------------------

interface SaveSectionProps {
  title: string;
  saveType: SaveType;
  slotCount: number;
  saves: LocalSave[];
  gameHash: string;
  displayName: string;
  onContinue: (sha1: string, saveType: SaveType, slot: number) => void;
  onRename: (gameHash: string, saveType: SaveType, slot: number, name: string) => void;
  onDownload: (gameHash: string, saveType: SaveType, slot: number, displayName: string) => Promise<void>;
  onDelete: (gameHash: string, saveType: SaveType, slot: number) => Promise<void>;
  onUpload: (gameHash: string, saveType: SaveType, slot: number) => void;
}

function SaveSection({
  title,
  saveType,
  slotCount,
  saves,
  gameHash,
  displayName,
  onContinue,
  onRename,
  onDownload,
  onDelete,
  onUpload,
}: SaveSectionProps): React.ReactElement {
  const bySlot = new Map<number, LocalSave>();
  for (const s of saves) bySlot.set(s.slot, s);

  return (
    <div className="mb-4">
      <h3 className="mb-2 text-sm font-bold uppercase tracking-tight text-muted-foreground">
        {title}
      </h3>
      <div className="space-y-2">
        {Array.from({ length: slotCount }).map((_, slot) => {
          const save = bySlot.get(slot);
          const slotLabel = save?.name ?? `${saveType === 'sram' ? 'Save' : 'State'} Slot ${slot + 1}`;

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
                    <p className="text-xs font-bold">{slotLabel}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(save.savedAt)}
                      {formatPlaytime(save.playtimeSeconds) && (
                        <> · {formatPlaytime(save.playtimeSeconds)}</>
                      )}
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground italic">Empty slot</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex shrink-0 gap-1">
                {save ? (
                  <>
                    <Button
                      size="sm"
                      onClick={() => onContinue(gameHash, saveType, slot)}
                    >
                      Continue
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onRename(gameHash, saveType, slot, slotLabel)}
                    >
                      Rename
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onDownload(gameHash, saveType, slot, displayName)}
                    >
                      Download
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onDelete(gameHash, saveType, slot)}
                    >
                      Delete
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onUpload(gameHash, saveType, slot)}
                  >
                    Upload
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
