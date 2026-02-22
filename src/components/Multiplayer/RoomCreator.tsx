'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { CreateRoomInput, RoomVisibility } from '@/types/room';

const MAX_PLAYERS_OPTIONS = [2, 4, 6, 8] as const;

interface RoomCreatorProps {
  open: boolean;
  isSubmitting?: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: CreateRoomInput) => void;
}

export function RoomCreator({
  open,
  isSubmitting = false,
  onOpenChange,
  onSubmit,
}: RoomCreatorProps): React.ReactElement {
  const [name, setName] = useState('');
  const [visibility, setVisibility] = useState<RoomVisibility>('public');
  const [maxPlayers, setMaxPlayers] = useState<number>(4);
  const [nameError, setNameError] = useState('');

  function handleSubmit(e: React.FormEvent): void {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError('Room name is required.');
      return;
    }
    if (trimmed.length > 32) {
      setNameError('Room name must be 32 characters or fewer.');
      return;
    }
    setNameError('');
    onSubmit({ name: trimmed, visibility, maxPlayers });
  }

  function handleOpenChange(value: boolean): void {
    if (!isSubmitting) {
      setName('');
      setNameError('');
      setVisibility('public');
      setMaxPlayers(4);
      onOpenChange(value);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="border border-border shadow-[3px_3px_0px_0px] shadow-foreground font-mono max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold uppercase tracking-widest">
            Create Room
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1">
            <Label htmlFor="room-name" className="text-xs uppercase tracking-wider">
              Room Name
            </Label>
            <Input
              id="room-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (nameError) setNameError('');
              }}
              placeholder="My awesome room"
              maxLength={32}
              className="border border-border text-xs"
              disabled={isSubmitting}
              autoFocus
            />
            {nameError && (
              <p className="text-xs text-destructive">{nameError}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="room-visibility" className="text-xs uppercase tracking-wider">
              Visibility
            </Label>
            <Select
              value={visibility}
              onValueChange={(v) => setVisibility(v as RoomVisibility)}
              disabled={isSubmitting}
            >
              <SelectTrigger
                id="room-visibility"
                className="border border-border text-xs"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="public" className="text-xs">Public</SelectItem>
                <SelectItem value="private" className="text-xs">Private</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="room-max-players" className="text-xs uppercase tracking-wider">
              Max Players
            </Label>
            <Select
              value={String(maxPlayers)}
              onValueChange={(v) => setMaxPlayers(Number(v))}
              disabled={isSubmitting}
            >
              <SelectTrigger
                id="room-max-players"
                className="border border-border text-xs"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MAX_PLAYERS_OPTIONS.map((n) => (
                  <SelectItem key={n} value={String(n)} className="text-xs">
                    {n} players
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="pt-2 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
              className="border border-border text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="text-xs"
            >
              {isSubmitting ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
