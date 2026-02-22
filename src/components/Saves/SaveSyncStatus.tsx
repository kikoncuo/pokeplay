'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { listAllLocalSaves, flushPendingSync, type LocalSave } from '@/lib/utils/offline-sync';

type SyncState = 'checking' | 'all-synced' | 'pending' | 'syncing' | 'offline';

interface SyncStats {
  total: number;
  synced: number;
  pending: number;
}

export function SaveSyncStatus(): React.ReactElement {
  const [syncState, setSyncState] = useState<SyncState>('checking');
  const [stats, setStats] = useState<SyncStats>({ total: 0, synced: 0, pending: 0 });
  const [lastChecked, setLastChecked] = useState<number | null>(null);

  const checkStatus = useCallback(async () => {
    const saves: LocalSave[] = await listAllLocalSaves();
    const synced = saves.filter((s) => s.synced).length;
    const pending = saves.length - synced;

    setStats({ total: saves.length, synced, pending });
    setLastChecked(Date.now());

    if (!navigator.onLine) {
      setSyncState('offline');
    } else if (pending > 0) {
      setSyncState('pending');
    } else {
      setSyncState('all-synced');
    }
  }, []);

  useEffect(() => {
    checkStatus();

    const onOnline = () => checkStatus();
    const onOffline = () => setSyncState('offline');
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [checkStatus]);

  const handleSyncNow = async () => {
    setSyncState('syncing');
    try {
      await flushPendingSync();
      await checkStatus();
    } catch {
      await checkStatus();
    }
  };

  const statusConfig: Record<
    SyncState,
    { label: string; badgeClass: string; description: string }
  > = {
    checking: {
      label: 'Checking...',
      badgeClass: 'bg-muted text-muted-foreground',
      description: 'Checking sync status',
    },
    'all-synced': {
      label: 'All Synced',
      badgeClass: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      description: 'All saves are backed up to the cloud',
    },
    pending: {
      label: `${stats.pending} Pending`,
      badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
      description: `${stats.pending} save${stats.pending !== 1 ? 's' : ''} waiting to sync`,
    },
    syncing: {
      label: 'Syncing...',
      badgeClass: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      description: 'Uploading saves to the cloud',
    },
    offline: {
      label: 'Offline',
      badgeClass: 'bg-muted text-muted-foreground',
      description: 'Saves are stored locally — will sync when online',
    },
  };

  const { label, badgeClass, description } = statusConfig[syncState];

  return (
    <Card className="border-2 border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-bold uppercase tracking-tight">
          Cloud Sync Status
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Badge className={`${badgeClass} border-0 font-bold`}>{label}</Badge>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          {syncState === 'pending' && (
            <Button size="sm" onClick={handleSyncNow}>
              Sync Now
            </Button>
          )}
        </div>

        {stats.total > 0 && (
          <div className="mt-4 grid grid-cols-3 gap-3">
            <StatBlock label="Total Saves" value={String(stats.total)} />
            <StatBlock
              label="Synced"
              value={String(stats.synced)}
              valueClass="text-green-600 dark:text-green-400"
            />
            <StatBlock
              label="Pending"
              value={String(stats.pending)}
              valueClass={stats.pending > 0 ? 'text-amber-600 dark:text-amber-400' : undefined}
            />
          </div>
        )}

        {lastChecked && (
          <p className="mt-3 text-xs text-muted-foreground">
            Last checked:{' '}
            {new Date(lastChecked).toLocaleTimeString(undefined, {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function StatBlock({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}): React.ReactElement {
  return (
    <div className="border border-border p-3 text-center">
      <p className={`text-2xl font-black tracking-tighter ${valueClass ?? ''}`}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
