create or replace function public.get_crm_metrics(p_tenant_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path=public
as $$
declare
  v_days integer;
  v_since timestamptz;
  v_result jsonb;
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles p
    where p.user_id=(select auth.uid())
      and p.tenant_id=p_tenant_id
      and lower(coalesce(p.role,'')) in ('admin','nutritionist','nutri')
  ) then
    raise exception 'Acesso negado';
  end if;

  select coalesce(s.window_days,30) into v_days
  from public.crm_metric_settings s where s.tenant_id=p_tenant_id;
  v_days:=coalesce(v_days,30);
  v_since:=now()-make_interval(days=>v_days);

  with base as (
    select o.contact_id,o.owner_user_id_snapshot,o.recency_segment_snapshot,
           o.minutes_late_snapshot,o.scheduled_action_at_snapshot,
           t.code,t.counts_as_response,t.counts_as_conversion
    from public.crm_contact_outcomes o
    join public.crm_outcome_types t on t.id=o.outcome_type_id and t.tenant_id=o.tenant_id
    where o.tenant_id=p_tenant_id and o.occurred_at>=v_since
  ), totals as (
    select
      count(distinct contact_id)::int approached,
      count(distinct contact_id) filter(where counts_as_response)::int responded,
      count(distinct contact_id) filter(where counts_as_conversion)::int converted,
      count(*) filter(where code='appointment_booked')::int appointments,
      count(*) filter(where code='protocol_purchased')::int protocols,
      count(*) filter(where code='no_response')::int no_response,
      coalesce(avg(minutes_late_snapshot) filter(where scheduled_action_at_snapshot is not null and minutes_late_snapshot>0),0)::numeric avg_minutes_late
    from base
  ), segments as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'segment',segment,
      'approached',approached,
      'responded',responded,
      'converted',converted
    ) order by segment),'[]'::jsonb) data
    from (
      select coalesce(recency_segment_snapshot,'unknown') segment,
             count(distinct contact_id)::int approached,
             count(distinct contact_id) filter(where counts_as_response)::int responded,
             count(distinct contact_id) filter(where counts_as_conversion)::int converted
      from base group by coalesce(recency_segment_snapshot,'unknown')
    ) s
  ), owners as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'owner_user_id',owner_user_id,
      'contacts',contacts,
      'attempts',attempts,
      'responded',responded,
      'converted',converted
    ) order by attempts desc),'[]'::jsonb) data
    from (
      select owner_user_id_snapshot owner_user_id,
             count(distinct contact_id)::int contacts,
             count(*)::int attempts,
             count(distinct contact_id) filter(where counts_as_response)::int responded,
             count(distinct contact_id) filter(where counts_as_conversion)::int converted
      from base group by owner_user_id_snapshot
    ) o
  ), overdue as (
    select count(*)::int value from public.crm_contacts c
    where c.tenant_id=p_tenant_id and not c.do_not_contact
      and c.next_action_at is not null and c.next_action_at<=now()
  )
  select jsonb_build_object(
    'window_days',v_days,
    'approached',t.approached,
    'responded',t.responded,
    'converted',t.converted,
    'appointments',t.appointments,
    'protocols',t.protocols,
    'no_response',t.no_response,
    'avg_minutes_late',t.avg_minutes_late,
    'overdue_now',d.value,
    'segments',s.data,
    'owners',o.data
  ) into v_result
  from totals t cross join segments s cross join owners o cross join overdue d;

  return coalesce(v_result,'{}'::jsonb);
end $$;

revoke all on function public.get_crm_metrics(uuid) from public, anon;
grant execute on function public.get_crm_metrics(uuid) to authenticated;
