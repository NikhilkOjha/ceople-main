-- Create user locations table
CREATE TABLE IF NOT EXISTS user_locations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ip_address INET,
  country TEXT,
  region TEXT,
  city TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  timezone TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_locations_user_id ON user_locations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_locations_country ON user_locations(country);
CREATE INDEX IF NOT EXISTS idx_user_locations_created_at ON user_locations(created_at);
CREATE INDEX IF NOT EXISTS idx_user_locations_ip_address ON user_locations(ip_address);

-- Enable RLS
ALTER TABLE user_locations ENABLE ROW LEVEL SECURITY;

-- RLS policies for user locations
CREATE POLICY "Users can insert their own location" ON user_locations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own location" ON user_locations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Allow admin to view all locations" ON user_locations
  FOR SELECT USING (auth.uid() IN (
    SELECT id FROM auth.users WHERE email = 'admin@ceople.com' OR raw_user_meta_data->>'role' = 'admin'
  ));
