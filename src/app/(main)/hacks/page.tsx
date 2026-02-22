'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RomUploader, type RomUploadResult } from '@/components/Emulator/RomUploader';
import { PatchApplier, type PatchResult } from '@/components/Emulator/PatchApplier';
import { listRoms, getRom, deleteRom, type StoredRomMeta } from '@/lib/rom/idb-store';
import { listAllPatches, deletePatch, type StoredPatchMeta } from '@/lib/rom/patch-store';

export default function GameLibraryPage(): React.ReactElement {
  const [roms, setRoms] = useState<StoredRomMeta[]>([]);
  const [patches, setPatches] = useState<StoredPatchMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // For patch applier: which base ROM is selected
  const [patchingRom, setPatchingRom] = useState<{
    meta: StoredRomMeta;
    data: Uint8Array;
  } | null>(null);
  const [loadingRomData, setLoadingRomData] = useState(false);

  const refreshAll = useCallback(async () => {
    const [romData, patchData] = await Promise.all([listRoms(), listAllPatches()]);
    setRoms(romData.sort((a, b) => b.addedAt - a.addedAt));
    setPatches(patchData.sort((a, b) => b.addedAt - a.addedAt));
  }, []);

  useEffect(() => {
    refreshAll().finally(() => setLoading(false));
  }, [refreshAll]);

  const handleRomLoaded = useCallback(
    async (_result: RomUploadResult) => {
      setUploadError(null);
      await refreshAll();
    },
    [refreshAll],
  );

  const handleRomDelete = useCallback(
    async (sha1: string) => {
      await deleteRom(sha1);
      if (patchingRom?.meta.sha1 === sha1) setPatchingRom(null);
      await refreshAll();
    },
    [refreshAll, patchingRom],
  );

  const handlePatchDelete = useCallback(
    async (id: string) => {
      await deletePatch(id);
      await refreshAll();
    },
    [refreshAll],
  );

  const handleSelectForPatching = useCallback(async (rom: StoredRomMeta) => {
    setLoadingRomData(true);
    try {
      const stored = await getRom(rom.sha1);
      if (!stored) return;
      setPatchingRom({ meta: rom, data: stored.data });
    } finally {
      setLoadingRomData(false);
    }
  }, []);

  const handlePatchApplied = useCallback(
    async (_result: PatchResult) => {
      setPatchingRom(null);
      await refreshAll();
    },
    [refreshAll],
  );

  const baseRoms = roms.filter((r) => !r.metadata?.isHack);
  const hackRoms = roms.filter((r) => r.metadata?.isHack);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-black uppercase tracking-tighter">Game Library</h1>
        <p className="text-muted-foreground">ROMs and patches — all stored locally in your browser</p>
      </div>

      <Separator className="mb-8" />

      <Tabs defaultValue="library">
        <TabsList className="mb-6">
          <TabsTrigger value="library" className="font-bold uppercase">
            ROM Library {!loading && <span className="ml-1 text-muted-foreground font-normal">({roms.length})</span>}
          </TabsTrigger>
          <TabsTrigger value="patch" className="font-bold uppercase">
            Apply Patch
          </TabsTrigger>
          <TabsTrigger value="patches" className="font-bold uppercase">
            Patches {!loading && patches.length > 0 && <span className="ml-1 text-muted-foreground font-normal">({patches.length})</span>}
          </TabsTrigger>
        </TabsList>

        {/* ---- ROM Library Tab ---- */}
        <TabsContent value="library">
          {/* Uploader */}
          <div className="mb-8 max-w-lg">
            <RomUploader onRomLoaded={handleRomLoaded} onError={setUploadError} />
            {uploadError && (
              <p className="mt-2 text-sm font-medium text-destructive">{uploadError}</p>
            )}
          </div>

          {loading ? (
            <LoadingSkeleton />
          ) : roms.length === 0 ? (
            <EmptyState
              title="No ROMs in your library"
              description="Use the uploader above to add .gb, .gbc, or .gba files."
            />
          ) : (
            <div className="space-y-6">
              {hackRoms.length > 0 && (
                <section>
                  <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">
                    ROM Hacks
                  </h2>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {hackRoms.map((rom) => (
                      <LibraryRomCard
                        key={rom.sha1}
                        rom={rom}
                        onDelete={handleRomDelete}
                        onPatch={handleSelectForPatching}
                      />
                    ))}
                  </div>
                </section>
              )}
              <section>
                <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">
                  Base Games
                </h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {baseRoms.map((rom) => (
                    <LibraryRomCard
                      key={rom.sha1}
                      rom={rom}
                      onDelete={handleRomDelete}
                      onPatch={handleSelectForPatching}
                    />
                  ))}
                </div>
              </section>
            </div>
          )}
        </TabsContent>

        {/* ---- Apply Patch Tab ---- */}
        <TabsContent value="patch">
          <div className="max-w-2xl space-y-6">
            {/* Base ROM selector */}
            <Card className="border-2 border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-bold uppercase tracking-tight">
                  1. Select Base ROM
                </CardTitle>
              </CardHeader>
              <CardContent>
                {baseRoms.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No base ROMs found. Load a ROM in the Library tab first.
                  </p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {baseRoms.map((rom) => {
                      const selected = patchingRom?.meta.sha1 === rom.sha1;
                      return (
                        <button
                          key={rom.sha1}
                          onClick={() => handleSelectForPatching(rom)}
                          disabled={loadingRomData}
                          className={[
                            'flex items-center gap-2 border-2 p-3 text-left transition-colors',
                            selected
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:border-primary hover:bg-primary/5',
                          ].join(' ')}
                        >
                          <Badge variant="outline" className="font-mono text-xs shrink-0">
                            {rom.metadata?.system ?? '?'}
                          </Badge>
                          <span className="truncate text-sm font-bold">
                            {rom.metadata?.title ?? rom.filename}
                          </span>
                          {selected && (
                            <span className="ml-auto shrink-0 text-xs font-bold text-primary">
                              Selected
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
                {loadingRomData && (
                  <p className="mt-2 text-xs text-muted-foreground">Loading ROM data...</p>
                )}
              </CardContent>
            </Card>

            {/* Patch applier — only shown when a base ROM is selected */}
            {patchingRom && (
              <div>
                <p className="mb-2 text-sm font-bold uppercase tracking-tight text-muted-foreground">
                  2. Upload &amp; Apply Patch
                </p>
                <PatchApplier
                  baseRomSha1={patchingRom.meta.sha1}
                  baseRomTitle={patchingRom.meta.metadata?.title ?? patchingRom.meta.filename}
                  baseRomData={patchingRom.data}
                  onPatchApplied={handlePatchApplied}
                  onError={(e) => setUploadError(e)}
                />
              </div>
            )}

            <Card className="border border-dashed border-border bg-muted/30">
              <CardContent className="py-4">
                <p className="text-xs text-muted-foreground">
                  <span className="font-bold">How it works:</span> Select a base ROM, upload a .bps
                  or .ips patch, and PokéPlay applies it in your browser. The patched ROM is saved
                  to your library — no data leaves your device.
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ---- Patches Tab ---- */}
        <TabsContent value="patches">
          {loading ? (
            <LoadingSkeleton />
          ) : patches.length === 0 ? (
            <EmptyState
              title="No patches applied yet"
              description="Use the Apply Patch tab to apply a .bps or .ips patch to a base ROM."
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {patches.map((patch) => (
                <PatchCard key={patch.id} patch={patch} roms={roms} onDelete={handlePatchDelete} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function LibraryRomCard({
  rom,
  onDelete,
  onPatch,
}: {
  rom: StoredRomMeta;
  onDelete: (sha1: string) => Promise<void>;
  onPatch: (rom: StoredRomMeta) => void;
}): React.ReactElement {
  const [deleting, setDeleting] = useState(false);

  const system = rom.metadata?.system ?? '?';
  const title = rom.customName ?? rom.metadata?.title ?? rom.filename;
  const isHack = rom.metadata?.isHack ?? false;
  const sizeMb = (rom.size / 1024 / 1024).toFixed(2);
  const addedDate = new Date(rom.addedAt).toLocaleDateString();

  return (
    <Card className="border-2 border-border shadow-sm">
      <CardContent className="p-5">
        <div className="mb-3 flex flex-wrap gap-2">
          <Badge variant="outline" className="font-mono text-xs">
            {system}
          </Badge>
          {isHack && (
            <Badge className="bg-accent text-accent-foreground text-xs">Hack</Badge>
          )}
          {rom.metadata === null && (
            <Badge variant="outline" className="text-xs text-muted-foreground">
              Unknown
            </Badge>
          )}
        </div>

        <Link href={`/hacks/${rom.sha1}`} className="truncate font-bold leading-tight hover:underline">
          {title}
        </Link>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{rom.filename}</p>

        <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
          <span>{sizeMb} MB</span>
          <span>Added {addedDate}</span>
        </div>

        <p className="mt-1 font-mono text-[10px] text-muted-foreground/60">
          {rom.sha1.slice(0, 12)}...
        </p>

        <div className="mt-4 flex gap-2">
          <Button size="sm" className="flex-1" asChild>
            <Link href={`/play/${rom.sha1}`}>Play</Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link href={`/hacks/${rom.sha1}`}>Details</Link>
          </Button>
          {!isHack && (
            <Button size="sm" variant="outline" onClick={() => onPatch(rom)}>
              Patch
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              setDeleting(true);
              try { await onDelete(rom.sha1); } finally { setDeleting(false); }
            }}
            disabled={deleting}
            className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
          >
            {deleting ? '...' : 'Remove'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function PatchCard({
  patch,
  roms,
  onDelete,
}: {
  patch: StoredPatchMeta;
  roms: StoredRomMeta[];
  onDelete: (id: string) => Promise<void>;
}): React.ReactElement {
  const [deleting, setDeleting] = useState(false);
  const baseRom = roms.find((r) => r.sha1 === patch.baseRomSha1);
  const sizeMb = (patch.size / 1024 / 1024).toFixed(3);
  const addedDate = new Date(patch.addedAt).toLocaleDateString();

  return (
    <Card className="border-2 border-border shadow-sm">
      <CardContent className="p-5">
        <div className="mb-3 flex flex-wrap gap-2">
          <Badge variant="outline" className="font-mono text-xs uppercase">
            {patch.format}
          </Badge>
        </div>

        <p className="truncate font-bold leading-tight">{patch.title ?? patch.filename}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{patch.filename}</p>

        {baseRom && (
          <p className="mt-1 truncate text-xs text-muted-foreground">
            Base: {baseRom.metadata?.title ?? baseRom.filename}
          </p>
        )}

        <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
          <span>{sizeMb} MB</span>
          <span>Added {addedDate}</span>
        </div>

        {patch.outputSha1 && (
          <div className="mt-3">
            <Button size="sm" className="w-full" asChild>
              <Link href={`/play/${patch.outputSha1}`}>Play Patched ROM</Link>
            </Button>
          </div>
        )}

        <div className="mt-2">
          <Button
            size="sm"
            variant="outline"
            className="w-full text-destructive hover:bg-destructive hover:text-destructive-foreground"
            disabled={deleting}
            onClick={async () => {
              setDeleting(true);
              try { await onDelete(patch.id); } finally { setDeleting(false); }
            }}
          >
            {deleting ? 'Removing...' : 'Remove Patch'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function LoadingSkeleton(): React.ReactElement {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i} className="border-2 border-border">
          <CardContent className="p-5">
            <div className="h-4 animate-pulse bg-muted" />
            <div className="mt-2 h-3 w-2/3 animate-pulse bg-muted" />
            <div className="mt-4 h-8 animate-pulse bg-muted" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}): React.ReactElement {
  return (
    <Card className="border-2 border-dashed border-border">
      <CardContent className="py-16 text-center">
        <p className="mb-2 font-bold text-muted-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}
