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
alter table public.guide_links enable row level security;
create policy "members read guide links" on public.guide_links for select using (public.is_trip_member(trip_id));
create policy "members add guide links" on public.guide_links for insert with check (public.is_trip_member(trip_id) and created_by = auth.uid());
create policy "creators delete guide links" on public.guide_links for delete using (created_by = auth.uid());
