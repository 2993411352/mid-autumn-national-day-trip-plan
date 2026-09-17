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

create policy "members manage guide groups" on public.guide_groups
  for all using (public.is_trip_member(trip_id))
  with check (public.is_trip_member(trip_id));

create policy "members manage accommodations" on public.accommodations
  for all using (public.is_trip_member(trip_id))
  with check (public.is_trip_member(trip_id));
