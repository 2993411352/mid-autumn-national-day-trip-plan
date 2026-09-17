-- This upgrade is intentionally self-contained so it can also be pasted into
-- the Supabase SQL Editor when an earlier optional-feature migration was missed.
alter table public.notes add column if not exists day_number int;
alter table public.notes add column if not exists stop_time text;
alter table public.notes add column if not exists stop_title text;

create table if not exists public.guide_links (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  title text not null check (length(title) between 1 and 120),
  url text not null check (url ~ '^https?://'),
  note text,
  platform text not null default '网页',
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.guide_links add column if not exists group_id text;

create table if not exists public.guide_groups (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  title text not null check (length(title) between 1 and 80),
  place text not null default '',
  note text,
  cover_url text not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.accommodations (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  day_number int not null check (day_number between 1 and 10),
  hotel_name text not null,
  address text not null default '',
  note text,
  updated_by uuid not null references auth.users(id) on delete cascade,
  updated_at timestamptz not null default now(),
  unique (trip_id, day_number)
);

alter table public.guide_groups enable row level security;
alter table public.accommodations enable row level security;
alter table public.guide_links enable row level security;

drop policy if exists "members read guide links" on public.guide_links;
drop policy if exists "members add guide links" on public.guide_links;
drop policy if exists "creators delete guide links" on public.guide_links;
drop policy if exists "members delete guide links" on public.guide_links;
create policy "members read guide links" on public.guide_links
  for select using (public.is_trip_member(trip_id));
create policy "members add guide links" on public.guide_links
  for insert with check (public.is_trip_member(trip_id) and created_by = auth.uid());
create policy "members delete guide links" on public.guide_links
  for delete using (public.is_trip_member(trip_id));

drop policy if exists "members manage guide groups" on public.guide_groups;
create policy "members manage guide groups" on public.guide_groups
  for all using (public.is_trip_member(trip_id))
  with check (public.is_trip_member(trip_id));

drop policy if exists "members manage accommodations" on public.accommodations;
create policy "members manage accommodations" on public.accommodations
  for all using (public.is_trip_member(trip_id))
  with check (public.is_trip_member(trip_id));
