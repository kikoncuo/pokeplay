'use client';

import { useCallback, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { loadRomFile, validateRomFile } from '@/lib/rom/loader';
import { hashRom } from '@/lib/rom/hasher';
import { identifyRom, createUnknownRomMetadata, type RomMetadata } from '@/lib/rom/identifier';
import { storeRom, hasRom } from '@/lib/rom/idb-store';

export interface RomUploadResult {
  sha1: string;
  filename: string;
  size: number;
  metadata: RomMetadata | null;
}

interface RomUploaderProps {
  onRomLoaded: (result: RomUploadResult) => void;
  onError?: (error: string) => void;
}

type UploadState = 'idle' | 'reading' | 'hashing' | 'storing' | 'done' | 'error';

export function RomUploader({ onRomLoaded, onError }: RomUploaderProps): React.ReactElement {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<UploadState>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);

  const processFile = useCallback(
    async (file: File) => {
      const validation = validateRomFile(file);
      if (!validation.valid) {
        setErrorMessage(validation.error ?? 'Invalid file');
        setState('error');
        onError?.(validation.error ?? 'Invalid file');
        return;
      }

      try {
        setState('reading');
        const data = await loadRomFile(file);

        setState('hashing');
        const sha1 = await hashRom(data);

        const alreadyStored = await hasRom(sha1);

        let metadata: RomMetadata | null = identifyRom(sha1);
        if (!metadata) {
          metadata = createUnknownRomMetadata(file.name);
        }

        if (!alreadyStored) {
          setState('storing');
          await storeRom(sha1, data, file.name, metadata);
        }

        setState('done');
        onRomLoaded({ sha1, filename: file.name, size: data.byteLength, metadata });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load ROM';
        setErrorMessage(message);
        setState('error');
        onError?.(message);
      }
    },
    [onRomLoaded, onError],
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
      // Reset so the same file can be selected again
      e.target.value = '';
    },
    [processFile],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile],
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const isProcessing = state === 'reading' || state === 'hashing' || state === 'storing';

  const statusLabel: Record<UploadState, string> = {
    idle: 'Drop a ROM file here or click to browse',
    reading: 'Reading file...',
    hashing: 'Computing hash...',
    storing: 'Saving to library...',
    done: 'ROM loaded successfully',
    error: errorMessage,
  };

  return (
    <Card
      className={`border-2 border-border transition-colors ${isDragging ? 'border-primary bg-primary/5' : ''}`}
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-bold uppercase tracking-tight">Load ROM</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Hidden file input */}
        <input
          ref={inputRef}
          type="file"
          accept=".gb,.gbc,.gba,.rom"
          className="hidden"
          onChange={handleFileChange}
          disabled={isProcessing}
        />

        {/* Drop zone */}
        <div
          role="button"
          tabIndex={0}
          aria-label="ROM file drop zone"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => !isProcessing && inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              if (!isProcessing) inputRef.current?.click();
            }
          }}
          className={[
            'flex min-h-[140px] cursor-pointer flex-col items-center justify-center gap-3',
            'border-2 border-dashed border-border p-6 text-center',
            'transition-colors hover:border-primary hover:bg-primary/5',
            isProcessing ? 'pointer-events-none opacity-60' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <div className="text-4xl">{state === 'done' ? '' : state === 'error' ? '' : ''}</div>
          <Label className="pointer-events-none cursor-pointer text-sm">
            {statusLabel[state]}
          </Label>
          {state === 'idle' && (
            <p className="text-xs text-muted-foreground">Supports .gb, .gbc, .gba — max 64 MB</p>
          )}
          {isProcessing && (
            <div className="h-1 w-32 overflow-hidden bg-muted">
              <div className="h-full animate-pulse bg-primary" />
            </div>
          )}
        </div>

        {/* Browse button */}
        <div className="mt-4 flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={isProcessing}
          >
            Browse Files
          </Button>
        </div>

        {/* Warning note */}
        <p className="mt-3 text-xs text-muted-foreground">
          ROMs are stored locally in your browser and never uploaded to any server.
        </p>
      </CardContent>
    </Card>
  );
}
