create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '新同伴',
  avatar_url text,
  created_at timestamptz not null default now()
);

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  invite_code text not null unique default upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8)),
  starts_on date not null,
  ends_on date not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.trip_members (
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','editor','member')),
  display_name text not null,
  joined_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);

create table public.itinerary_days (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  day_number int not null,
  trip_date date not null,
  title text not null,
  route text not null default '',
  plan jsonb not null default '[]'::jsonb,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  unique (trip_id, day_number)
);

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  day_id uuid references public.itinerary_days(id) on delete cascade,
  body text not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  title text not null,
  category text not null default '其他',
  amount numeric(12,2) not null check (amount > 0),
  payer_name text not null,
  expense_date date not null default current_date,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.photos (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  object_path text not null unique,
  original_name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes <= 26214400),
  caption text,
  uploaded_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.agent_messages (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  role text not null check (role in ('user','assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create or replace function public.is_trip_member(target_trip uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.trip_members where trip_id = target_trip and user_id = auth.uid()) $$;

create or replace function public.ensure_default_trip()
returns uuid language plpgsql security definer set search_path = public
as $$
declare selected_trip uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select trip_id into selected_trip from public.trip_members where user_id = auth.uid() order by joined_at limit 1;
  if selected_trip is null then
    insert into public.trips(name, slug, starts_on, ends_on, created_by)
    values ('川西小环线', 'chuanxi-2026-' || substr(auth.uid()::text, 1, 8), '2026-09-25', '2026-10-01', auth.uid()) returning id into selected_trip;
    insert into public.trip_members(trip_id, user_id, role, display_name)
    values (selected_trip, auth.uid(), 'owner', coalesce(auth.jwt()->>'email', '行程管理员'));
    insert into public.itinerary_days(trip_id, day_number, trip_date, title, route, updated_by) values
      (selected_trip, 1, '2026-09-25', '成都城市慢游', '人民公园 → 宽窄巷子 → 奎星楼街 → 九眼桥', auth.uid()),
      (selected_trip, 2, '2026-09-26', '成都经典打卡', '熊猫基地 → 武侯祠 / 锦里 → 太古里', auth.uid()),
      (selected_trip, 3, '2026-09-27', '翻越折多山', '成都 → 雅安 → 泸定 → 康定 → 新都桥', auth.uid()),
      (selected_trip, 4, '2026-09-28', '草原与异星峡谷', '新都桥 → 塔公 → 墨石公园 → 丹巴', auth.uid()),
      (selected_trip, 5, '2026-09-29', '深入双桥沟', '丹巴 → 四姑娘山双桥沟 → 日隆镇', auth.uid()),
      (selected_trip, 6, '2026-09-30', '沿熊猫走廊下山', '日隆 → 卧龙 → 映秀 → 都江堰', auth.uid()),
      (selected_trip, 7, '2026-10-01', '山水收尾，返回成都', '都江堰 / 青城山 → 成都', auth.uid());
  end if;
  return selected_trip;
end $$;

create or replace function public.join_trip_by_code(p_invite_code text, p_display_name text)
returns uuid language plpgsql security definer set search_path = public
as $$
declare selected_trip uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select id into selected_trip from public.trips where invite_code = upper(trim(p_invite_code));
  if selected_trip is null then raise exception '邀请码不存在'; end if;
  insert into public.trip_members(trip_id, user_id, role, display_name)
  values (selected_trip, auth.uid(), 'member', nullif(trim(p_display_name), ''))
  on conflict (trip_id, user_id) do update set display_name = excluded.display_name;
  return selected_trip;
end $$;

alter table public.profiles enable row level security;
alter table public.trips enable row level security;
alter table public.trip_members enable row level security;
alter table public.itinerary_days enable row level security;
alter table public.notes enable row level security;
alter table public.expenses enable row level security;
alter table public.photos enable row level security;
alter table public.agent_messages enable row level security;

create policy "profile owner" on public.profiles for all using (id = auth.uid()) with check (id = auth.uid());
create policy "members read trips" on public.trips for select using (public.is_trip_member(id));
create policy "members read membership" on public.trip_members for select using (public.is_trip_member(trip_id));
create policy "members read itinerary" on public.itinerary_days for select using (public.is_trip_member(trip_id));
create policy "editors write itinerary" on public.itinerary_days for all using (exists(select 1 from public.trip_members where trip_id = itinerary_days.trip_id and user_id = auth.uid() and role in ('owner','editor'))) with check (exists(select 1 from public.trip_members where trip_id = itinerary_days.trip_id and user_id = auth.uid() and role in ('owner','editor')));
create policy "members manage notes" on public.notes for all using (public.is_trip_member(trip_id)) with check (public.is_trip_member(trip_id) and created_by = auth.uid());
create policy "members read expenses" on public.expenses for select using (public.is_trip_member(trip_id));
create policy "members add expenses" on public.expenses for insert with check (public.is_trip_member(trip_id) and created_by = auth.uid());
create policy "owners manage own expenses" on public.expenses for update using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy "owners delete own expenses" on public.expenses for delete using (created_by = auth.uid());
create policy "members read photos" on public.photos for select using (public.is_trip_member(trip_id));
create policy "members add photos" on public.photos for insert with check (public.is_trip_member(trip_id) and uploaded_by = auth.uid());
create policy "uploaders delete photos" on public.photos for delete using (uploaded_by = auth.uid());
create policy "members read agent chat" on public.agent_messages for select using (public.is_trip_member(trip_id));
create policy "members add agent chat" on public.agent_messages for insert with check (public.is_trip_member(trip_id) and user_id = auth.uid());

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('trip-photos', 'trip-photos', false, 26214400, array['image/jpeg','image/png','image/webp','image/heic'])
on conflict (id) do nothing;

create policy "trip members read photo objects" on storage.objects for select to authenticated
using (bucket_id = 'trip-photos' and public.is_trip_member((storage.foldername(name))[1]::uuid));
create policy "trip members upload photo objects" on storage.objects for insert to authenticated
with check (bucket_id = 'trip-photos' and public.is_trip_member((storage.foldername(name))[1]::uuid) and (storage.foldername(name))[2] = auth.uid()::text);
create policy "uploader deletes photo objects" on storage.objects for delete to authenticated
using (bucket_id = 'trip-photos' and (storage.foldername(name))[2] = auth.uid()::text);

grant execute on function public.ensure_default_trip() to authenticated;
grant execute on function public.join_trip_by_code(text,text) to authenticated;
