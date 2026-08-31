-- V1 hardening: keep duplicate_protocol aligned with the relational protocol schema.
-- The previous function still inserted protocol_days without tenant_id and copied
-- only legacy protocol_items fields, causing duplication to fail after Sub-phase 3.

create or replace function public.duplicate_protocol(p_protocol_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_tenant_id uuid;
  v_new_protocol_id uuid;
  v_day record;
  v_new_day_id uuid;
begin
  select p.tenant_id
    into v_tenant_id
  from public.protocols p
  where p.id = p_protocol_id;

  if v_tenant_id is null then
    raise exception 'Protocol not found' using errcode = 'P0002';
  end if;

  if v_uid is null or not exists (
    select 1
    from public.profiles pr
    where pr.user_id = v_uid
      and pr.tenant_id = v_tenant_id
      and lower(coalesce(pr.role, '')) in ('admin', 'nutritionist', 'nutri')
  ) then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  insert into public.protocols (
    title,
    description,
    duration_days,
    cover_image_url,
    category,
    tenant_id,
    is_template,
    method_phase_id
  )
  select
    p.title || ' (Cópia)',
    p.description,
    p.duration_days,
    p.cover_image_url,
    p.category,
    p.tenant_id,
    p.is_template,
    p.method_phase_id
  from public.protocols p
  where p.id = p_protocol_id
  returning id into v_new_protocol_id;

  for v_day in
    select d.*
    from public.protocol_days d
    where d.protocol_id = p_protocol_id
    order by d.day_number
  loop
    insert into public.protocol_days (
      protocol_id,
      day_number,
      title,
      subtitle,
      tenant_id
    )
    values (
      v_new_protocol_id,
      v_day.day_number,
      v_day.title,
      v_day.subtitle,
      v_tenant_id
    )
    returning id into v_new_day_id;

    insert into public.protocol_items (
      protocol_day_id,
      time,
      type,
      title,
      description,
      ingredients,
      recipe,
      video_url,
      is_mandatory,
      points,
      order_index,
      image_url,
      points_camera,
      points_gallery,
      tenant_id,
      item_kind,
      recipe_id,
      meal_id,
      shot_id,
      tea_id,
      supplement_id,
      material_id,
      quantity,
      unit,
      serving_label
    )
    select
      v_new_day_id,
      i.time,
      i.type,
      i.title,
      i.description,
      i.ingredients,
      i.recipe,
      i.video_url,
      i.is_mandatory,
      i.points,
      i.order_index,
      i.image_url,
      i.points_camera,
      i.points_gallery,
      v_tenant_id,
      i.item_kind,
      i.recipe_id,
      i.meal_id,
      i.shot_id,
      i.tea_id,
      i.supplement_id,
      i.material_id,
      i.quantity,
      i.unit,
      i.serving_label
    from public.protocol_items i
    where i.protocol_day_id = v_day.id;
  end loop;

  insert into public.protocol_goals (
    protocol_id,
    goal_id,
    tenant_id,
    sort_order
  )
  select
    v_new_protocol_id,
    pg.goal_id,
    v_tenant_id,
    pg.sort_order
  from public.protocol_goals pg
  where pg.protocol_id = p_protocol_id;

  return v_new_protocol_id;
end;
$$;

revoke execute on function public.duplicate_protocol(uuid) from public, anon;
grant execute on function public.duplicate_protocol(uuid) to authenticated;
