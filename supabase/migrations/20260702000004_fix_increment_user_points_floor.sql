-- Corrige increment_user_points para nunca deixar nutri_coins/total_xp negativos
-- quando um estorno (ex: desmarcar uma missão do protocolo) é aplicado.
-- Mesmo padrão de proteção (GREATEST(0, ...)) já usado no trigger
-- update_gamification_after_log (schema_core.sql) para daily_logs.
CREATE OR REPLACE FUNCTION increment_user_points(user_id UUID, points_to_add INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE profiles
  SET
    nutri_coins = GREATEST(0, nutri_coins + points_to_add),
    total_xp = GREATEST(0, total_xp + points_to_add),
    current_level = calculate_level(GREATEST(0, total_xp + points_to_add))
  WHERE profiles.user_id = $1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
