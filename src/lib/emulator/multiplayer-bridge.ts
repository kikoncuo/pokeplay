/**
 * Multiplayer bridge — connects the memory poller to the multiplayer
 * position-broadcasting system via a window hook.
 *
 * Architecture:
 *   EmulatorManager (memory) → MultiplayerBridge → window.__mpUpdatePosition
 *   ↑ sets this up                                  ↑ room page registers this
 *
 * The room page (rooms/[id]) registers `window.__mpUpdatePosition` when a
 * multiplayer room is active. The bridge calls it on every state diff so the
 * multiplayer layer can push updates via Supabase Realtime without the
 * emulator module importing any multiplayer code.
 *
 * Architecture rules (CLAUDE.md):
 * - Memory polling is 10 Hz maximum.
 * - Multiplayer overlay is a separate canvas element.
 */

import type { GameState } from './memory-reader';
import type { FacingDirection } from '@/types/multiplayer';

// ---------------------------------------------------------------------------
// PlayerState subset the bridge exposes — compatible with types/multiplayer.ts
// ---------------------------------------------------------------------------

export interface BroadcastPlayerState {
  mapId: number;
  x: number;
  y: number;
  facing: FacingDirection;
  isInBattle: boolean;
}

export type MpUpdatePositionFn = (state: BroadcastPlayerState) => void;

// ---------------------------------------------------------------------------
// Gen 1 facing byte → FacingDirection
// GB/GBC: the wSpritePlayerStateData1FacingDirection byte uses 0/4/8/12
// ---------------------------------------------------------------------------
const GEN1_FACING: Record<number, FacingDirection> = {
  0:  'down',
  4:  'up',
  8:  'left',
  12: 'right',
};

// ---------------------------------------------------------------------------
// Gen 3 facing byte → FacingDirection
// GBA Pokémon Emerald FacingDirection: 1=down, 2=up, 4=left, 8=right
// ---------------------------------------------------------------------------
const GEN3_FACING: Record<number, FacingDirection> = {
  1: 'down',
  2: 'up',
  4: 'left',
  8: 'right',
};

export type Generation = 1 | 3;

function decodeFacing(raw: number, gen: Generation): FacingDirection {
  const map = gen === 3 ? GEN3_FACING : GEN1_FACING;
  return map[raw] ?? 'down';
}

// ---------------------------------------------------------------------------
// Global window hook — accessed via property lookup to avoid declaration
// conflicts with the room page's local cast pattern.
// ---------------------------------------------------------------------------

// We intentionally do NOT add __mpUpdatePosition to the global Window interface
// here. The room page registers it with a local intersection cast:
//   (window as Window & { __mpUpdatePosition?: MpUpdatePositionFn }).__mpUpdatePosition = fn
// If we declared it globally, TypeScript would unify both declarations and
// create an incompatible intersection type. Instead we access it by casting
// to `unknown` at the call site in dispatchToWindow() below.

// ---------------------------------------------------------------------------
// MultiplayerBridge
// ---------------------------------------------------------------------------

/**
 * MultiplayerBridge sits between the MemoryPoller and the multiplayer system.
 *
 * It converts a raw `GameState` (emulator coordinates) to a
 * `BroadcastPlayerState` (multiplayer coordinates) and calls
 * `window.__mpUpdatePosition` on every state diff.
 *
 * Usage — created and managed by EmulatorManager:
 * ```ts
 * const bridge = new MultiplayerBridge({ gen: 1 });
 * bridge.start();
 * // ...
 * bridge.stop();
 * ```
 *
 * Room page registers the hook:
 * ```ts
 * window.__mpUpdatePosition = (state) => broadcaster.updateState({ ...state, userId, username, timestamp: Date.now() });
 * ```
 */
export class MultiplayerBridge {
  private readonly gen: Generation;
  private readonly onState: (state: BroadcastPlayerState) => void;

  constructor(options: { gen: Generation; onState?: (state: BroadcastPlayerState) => void }) {
    this.gen = options.gen;
    // Allow callers to supply their own handler (useful for testing / non-window environments)
    this.onState = options.onState ?? this.dispatchToWindow.bind(this);
  }

  /**
   * Process a raw GameState from the memory poller. Converts it to
   * BroadcastPlayerState and dispatches to the registered handler.
   * Called by MemoryPoller's `onStateDiff` — i.e. only when state changes.
   */
  handleStateDiff(gameState: GameState): void {
    const { position, battleState } = gameState;
    const state: BroadcastPlayerState = {
      mapId: position.mapId,
      x: position.x,
      y: position.y,
      facing: decodeFacing(position.facing, this.gen),
      isInBattle: battleState !== 'none',
    };
    this.onState(state);
  }

  private dispatchToWindow(state: BroadcastPlayerState): void {
    const fn = (window as unknown as Record<string, unknown>)['__mpUpdatePosition'];
    if (typeof fn === 'function') fn(state);
  }
}

// ---------------------------------------------------------------------------
// Helper: register the window hook from the room page
// ---------------------------------------------------------------------------

/**
 * Register `window.__mpUpdatePosition` from a multiplayer room page.
 * Returns a cleanup function that removes the registration.
 *
 * ```ts
 * // In the room page (rooms/[id]/page.tsx):
 * useEffect(() => {
 *   return registerMpUpdatePosition((state) => {
 *     broadcaster.updateState({ ...state, userId, username, timestamp: Date.now() });
 *   });
 * }, [broadcaster, userId, username]);
 * ```
 */
export function registerMpUpdatePosition(fn: MpUpdatePositionFn): () => void {
  const win = window as unknown as Record<string, unknown>;
  win['__mpUpdatePosition'] = fn;
  return () => {
    if (win['__mpUpdatePosition'] === fn) {
      delete win['__mpUpdatePosition'];
    }
  };
}
