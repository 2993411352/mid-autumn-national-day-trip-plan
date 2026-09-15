-- Only the very first authenticated user may bootstrap the shared trip.
-- Every later account must join through the invite code.
create or replace function public.ensure_default_trip()
returns uuid language plpgsql security definer set search_path = public
as $$
declare selected_trip uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  select trip_id into selected_trip
  from public.trip_members
  where user_id = auth.uid()
  order by joined_at
  limit 1;
  if selected_trip is not null then return selected_trip; end if;

  perform pg_advisory_xact_lock(hashtext('chuanxi-shared-trip-bootstrap'));
  if exists(select 1 from public.trips) then return null; end if;

  insert into public.trips(name, slug, starts_on, ends_on, created_by)
  values ('川西小环线', 'chuanxi-2026', '2026-09-25', '2026-10-01', auth.uid())
  returning id into selected_trip;

  insert into public.trip_members(trip_id, user_id, role, display_name)
  values (selected_trip, auth.uid(), 'owner', coalesce(nullif(auth.jwt()->>'user_metadata', ''), auth.jwt()->>'email', '我'));

  -- Keep the owner-facing name concise even when no profile name was supplied.
  update public.trip_members
  set display_name = coalesce(nullif(auth.jwt()->'user_metadata'->>'display_name', ''), split_part(auth.jwt()->>'email', '@', 1), '我')
  where trip_id = selected_trip and user_id = auth.uid();

  insert into public.itinerary_days(trip_id, day_number, trip_date, title, route, updated_by) values
    (selected_trip, 1, '2026-09-25', '成都城市慢游', '人民公园 → 宽窄巷子 → 奎星楼街 → 九眼桥', auth.uid()),
    (selected_trip, 2, '2026-09-26', '成都经典打卡', '熊猫基地 → 武侯祠 / 锦里 → 太古里', auth.uid()),
    (selected_trip, 3, '2026-09-27', '翻越折多山', '成都 → 雅安 → 泸定 → 康定 → 新都桥', auth.uid()),
    (selected_trip, 4, '2026-09-28', '草原与异星峡谷', '新都桥 → 塔公 → 墨石公园 → 丹巴', auth.uid()),
    (selected_trip, 5, '2026-09-29', '深入双桥沟', '丹巴 → 四姑娘山双桥沟 → 日隆镇', auth.uid()),
    (selected_trip, 6, '2026-09-30', '沿熊猫走廊下山', '日隆 → 卧龙 → 映秀 → 都江堰', auth.uid()),
    (selected_trip, 7, '2026-10-01', '山水收尾，返回成都', '都江堰 / 青城山 → 成都', auth.uid());
  return selected_trip;
end $$;
