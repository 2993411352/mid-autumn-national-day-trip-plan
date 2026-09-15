do $$
declare target_trip uuid;
begin
  select id into target_trip from public.trips
  where name = '川西小环线' and starts_on = '2026-09-25'
  order by created_at limit 1;
  if target_trip is null then return; end if;
  update public.trips set ends_on = '2026-10-04' where id = target_trip;
  update public.itinerary_days set title='成都城市慢游', route='人民公园 → 宽窄巷子 → 奎星楼街 → 九眼桥' where trip_id=target_trip and day_number=1;
  update public.itinerary_days set title='成都经典打卡', route='熊猫基地 → 武侯祠 / 锦里 → 太古里' where trip_id=target_trip and day_number=2;
  update public.itinerary_days set title='进山适应海拔', route='成都 → 映秀 → 卧龙 → 猫鼻梁 → 四姑娘山镇' where trip_id=target_trip and day_number=3;
  update public.itinerary_days set title='双桥沟完整一日', route='四姑娘山镇 → 双桥沟 → 四姑娘山镇' where trip_id=target_trip and day_number=4;
  update public.itinerary_days set title='丹巴藏寨与墨石', route='四姑娘山镇 → 小金 → 丹巴 → 墨石公园 → 八美 → 新都桥' where trip_id=target_trip and day_number=5;
  update public.itinerary_days set title='穿越天路到亚丁', route='新都桥 → 雅江 → 天路十八弯 → 卡子拉山 → 理塘 → 稻城 → 香格里拉镇' where trip_id=target_trip and day_number=6;
  update public.itinerary_days set title='稻城亚丁全日游', route='香格里拉镇 → 亚丁游客中心 → 扎灌崩 → 洛绒牛场 → 香格里拉镇' where trip_id=target_trip and day_number=7;
  insert into public.itinerary_days (trip_id,day_number,trip_date,title,route,updated_by)
  select target_trip, v.day_number, v.trip_date, v.title, v.route, t.created_by
  from public.trips t cross join (values
    (8,'2026-10-02'::date,'回到天空之城','香格里拉镇 → 稻城 → 海子山 → 理塘'),
    (9,'2026-10-03'::date,'翻越折多山到康定','理塘 → 雅江 → 新都桥 → 折多山 → 康定'),
    (10,'2026-10-04'::date,'木格措收尾返成都','康定 → 木格措 → 泸定 → 雅安 → 成都')
  ) v(day_number,trip_date,title,route) where t.id=target_trip
  on conflict (trip_id,day_number) do update set trip_date=excluded.trip_date,title=excluded.title,route=excluded.route;
end $$;
