create or replace view public.upcoming_appointments
with (security_invoker=true) as
select
  a.id,a.created_at,a.updated_at,a.nutritionist_id,a.patient_id,a.tenant_id,a.scheduled_at,a.duration_minutes,
  a.appointment_type,a.is_virtual,a.meeting_link,a.location_address,a.status,a.confirmed_at,a.completed_at,
  a.cancellation_reason,a.cancelled_at,a.cancelled_by,a.notes,a.patient_notes,a.pre_consultation_form,
  a.reminder_sent,a.reminder_sent_at,a.confirmation_sent,
  coalesce(p.name,c.name) as patient_name,
  coalesce(p.email,c.email) as patient_email,
  p.avatar_url as patient_avatar,
  n.name as nutritionist_name,
  n.avatar_url as nutritionist_avatar
from public.appointments a
left join public.profiles p on p.user_id=a.patient_id
left join public.crm_contacts c on c.id=a.crm_contact_id and c.tenant_id=a.tenant_id
join public.nutritionists n on n.id=a.nutritionist_id
where a.scheduled_at>now() and a.status in ('scheduled','confirmed')
order by a.scheduled_at;

create or replace view public.nutritionist_appointment_stats
with (security_invoker=true) as
select
  n.id as nutritionist_id,
  n.name as nutritionist_name,
  n.tenant_id,
  count(a.id) as total_appointments,
  count(a.id) filter(where a.status='completed') as completed_appointments,
  count(a.id) filter(where a.status='cancelled') as cancelled_appointments,
  count(a.id) filter(where a.status='no_show') as no_show_appointments,
  count(a.id) filter(where a.scheduled_at>now() and a.status in ('scheduled','confirmed')) as upcoming_appointments
from public.nutritionists n
left join public.appointments a on a.nutritionist_id=n.id and a.tenant_id=n.tenant_id
group by n.id,n.name,n.tenant_id;