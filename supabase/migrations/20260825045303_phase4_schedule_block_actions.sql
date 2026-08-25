create or replace function public.staff_create_schedule_block(
  p_nutritionist_id uuid,p_local_start timestamp,p_local_end timestamp,p_block_type text default 'unavailable',p_reason text default null
) returns uuid language plpgsql security invoker set search_path=public,pg_temp as $$
declare v_tenant uuid;v_role text;v_timezone text;v_id uuid;
begin
  select p.tenant_id,lower(coalesce(p.role,'')) into v_tenant,v_role from public.profiles p where p.user_id=auth.uid();
  if v_tenant is null or v_role not in ('admin','nutritionist','nutri') then raise exception 'Equipe autorizada necessária'; end if;
  if not exists(select 1 from public.nutritionists n where n.id=p_nutritionist_id and n.tenant_id=v_tenant) then raise exception 'Profissional inválida'; end if;
  if p_block_type not in ('unavailable','vacation','holiday','personal','other') then raise exception 'Tipo de bloqueio inválido'; end if;
  if p_local_end<=p_local_start then raise exception 'Fim do bloqueio deve ser posterior ao início'; end if;
  select coalesce(s.timezone,'America/Sao_Paulo') into v_timezone from public.tenant_appointment_settings s where s.tenant_id=v_tenant;
  insert into public.nutritionist_schedule_blocks(tenant_id,nutritionist_id,starts_at,ends_at,block_type,reason,created_by)
  values(v_tenant,p_nutritionist_id,p_local_start at time zone coalesce(v_timezone,'America/Sao_Paulo'),p_local_end at time zone coalesce(v_timezone,'America/Sao_Paulo'),p_block_type,nullif(btrim(p_reason),''),auth.uid()) returning id into v_id;
  return v_id;
end;$$;
grant execute on function public.staff_create_schedule_block(uuid,timestamp,timestamp,text,text) to authenticated;