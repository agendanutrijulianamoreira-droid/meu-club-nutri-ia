revoke execute on function public.upsert_tenant_vital_setting(text,text,text,text,text,text,text,boolean,boolean) from authenticated;

create or replace function public.service_upsert_tenant_vital_setting(
  p_user_id uuid,
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
  if current_user not in ('postgres','service_role','supabase_admin') then raise exception 'privileged role required'; end if;
  if p_user_id is null then raise exception 'Usuário obrigatório'; end if;
  select p.tenant_id, lower(coalesce(p.role,'')) into v_tenant, v_role from public.profiles p where p.user_id=p_user_id;
  if v_tenant is null or v_role not in ('admin','nutritionist','nutri') then raise exception 'Acesso de staff necessário'; end if;
  if p_category is null or length(trim(p_category))<2 then raise exception 'Categoria inválida'; end if;
  if p_provider is null or p_provider !~ '^[a-z0-9_\-]{2,64}$' then raise exception 'Provider inválido'; end if;
  if p_setting_key is null or p_setting_key !~ '^[A-Z0-9_\-\.]{2,128}$' then raise exception 'Chave inválida'; end if;
  if p_value_type not in ('secret','text','url','boolean','json') then raise exception 'Tipo inválido'; end if;
  if p_value_type='secret' and (p_value is null or length(p_value)=0) then raise exception 'Segredo vazio'; end if;

  select * into v_existing from public.tenant_vital_settings s
  where s.tenant_id=v_tenant and s.provider=p_provider and s.setting_key=p_setting_key for update;

  if p_value_type='secret' then
    v_name:='tenant_'||v_tenant::text||'__'||p_provider||'__'||lower(replace(p_setting_key,'.','_'));
    if v_existing.secret_id is not null then
      perform vault.update_secret(v_existing.secret_id,p_value,v_name,coalesce(p_description,p_label));
      v_secret_id:=v_existing.secret_id;
    else
      v_secret_id:=vault.create_secret(p_value,v_name,coalesce(p_description,p_label));
    end if;
  else
    v_secret_id:=null;
  end if;

  insert into public.tenant_vital_settings(tenant_id,category,provider,setting_key,label,description,value_type,config_value,secret_id,required,enabled,validation_status,last_validated_at,updated_by,updated_at)
  values(v_tenant,trim(p_category),p_provider,p_setting_key,trim(p_label),nullif(trim(coalesce(p_description,'')),''),p_value_type,case when p_value_type='secret' then null else p_value end,v_secret_id,coalesce(p_required,false),coalesce(p_enabled,true),'configured',null,p_user_id,now())
  on conflict (tenant_id,provider,setting_key) do update set
    category=excluded.category,label=excluded.label,description=excluded.description,value_type=excluded.value_type,
    config_value=excluded.config_value,secret_id=coalesce(excluded.secret_id,tenant_vital_settings.secret_id),required=excluded.required,
    enabled=excluded.enabled,validation_status='configured',last_validated_at=null,updated_by=p_user_id,updated_at=now()
  returning id into v_id;

  if p_provider='meta_whatsapp' then
    if p_setting_key='PHONE_NUMBER_ID' then update public.appointment_communication_channel_settings set whatsapp_phone_number_id=p_value,updated_by=p_user_id,updated_at=now() where tenant_id=v_tenant;
    elsif p_setting_key='WABA_ID' then update public.appointment_communication_channel_settings set whatsapp_waba_id=p_value,updated_by=p_user_id,updated_at=now() where tenant_id=v_tenant;
    elsif p_setting_key='GRAPH_VERSION' then update public.appointment_communication_channel_settings set whatsapp_graph_version=coalesce(nullif(p_value,''),'v26.0'),updated_by=p_user_id,updated_at=now() where tenant_id=v_tenant;
    end if;
  end if;
  return v_id;
end;
$$;

revoke all on function public.service_upsert_tenant_vital_setting(uuid,text,text,text,text,text,text,text,boolean,boolean) from public,anon,authenticated;
grant execute on function public.service_upsert_tenant_vital_setting(uuid,text,text,text,text,text,text,text,boolean,boolean) to service_role;
