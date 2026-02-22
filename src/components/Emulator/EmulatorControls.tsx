'use client';

import { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { SpeedMultiplier } from '@/hooks/useEmulatorPrefs';

interface EmulatorControlsProps {
  isPaused: boolean;
  speed: SpeedMultiplier;
  volume: number;
  muted: boolean;
  isFullscreen: boolean;
  onPause: () => void;
  onResume: () => void;
  onSetSpeed: (s: SpeedMultiplier) => void;
  onSetVolume: (v: number) => void;
  onToggleMute: () => void;
  onToggleFullscreen: () => void;
  onSaveState: () => void;
  system: string;
}

const SPEED_OPTIONS: SpeedMultiplier[] = [1, 2, 4];

function tip(label: string, shortcut?: string): string {
  return shortcut ? `${label} (${shortcut})` : label;
}

export function EmulatorControls({
  isPaused,
  speed,
  volume,
  muted,
  isFullscreen,
  onPause,
  onResume,
  onSetSpeed,
  onSetVolume,
  onToggleMute,
  onToggleFullscreen,
  onSaveState,
  system,
}: EmulatorControlsProps): React.ReactElement {
  const handleVolumeChange = useCallback(
    (values: number[]) => {
      const v = (values[0] ?? 80) / 100;
      onSetVolume(v);
    },
    [onSetVolume],
  );

  const effectiveVolume = muted ? 0 : volume;

  return (
    <TooltipProvider>
      <div className="flex items-center gap-1 border-t border-border bg-background px-2 py-1.5">
        {/* Pause / Resume */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={isPaused ? onResume : onPause}
              aria-label={isPaused ? 'Resume' : 'Pause'}
            >
              {isPaused ? 'Resume' : 'Pause'}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{tip(isPaused ? 'Resume' : 'Pause', 'Space')}</TooltipContent>
        </Tooltip>

        <div className="mx-1 h-4 w-px bg-border" aria-hidden />

        {/* Speed buttons */}
        <div className="flex items-center gap-0.5" role="group" aria-label="Playback speed">
          {SPEED_OPTIONS.map((s) => (
            <Tooltip key={s}>
              <TooltipTrigger asChild>
                <Button
                  variant={speed === s ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 w-9 px-0 text-xs font-bold"
                  onClick={() => onSetSpeed(s)}
                  aria-pressed={speed === s}
                  aria-label={`${s}x speed`}
                >
                  {s}x
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {s === 1 ? tip('Normal speed', 'F') : `${s}x fast forward`}
              </TooltipContent>
            </Tooltip>
          ))}
        </div>

        <div className="mx-1 h-4 w-px bg-border" aria-hidden />

        {/* Mute button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-7 w-7 px-0 text-xs"
              onClick={onToggleMute}
              aria-label={muted ? 'Unmute' : 'Mute'}
              aria-pressed={muted}
            >
              {muted || effectiveVolume === 0 ? '' : effectiveVolume < 0.5 ? '' : ''}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{tip(muted ? 'Unmute' : 'Mute', 'M')}</TooltipContent>
        </Tooltip>

        {/* Volume slider */}
        <div className="w-20" aria-label="Volume">
          <Slider
            min={0}
            max={100}
            step={1}
            value={[Math.round(effectiveVolume * 100)]}
            onValueChange={handleVolumeChange}
            aria-label="Volume"
            className="cursor-pointer"
          />
        </div>

        <div className="mx-1 h-4 w-px bg-border" aria-hidden />

        {/* Save state */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={onSaveState}
              aria-label="Save state"
            >
              Save
            </Button>
          </TooltipTrigger>
          <TooltipContent>Save state</TooltipContent>
        </Tooltip>

        {/* Fullscreen */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-7 w-7 px-0 text-xs"
              onClick={onToggleFullscreen}
              aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
              aria-pressed={isFullscreen}
            >
              {isFullscreen ? '' : ''}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{tip(isFullscreen ? 'Exit fullscreen' : 'Fullscreen', isFullscreen ? 'Esc' : undefined)}</TooltipContent>
        </Tooltip>

        {/* System badge — pushed to end */}
        <span className="ml-auto text-xs text-muted-foreground uppercase tracking-wider">
          {system.toUpperCase()}
        </span>
      </div>
    </TooltipProvider>
  );
}
