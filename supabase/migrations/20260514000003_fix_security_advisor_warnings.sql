-- ════════════════════════════════════════════════════════════
-- 1. FUNCTION SEARCH_PATH MUTABLE
--    Fixa o search_path em cada função para evitar hijacking
--    de schema via SET search_path malicioso.
-- ════════════════════════════════════════════════════════════

ALTER FUNCTION public.update_protocol_end_date()                        SET search_path = public;
ALTER FUNCTION public.auto_post_daily_victory()                         SET search_path = public;
ALTER FUNCTION public.update_updated_at_column()                        SET search_path = public;
ALTER FUNCTION public.get_professional_by_referral(ref_code text)       SET search_path = public;
ALTER FUNCTION public.generate_referral_code()                          SET search_path = public;
ALTER FUNCTION public.update_updated_at()                               SET search_path = public;
ALTER FUNCTION public.update_protocol_statuses()                        SET search_path = public;
ALTER FUNCTION public.get_inactive_users(p_tenant_id uuid, p_days integer) SET search_path = public;
ALTER FUNCTION public.update_gamification_after_log()                   SET search_path = public;
ALTER FUNCTION public.calculate_commission()                            SET search_path = public;
ALTER FUNCTION public.seed_reward_items(p_tenant_id uuid)              SET search_path = public;
ALTER FUNCTION public.update_professional_stats()                       SET search_path = public;
ALTER FUNCTION public.sync_subscription_to_profile()                    SET search_path = public;
ALTER FUNCTION public.duplicate_protocol(p_protocol_id uuid)            SET search_path = public;
ALTER FUNCTION public.calculate_booking_split()                         SET search_path = public;
ALTER FUNCTION public.auto_post_streak_milestone()                      SET search_path = public;
ALTER FUNCTION public.update_professional_metrics()                     SET search_path = public;
ALTER FUNCTION public.calculate_level(xp integer)                       SET search_path = public;
ALTER FUNCTION public.handle_new_user()                                 SET search_path = public;
-- create_clinic_and_profile já tem search_path=public configurado.

-- ════════════════════════════════════════════════════════════
-- 2. RLS POLICIES ALWAYS TRUE
--    Políticas "service role" com USING/WITH CHECK = true são
--    desnecessárias: o service role já bypassa RLS por design.
--    Removê-las fecha o acesso para JWT/anon comuns.
-- ════════════════════════════════════════════════════════════

-- agent_logs
DROP POLICY IF EXISTS "Service role can insert agent logs"  ON public.agent_logs;
DROP POLICY IF EXISTS "Service role can update agent logs"  ON public.agent_logs;

-- foods
DROP POLICY IF EXISTS "Service role manages foods"          ON public.foods;

-- inbox_messages
DROP POLICY IF EXISTS "Service role can insert inbox messages" ON public.inbox_messages;

-- patient_risk_scores
DROP POLICY IF EXISTS "Service role can manage risk scores" ON public.patient_risk_scores;

-- ai_generations: substituir WITH CHECK (true) por verificação de tenant
DROP POLICY IF EXISTS "Authenticated can insert generations" ON public.ai_generations;
CREATE POLICY "Authenticated insert own tenant generations"
  ON public.ai_generations FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND tenant_id IN (
      SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

-- ════════════════════════════════════════════════════════════
-- 3. SECURITY DEFINER FUNCTIONS ACESSÍVEIS POR ANON/AUTHENTICATED
--    Funções de trigger não devem ser chamáveis via RPC.
--    Funções utilitárias só precisam de acesso autenticado.
-- ════════════════════════════════════════════════════════════

-- Funções trigger — apenas o sistema as chama (via trigger), não RPC
REVOKE EXECUTE ON FUNCTION public.handle_new_user()            FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_subscription_to_profile() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_post_daily_victory()    FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_post_streak_milestone() FROM anon, authenticated;

-- duplicate_protocol — só admins autenticados devem usar
REVOKE EXECUTE ON FUNCTION public.duplicate_protocol(uuid)     FROM anon;

-- ════════════════════════════════════════════════════════════
-- 4. PUBLIC BUCKET ALLOWS LISTING
--    Remover política SELECT broad que permite listar todos os
--    arquivos do bucket 'assets'. Buckets públicos continuam
--    acessíveis por URL direta sem precisar desta política.
-- ════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Public Access" ON storage.objects;
