-- Especificações estruturadas do catálogo de produtos/serviços (Fase 1 do
-- planejamento anual do consultório). `features` já existia como lista solta
-- de benefícios; `specifications` guarda pares label/value (ex: "Duração" /
-- "90 dias") para especificações técnicas do produto ou serviço.
ALTER TABLE products ADD COLUMN IF NOT EXISTS specifications jsonb DEFAULT '[]';

COMMENT ON COLUMN products.specifications IS 'Array de {label, value} — especificações técnicas do produto/serviço (ex: duração, o que inclui, modalidade). Distinto de "features", que é uma lista solta de benefícios de marketing.';
