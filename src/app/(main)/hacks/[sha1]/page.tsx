'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { Heart, Share2, ArrowLeft, Pencil, Trash2, Download, ImagePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { createClient } from '@/lib/supabase/client';
import { useUserStore } from '@/stores/user-store';
import {
  getListingBySha1,
  getOrCreateListing,
  updateListing,
  listComments,
  addComment,
  deleteComment,
  hasUserLiked,
  toggleLike,
  type RomListingWithProfile,
  type RomCommentWithProfile,
  type RomListing,
} from '@/lib/supabase/queries/listings';
import {
  uploadListingImage,
  uploadSharedRom,
  downloadSharedRom,
  deleteSharedRom,
} from '@/lib/supabase/listing-storage';
import { getRomMeta, getRom, storeRom, type StoredRomMeta } from '@/lib/rom/idb-store';

type PageState =
  | { kind: 'loading' }
  | { kind: 'detail'; listing: RomListingWithProfile; isOwner: boolean }
  | { kind: 'private' }
  | { kind: 'not-found'; authenticated: boolean };

export default function RomDetailPage(): React.ReactElement {
  const params = useParams();
  const sha1 = params.sha1 as string;
  const user = useUserStore((s) => s.user);
  const profile = useUserStore((s) => s.profile);
  const [pageState, setPageState] = useState<PageState>({ kind: 'loading' });

  const initListing = useCallback(async (): Promise<void> => {
    const supabase = createClient();

    // Fetch existing listing
    try {
      const existing = await getListingBySha1(supabase, sha1);

      if (existing) {
        const isOwner = !!user && existing.owner_id === user.id;
        if (existing.is_public || isOwner) {
          setPageState({ kind: 'detail', listing: existing, isOwner });
          return;
        }
        setPageState({ kind: 'private' });
        return;
      }
    } catch {
      // listing not found, continue
    }

    // No listing exists — try to auto-create if authenticated
    if (user) {
      try {
        const romMeta = await getRomMeta(sha1);
        if (romMeta) {
          const newListing = await getOrCreateListing(supabase, sha1, user.id, {
            title: romMeta.customName ?? romMeta.metadata?.title ?? romMeta.filename,
            system: romMeta.metadata?.system,
            generation: romMeta.metadata?.generation,
            base_game_title: romMeta.metadata?.isHack ? romMeta.metadata?.baseGame : undefined,
          });
          setPageState({
            kind: 'detail',
            listing: {
              ...newListing,
              owner: {
                display_name: profile?.display_name ?? 'You',
                avatar_url: profile?.avatar_url ?? null,
              },
            },
            isOwner: true,
          });
          return;
        }
      } catch {
        // couldn't create
      }
      setPageState({ kind: 'not-found', authenticated: true });
    } else {
      setPageState({ kind: 'not-found', authenticated: false });
    }
  }, [sha1, user, profile]);

  useEffect(() => {
    initListing();
  }, [initListing]);

  if (pageState.kind === 'loading') {
    return (
      <div className="p-8">
        <div className="h-8 w-48 animate-pulse bg-muted" />
        <div className="mt-4 h-64 animate-pulse bg-muted" />
      </div>
    );
  }

  if (pageState.kind === 'private') {
    return (
      <div className="p-8">
        <Link href="/hacks" className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Library
        </Link>
        <Card className="mt-4 border-2 border-border">
          <CardContent className="py-16 text-center">
            <p className="text-lg font-bold">This listing is private</p>
            <p className="mt-2 text-sm text-muted-foreground">The owner has not made this ROM public.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (pageState.kind === 'not-found') {
    return (
      <div className="p-8">
        <Link href="/hacks" className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Library
        </Link>
        <Card className="mt-4 border-2 border-border">
          <CardContent className="py-16 text-center">
            <p className="text-lg font-bold">ROM not found</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {pageState.authenticated
                ? 'This ROM is not in your library and no public listing exists.'
                : 'No public listing found for this ROM.'}
            </p>
            {!pageState.authenticated && (
              <Button className="mt-4" asChild>
                <Link href={`/login?next=/hacks/${sha1}`}>Sign in</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <DetailView
      listing={pageState.listing}
      isOwner={pageState.isOwner}
      sha1={sha1}
      onListingUpdated={(updated) => {
        setPageState((prev) =>
          prev.kind === 'detail'
            ? { ...prev, listing: { ...prev.listing, ...updated } }
            : prev
        );
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Detail View
// ---------------------------------------------------------------------------

function DetailView({
  listing,
  isOwner,
  sha1,
  onListingUpdated,
}: {
  listing: RomListingWithProfile;
  isOwner: boolean;
  sha1: string;
  onListingUpdated: (updates: Partial<RomListing>) => void;
}): React.ReactElement {
  const user = useUserStore((s) => s.user);

  return (
    <div className="p-8 max-w-3xl">
      <Link href="/hacks" className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Library
      </Link>

      <ImageSection listing={listing} isOwner={isOwner} sha1={sha1} onUpdated={onListingUpdated} />
      <TitleSection listing={listing} isOwner={isOwner} onUpdated={onListingUpdated} />

      <Separator className="my-6" />

      <ActionBar listing={listing} isOwner={isOwner} sha1={sha1} userId={user?.id ?? null} onUpdated={onListingUpdated} />

      <Separator className="my-6" />

      <CommentThread listing={listing} isOwner={isOwner} userId={user?.id ?? null} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Image Section
// ---------------------------------------------------------------------------

function ImageSection({
  listing,
  isOwner,
  sha1,
  onUpdated,
}: {
  listing: RomListingWithProfile;
  isOwner: boolean;
  sha1: string;
  onUpdated: (u: Partial<RomListing>) => void;
}): React.ReactElement {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0];
    if (!file || !listing.owner_id) return;
    setUploading(true);
    try {
      const url = await uploadListingImage(listing.owner_id, sha1, file);
      const supabase = createClient();
      const updated = await updateListing(supabase, listing.id, { image_url: url });
      onUpdated(updated);
      toast.success('Cover image updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div className="relative mt-4 aspect-video w-full overflow-hidden border-2 border-border bg-muted">
      {listing.image_url ? (
        <img src={listing.image_url} alt={listing.title ?? 'Cover'} className="size-full object-cover" />
      ) : (
        <div className="flex size-full items-center justify-center text-muted-foreground">
          <ImagePlus className="size-12" />
        </div>
      )}
      {isOwner && (
        <>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageChange}
          />
          <Button
            size="sm"
            variant="outline"
            className="absolute bottom-3 right-3 bg-background/80 backdrop-blur"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? 'Uploading...' : 'Change Image'}
          </Button>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Title + Description Section
// ---------------------------------------------------------------------------

function TitleSection({
  listing,
  isOwner,
  onUpdated,
}: {
  listing: RomListingWithProfile;
  isOwner: boolean;
  onUpdated: (u: Partial<RomListing>) => void;
}): React.ReactElement {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(listing.title ?? '');
  const [description, setDescription] = useState(listing.description ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTitle(listing.title ?? '');
    setDescription(listing.description ?? '');
  }, [listing.title, listing.description]);

  async function handleSave(): Promise<void> {
    setSaving(true);
    try {
      const supabase = createClient();
      const updated = await updateListing(supabase, listing.id, { title, description });
      onUpdated(updated);
      setEditing(false);
      toast.success('Details saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-4">
      {editing ? (
        <div className="space-y-3">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="ROM title"
            className="text-2xl font-black"
          />
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Write a description..."
            rows={4}
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditing(false)} disabled={saving}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-start gap-3">
            <h1 className="text-2xl font-black uppercase tracking-tighter">
              {listing.title || 'Untitled ROM'}
            </h1>
            {isOwner && (
              <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
                <Pencil className="size-4" />
              </Button>
            )}
          </div>

          <div className="mt-2 flex flex-wrap gap-2">
            {listing.system && (
              <Badge variant="outline" className="font-mono text-xs">{listing.system}</Badge>
            )}
            {listing.generation && (
              <Badge variant="outline" className="text-xs">Gen {listing.generation}</Badge>
            )}
            {listing.base_game_title && (
              <Badge className="bg-accent text-accent-foreground text-xs">Hack</Badge>
            )}
          </div>

          <div className="mt-3 flex items-center gap-2">
            <Avatar size="sm">
              {listing.owner.avatar_url && <AvatarImage src={listing.owner.avatar_url} />}
              <AvatarFallback>{listing.owner.display_name.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <span className="text-sm font-bold">{listing.owner.display_name}</span>
          </div>

          {listing.description ? (
            <p className="mt-3 text-sm text-muted-foreground whitespace-pre-wrap">{listing.description}</p>
          ) : isOwner ? (
            <button
              onClick={() => setEditing(true)}
              className="mt-3 text-sm text-muted-foreground hover:text-foreground"
            >
              Add a description...
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Action Bar (Like, Share, Public Toggle, Download)
// ---------------------------------------------------------------------------

function ActionBar({
  listing,
  isOwner,
  sha1,
  userId,
  onUpdated,
}: {
  listing: RomListingWithProfile;
  isOwner: boolean;
  sha1: string;
  userId: string | null;
  onUpdated: (u: Partial<RomListing>) => void;
}): React.ReactElement {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(listing.like_count ?? 0);
  const [toggling, setToggling] = useState(false);
  const [publishLoading, setPublishLoading] = useState(false);
  const [downloadOpen, setDownloadOpen] = useState(false);

  useEffect(() => {
    setLikeCount(listing.like_count ?? 0);
  }, [listing.like_count]);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    hasUserLiked(supabase, listing.id, userId).then(setLiked).catch(() => {});
  }, [listing.id, userId]);

  async function handleLike(): Promise<void> {
    if (!userId) {
      toast.error('Sign in to like');
      return;
    }
    // Optimistic
    setLiked((prev) => !prev);
    setLikeCount((prev) => prev + (liked ? -1 : 1));
    try {
      const supabase = createClient();
      const result = await toggleLike(supabase, listing.id, userId);
      setLiked(result.liked);
      setLikeCount(result.newCount);
    } catch {
      // Revert
      setLiked((prev) => !prev);
      setLikeCount((prev) => prev + (liked ? 1 : -1));
      toast.error('Failed to update like');
    }
  }

  function handleShare(): void {
    navigator.clipboard.writeText(window.location.href);
    toast.success('Link copied to clipboard');
  }

  async function handlePublicToggle(checked: boolean): Promise<void> {
    setPublishLoading(true);
    try {
      const supabase = createClient();

      if (checked) {
        // Upload ROM from IndexedDB
        const rom = await getRom(sha1);
        if (!rom) {
          toast.error('ROM not found in local library');
          setPublishLoading(false);
          return;
        }
        const storagePath = await uploadSharedRom(listing.owner_id, sha1, rom.data);
        const updated = await updateListing(supabase, listing.id, {
          is_public: true,
          rom_storage_path: storagePath,
          rom_size_bytes: rom.data.byteLength,
        });
        onUpdated(updated);
        toast.success('ROM published');
      } else {
        // Unpublish
        if (listing.rom_storage_path) {
          await deleteSharedRom(listing.rom_storage_path);
        }
        const updated = await updateListing(supabase, listing.id, {
          is_public: false,
          rom_storage_path: null,
          rom_size_bytes: null,
        });
        onUpdated(updated);
        toast.success('ROM unpublished');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Toggle failed');
    } finally {
      setPublishLoading(false);
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" onClick={handleLike} disabled={toggling}>
          <Heart className={`size-4 mr-1 ${liked ? 'fill-primary text-primary' : ''}`} />
          {likeCount}
        </Button>

        <Button variant="outline" size="sm" onClick={handleShare}>
          <Share2 className="size-4 mr-1" /> Share
        </Button>

        {isOwner && (
          <div className="flex items-center gap-2 ml-auto">
            <Label htmlFor="public-toggle" className="text-sm font-bold">
              Public
            </Label>
            <Switch
              id="public-toggle"
              checked={listing.is_public ?? false}
              onCheckedChange={handlePublicToggle}
              disabled={publishLoading}
            />
          </div>
        )}

        {!isOwner && listing.is_public && listing.rom_storage_path && (
          <Button variant="outline" size="sm" className="ml-auto" onClick={() => setDownloadOpen(true)}>
            <Download className="size-4 mr-1" /> Download
          </Button>
        )}
      </div>

      <DownloadWarningDialog
        open={downloadOpen}
        onOpenChange={setDownloadOpen}
        listing={listing}
        sha1={sha1}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Download Warning Dialog
// ---------------------------------------------------------------------------

function DownloadWarningDialog({
  open,
  onOpenChange,
  listing,
  sha1,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listing: RomListingWithProfile;
  sha1: string;
}): React.ReactElement {
  const [confirmed, setConfirmed] = useState(false);
  const [downloading, setDownloading] = useState(false);

  async function handleDownload(): Promise<void> {
    if (!listing.rom_storage_path) return;
    setDownloading(true);
    try {
      const data = await downloadSharedRom(listing.rom_storage_path);
      await storeRom(sha1, data, `${listing.title ?? 'ROM'}.bin`, null);
      toast.success('ROM added to your library');
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Download failed');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Legal Notice</DialogTitle>
          <DialogDescription>
            You must own a legitimate copy of{' '}
            <strong>{listing.base_game_title ?? listing.title ?? 'the original game'}</strong>{' '}
            to use this ROM. Downloading is for personal backup purposes only.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-start gap-2 py-2">
          <Checkbox
            id="confirm-own"
            checked={confirmed}
            onCheckedChange={(v) => setConfirmed(v === true)}
          />
          <Label htmlFor="confirm-own" className="text-sm leading-tight">
            I confirm I own the original game
          </Label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleDownload} disabled={!confirmed || downloading}>
            {downloading ? 'Downloading...' : 'Download'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Comment Thread
// ---------------------------------------------------------------------------

function CommentThread({
  listing,
  isOwner,
  userId,
}: {
  listing: RomListingWithProfile;
  isOwner: boolean;
  userId: string | null;
}): React.ReactElement {
  const profile = useUserStore((s) => s.profile);
  const [comments, setComments] = useState<RomCommentWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState('');
  const [posting, setPosting] = useState(false);

  const loadComments = useCallback(async (): Promise<void> => {
    try {
      const supabase = createClient();
      const data = await listComments(supabase, listing.id);
      setComments(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [listing.id]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  async function handlePost(): Promise<void> {
    if (!userId || !body.trim()) return;
    setPosting(true);
    try {
      const supabase = createClient();
      const newComment = await addComment(supabase, listing.id, userId, body.trim());
      // Optimistic append
      setComments((prev) => [
        ...prev,
        {
          ...newComment,
          profile: {
            display_name: profile?.display_name ?? 'You',
            avatar_url: profile?.avatar_url ?? null,
          },
        },
      ]);
      setBody('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Post failed');
    } finally {
      setPosting(false);
    }
  }

  async function handleDelete(commentId: string): Promise<void> {
    try {
      const supabase = createClient();
      await deleteComment(supabase, commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  return (
    <div>
      <h2 className="text-lg font-bold uppercase tracking-tight">
        Comments <span className="text-muted-foreground font-normal">({comments.length})</span>
      </h2>

      {/* Comment form */}
      {userId ? (
        <div className="mt-4 space-y-2">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write a comment..."
            rows={3}
            maxLength={2000}
          />
          <Button size="sm" onClick={handlePost} disabled={posting || !body.trim()}>
            {posting ? 'Posting...' : 'Post'}
          </Button>
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">
          <Link href={`/login?next=/hacks/${listing.rom_sha1}`} className="underline hover:text-foreground">
            Sign in
          </Link>{' '}
          to comment.
        </p>
      )}

      {/* Comment list */}
      <div className="mt-6 space-y-4">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 animate-pulse bg-muted" />
            ))}
          </div>
        ) : comments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No comments yet.</p>
        ) : (
          comments.map((comment) => {
            const canDelete = userId === comment.user_id || isOwner;
            return (
              <div key={comment.id} className="flex gap-3 border-2 border-border p-3">
                <Avatar size="sm">
                  {comment.profile.avatar_url && (
                    <AvatarImage src={comment.profile.avatar_url} />
                  )}
                  <AvatarFallback>
                    {comment.profile.display_name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold">{comment.profile.display_name}</span>
                    <span className="text-xs text-muted-foreground">
                      {comment.created_at ? new Date(comment.created_at).toLocaleDateString() : ''}
                    </span>
                    {canDelete && (
                      <button
                        onClick={() => handleDelete(comment.id)}
                        className="ml-auto text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </div>
                  <p className="mt-1 text-sm whitespace-pre-wrap break-words">{comment.body}</p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
