-- Fase 1 hardening: progresso do protocolo e XP/NutriCoins devem ser atômicos.
-- A função valida ownership, item/protocolo, data clínica e prova antes de mutar dados.

CREATE OR REPLACE FUNCTION apply_protocol_progress(
  p_assignment_id UUID,
  p_protocol_item_id UUID,
  p_mark BOOLEAN,
  p_proof_type TEXT DEFAULT 'simple',
  p_photo_path TEXT DEFAULT NULL,
  p_checkin_date DATE DEFAULT NULL
)
RETURNS TABLE (
  points_delta INTEGER,
  already_marked BOOLEAN,
  already_unmarked BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_assignment_protocol_id UUID;
  v_item_protocol_id UUID;
  v_points INTEGER;
  v_existing_points INTEGER;
  v_expected_prefix TEXT;
  v_today DATE := (now() AT TIME ZONE 'America/Sao_Paulo')::DATE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;

  IF p_proof_type NOT IN ('simple', 'camera', 'gallery') THEN
    RAISE EXCEPTION 'proof_type inválido' USING ERRCODE = '22023';
  END IF;

  IF p_checkin_date IS NULL OR abs(p_checkin_date - v_today) > 1 THEN
    RAISE EXCEPTION 'checkin_date inválida ou fora da janela permitida' USING ERRCODE = '22023';
  END IF;

  SELECT protocol_id
    INTO v_assignment_protocol_id
  FROM protocol_assignments
  WHERE id = p_assignment_id
    AND user_id = v_user_id;

  IF v_assignment_protocol_id IS NULL THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT pd.protocol_id,
         CASE p_proof_type
           WHEN 'camera' THEN COALESCE(pi.points_camera, pi.points, 10)
           WHEN 'gallery' THEN COALESCE(pi.points_gallery, pi.points, 10)
           ELSE COALESCE(pi.points, 10)
         END
    INTO v_item_protocol_id, v_points
  FROM protocol_items pi
  JOIN protocol_days pd ON pd.id = pi.protocol_day_id
  WHERE pi.id = p_protocol_item_id;

  IF v_item_protocol_id IS NULL THEN
    RAISE EXCEPTION 'Item não encontrado' USING ERRCODE = 'P0002';
  END IF;

  IF v_item_protocol_id <> v_assignment_protocol_id THEN
    RAISE EXCEPTION 'Item não pertence ao protocolo atribuído' USING ERRCODE = '42501';
  END IF;

  IF p_mark AND p_proof_type <> 'simple' THEN
    v_expected_prefix := v_user_id::TEXT || '/' || p_protocol_item_id::TEXT || '/';
    IF p_photo_path IS NULL OR left(p_photo_path, length(v_expected_prefix)) <> v_expected_prefix THEN
      RAISE EXCEPTION 'Prova fotográfica inválida' USING ERRCODE = '22023';
    END IF;
  END IF;

  SELECT points_earned
    INTO v_existing_points
  FROM protocol_progress
  WHERE assignment_id = p_assignment_id
    AND protocol_item_id = p_protocol_item_id
  FOR UPDATE;

  IF p_mark THEN
    IF FOUND THEN
      RETURN QUERY SELECT 0, TRUE, FALSE;
      RETURN;
    END IF;

    INSERT INTO protocol_progress (
      assignment_id,
      protocol_item_id,
      completed_at,
      checkin_date,
      points_earned,
      proof_type,
      photo_url
    ) VALUES (
      p_assignment_id,
      p_protocol_item_id,
      now(),
      p_checkin_date,
      v_points,
      p_proof_type,
      CASE WHEN p_proof_type = 'simple' THEN NULL ELSE p_photo_path END
    );

    PERFORM increment_user_points(v_user_id, v_points);
    RETURN QUERY SELECT v_points, FALSE, FALSE;
    RETURN;
  END IF;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 0, FALSE, TRUE;
    RETURN;
  END IF;

  DELETE FROM protocol_progress
  WHERE assignment_id = p_assignment_id
    AND protocol_item_id = p_protocol_item_id;

  IF COALESCE(v_existing_points, 0) <> 0 THEN
    PERFORM increment_user_points(v_user_id, -COALESCE(v_existing_points, 0));
  END IF;

  RETURN QUERY SELECT -COALESCE(v_existing_points, 0), FALSE, FALSE;
END;
$$;

REVOKE ALL ON FUNCTION apply_protocol_progress(UUID, UUID, BOOLEAN, TEXT, TEXT, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION apply_protocol_progress(UUID, UUID, BOOLEAN, TEXT, TEXT, DATE) TO authenticated;
