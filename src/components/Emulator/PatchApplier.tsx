'use client';

import { useCallback, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { loadRomFile } from '@/lib/rom/loader';
import { hashRom } from '@/lib/rom/hasher';
import { applyPatch, validatePatchFile, detectPatchFormat, type PatchFormat } from '@/lib/rom/patcher';
import { storePatch } from '@/lib/rom/patch-store';
import { storeRom } from '@/lib/rom/idb-store';
import { identifyRom, createUnknownRomMetadata } from '@/lib/rom/identifier';

export interface PatchResult {
  patchId: string;
  outputSha1: string;
  outputSize: number;
  format: PatchFormat;
}

interface PatchApplierProps {
  /** SHA-1 of the base ROM already in IndexedDB */
  baseRomSha1: string;
  /** Display title of the base ROM */
  baseRomTitle: string;
  /** Raw bytes of the base ROM (already loaded from IDB) */
  baseRomData: Uint8Array;
  onPatchApplied: (result: PatchResult) => void;
  onError?: (error: string) => void;
}

type ApplyState = 'idle' | 'reading' | 'applying' | 'storing' | 'done' | 'error';

const STATE_LABEL: Record<ApplyState, string> = {
  idle: 'Drop a .bps or .ips patch file here',
  reading: 'Reading patch...',
  applying: 'Applying patch...',
  storing: 'Saving patched ROM...',
  done: 'Patch applied successfully',
  error: '',
};

export function PatchApplier({
  baseRomSha1,
  baseRomTitle,
  baseRomData,
  onPatchApplied,
  onError,
}: PatchApplierProps): React.ReactElement {
  const inputRef = useRef<HTMLInputElement>(null);
  const [applyState, setApplyState] = useState<ApplyState>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [detectedFormat, setDetectedFormat] = useState<PatchFormat | null>(null);

  const processPatch = useCallback(
    async (file: File) => {
      const validation = validatePatchFile(file);
      if (!validation.valid) {
        setErrorMsg(validation.error ?? 'Invalid patch file');
        setApplyState('error');
        onError?.(validation.error ?? 'Invalid patch file');
        return;
      }

      try {
        setApplyState('reading');
        const patchData = await loadRomFile(file);
        const format = detectPatchFormat(patchData);
        setDetectedFormat(format);

        setApplyState('applying');
        const patchedData = applyPatch(baseRomData, patchData);

        setApplyState('storing');
        const [patchSha1, outputSha1] = await Promise.all([
          hashRom(patchData),
          hashRom(patchedData),
        ]);

        // Store the patch file
        const patchId = await storePatch(
          baseRomSha1,
          patchSha1,
          patchData,
          file.name,
          format,
          file.name.replace(/\.[^.]+$/, ''),
        );

        // Store the patched ROM in the ROM library
        const patchedFilename = `${baseRomTitle} [${file.name.replace(/\.[^.]+$/, '')}].${
          baseRomData.length > 4 * 1024 * 1024 ? 'gba' : 'gb'
        }`;
        const metadata = identifyRom(outputSha1) ?? {
          ...createUnknownRomMetadata(patchedFilename),
          isHack: true,
          baseGame: baseRomSha1,
        };
        await storeRom(outputSha1, patchedData, patchedFilename, metadata);

        setApplyState('done');
        onPatchApplied({ patchId, outputSha1, outputSize: patchedData.byteLength, format });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to apply patch';
        setErrorMsg(message);
        setApplyState('error');
        onError?.(message);
      }
    },
    [baseRomData, baseRomSha1, baseRomTitle, onPatchApplied, onError],
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processPatch(file);
      e.target.value = '';
    },
    [processPatch],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) processPatch(file);
    },
    [processPatch],
  );

  const isProcessing =
    applyState === 'reading' || applyState === 'applying' || applyState === 'storing';

  const reset = () => {
    setApplyState('idle');
    setErrorMsg('');
    setDetectedFormat(null);
  };

  return (
    <Card className="border-2 border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-bold uppercase tracking-tight">
            Apply Patch
          </CardTitle>
          {detectedFormat && applyState !== 'error' && (
            <Badge variant="outline" className="font-mono text-xs uppercase">
              {detectedFormat}
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Base: <span className="font-medium">{baseRomTitle}</span>
        </p>
      </CardHeader>
      <CardContent>
        <input
          ref={inputRef}
          type="file"
          accept=".bps,.ips"
          className="hidden"
          onChange={handleFileChange}
          disabled={isProcessing}
        />

        <div
          role="button"
          tabIndex={0}
          aria-label="Patch file drop zone"
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onClick={() => !isProcessing && inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              if (!isProcessing) inputRef.current?.click();
            }
          }}
          className={[
            'flex min-h-[100px] cursor-pointer flex-col items-center justify-center gap-2',
            'border-2 border-dashed border-border p-4 text-center transition-colors',
            'hover:border-primary hover:bg-primary/5',
            isDragging ? 'border-primary bg-primary/5' : '',
            isProcessing ? 'pointer-events-none opacity-60' : '',
            applyState === 'error' ? 'border-destructive' : '',
            applyState === 'done' ? 'border-green-600 bg-green-50 dark:bg-green-950/20' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {applyState === 'error' ? (
            <>
              <p className="text-sm font-bold text-destructive">Patch Failed</p>
              <p className="text-xs text-destructive/80">{errorMsg}</p>
            </>
          ) : (
            <>
              <Label className="pointer-events-none cursor-pointer text-sm">
                {STATE_LABEL[applyState]}
              </Label>
              {applyState === 'idle' && (
                <p className="text-xs text-muted-foreground">Supports .bps and .ips formats</p>
              )}
              {isProcessing && (
                <div className="h-1 w-24 overflow-hidden bg-muted">
                  <div className="h-full animate-pulse bg-primary" />
                </div>
              )}
            </>
          )}
        </div>

        <div className="mt-3 flex gap-2">
          {applyState === 'error' || applyState === 'done' ? (
            <Button size="sm" variant="outline" onClick={reset} className="flex-1">
              {applyState === 'done' ? 'Apply Another' : 'Try Again'}
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => inputRef.current?.click()}
              disabled={isProcessing}
              className="flex-1"
            >
              Browse Patch File
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
