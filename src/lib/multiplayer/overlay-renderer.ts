import type { PlayerState } from '@/types/multiplayer';
import type { InterpolatedPosition } from './interpolation';

/** Pixel dimensions of one Game Boy tile (8px) scaled to display size. */
const TILE_SIZE_PX = 16;

/** Colours for remote player sprites. */
const PLAYER_FILL = 'oklch(0.5799 0.2380 29.2339)';
const PLAYER_STROKE = 'oklch(0 0 0)';
const LABEL_BG = 'oklch(0 0 0 / 0.65)';
const LABEL_TEXT = 'oklch(1 0 0)';

export interface RenderablePlayer {
  state: PlayerState;
  position: InterpolatedPosition;
}

export interface OverlayRenderOptions {
  /** Map tile width (columns). */
  mapWidth: number;
  /** Map tile height (rows). */
  mapHeight: number;
  /** Current local player map ID — only render players on same map. */
  localMapId: number;
  /** Camera offset in pixels (how far the viewport has scrolled). */
  cameraOffsetX: number;
  cameraOffsetY: number;
  /** Scale factor from emulator logical px to CSS px. */
  scale: number;
}

/**
 * Draws all remote players onto the overlay canvas.
 * The overlay canvas MUST be absolutely positioned on top of the emulator canvas,
 * with pointer-events: none so it never captures input.
 */
export function renderOverlay(
  ctx: CanvasRenderingContext2D,
  players: RenderablePlayer[],
  opts: OverlayRenderOptions
): void {
  const { localMapId, cameraOffsetX, cameraOffsetY, scale } = opts;

  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  const tilePx = TILE_SIZE_PX * scale;

  for (const { state, position } of players) {
    if (state.mapId !== localMapId) continue;

    const screenX = position.x * tilePx - cameraOffsetX;
    const screenY = position.y * tilePx - cameraOffsetY;

    drawPlayerSprite(ctx, screenX, screenY, tilePx);
    drawPlayerLabel(ctx, screenX, screenY, state.username, tilePx);
  }
}

function drawPlayerSprite(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  tilePx: number
): void {
  const half = tilePx / 2;

  ctx.save();
  ctx.fillStyle = PLAYER_FILL;
  ctx.strokeStyle = PLAYER_STROKE;
  ctx.lineWidth = 1.5;

  // Body
  ctx.beginPath();
  ctx.rect(x - half * 0.4, y - half * 0.1, tilePx * 0.8, tilePx * 0.7);
  ctx.fill();
  ctx.stroke();

  // Head
  ctx.beginPath();
  ctx.arc(x, y - half * 0.2, half * 0.45, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}

function drawPlayerLabel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  username: string,
  tilePx: number
): void {
  const fontSize = Math.max(9, Math.round(tilePx * 0.55));
  ctx.save();
  ctx.font = `bold ${fontSize}px "SF Mono", monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';

  const metrics = ctx.measureText(username);
  const padding = 3;
  const labelW = metrics.width + padding * 2;
  const labelH = fontSize + padding;
  const labelX = x - labelW / 2;
  const labelY = y - tilePx * 0.8 - labelH;

  ctx.fillStyle = LABEL_BG;
  ctx.fillRect(labelX, labelY, labelW, labelH);

  ctx.fillStyle = LABEL_TEXT;
  ctx.fillText(username, x, y - tilePx * 0.8);

  ctx.restore();
}

/**
 * Resizes the overlay canvas to match the emulator canvas dimensions.
 * Call this on window resize or emulator canvas resize events.
 */
export function syncOverlaySize(
  overlayCanvas: HTMLCanvasElement,
  emulatorCanvas: HTMLCanvasElement
): void {
  overlayCanvas.width = emulatorCanvas.width;
  overlayCanvas.height = emulatorCanvas.height;
  overlayCanvas.style.width = emulatorCanvas.style.width;
  overlayCanvas.style.height = emulatorCanvas.style.height;
}
