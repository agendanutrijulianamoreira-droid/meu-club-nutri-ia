-- ============================================
-- MEU CLUB NUTRI.AI - CAMPAIGN RECURRENCE
-- ============================================

ALTER TABLE campaigns 
ADD COLUMN recurrence_type TEXT DEFAULT 'none' CHECK (recurrence_type IN ('none', 'daily', 'weekly', 'biweekly', 'monthly')),
ADD COLUMN recurrence_config JSONB DEFAULT '{}';

-- Add comment for clarity
COMMENT ON COLUMN campaigns.recurrence_type IS 'Type of recurrence for the campaign (none, daily, weekly, biweekly, monthly)';
COMMENT ON COLUMN campaigns.recurrence_config IS 'Configuration for recurrence (e.g., {"days": [1, 3, 5]} for Mon, Wed, Fri)';
