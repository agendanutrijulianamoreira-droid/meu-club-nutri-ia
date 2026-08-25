-- Fase 4 · Bloco 4.2 — hardening de RPCs e views legadas
-- Objetivo: reduzir a superfície pública de funções SECURITY DEFINER e fazer a view
-- de feedback obedecer ao RLS do chamador.

-- 1) View: passa a executar com os privilégios do chamador/RLS.
alter view public.agent_feedback_summary set (security_invoker = true);
revoke all on public.agent_feedback_summary from anon;
revoke insert, update, delete, truncate, references, trigger on public.agent_feedback_summary from authenticated;
grant select on public.agent_feedback_summary to authenticated, service_role;

-- 2) Trigger functions e rotinas internas não são RPCs públicas.
revoke execute on function public.auto_create_nutritionist() from public, anon, authenticated;
revoke execute on function public.auto_post_daily_victory() from public, anon, authenticated;
revoke execute on function public.auto_post_streak_milestone() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.notify_profile_manual_edit() from public, anon, authenticated;
revoke execute on function public.sync_subscription_to_profile() from public, anon, authenticated;
revoke execute on function public.update_gamification_after_log() from public, anon, authenticated;

grant execute on function public.auto_create_nutritionist() to service_role;
grant execute on function public.auto_post_daily_victory() to service_role;
grant execute on function public.auto_post_streak_milestone() to service_role;
grant execute on function public.handle_new_user() to service_role;
grant execute on function public.notify_profile_manual_edit() to service_role;
grant execute on function public.sync_subscription_to_profile() to service_role;
grant execute on function public.update_gamification_after_log() to service_role;

-- 3) Manutenções internas ficam restritas ao service role.
revoke execute on function public.expire_pending_actions() from public, anon, authenticated;
revoke execute on function public.expire_stale_approvals() from public, anon, authenticated;
revoke execute on function public.increment_msgs(uuid) from public, anon, authenticated;
revoke execute on function public.reset_stale_streaks(date) from public, anon, authenticated;

grant execute on function public.expire_pending_actions() to service_role;
grant execute on function public.expire_stale_approvals() to service_role;
grant execute on function public.increment_msgs(uuid) to service_role;
grant execute on function public.reset_stale_streaks(date) to service_role;

-- Corrige search_path mutável em helpers legados diretamente relacionados.
alter function public.auto_create_nutritionist() set search_path = public, pg_temp;
alter function public.increment_msgs(uuid) set search_path = public, pg_temp;

-- 4) create_clinic_and_profile continua sendo RPC autenticada, mas nunca anônima/PUBLIC.
revoke execute on function public.create_clinic_and_profile(text,text,text,text) from public, anon;
grant execute on function public.create_clinic_and_profile(text,text,text,text) to authenticated, service_role;

-- 5) Cadastro público nunca pode promover usuário a equipe a partir de raw_user_meta_data.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tenant_id uuid;
  v_requested_tenant uuid;
begin
  -- raw_user_meta_data é controlável pelo usuário e não pode decidir autorização.
  -- Novo usuário nasce sempre como paciente; elevação de papel ocorre somente por fluxo
  -- administrativo/server-side explícito.
  begin
    v_requested_tenant := nullif(new.raw_user_meta_data->>'tenant_id','')::uuid;
  exception when invalid_text_representation then
    v_requested_tenant := null;
  end;

  if v_requested_tenant is not null
     and exists(select 1 from public.tenants t where t.id=v_requested_tenant and coalesce(t.is_active,true)) then
    v_tenant_id := v_requested_tenant;
  else
    -- Compatibilidade com o fluxo legado de criação sem tenant explícito.
    select t.id into v_tenant_id
    from public.tenants t
    where coalesce(t.is_active,true)
    order by t.created_at
    limit 1;
  end if;

  insert into public.profiles(
    user_id, tenant_id, name, email, role, current_plan, nutri_coins, total_xp, current_level
  ) values (
    new.id,
    v_tenant_id,
    coalesce(new.raw_user_meta_data->>'full_name',new.raw_user_meta_data->>'name',new.email),
    new.email,
    'patient',
    coalesce(new.raw_user_meta_data->>'plan','community'),
    100,0,1
  )
  on conflict(user_id) do update set
    name=excluded.name,
    email=coalesce(excluded.email,public.profiles.email),
    tenant_id=coalesce(public.profiles.tenant_id,excluded.tenant_id);

  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.handle_new_user() to service_role;

