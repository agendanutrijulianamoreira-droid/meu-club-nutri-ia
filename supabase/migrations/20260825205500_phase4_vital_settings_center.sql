create table if not exists public.tenant_vital_settings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  category text not null,
  provider text not null,
  setting_key text not null,
  label text not null,
  description text,
  value_type text not null check (value_type in ('secret','text','url','boolean','json')),
  config_value text,
  secret_id uuid,
  required boolean not null default false,
  enabled boolean not null default true,
  validation_status text not null default 'unknown' check (validation_status in ('unknown','configured','valid','invalid','needs_review')),
  last_validated_at timestamptz,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, provider, setting_key)
);

alter table public.tenant_vital_settings enable row level security;

revoke all on public.tenant_vital_settings from anon;
revoke insert, update, delete on public.tenant_vital_settings from authenticated;
grant select on public.tenant_vital_settings to authenticated;
grant select, insert, update, delete on public.tenant_vital_settings to service_role;

drop policy if exists tenant_vital_settings_staff_select on public.tenant_vital_settings;
create policy tenant_vital_settings_staff_select
on public.tenant_vital_settings
for select
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and p.tenant_id = tenant_vital_settings.tenant_id
      and lower(coalesce(p.role,'')) in ('admin','nutritionist','nutri')
  )
);

create or replace function public.upsert_tenant_vital_setting(
  p_category text,
  p_provider text,
  p_setting_key text,
  p_label text,
  p_description text,
  p_value_type text,
  p_value text,
  p_required boolean default false,
  p_enabled boolean default true
) returns uuid
language plpgsql
security definer
set search_path = public, vault, pg_temp
as $$
declare
  v_tenant uuid;
  v_role text;
  v_existing public.tenant_vital_settings%rowtype;
  v_secret_id uuid;
  v_id uuid;
  v_name text;
begin
  if auth.uid() is null then raise exception 'Autenticação necessária'; end if;
  select p.tenant_id, lower(coalesce(p.role,'')) into v_tenant, v_role
  from public.profiles p where p.user_id = auth.uid();
  if v_tenant is null or v_role not in ('admin','nutritionist','nutri') then raise exception 'Acesso de staff necessário'; end if;
  if p_category is null or length(trim(p_category)) < 2 then raise exception 'Categoria inválida'; end if;
  if p_provider is null or p_provider !~ '^[a-z0-9_\-]{2,64}$' then raise exception 'Provider inválido'; end if;
  if p_setting_key is null or p_setting_key !~ '^[A-Z0-9_\-\.]{2,128}$' then raise exception 'Chave inválida'; end if;
  if p_value_type not in ('secret','text','url','boolean','json') then raise exception 'Tipo inválido'; end if;
  if p_value_type='secret' and (p_value is null or length(p_value)=0) then raise exception 'Segredo vazio'; end if;

  select * into v_existing from public.tenant_vital_settings s
  where s.tenant_id=v_tenant and s.provider=p_provider and s.setting_key=p_setting_key
  for update;

  if p_value_type='secret' then
    v_name := 'tenant_'||v_tenant::text||'__'||p_provider||'__'||lower(replace(p_setting_key,'.','_'));
    if v_existing.secret_id is not null then
      perform vault.update_secret(v_existing.secret_id, p_value, v_name, coalesce(p_description,p_label));
      v_secret_id := v_existing.secret_id;
    else
      v_secret_id := vault.create_secret(p_value, v_name, coalesce(p_description,p_label));
    end if;
  else
    v_secret_id := null;
  end if;

  insert into public.tenant_vital_settings(
    tenant_id,category,provider,setting_key,label,description,value_type,config_value,secret_id,required,enabled,
    validation_status,last_validated_at,updated_by,updated_at
  ) values (
    v_tenant,trim(p_category),p_provider,p_setting_key,trim(p_label),nullif(trim(coalesce(p_description,'')),''),p_value_type,
    case when p_value_type='secret' then null else p_value end,v_secret_id,coalesce(p_required,false),coalesce(p_enabled,true),
    'configured',null,auth.uid(),now()
  )
  on conflict (tenant_id,provider,setting_key) do update set
    category=excluded.category,label=excluded.label,description=excluded.description,value_type=excluded.value_type,
    config_value=excluded.config_value,secret_id=coalesce(excluded.secret_id,tenant_vital_settings.secret_id),
    required=excluded.required,enabled=excluded.enabled,validation_status='configured',last_validated_at=null,
    updated_by=auth.uid(),updated_at=now()
  returning id into v_id;

  if p_provider='meta_whatsapp' then
    if p_setting_key='PHONE_NUMBER_ID' then
      update public.appointment_communication_channel_settings set whatsapp_phone_number_id=p_value,updated_by=auth.uid(),updated_at=now() where tenant_id=v_tenant;
    elsif p_setting_key='WABA_ID' then
      update public.appointment_communication_channel_settings set whatsapp_waba_id=p_value,updated_by=auth.uid(),updated_at=now() where tenant_id=v_tenant;
    elsif p_setting_key='GRAPH_VERSION' then
      update public.appointment_communication_channel_settings set whatsapp_graph_version=coalesce(nullif(p_value,''),'v26.0'),updated_by=auth.uid(),updated_at=now() where tenant_id=v_tenant;
    end if;
  end if;

  return v_id;
end;
$$;

revoke all on function public.upsert_tenant_vital_setting(text,text,text,text,text,text,text,boolean,boolean) from public, anon;
grant execute on function public.upsert_tenant_vital_setting(text,text,text,text,text,text,text,boolean,boolean) to authenticated, service_role;

create or replace function public.service_get_tenant_vital_secret(
  p_tenant_id uuid,
  p_provider text,
  p_setting_key text
) returns text
language plpgsql
security definer
set search_path = public, vault, pg_temp
as $$
declare v_secret text;
begin
  if current_user not in ('postgres','service_role','supabase_admin') then raise exception 'privileged role required'; end if;
  select d.decrypted_secret into v_secret
  from public.tenant_vital_settings s
  join vault.decrypted_secrets d on d.id=s.secret_id
  where s.tenant_id=p_tenant_id and s.provider=p_provider and s.setting_key=p_setting_key and s.enabled=true;
  return v_secret;
end;
$$;

revoke all on function public.service_get_tenant_vital_secret(uuid,text,text) from public, anon, authenticated;
grant execute on function public.service_get_tenant_vital_secret(uuid,text,text) to service_role;

comment on table public.tenant_vital_settings is 'Metadados/configuracoes vitais por tenant. Segredos ficam no Supabase Vault; esta tabela guarda apenas secret_id.';
comment on function public.service_get_tenant_vital_secret(uuid,text,text) is 'Leitura service-only de segredo do Vault para adapters server-side.';