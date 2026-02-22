'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { listRoms, type StoredRomMeta } from '@/lib/rom/idb-store';
import { createClient } from '@/lib/supabase/client';

interface RecentlyPlayedGame {
  gameHash: string;
  lastPlayedAt: string;
  title: string | null;
  system: string | null;
}

export default function DashboardPage(): React.ReactElement {
  const [roms, setRoms] = useState<StoredRomMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [recentGames, setRecentGames] = useState<RecentlyPlayedGame[]>([]);
  const [recentLoading, setRecentLoading] = useState(true);

  useEffect(() => {
    listRoms()
      .then(setRoms)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    async function loadRecentGames(): Promise<void> {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setRecentGames([]);
          return;
        }

        const { data, error } = await supabase
          .from('user_games')
          .select('game_hash, last_played_at, games!inner(title, system)')
          .eq('user_id', user.id)
          .not('last_played_at', 'is', null)
          .order('last_played_at', { ascending: false })
          .limit(5);

        if (error || !data) {
          setRecentGames([]);
          return;
        }

        setRecentGames(
          data.map((row) => {
            const game = row.games as { title: string | null; system: string | null } | null;
            return {
              gameHash: row.game_hash,
              lastPlayedAt: row.last_played_at as string,
              title: game?.title ?? null,
              system: game?.system ?? null,
            };
          }),
        );
      } catch {
        setRecentGames([]);
      } finally {
        setRecentLoading(false);
      }
    }

    loadRecentGames();
  }, []);

  const recentRoms = roms.sort((a, b) => b.addedAt - a.addedAt).slice(0, 4);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tighter">Dashboard</h1>
          <p className="text-muted-foreground">Your Pokémon ROM hack hub</p>
        </div>
        <Button asChild>
          <Link href="/hacks">Browse Library</Link>
        </Button>
      </div>

      <Separator className="mb-8" />

      {/* Stats row */}
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <StatCard label="ROMs in Library" value={loading ? '...' : String(roms.length)} />
        <StatCard label="Cloud Saves" value="—" />
        <StatCard label="Active Rooms" value="0" />
      </div>

      {/* Recent ROMs */}
      <section className="mb-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold uppercase tracking-tight">Recent ROMs</h2>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/hacks">View All</Link>
          </Button>
        </div>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="border-2 border-border">
                <CardContent className="p-4">
                  <div className="h-4 animate-pulse bg-muted" />
                  <div className="mt-2 h-3 w-2/3 animate-pulse bg-muted" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : recentRoms.length === 0 ? (
          <Card className="border-2 border-dashed border-border">
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <p className="font-bold">No ROMs loaded yet</p>
              <p className="text-sm text-muted-foreground">
                Go to the Library to load your first ROM file.
              </p>
              <Button asChild>
                <Link href="/hacks">Load a ROM</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {recentRoms.map((rom) => (
              <RomCard key={rom.sha1} rom={rom} />
            ))}
          </div>
        )}
      </section>

      {/* Recently Played */}
      <section className="mb-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold uppercase tracking-tight">Recently Played</h2>
        </div>

        {recentLoading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="border-2 border-border">
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="h-4 w-24 animate-pulse bg-muted" />
                  <div className="h-4 flex-1 animate-pulse bg-muted" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : recentGames.length === 0 ? (
          <Card className="border-2 border-dashed border-border">
            <CardContent className="py-8 text-center">
              <p className="text-sm text-muted-foreground">No games played yet. Load a ROM to get started.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-2">
            {recentGames.map((game) => (
              <RecentGameRow key={game.gameHash} game={game} />
            ))}
          </div>
        )}
      </section>

      {/* Quick actions */}
      <section>
        <h2 className="mb-4 text-xl font-bold uppercase tracking-tight">Quick Actions</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <ActionCard
            title="Load ROM"
            description="Add a new ROM file to your library"
            href="/hacks"
            label="Go to Library"
          />
          <ActionCard
            title="Multiplayer"
            description="Create or join a room to play with friends"
            href="/rooms"
            label="Browse Rooms"
          />
          <ActionCard
            title="Cloud Saves"
            description="Manage your save files across devices"
            href="/saves"
            label="View Saves"
          />
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <Card className="border-2 border-border shadow-sm">
      <CardHeader className="pb-1">
        <CardTitle className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-black tracking-tighter">{value}</p>
      </CardContent>
    </Card>
  );
}

function RomCard({ rom }: { rom: StoredRomMeta }): React.ReactElement {
  const system = rom.metadata?.system ?? '?';
  const title = rom.customName ?? rom.metadata?.title ?? rom.filename;
  const isHack = rom.metadata?.isHack ?? false;

  return (
    <Card className="border-2 border-border shadow-sm transition-shadow hover:shadow-md">
      <CardContent className="p-4">
        <div className="mb-2 flex items-center gap-2">
          <Badge variant="outline" className="font-mono text-xs">
            {system}
          </Badge>
          {isHack && (
            <Badge className="bg-accent text-accent-foreground text-xs">Hack</Badge>
          )}
        </div>
        <p className="truncate font-bold leading-tight">{title}</p>
        <p className="mt-1 truncate text-xs text-muted-foreground">{rom.filename}</p>
        <div className="mt-3">
          <Button size="sm" className="w-full" asChild>
            <Link href={`/play/${rom.sha1}`}>Play</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ActionCard({
  title,
  description,
  href,
  label,
}: {
  title: string;
  description: string;
  href: string;
  label: string;
}): React.ReactElement {
  return (
    <Card className="border-2 border-border shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-bold uppercase tracking-tight">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-sm text-muted-foreground">{description}</p>
        <Button variant="outline" size="sm" asChild>
          <Link href={href}>{label}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function RecentGameRow({ game }: { game: RecentlyPlayedGame }): React.ReactElement {
  const title = game.title ?? game.gameHash.slice(0, 12) + '…';
  const system = game.system ?? '?';
  const playedAt = new Date(game.lastPlayedAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <Card className="border-2 border-border shadow-sm transition-shadow hover:shadow-md">
      <CardContent className="flex items-center gap-4 p-4">
        <Badge variant="outline" className="shrink-0 font-mono text-xs">
          {system.toUpperCase()}
        </Badge>
        <p className="flex-1 truncate font-bold">{title}</p>
        <p className="shrink-0 text-xs text-muted-foreground">{playedAt}</p>
        <Button size="sm" asChild>
          <Link href={`/play/${game.gameHash}`}>Resume</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
