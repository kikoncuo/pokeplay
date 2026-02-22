import type { FacingDirection, PlayerState } from '@/types/multiplayer';

export type { PlayerState, FacingDirection };

/**
 * Wire format for position broadcast — kept small (~20 bytes).
 * Fields are abbreviated to reduce payload size.
 */
export interface PlayerStateWire {
  u: string;       // userId
  n: string;       // username
  m: number;       // mapId
  x: number;       // x coord
  y: number;       // y coord
  f: number;       // facing (0=down,1=up,2=left,3=right)
  b: 0 | 1;        // isInBattle
  t: number;       // timestamp (ms)
}

const FACING_TO_NUM: Record<FacingDirection, number> = {
  down: 0,
  up: 1,
  left: 2,
  right: 3,
};

const NUM_TO_FACING: Record<number, FacingDirection> = {
  0: 'down',
  1: 'up',
  2: 'left',
  3: 'right',
};

export function serializePlayerState(state: PlayerState): PlayerStateWire {
  return {
    u: state.userId,
    n: state.username,
    m: state.mapId,
    x: state.x,
    y: state.y,
    f: FACING_TO_NUM[state.facing],
    b: state.isInBattle ? 1 : 0,
    t: state.timestamp,
  };
}

export function deserializePlayerState(wire: PlayerStateWire): PlayerState {
  return {
    userId: wire.u,
    username: wire.n,
    mapId: wire.m,
    x: wire.x,
    y: wire.y,
    facing: NUM_TO_FACING[wire.f] ?? 'down',
    isInBattle: wire.b === 1,
    timestamp: wire.t,
  };
}
