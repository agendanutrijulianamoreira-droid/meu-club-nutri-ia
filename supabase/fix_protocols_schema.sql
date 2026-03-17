-- MEU CLUB NUTRI.AI - SCHEMA FIX: HIERARCHICAL PROTOCOLS
-- Versão: 1.1
-- Execute este script no SQL Editor do Supabase para corrigir o erro de salvamento de protocolos.

-- 1. Adicionar colunas faltantes na tabela 'protocols'
ALTER TABLE protocols ADD COLUMN IF NOT EXISTS cover_image_url TEXT;
ALTER TABLE protocols ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE protocols ADD COLUMN IF NOT EXISTS start_time TIME DEFAULT '06:00';
ALTER TABLE protocols ADD COLUMN IF NOT EXISTS auto_activate BOOLEAN DEFAULT true;
ALTER TABLE protocols ADD COLUMN IF NOT EXISTS scheduled_status TEXT DEFAULT 'draft' CHECK (scheduled_status IN ('draft', 'scheduled', 'active', 'finished'));
ALTER TABLE protocols ADD COLUMN IF NOT EXISTS is_template BOOLEAN DEFAULT false;

-- 2. Criar tabela 'protocol_days'
CREATE TABLE IF NOT EXISTS protocol_days (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    protocol_id UUID REFERENCES protocols(id) ON DELETE CASCADE NOT NULL,
    day_number INTEGER NOT NULL,
    title TEXT NOT NULL,
    subtitle TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Criar tabela 'protocol_items'
CREATE TABLE IF NOT EXISTS protocol_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    protocol_day_id UUID REFERENCES protocol_days(id) ON DELETE CASCADE NOT NULL,
    time TIME,
    type TEXT NOT NULL, -- meal, shot, workout, content, water, custom
    title TEXT NOT NULL,
    description TEXT,
    ingredients TEXT[], -- Array de strings
    recipe TEXT,
    video_url TEXT,
    is_mandatory BOOLEAN DEFAULT true,
    points INTEGER DEFAULT 10,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_protocol_days_protocol_id ON protocol_days(protocol_id);
CREATE INDEX IF NOT EXISTS idx_protocol_items_day_id ON protocol_items(protocol_day_id);

-- 5. RPC para Duplicação (necessário para a função 'Copiar' no painel)
CREATE OR REPLACE FUNCTION duplicate_protocol(p_protocol_id UUID)
RETURNS UUID AS $$
DECLARE
    v_new_protocol_id UUID;
    v_day RECORD;
    v_new_day_id UUID;
BEGIN
    -- 1. Duplicar protocolo base
    INSERT INTO protocols (
        title, description, duration_days, cover_image_url, category, 
        tenant_id, is_template
    )
    SELECT 
        title || ' (Cópia)', description, duration_days, cover_image_url, category, 
        tenant_id, is_template
    FROM protocols
    WHERE id = p_protocol_id
    RETURNING id INTO v_new_protocol_id;

    -- 2. Loop pelos dias
    FOR v_day IN (SELECT * FROM protocol_days WHERE protocol_id = p_protocol_id ORDER BY day_number) LOOP
        -- Inserir novo dia
        INSERT INTO protocol_days (protocol_id, day_number, title, subtitle)
        VALUES (v_new_protocol_id, v_day.day_number, v_day.title, v_day.subtitle)
        RETURNING id INTO v_new_day_id;

        -- 3. Duplicar items desse dia
        INSERT INTO protocol_items (
            protocol_day_id, time, type, title, description, 
            ingredients, recipe, video_url, is_mandatory, points, order_index
        )
        SELECT 
            v_new_day_id, time, type, title, description, 
            ingredients, recipe, video_url, is_mandatory, points, order_index
        FROM protocol_items
        WHERE protocol_day_id = v_day.id;
    END LOOP;

    RETURN v_new_protocol_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
