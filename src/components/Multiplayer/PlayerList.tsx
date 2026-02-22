'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import type { RoomMember } from '@/types/room';
import type { PlayerHealthStatus } from '@/hooks/useConnectionHealth';

interface PlayerListProps {
  members: RoomMember[];
  localUserId: string;
  maxPlayers: number;
  /** Optional: health status per userId for connection indicators. */
  getHealth?: (userId: string) => PlayerHealthStatus;
}

export function PlayerList({
  members,
  localUserId,
  maxPlayers,
  getHealth,
}: PlayerListProps): React.ReactElement {
  return (
    <Card className="w-full border border-border shadow-[3px_3px_0px_0px] shadow-foreground">
      <CardHeader className="border-b border-border pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="font-mono text-sm font-bold uppercase tracking-widest">
            Players
          </CardTitle>
          <span className="font-mono text-xs text-muted-foreground">
            {members.length}/{maxPlayers}
          </span>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <ScrollArea className="h-48">
          {members.length === 0 ? (
            <p className="py-6 text-center font-mono text-xs text-muted-foreground">
              No players yet.
            </p>
          ) : (
            <div>
              {members.map((member, idx) => (
                <div key={member.userId}>
                  <PlayerRow
                    member={member}
                    isLocal={member.userId === localUserId}
                    health={getHealth?.(member.userId)}
                  />
                  {idx < members.length - 1 && <Separator />}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

interface PlayerRowProps {
  member: RoomMember;
  isLocal: boolean;
  health?: PlayerHealthStatus;
}

function PlayerRow({ member, isLocal, health }: PlayerRowProps): React.ReactElement {
  const initials = member.username.slice(0, 2).toUpperCase();

  return (
    <div className="flex items-center gap-3 px-3 py-2">
      <div className="relative shrink-0">
        <Avatar className="h-6 w-6 border border-border">
          <AvatarFallback className="text-[9px] font-mono font-bold bg-primary text-primary-foreground">
            {initials}
          </AvatarFallback>
        </Avatar>
        {/* Connection indicator dot */}
        {health !== undefined && (
          <span
            className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-background ${healthDotClass(health)}`}
            title={healthLabel(health)}
          />
        )}
      </div>

      <span className="flex-1 font-mono text-xs truncate">
        {member.username}
      </span>

      <div className="flex items-center gap-1">
        {member.isHost && (
          <Badge
            variant="default"
            className="font-mono text-[10px] px-1 py-0 h-4"
          >
            Host
          </Badge>
        )}
        {isLocal && (
          <Badge
            variant="secondary"
            className="font-mono text-[10px] px-1 py-0 h-4"
          >
            You
          </Badge>
        )}
        {health === 'stale' && !isLocal && (
          <Badge
            variant="outline"
            className="font-mono text-[10px] px-1 py-0 h-4 text-muted-foreground"
          >
            away
          </Badge>
        )}
      </div>
    </div>
  );
}

function healthDotClass(health: PlayerHealthStatus): string {
  switch (health) {
    case 'active':
      return 'bg-green-500';
    case 'stale':
      return 'bg-yellow-400';
    case 'unknown':
    default:
      return 'bg-muted-foreground/40';
  }
}

function healthLabel(health: PlayerHealthStatus): string {
  switch (health) {
    case 'active':
      return 'Active';
    case 'stale':
      return 'No updates for 5s';
    case 'unknown':
    default:
      return 'Unknown';
  }
}
