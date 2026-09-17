-- Expense dates already exist in the original schema. Keep the column present
-- for databases that were created from an older partial setup.
alter table public.expenses
  add column if not exists expense_date date not null default current_date;

drop policy if exists "owners delete own expenses" on public.expenses;
drop policy if exists "members delete expenses" on public.expenses;
create policy "members delete expenses" on public.expenses
  for delete using (public.is_trip_member(trip_id));

create table if not exists public.photo_albums (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  title text not null check (length(title) between 1 and 80),
  note text,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.photos
  add column if not exists album_id uuid references public.photo_albums(id) on delete set null;

create index if not exists photos_album_id_idx on public.photos(album_id);
alter table public.photo_albums enable row level security;

drop policy if exists "members manage photo albums" on public.photo_albums;
create policy "members manage photo albums" on public.photo_albums
  for all using (public.is_trip_member(trip_id))
  with check (public.is_trip_member(trip_id));

drop policy if exists "uploaders delete photos" on public.photos;
drop policy if exists "members delete photos" on public.photos;
create policy "members delete photos" on public.photos
  for delete using (public.is_trip_member(trip_id));

drop policy if exists "uploader deletes photo objects" on storage.objects;
drop policy if exists "trip members delete photo objects" on storage.objects;
create policy "trip members delete photo objects" on storage.objects
  for delete to authenticated
  using (bucket_id = 'trip-photos' and public.is_trip_member((storage.foldername(name))[1]::uuid));
