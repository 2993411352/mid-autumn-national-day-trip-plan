-- Keep the shared trip and first-time bootstrap aligned with the ten-day plan.
do $$
declare
  target_trip uuid;
begin
  for target_trip in
    select id from public.trips
    where name = '川西小环线' and starts_on = '2026-09-25'
  loop
    update public.trips set ends_on = '2026-10-04' where id = target_trip;
    insert into public.itinerary_days (trip_id, day_number, trip_date, title, route, updated_by)
    select target_trip, v.day_number, v.trip_date, v.title, v.route, t.created_by
    from public.trips t
    cross join (values
      (1, '2026-09-25'::date, '成都城市慢游', '人民公园 → 宽窄巷子 → 奎星楼街 → 九眼桥'),
      (2, '2026-09-26'::date, '成都经典打卡', '熊猫基地 → 武侯祠 / 锦里 → 太古里'),
      (3, '2026-09-27'::date, '进山适应海拔', '成都 → 映秀 → 卧龙 → 猫鼻梁 → 四姑娘山镇'),
      (4, '2026-09-28'::date, '双桥沟完整一日', '四姑娘山镇 → 双桥沟 → 四姑娘山镇'),
      (5, '2026-09-29'::date, '丹巴藏寨与墨石', '四姑娘山镇 → 小金 → 丹巴 → 墨石公园 → 八美 → 新都桥'),
      (6, '2026-09-30'::date, '穿越天路到亚丁', '新都桥 → 雅江 → 天路十八弯 → 卡子拉山 → 理塘 → 稻城 → 香格里拉镇'),
      (7, '2026-10-01'::date, '稻城亚丁全日游', '香格里拉镇 → 亚丁游客中心 → 扎灌崩 → 洛绒牛场 → 香格里拉镇'),
      (8, '2026-10-02'::date, '回到天空之城', '香格里拉镇 → 稻城 → 海子山 → 理塘'),
      (9, '2026-10-03'::date, '翻越折多山到康定', '理塘 → 雅江 → 新都桥 → 折多山 → 康定'),
      (10, '2026-10-04'::date, '木格措收尾返成都', '康定 → 木格措 → 泸定 → 雅安 → 成都')
    ) v(day_number, trip_date, title, route)
    where t.id = target_trip
    on conflict (trip_id, day_number) do update
      set trip_date = excluded.trip_date,
          title = excluded.title,
          route = excluded.route,
          updated_by = excluded.updated_by;
  end loop;
end $$;

create or replace function public.ensure_default_trip()
returns uuid language plpgsql security definer set search_path = public
as $$
declare
  selected_trip uuid;
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
  values ('川西小环线', 'chuanxi-2026', '2026-09-25', '2026-10-04', auth.uid())
  returning id into selected_trip;

  insert into public.trip_members(trip_id, user_id, role, display_name)
  values (
    selected_trip,
    auth.uid(),
    'owner',
    coalesce(nullif(auth.jwt()->'user_metadata'->>'display_name', ''), split_part(auth.jwt()->>'email', '@', 1), '我')
  );

  insert into public.itinerary_days(trip_id, day_number, trip_date, title, route, updated_by) values
    (selected_trip, 1, '2026-09-25', '成都城市慢游', '人民公园 → 宽窄巷子 → 奎星楼街 → 九眼桥', auth.uid()),
    (selected_trip, 2, '2026-09-26', '成都经典打卡', '熊猫基地 → 武侯祠 / 锦里 → 太古里', auth.uid()),
    (selected_trip, 3, '2026-09-27', '进山适应海拔', '成都 → 映秀 → 卧龙 → 猫鼻梁 → 四姑娘山镇', auth.uid()),
    (selected_trip, 4, '2026-09-28', '双桥沟完整一日', '四姑娘山镇 → 双桥沟 → 四姑娘山镇', auth.uid()),
    (selected_trip, 5, '2026-09-29', '丹巴藏寨与墨石', '四姑娘山镇 → 小金 → 丹巴 → 墨石公园 → 八美 → 新都桥', auth.uid()),
    (selected_trip, 6, '2026-09-30', '穿越天路到亚丁', '新都桥 → 雅江 → 天路十八弯 → 卡子拉山 → 理塘 → 稻城 → 香格里拉镇', auth.uid()),
    (selected_trip, 7, '2026-10-01', '稻城亚丁全日游', '香格里拉镇 → 亚丁游客中心 → 扎灌崩 → 洛绒牛场 → 香格里拉镇', auth.uid()),
    (selected_trip, 8, '2026-10-02', '回到天空之城', '香格里拉镇 → 稻城 → 海子山 → 理塘', auth.uid()),
    (selected_trip, 9, '2026-10-03', '翻越折多山到康定', '理塘 → 雅江 → 新都桥 → 折多山 → 康定', auth.uid()),
    (selected_trip, 10, '2026-10-04', '木格措收尾返成都', '康定 → 木格措 → 泸定 → 雅安 → 成都', auth.uid());
  return selected_trip;
end $$;
