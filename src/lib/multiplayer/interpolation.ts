import type { PlayerState } from '@/types/multiplayer';

export interface InterpolatedPosition {
  x: number;
  y: number;
}

interface PositionSnapshot {
  state: PlayerState;
  receivedAt: number;
}

/**
 * Smooths remote player movement between sparse 10Hz network updates.
 * Maintains a two-snapshot buffer and linearly interpolates between them.
 * Render delay is intentionally 100ms behind real time so there's always
 * a "from" and "to" snapshot available for interpolation.
 */
export class PlayerInterpolator {
  private snapshots: PositionSnapshot[] = [];
  private readonly renderDelayMs: number;

  constructor(renderDelayMs = 100) {
    this.renderDelayMs = renderDelayMs;
  }

  addSnapshot(state: PlayerState): void {
    this.snapshots.push({ state, receivedAt: Date.now() });
    // Keep only the last 3 snapshots to avoid memory growth
    if (this.snapshots.length > 3) {
      this.snapshots.shift();
    }
  }

  /**
   * Returns the interpolated position for rendering right now.
   * Falls back to the most recent known position when interpolation
   * snapshots are not yet available.
   */
  getInterpolatedPosition(now = Date.now()): InterpolatedPosition | null {
    if (this.snapshots.length === 0) return null;

    const renderTime = now - this.renderDelayMs;

    // Find the two surrounding snapshots
    let from: PositionSnapshot | null = null;
    let to: PositionSnapshot | null = null;

    for (let i = 0; i < this.snapshots.length - 1; i++) {
      if (
        this.snapshots[i].receivedAt <= renderTime &&
        this.snapshots[i + 1].receivedAt >= renderTime
      ) {
        from = this.snapshots[i];
        to = this.snapshots[i + 1];
        break;
      }
    }

    // Haven't caught up yet — show latest known position
    if (!from || !to) {
      const latest = this.snapshots[this.snapshots.length - 1];
      return { x: latest.state.x, y: latest.state.y };
    }

    const duration = to.receivedAt - from.receivedAt;
    const elapsed = renderTime - from.receivedAt;
    const t = duration > 0 ? Math.min(elapsed / duration, 1) : 1;

    return {
      x: lerp(from.state.x, to.state.x, t),
      y: lerp(from.state.y, to.state.y, t),
    };
  }

  /** Returns the most recently received state (for non-position fields). */
  getLatestState(): PlayerState | null {
    if (this.snapshots.length === 0) return null;
    return this.snapshots[this.snapshots.length - 1].state;
  }

  clear(): void {
    this.snapshots = [];
  }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Registry of per-player interpolators for a room session. */
export class InterpolationRegistry {
  private players = new Map<string, PlayerInterpolator>();
  private readonly renderDelayMs: number;

  constructor(renderDelayMs = 100) {
    this.renderDelayMs = renderDelayMs;
  }

  update(state: PlayerState): void {
    if (!this.players.has(state.userId)) {
      this.players.set(state.userId, new PlayerInterpolator(this.renderDelayMs));
    }
    this.players.get(state.userId)!.addSnapshot(state);
  }

  remove(userId: string): void {
    this.players.get(userId)?.clear();
    this.players.delete(userId);
  }

  getInterpolated(userId: string, now = Date.now()): InterpolatedPosition | null {
    return this.players.get(userId)?.getInterpolatedPosition(now) ?? null;
  }

  getLatestState(userId: string): PlayerState | null {
    return this.players.get(userId)?.getLatestState() ?? null;
  }

  getAllUserIds(): string[] {
    return Array.from(this.players.keys());
  }

  clear(): void {
    for (const interp of this.players.values()) interp.clear();
    this.players.clear();
  }
}
