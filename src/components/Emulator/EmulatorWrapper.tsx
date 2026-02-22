'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { EmulatorManager, type EmulatorConfig } from '@/lib/emulator/emulator-manager';
import { detectSystem, type SupportedSystem } from '@/lib/emulator/core-config';
import { useEmulatorPrefs, type SpeedMultiplier } from '@/hooks/useEmulatorPrefs';
import { EmulatorControls } from './EmulatorControls';

/**
 * Native pixel dimensions per system — drives the CSS aspect-ratio.
 *   GBA:    240×160  (3:2)
 *   GB/GBC: 160×144  (10:9)
 */
const SYSTEM_DIMENSIONS: Record<SupportedSystem, { w: number; h: number }> = {
  gba: { w: 240, h: 160 },
  gbc: { w: 160, h: 144 },
  gb:  { w: 160, h: 144 },
};

interface EmulatorWrapperProps {
  /** Blob URL or path to the ROM file */
  romUrl: string;
  /** Original ROM filename (used to detect system) */
  romName: string;
  /** Called when the emulator has loaded and is ready, passes the manager instance */
  onReady?: (manager: EmulatorManager) => void;
  /** Called when the game actually starts running */
  onStart?: () => void;
  /** Called when the user clicks Save (parent should open slot picker) */
  onSaveState?: () => void;
  /** Called when a state is loaded */
  onLoadState?: () => void;
  className?: string;
}

type EmulatorStatus = 'idle' | 'loading' | 'ready' | 'error';

// Speed toggling: F key cycles 1x → 2x → 4x → 1x
const SPEED_CYCLE: SpeedMultiplier[] = [1, 2, 4];

