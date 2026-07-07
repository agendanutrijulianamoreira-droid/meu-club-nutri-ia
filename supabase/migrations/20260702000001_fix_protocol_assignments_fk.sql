-- protocol_assignments nunca teve FK constraints para profiles/protocols, o que
-- quebrava o embedding do PostgREST (select=*,protocol:protocols(*)) usado na
-- home da paciente e na rota de insight do admin, retornando 400
-- ("Could not find a relationship between 'protocol_assignments' and 'protocols'").
-- Remove registros órfãos (referenciando profiles/protocols já deletados) antes
-- de adicionar as constraints.
DELETE FROM protocol_assignments pa
WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = pa.user_id)
   OR NOT EXISTS (SELECT 1 FROM protocols pr WHERE pr.id = pa.protocol_id);

ALTER TABLE protocol_assignments
  ADD CONSTRAINT protocol_assignments_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(user_id) ON DELETE CASCADE;

ALTER TABLE protocol_assignments
  ADD CONSTRAINT protocol_assignments_protocol_id_fkey
  FOREIGN KEY (protocol_id) REFERENCES protocols(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_protocol_assignments_user_id ON protocol_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_protocol_assignments_protocol_id ON protocol_assignments(protocol_id);
