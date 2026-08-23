-- Fase 1 hardening: a RPC de progresso do protocolo não pode ser executada anonimamente.
REVOKE EXECUTE ON FUNCTION apply_protocol_progress(UUID, UUID, BOOLEAN, TEXT, TEXT, DATE) FROM anon;
REVOKE EXECUTE ON FUNCTION apply_protocol_progress(UUID, UUID, BOOLEAN, TEXT, TEXT, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION apply_protocol_progress(UUID, UUID, BOOLEAN, TEXT, TEXT, DATE) TO authenticated;
