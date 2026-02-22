'use client';

import { useEffect, useRef } from 'react';
import { GameboyMemoryReader, readGen1GameState } from '@/lib/emulator/memory-reader';
import { MemoryPoller } from '@/lib/emulator/memory-poller';
import { InterpolationRegistry } from '@/lib/multiplayer/interpolation';
import { renderOverlay } from '@/lib/multiplayer/overlay-renderer';
import { useMultiplayerStore } from '@/stores/multiplayer-store';
import type { FacingDirection } from '@/types/multiplayer';

// Gen 1 facing byte → direction string
const FACING_MAP: Record<number, FacingDirection> = {
  0: 'down',
  4: 'up',
  8: 'left',
  12: 'right',
};

function decodeFacing(raw: number): FacingDirection {
  return FACING_MAP[raw] ?? 'down';
}

export interface EmulatorOverlayProps {
  /** Ref to the container div that EmulatorJS mounts its canvas inside. */
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** The local user's ID — used to broadcast position, not render a remote sprite. */
  localUserId: string;
  /** The local user's display name. */
  localUsername: string;
  /** Called each poll tick with updated local player state for broadcasting. */
  onLocalState?: (state: import('@/types/multiplayer').PlayerState) => void;
}

/**
 * EmulatorOverlay mounts a transparent canvas on top of the emulator canvas,
 * polls memory for the local player's position, and draws remote players
 * using renderOverlay() from overlay-renderer.ts.
 *
 * Architecture rules (CLAUDE.md):
 * - Overlay is ALWAYS a separate canvas element, never modifying emulator internals.
 * - Memory polling is 10 Hz maximum.
 * - Only players on the same mapId as local player are rendered.
 */
export function EmulatorOverlay({
  containerRef,
  localUserId,
  localUsername,
  onLocalState,
}: EmulatorOverlayProps): React.ReactElement {
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const pollerRef = useRef<MemoryPoller | null>(null);
  const interpolationRef = useRef<InterpolationRegistry>(new InterpolationRegistry());
  const localMapIdRef = useRef<number>(0);

  const remotePlayers = useMultiplayerStore((s) => s.remotePlayers);
  const remotePlayersRef = useRef(remotePlayers);
  remotePlayersRef.current = remotePlayers;

  // -------------------------------------------------------------------------
  // Sync overlay canvas size to the emulator canvas
  // -------------------------------------------------------------------------
  useEffect(() => {
    const container = containerRef.current;
    const overlay = overlayRef.current;
    if (!container || !overlay) return;

    function syncSize(emulatorCanvas: HTMLCanvasElement): void {
      if (!overlay) return;
      const rect = emulatorCanvas.getBoundingClientRect();
      overlay.width = emulatorCanvas.width;
      overlay.height = emulatorCanvas.height;
      overlay.style.width = `${rect.width}px`;
      overlay.style.height = `${rect.height}px`;
    }

    // EmulatorJS creates its canvas asynchronously inside the container div.
    // Watch for it with a MutationObserver.
    let resizeObserver: ResizeObserver | null = null;

    function attachToCanvas(canvas: HTMLCanvasElement): void {
      syncSize(canvas);
      resizeObserver = new ResizeObserver(() => syncSize(canvas));
      resizeObserver.observe(canvas);
    }

    // Check if canvas already exists
    const existing = container.querySelector('canvas');
    if (existing) {
      attachToCanvas(existing);
    }

    const mutationObserver = new MutationObserver(() => {
      const canvas = container.querySelector('canvas');
      if (canvas && !resizeObserver) {
        attachToCanvas(canvas);
        mutationObserver.disconnect();
      }
    });

    mutationObserver.observe(container, { childList: true, subtree: true });

    return () => {
      mutationObserver.disconnect();
      resizeObserver?.disconnect();
    };
  }, [containerRef]);

  // -------------------------------------------------------------------------
  // Memory polling: read local player state at 10 Hz
  // -------------------------------------------------------------------------
  useEffect(() => {
    // Wait until window.__memoryReader is available (set by EmulatorManager)
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    function tryStartPoller(): void {
      const rawReader = window.__memoryReader;
      if (!rawReader) {
        if (!cancelled) {
          retryTimer = setTimeout(tryStartPoller, 200);
        }
        return;
      }

      const gbReader = new GameboyMemoryReader(rawReader);
      const poller = new MemoryPoller(() => readGen1GameState(gbReader));
      pollerRef.current = poller;

      poller.subscribe((gameState) => {
        const { position, battleState } = gameState;
        localMapIdRef.current = position.mapId;

        const playerState: import('@/types/multiplayer').PlayerState = {
          userId: localUserId,
          username: localUsername,
          mapId: position.mapId,
          x: position.x,
          y: position.y,
          facing: decodeFacing(position.facing),
          isInBattle: battleState !== 'none',
          timestamp: Date.now(),
        };

        onLocalState?.(playerState);
      });
    }

    tryStartPoller();

    return () => {
      cancelled = true;
      if (retryTimer !== null) clearTimeout(retryTimer);
      pollerRef.current?.destroy();
      pollerRef.current = null;
    };
  }, [localUserId, localUsername, onLocalState]);

  // -------------------------------------------------------------------------
  // Update interpolation registry when remote players change
  // -------------------------------------------------------------------------
  useEffect(() => {
    for (const state of Object.values(remotePlayers)) {
      interpolationRef.current.update(state);
    }

    // Remove players no longer in room
    const activeIds = new Set(Object.keys(remotePlayers));
    for (const uid of interpolationRef.current.getAllUserIds()) {
      if (!activeIds.has(uid)) {
        interpolationRef.current.remove(uid);
      }
    }
  }, [remotePlayers]);

  // -------------------------------------------------------------------------
  // rAF render loop
  // -------------------------------------------------------------------------
  useEffect(() => {
    function frame(): void {
      const canvas = overlayRef.current;
      if (!canvas) {
        rafRef.current = requestAnimationFrame(frame);
        return;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        rafRef.current = requestAnimationFrame(frame);
        return;
      }

      const now = Date.now();
      const allIds = interpolationRef.current.getAllUserIds();

      const renderables = allIds
        .map((uid) => {
          const pos = interpolationRef.current.getInterpolated(uid, now);
          const state = interpolationRef.current.getLatestState(uid);
          if (!pos || !state) return null;
          return { state, position: pos };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null);

      renderOverlay(ctx, renderables, {
        mapWidth: 20,
        mapHeight: 18,
        localMapId: localMapIdRef.current,
        cameraOffsetX: 0,
        cameraOffsetY: 0,
        scale: canvas.width > 0 ? canvas.width / 160 : 1,
      });

      rafRef.current = requestAnimationFrame(frame);
    }

    rafRef.current = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // -------------------------------------------------------------------------
  // Cleanup interpolation on unmount
  // -------------------------------------------------------------------------
  useEffect(() => {
    return () => {
      interpolationRef.current.clear();
    };
  }, []);

  return (
    <canvas
      ref={overlayRef}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 10 }}
      aria-hidden="true"
    />
  );
}