-- 6) Duplicação de protocolo: exige membro da equipe no mesmo tenant do protocolo.
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
  select p.tenant_id into v_tenant_id
  from public.protocols p
  where p.id=p_protocol_id;

  if v_tenant_id is null then
    raise exception 'Protocol not found' using errcode='P0002';
  end if;

  if v_uid is null or not exists(
    select 1 from public.profiles pr
    where pr.user_id=v_uid and pr.tenant_id=v_tenant_id
      and lower(coalesce(pr.role,'')) in ('admin','nutritionist','nutri')
  ) then
    raise exception 'Forbidden' using errcode='42501';
  end if;

  insert into public.protocols(title,description,duration_days,cover_image_url,category,tenant_id,is_template)
  select title||' (Cópia)',description,duration_days,cover_image_url,category,tenant_id,is_template
  from public.protocols where id=p_protocol_id
  returning id into v_new_protocol_id;

  for v_day in select * from public.protocol_days where protocol_id=p_protocol_id order by day_number loop
    insert into public.protocol_days(protocol_id,day_number,title,subtitle)
    values(v_new_protocol_id,v_day.day_number,v_day.title,v_day.subtitle)
    returning id into v_new_day_id;

    insert into public.protocol_items(
      protocol_day_id,time,type,title,description,ingredients,recipe,video_url,is_mandatory,points,order_index
    )
    select v_new_day_id,time,type,title,description,ingredients,recipe,video_url,is_mandatory,points,order_index
    from public.protocol_items where protocol_day_id=v_day.id;
  end loop;

  return v_new_protocol_id;
end;
$$;
revoke execute on function public.duplicate_protocol(uuid) from public, anon;
grant execute on function public.duplicate_protocol(uuid) to authenticated, service_role;

-- 7) Feedback do agente: somente equipe do tenant pode gravar vetor de feedback.
create or replace function public.record_agent_feedback(
  p_tenant_id uuid,
  p_pending_action_id uuid,
  p_agent_type text,
  p_original_content text,
  p_approved_content text,
  p_patient_profile jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
  v_delta text;
begin
  if v_uid is null or not exists(
    select 1 from public.profiles p
    where p.user_id=v_uid and p.tenant_id=p_tenant_id
      and lower(coalesce(p.role,'')) in ('admin','nutritionist','nutri')
  ) then
    raise exception 'Forbidden' using errcode='42501';
  end if;

  if p_pending_action_id is not null and not exists(
    select 1 from public.agent_pending_actions a
    where a.id=p_pending_action_id and a.tenant_id=p_tenant_id
  ) then
    raise exception 'Pending action belongs to another tenant' using errcode='42501';
  end if;

  v_delta := case when p_original_content=p_approved_content
    then 'approved_unchanged' else 'admin_edited_before_approval' end;

  insert into public.ai_feedback_vectors(
    tenant_id,pending_action_id,agent_type,original_content,approved_content,delta_summary,context_patient_profile
  ) values(
    p_tenant_id,p_pending_action_id,p_agent_type,p_original_content,p_approved_content,v_delta,p_patient_profile
  ) returning id into v_id;

  return v_id;
end;
$$;
revoke execute on function public.record_agent_feedback(uuid,uuid,text,text,text,jsonb) from public, anon;
grant execute on function public.record_agent_feedback(uuid,uuid,text,text,text,jsonb) to authenticated, service_role;

-- 8) Consulta de upsell: paciente só consulta a si mesma; equipe pode consultar paciente do próprio tenant.
create or replace function public.was_recently_offered(
  p_user_id uuid,
  p_product_id uuid,
  p_days integer default 14
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_target_tenant uuid;
begin
  if v_uid is null then
    raise exception 'Unauthorized' using errcode='42501';
  end if;

  if p_user_id<>v_uid then
    select p.tenant_id into v_target_tenant from public.profiles p where p.user_id=p_user_id;
    if v_target_tenant is null or not exists(
      select 1 from public.profiles actor
      where actor.user_id=v_uid and actor.tenant_id=v_target_tenant
        and lower(coalesce(actor.role,'')) in ('admin','nutritionist','nutri')
    ) then
      raise exception 'Forbidden' using errcode='42501';
    end if;
  end if;

  return exists(
    select 1 from public.upsell_events u
    where u.user_id=p_user_id
      and (u.product_id=p_product_id or p_product_id is null)
      and u.event_type='sent'
      and u.created_at>now()-make_interval(days=>greatest(0,coalesce(p_days,14)))
  );
end;
$$;
revoke execute on function public.was_recently_offered(uuid,uuid,integer) from public, anon;
grant execute on function public.was_recently_offered(uuid,uuid,integer) to authenticated, service_role;

-- RPCs autenticadas que já possuem validação de ownership/tenant permanecem acessíveis.
revoke execute on function public.apply_protocol_progress(uuid,uuid,boolean,text,text,date) from public, anon;
grant execute on function public.apply_protocol_progress(uuid,uuid,boolean,text,text,date) to authenticated, service_role;

revoke execute on function public.record_usage_pattern(uuid,text,text,jsonb) from public, anon;
grant execute on function public.record_usage_pattern(uuid,text,text,jsonb) to authenticated, service_role;