export function EmulatorWrapper({
  romUrl,
  romName,
  onReady,
  onStart,
  onSaveState,
  onLoadState,
  className,
}: EmulatorWrapperProps): React.ReactElement {
  const uniqueId = useId();
  const containerId = `ejs-container-${uniqueId.replace(/:/g, '')}`;

  const managerRef = useRef<EmulatorManager | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const ejsHostRef = useRef<HTMLDivElement | null>(null);

  const [emulatorStatus, setEmulatorStatus] = useState<EmulatorStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isPaused, setIsPaused] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const mountedRef = useRef(true);
  const system = detectSystem(romName);
  const { w, h } = SYSTEM_DIMENSIONS[system];

  const { prefs, setVolume, toggleMuted, setSpeed } = useEmulatorPrefs();

  // ---------------------------------------------------------------------------
  // Sync volume/mute prefs → manager whenever they change
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (emulatorStatus !== 'ready') return;
    managerRef.current?.setVolume(prefs.muted ? 0 : prefs.volume);
  }, [prefs.volume, prefs.muted, emulatorStatus]);

  // ---------------------------------------------------------------------------
  // Sync speed prefs → manager whenever they change
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (emulatorStatus !== 'ready') return;
    managerRef.current?.setSpeed(prefs.speed);
  }, [prefs.speed, emulatorStatus]);

  // ---------------------------------------------------------------------------
  // Emulator lifecycle
  // ---------------------------------------------------------------------------
  const handleReady = useCallback(() => {
    if (!mountedRef.current) return;
    setEmulatorStatus('ready');
    // Defer volume — EmulatorJS audio context needs a tick to initialize
    setTimeout(() => {
      managerRef.current?.setVolume(prefs.muted ? 0 : prefs.volume);
    }, 200);
    if (managerRef.current) onReady?.(managerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onReady]);

  const handleStart = useCallback(() => {
    if (!mountedRef.current) return;
    onStart?.();
  }, [onStart]);

  useEffect(() => {
    mountedRef.current = true;
    setEmulatorStatus('loading');
    setErrorMessage('');
    setIsPaused(false);

    const config: EmulatorConfig = {
      containerId,
      romUrl,
      romName,
      system,
      onReady: handleReady,
      onStart: handleStart,
      onLoadState,
    };

    const manager = new EmulatorManager(config);
    managerRef.current = manager;

    manager.initialize().catch((err: unknown) => {
      if (!mountedRef.current) return;
      const message = err instanceof Error ? err.message : 'Failed to initialize emulator';
      setErrorMessage(message);
      setEmulatorStatus('error');
    });

    return () => {
      mountedRef.current = false;
      managerRef.current?.destroy();
      managerRef.current = null;
      // Remove EmulatorJS's DOM before React reconciles the container
      if (ejsHostRef.current) {
        ejsHostRef.current.remove();
        ejsHostRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [romUrl, romName]);

  // ---------------------------------------------------------------------------
  // Control handlers
  // ---------------------------------------------------------------------------
  const handlePause = useCallback(() => {
    managerRef.current?.pause();
    setIsPaused(true);
  }, []);

  const handleResume = useCallback(() => {
    managerRef.current?.resume();
    setIsPaused(false);
  }, []);

  const handleSetSpeed = useCallback((s: SpeedMultiplier) => {
    setSpeed(s);
    // useEffect above will push to manager
  }, [setSpeed]);

  const handleSetVolume = useCallback((v: number) => {
    setVolume(v);
    // useEffect above will push to manager
  }, [setVolume]);

  const handleToggleMute = useCallback(() => {
    toggleMuted();
    // useEffect above will push to manager
  }, [toggleMuted]);

  const handleSaveState = useCallback(() => {
    onSaveState?.();
  }, [onSaveState]);

  // ---------------------------------------------------------------------------
  // Fullscreen (Fullscreen API)
  // ---------------------------------------------------------------------------
  const handleToggleFullscreen = useCallback(async () => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      await el.requestFullscreen().catch(() => { /* permission denied */ });
    } else {
      await document.exitFullscreen().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // ---------------------------------------------------------------------------
  // Keyboard shortcuts (active while emulator is ready)
  //   Space — pause / resume
  //   F     — cycle speed: 1x → 2x → 4x → 1x
  //   M     — mute / unmute
  //   Esc   — browser exits fullscreen natively; we just track state via event
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (emulatorStatus !== 'ready') return;

    const onKeyDown = (e: KeyboardEvent) => {
      // Skip when a form element has focus
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          if (isPaused) handleResume();
          else handlePause();
          break;
        case 'KeyF': {
          e.preventDefault();
          const idx = SPEED_CYCLE.indexOf(prefs.speed);
          const next = SPEED_CYCLE[(idx + 1) % SPEED_CYCLE.length] ?? 1;
          handleSetSpeed(next);
          break;
        }
        case 'KeyM':
          e.preventDefault();
          handleToggleMute();
          break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    emulatorStatus,
    isPaused,
    prefs.speed,
    handlePause,
    handleResume,
    handleSetSpeed,
    handleToggleMute,
  ]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className={`flex flex-col ${className ?? ''}`}>
      <Card className="border-2 border-border shadow-[3px_3px_0px_0px_oklch(0_0_0)] flex-1 min-h-0 flex flex-col">
        <CardContent className="p-0 flex-1 min-h-0 flex flex-col">
          {/* containerRef enters fullscreen — wraps canvas + controls so the
              toolbar stays visible during fullscreen play */}
          <div ref={containerRef} className="flex flex-col flex-1 min-h-0 bg-black">
            {/* Emulator canvas host. We use a ref-callback wrapper so React
                never tries to reconcile EmulatorJS's internal DOM nodes.
                EmulatorJS injects its canvas inside the inner div.
                Height-driven: fills available height, width follows aspect-ratio. */}
            <div
              className="relative bg-black flex-1 min-h-0 mx-auto"
              style={{ aspectRatio: `${w} / ${h}`, maxWidth: '100%', height: '100%' }}
              aria-label={`Game emulator: ${romName}`}
              ref={(node) => {
                if (node && !ejsHostRef.current) {
                  const inner = document.createElement('div');
                  inner.id = containerId;
                  inner.style.width = '100%';
                  inner.style.height = '100%';
                  node.appendChild(inner);
                  ejsHostRef.current = inner;
                }
              }}
            >
              {emulatorStatus === 'loading' && (
                <div className="absolute inset-0 flex items-center justify-center z-10">
                  <div className="text-center text-white">
                    <div className="mb-2 text-sm uppercase tracking-widest">
                      Loading emulator...
                    </div>
                    <div className="h-1 w-48 overflow-hidden bg-white/20">
                      <div className="h-full animate-pulse bg-primary" />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Controls toolbar — shown once ready, stays visible in fullscreen */}
            {emulatorStatus === 'ready' && (
              <div className="shrink-0">
                <EmulatorControls
                  isPaused={isPaused}
                  speed={prefs.speed}
                  volume={prefs.volume}
                  muted={prefs.muted}
                  isFullscreen={isFullscreen}
                  onPause={handlePause}
                  onResume={handleResume}
                  onSetSpeed={handleSetSpeed}
                  onSetVolume={handleSetVolume}
                  onToggleMute={handleToggleMute}
                  onToggleFullscreen={handleToggleFullscreen}
                  onSaveState={handleSaveState}
                  system={system}
                />
              </div>
            )}
          </div>

          {emulatorStatus === 'error' && (
            <Alert variant="destructive" className="m-3 shrink-0">
              <AlertDescription>
                {errorMessage || 'Failed to start emulator. Please try reloading.'}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
