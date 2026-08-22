-- Fase 1 hardening: fotos de comprovação não devem ser públicas.
-- O path segue o formato <patient_user_id>/<protocol_item_id>/<arquivo>.

-- Converte URLs públicas já persistidas para o caminho interno do objeto.
UPDATE protocol_progress
SET photo_url = split_part(split_part(photo_url, '/protocol-photos/', 2), '?', 1)
WHERE photo_url IS NOT NULL
  AND photo_url LIKE '%/protocol-photos/%';

UPDATE storage.buckets
SET public = false
WHERE id = 'protocol-photos';

DROP POLICY IF EXISTS "protocol_photos_public_read" ON storage.objects;
DROP POLICY IF EXISTS "protocol_photos_read_own" ON storage.objects;
DROP POLICY IF EXISTS "protocol_photos_read_tenant_staff" ON storage.objects;

-- Paciente lê apenas os próprios objetos.
CREATE POLICY "protocol_photos_read_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'protocol-photos'
    AND auth.uid()::text = (string_to_array(name, '/'))[1]
  );

-- Admin/nutricionista lê provas apenas de pacientes do mesmo tenant.
CREATE POLICY "protocol_photos_read_tenant_staff" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'protocol-photos'
    AND EXISTS (
      SELECT 1
      FROM profiles viewer
      JOIN profiles patient
        ON patient.user_id::text = (string_to_array(storage.objects.name, '/'))[1]
      WHERE viewer.user_id = auth.uid()
        AND viewer.tenant_id = patient.tenant_id
        AND viewer.role IN ('admin', 'nutritionist', 'nutri')
    )
  );
