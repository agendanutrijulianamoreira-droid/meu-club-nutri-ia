-- ============================================
-- MEU CLUB NUTRI.AI - COMMUNITY & REWARDS SCHEMA
-- ============================================

-- 1. POSTS (Feed da Comunidade)
CREATE TABLE IF NOT EXISTS posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  
  content TEXT,
  image_url TEXT,
  type TEXT DEFAULT 'post' CHECK (type IN ('post', 'recipe', 'question', 'achievement')),
  
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  
  is_ai_moderated BOOLEAN DEFAULT false,
  ai_status TEXT DEFAULT 'pending' CHECK (ai_status IN ('pending', 'approved', 'flagged'))
);

-- 2. POST_LIKES
CREATE TABLE IF NOT EXISTS post_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE NOT NULL,
  
  UNIQUE(user_id, post_id)
);

-- 3. POST_COMMENTS
CREATE TABLE IF NOT EXISTS post_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL
);

-- 4. REWARDS (Loja de Prêmios)
CREATE TABLE IF NOT EXISTS rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  
  name TEXT NOT NULL,
  description TEXT,
  emoji TEXT DEFAULT '🎁',
  cost_points INTEGER NOT NULL CHECK (cost_points > 0),
  stock INTEGER DEFAULT -1, -- -1 para infinito
  is_active BOOLEAN DEFAULT true
);

-- 5. REDEMPTIONS (Resgates)
CREATE TABLE IF NOT EXISTS redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  reward_id UUID REFERENCES rewards(id) ON DELETE CASCADE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'fulfilled', 'cancelled'))
);

-- 6. ENHANCE DAILY_LOGS (Alterações na tabela existente)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_logs' AND column_name='humor') THEN
        ALTER TABLE daily_logs ADD COLUMN humor TEXT CHECK (humor IN ('great', 'good', 'neutral', 'bad', 'terrible'));
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_logs' AND column_name='hunger_level') THEN
        ALTER TABLE daily_logs ADD COLUMN hunger_level TEXT CHECK (hunger_level IN ('low', 'medium', 'high'));
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_logs' AND column_name='medication_taken') THEN
        ALTER TABLE daily_logs ADD COLUMN medication_taken BOOLEAN DEFAULT false;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_logs' AND column_name='note') THEN
        ALTER TABLE daily_logs ADD COLUMN note TEXT;
    END IF;
END $$;

-- ============================================
-- RLS POLICIES
-- ============================================

ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE redemptions ENABLE ROW LEVEL SECURITY;

-- Posts: Ver todos do tenant, mas inserir/editar apenas os próprios
CREATE POLICY "Users can see tenant posts" ON posts
  FOR SELECT TO authenticated USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can create own posts" ON posts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Likes: Usuários gerenciam seus próprios likes
CREATE POLICY "Users can manage own likes" ON post_likes
  FOR ALL TO authenticated USING (auth.uid() = user_id);

-- Rewards: Todos do tenant veem, apenas admin gerencia
CREATE POLICY "Users can see tenant rewards" ON rewards
  FOR SELECT TO authenticated USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()));

-- Redemptions: Usuário vê os seus, admin vê todos do tenant
CREATE POLICY "Users can see own redemptions" ON redemptions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Atualizar contadores de likes
CREATE OR REPLACE FUNCTION update_post_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE posts SET likes_count = likes_count + 1 WHERE id = NEW.post_id;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE posts SET likes_count = GREATEST(0, likes_count - 1) WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_update_post_likes_count
AFTER INSERT OR DELETE ON post_likes
FOR EACH ROW EXECUTE FUNCTION update_post_likes_count();
