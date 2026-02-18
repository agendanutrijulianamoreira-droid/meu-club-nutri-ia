-- Add whatsapp column to tenants table
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS whatsapp TEXT;

-- Ensure slug is unique (just in case it wasn't applied correctly before)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'tenants_slug_key'
    ) THEN
        ALTER TABLE tenants ADD CONSTRAINT tenants_slug_key UNIQUE (slug);
    END IF;
END $$;
