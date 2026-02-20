-- Adicionando colunas de duração e intensidade requeridas pelo review sênior
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS club_duration integer DEFAULT 6;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS club_intensity text DEFAULT 'moderada';
