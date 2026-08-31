-- V1 hardening: pin search_path on legacy helper functions.
-- This addresses Supabase security advisor warnings without changing function behavior.

alter function public.update_updated_at()
  set search_path = public, pg_temp;

alter function public.update_methods_updated_at()
  set search_path = public, pg_temp;

alter function public.cleanup_audit_logs()
  set search_path = public, pg_temp;

alter function public.seed_meal_templates(uuid)
  set search_path = public, pg_temp;

alter function public.seed_full_content(uuid)
  set search_path = public, pg_temp;
