-- ============================================
-- Fase 7: Bucket de fotos de refeição
-- ============================================

-- Criar bucket para fotos de refeição (via storage.buckets)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'fotos-refeicao',
    'fotos-refeicao',
    false,
    5242880, -- 5MB
    ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- RLS: paciente pode fazer upload das próprias fotos
DROP POLICY IF EXISTS "Paciente upload propria foto" ON storage.objects;
CREATE POLICY "Paciente upload propria foto" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'fotos-refeicao'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

-- RLS: paciente pode ler as próprias fotos
DROP POLICY IF EXISTS "Paciente lê propria foto" ON storage.objects;
CREATE POLICY "Paciente lê propria foto" ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'fotos-refeicao'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

-- RLS: paciente pode deletar as próprias fotos
DROP POLICY IF EXISTS "Paciente deleta propria foto" ON storage.objects;
CREATE POLICY "Paciente deleta propria foto" ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'fotos-refeicao'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );
