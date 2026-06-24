-- Add setup wizard columns to tenants table
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS method_name TEXT;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}';

-- club_setup_done already added in 20260218000002 but method_name was missing
-- This ensures all setup-wizard fields exist
