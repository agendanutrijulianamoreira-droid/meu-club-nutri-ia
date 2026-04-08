-- Add menstrual cycle tracking fields to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cycle_phase TEXT CHECK (cycle_phase IN ('menstrual', 'follicular', 'ovulatory', 'luteal'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cycle_day INTEGER;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_period_start DATE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cycle_length INTEGER DEFAULT 28;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cycle_tracking_enabled BOOLEAN DEFAULT false;

-- Add discretion mode field to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS discretion_mode BOOLEAN DEFAULT false;

-- Add OneSignal player ID for push notifications
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onesignal_player_id TEXT;
