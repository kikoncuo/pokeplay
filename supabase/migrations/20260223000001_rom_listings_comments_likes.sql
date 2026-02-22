-- ROM Listings, Comments, and Likes
-- Enables community sharing of ROM hacks with cover images, descriptions, comments, and likes.

-- ============================================================================
-- Tables
-- ============================================================================

create table public.rom_listings (
  id uuid primary key default gen_random_uuid(),
  rom_sha1 text unique not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text,
  description text default '',
  image_url text,
  is_public boolean default false,
  rom_storage_path text,
  rom_size_bytes bigint,
  system text,
  generation smallint,
  base_game_title text,
  base_game_hash text,
  like_count int default 0,
  comment_count int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.rom_comments (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.rom_listings(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (length(body) <= 2000),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_rom_comments_listing_created on public.rom_comments (listing_id, created_at);

create table public.rom_likes (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.rom_listings(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  unique (listing_id, user_id)
);

-- ============================================================================
-- RLS Policies
-- ============================================================================

alter table public.rom_listings enable row level security;
alter table public.rom_comments enable row level security;
alter table public.rom_likes enable row level security;

-- rom_listings: public SELECT when is_public, owner SELECT always
create policy "Anyone can view public listings"
  on public.rom_listings for select
  using (is_public = true);

create policy "Owner can view own listings"
  on public.rom_listings for select
  using (auth.uid() = owner_id);

create policy "Authenticated users can create listings"
  on public.rom_listings for insert
  with check (auth.uid() = owner_id);

create policy "Owner can update own listings"
  on public.rom_listings for update
  using (auth.uid() = owner_id);

create policy "Owner can delete own listings"
  on public.rom_listings for delete
  using (auth.uid() = owner_id);

-- rom_comments: SELECT if listing is public or user is listing owner
create policy "Anyone can view comments on public listings"
  on public.rom_comments for select
  using (
    exists (
      select 1 from public.rom_listings
      where id = listing_id and (is_public = true or owner_id = auth.uid())
    )
  );

create policy "Authenticated users can comment on public listings"
  on public.rom_comments for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.rom_listings
      where id = listing_id and is_public = true
    )
  );

create policy "Users can update own comments"
  on public.rom_comments for update
  using (auth.uid() = user_id);

create policy "Users can delete own comments or listing owner can delete"
  on public.rom_comments for delete
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.rom_listings
      where id = listing_id and owner_id = auth.uid()
    )
  );

-- rom_likes: SELECT own, INSERT if authenticated + listing public, DELETE own
create policy "Users can view own likes"
  on public.rom_likes for select
  using (auth.uid() = user_id);

create policy "Authenticated users can like public listings"
  on public.rom_likes for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.rom_listings
      where id = listing_id and is_public = true
    )
  );

create policy "Users can remove own likes"
  on public.rom_likes for delete
  using (auth.uid() = user_id);

-- ============================================================================
-- Trigger Functions (denormalized counters)
-- ============================================================================

create or replace function public.handle_rom_like_count()
returns trigger
language plpgsql
security definer
as $$
begin
  if (tg_op = 'INSERT') then
    update public.rom_listings
    set like_count = like_count + 1, updated_at = now()
    where id = new.listing_id;
    return new;
  elsif (tg_op = 'DELETE') then
    update public.rom_listings
    set like_count = greatest(like_count - 1, 0), updated_at = now()
    where id = old.listing_id;
    return old;
  end if;
  return null;
end;
$$;

create trigger trg_rom_likes_count
  after insert or delete on public.rom_likes
  for each row execute function public.handle_rom_like_count();

create or replace function public.handle_rom_comment_count()
returns trigger
language plpgsql
security definer
as $$
begin
  if (tg_op = 'INSERT') then
    update public.rom_listings
    set comment_count = comment_count + 1, updated_at = now()
    where id = new.listing_id;
    return new;
  elsif (tg_op = 'DELETE') then
    update public.rom_listings
    set comment_count = greatest(comment_count - 1, 0), updated_at = now()
    where id = old.listing_id;
    return old;
  end if;
  return null;
end;
$$;

create trigger trg_rom_comments_count
  after insert or delete on public.rom_comments
  for each row execute function public.handle_rom_comment_count();

-- ============================================================================
-- Updated_at trigger for rom_listings
-- ============================================================================

create or replace function public.handle_rom_listing_updated_at()
returns trigger
language plpgsql
security definer
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_rom_listings_updated_at
  before update on public.rom_listings
  for each row execute function public.handle_rom_listing_updated_at();
