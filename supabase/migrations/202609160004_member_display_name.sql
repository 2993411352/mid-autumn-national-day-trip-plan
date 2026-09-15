create or replace function public.update_trip_member_name(p_trip_id uuid, p_display_name text)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if nullif(trim(p_display_name), '') is null then raise exception '称呼不能为空'; end if;
  update public.trip_members
  set display_name = trim(p_display_name)
  where trip_id = p_trip_id and user_id = auth.uid();
  if not found then raise exception '你还不是这趟旅程的成员'; end if;
end $$;
grant execute on function public.update_trip_member_name(uuid,text) to authenticated;
