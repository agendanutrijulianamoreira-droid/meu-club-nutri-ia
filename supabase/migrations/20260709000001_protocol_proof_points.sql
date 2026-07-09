-- Fase 4 do roadmap: pontuação diferenciada por tipo de comprovação (protocolo).
-- Escopo desta migration é só Protocolo — Desafio não tem hoje nenhum mecanismo
-- de conclusão de atividade (challenge_participants.score nunca é escrito em
-- lugar nenhum do código) e vira uma fase própria no roadmap.
ALTER TABLE protocol_items
  ADD COLUMN IF NOT EXISTS points_camera INTEGER,
  ADD COLUMN IF NOT EXISTS points_gallery INTEGER;

-- Backfill: itens existentes mantêm o mesmo XP nos 3 modos até a nutricionista
-- configurar valores diferentes — sem isso, o comportamento atual mudaria
-- silenciosamente para todo protocolo já criado.
UPDATE protocol_items SET points_camera = points WHERE points_camera IS NULL;
UPDATE protocol_items SET points_gallery = points WHERE points_gallery IS NULL;

ALTER TABLE protocol_progress
  ADD COLUMN IF NOT EXISTS proof_type TEXT NOT NULL DEFAULT 'simple'
    CHECK (proof_type IN ('simple', 'camera', 'gallery'));

-- Bucket de fotos de comprovação de protocolo — espelha exatamente o padrão
-- já usado por habit-photos (público para leitura, escrita/remoção restrita
-- ao prefixo auth.uid() no path).
INSERT INTO storage.buckets (id, name, public)
VALUES ('protocol-photos', 'protocol-photos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "protocol_photos_public_read" ON storage.objects;
CREATE POLICY "protocol_photos_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'protocol-photos');

DROP POLICY IF EXISTS "protocol_photos_upload" ON storage.objects;
CREATE POLICY "protocol_photos_upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'protocol-photos'
    AND auth.uid()::text = (string_to_array(name, '/'))[1]
  );

DROP POLICY IF EXISTS "protocol_photos_delete_own" ON storage.objects;
CREATE POLICY "protocol_photos_delete_own" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'protocol-photos'
    AND auth.uid()::text = (string_to_array(name, '/'))[1]
  );
