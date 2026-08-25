-- Fase 4 / Bloco 4: entrega transacional de comunicações da agenda.
-- A fila appointment_communication_jobs permanece a fonte única de verdade.
-- Neste bloco, Inbox é o único canal habilitado por padrão; provedores externos ficam desabilitados.

alter table public.appointment_communication_jobs
  add column if not exists attempt_count integer not null default 0,
  add column if not exists max_attempts integer not null default 3,
  add column if not exists next_attempt_at timestamptz,
  add column if not exists locked_at timestamptz,
  add column if not exists provider text,
  add column if not exists delivered_at timestamptz,
  add column if not exists failed_at timestamptz;

alter table public.appointment_communication_jobs
  drop constraint if exists appointment_communication_jobs_max_attempts_check;
alter table public.appointment_communication_jobs
  add constraint appointment_communication_jobs_max_attempts_check
  check (max_attempts between 1 and 10 and attempt_count >= 0);

create index if not exists appointment_communication_jobs_dispatch_idx
  on public.appointment_communication_jobs(status, due_at, next_attempt_at)
  where status in ('ready','failed');

-- Corrige o isolamento multi-tenant da policy criada no Bloco 3.
drop policy if exists appointment_communication_jobs_staff_read on public.appointment_communication_jobs;
create policy appointment_communication_jobs_staff_read
on public.appointment_communication_jobs for select to authenticated
using (
  exists (
    select 1
    from public.profiles viewer
    where viewer.user_id = (select auth.uid())
      and viewer.tenant_id = appointment_communication_jobs.tenant_id
      and lower(coalesce(viewer.role,'')) in ('admin','nutritionist','nutri')
  )
);

create table if not exists public.appointment_communication_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  kind text not null check (kind in ('confirmation_request','reminder')),
  channel text not null check (channel in ('inbox','whatsapp','email')),
  title text not null,
  body text not null,
  cta_label text,
  cta_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appointment_communication_templates_tenant_kind_channel_key unique(tenant_id,kind,channel)
);

alter table public.appointment_communication_templates enable row level security;

create policy appointment_communication_templates_staff_read
on public.appointment_communication_templates for select to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.user_id=(select auth.uid())
      and p.tenant_id=appointment_communication_templates.tenant_id
      and lower(coalesce(p.role,'')) in ('admin','nutritionist','nutri')
  )
);

create policy appointment_communication_templates_staff_manage
on public.appointment_communication_templates for all to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.user_id=(select auth.uid())
      and p.tenant_id=appointment_communication_templates.tenant_id
      and lower(coalesce(p.role,'')) in ('admin','nutritionist','nutri')
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.user_id=(select auth.uid())
      and p.tenant_id=appointment_communication_templates.tenant_id
      and lower(coalesce(p.role,'')) in ('admin','nutritionist','nutri')
  )
);

grant select,insert,update,delete on public.appointment_communication_templates to authenticated;
grant all on public.appointment_communication_templates to service_role;
revoke all on public.appointment_communication_templates from anon;

insert into public.appointment_communication_templates(tenant_id,kind,channel,title,body,cta_label,cta_url)
select t.id,'confirmation_request','inbox','Confirme sua consulta',
       'Sua consulta está chegando. Confirme sua presença para mantermos seu horário reservado.',
       'Confirmar presença','/patient/appointments/confirm'
from public.tenants t
on conflict (tenant_id,kind,channel) do nothing;

insert into public.appointment_communication_templates(tenant_id,kind,channel,title,body,cta_label,cta_url)
select t.id,'reminder','inbox','Lembrete da sua consulta',
       'Sua consulta está próxima. Confira o horário e os detalhes no app.',
       'Ver consulta','/patient/appointments'
from public.tenants t
on conflict (tenant_id,kind,channel) do nothing;

create or replace function public.service_dispatch_appointment_inbox(p_limit integer default 50)
returns jsonb
language plpgsql
security invoker
set search_path=public,pg_temp
as $$
declare
  v_job public.appointment_communication_jobs%rowtype;
  v_template public.appointment_communication_templates%rowtype;
  v_appointment public.appointments%rowtype;
  v_message_id uuid;
  v_sent integer:=0;
  v_cancelled integer:=0;
  v_failed integer:=0;
begin
  if p_limit is null or p_limit < 1 or p_limit > 200 then
    raise exception 'Limite inválido';
  end if;

  for v_job in
    select j.*
    from public.appointment_communication_jobs j
    where j.status in ('ready','failed')
      and j.due_at <= now()
      and (j.next_attempt_at is null or j.next_attempt_at <= now())
      and j.attempt_count < j.max_attempts
    order by j.due_at,j.created_at
    for update skip locked
    limit p_limit
  loop
    begin
      update public.appointment_communication_jobs
      set locked_at=now(),updated_at=now()
      where id=v_job.id;

      select * into v_appointment
      from public.appointments a
      where a.id=v_job.appointment_id and a.tenant_id=v_job.tenant_id;

      if v_appointment.id is null or v_appointment.status not in ('scheduled','confirmed','in_progress') then
        update public.appointment_communication_jobs
        set status='cancelled',locked_at=null,updated_at=now(),last_error=null
        where id=v_job.id;
        v_cancelled:=v_cancelled+1;
        continue;
      end if;

      if v_job.kind='confirmation_request' and v_appointment.status='confirmed' then
        update public.appointment_communication_jobs
        set status='cancelled',locked_at=null,updated_at=now(),last_error=null
        where id=v_job.id;
        v_cancelled:=v_cancelled+1;
        continue;
      end if;

      select * into v_template
      from public.appointment_communication_templates t
      where t.tenant_id=v_job.tenant_id
        and t.kind=v_job.kind
        and t.channel='inbox'
        and t.active=true;

      if v_template.id is null then
        update public.appointment_communication_jobs
        set status='failed',attempt_count=attempt_count+1,
            next_attempt_at=now()+interval '6 hours',locked_at=null,
            last_error='Template Inbox ativo não encontrado',failed_at=now(),updated_at=now()
        where id=v_job.id;
        v_failed:=v_failed+1;
        continue;
      end if;

      -- Idempotência: se o job já possui um ID de mensagem, não cria outra cópia.
      if v_job.provider='inbox' and v_job.provider_message_id is not null
         and exists(select 1 from public.inbox_messages im where im.id::text=v_job.provider_message_id) then
        update public.appointment_communication_jobs
        set status='sent',sent_at=coalesce(sent_at,now()),delivered_at=coalesce(delivered_at,now()),
            locked_at=null,last_error=null,updated_at=now()
        where id=v_job.id;
        continue;
      end if;

      insert into public.inbox_messages(
        tenant_id,user_id,agent_name,title,body,message_type,priority,cta_label,cta_url,channels,status,metadata
      ) values (
        v_job.tenant_id,v_job.patient_id,'appointment_automation',v_template.title,v_template.body,
        case when v_job.kind='confirmation_request' then 'appointment_confirmation' else 'appointment_reminder' end,
        'high',v_template.cta_label,v_template.cta_url,array['inbox']::text[],'unread',
        jsonb_build_object('appointment_id',v_job.appointment_id,'communication_job_id',v_job.id,'kind',v_job.kind)
      ) returning id into v_message_id;

      update public.appointment_communication_jobs
      set status='sent',channel='inbox',provider='inbox',provider_message_id=v_message_id::text,
          attempt_count=attempt_count+1,sent_at=now(),delivered_at=now(),failed_at=null,
          next_attempt_at=null,locked_at=null,last_error=null,updated_at=now()
      where id=v_job.id;

      if v_job.kind='confirmation_request' then
        update public.appointments set confirmation_sent=true,updated_at=now() where id=v_job.appointment_id;
      elsif v_job.kind='reminder' then
        update public.appointments set reminder_sent=true,reminder_sent_at=now(),updated_at=now() where id=v_job.appointment_id;
      end if;
      v_sent:=v_sent+1;
    exception when others then
      update public.appointment_communication_jobs
      set status='failed',attempt_count=attempt_count+1,
          next_attempt_at=case when attempt_count+1 < max_attempts then now()+interval '1 hour' else null end,
          failed_at=now(),locked_at=null,last_error=left(sqlerrm,500),updated_at=now()
      where id=v_job.id;
      v_failed:=v_failed+1;
    end;
  end loop;

  return jsonb_build_object('sent',v_sent,'cancelled',v_cancelled,'failed',v_failed);
end;$$;

revoke all on function public.service_dispatch_appointment_inbox(integer) from public,anon,authenticated;
grant execute on function public.service_dispatch_appointment_inbox(integer) to service_role;
