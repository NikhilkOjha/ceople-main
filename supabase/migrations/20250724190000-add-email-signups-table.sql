-- Create email signups table
CREATE TABLE IF NOT EXISTS email_signups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  source TEXT DEFAULT 'website',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_email_signups_email ON email_signups(email);
CREATE INDEX IF NOT EXISTS idx_email_signups_created_at ON email_signups(created_at);
CREATE INDEX IF NOT EXISTS idx_email_signups_source ON email_signups(source);

-- Enable RLS
ALTER TABLE email_signups ENABLE ROW LEVEL SECURITY;

-- RLS policies for email signups
CREATE POLICY "Allow public email signups" ON email_signups
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow admin to view all email signups" ON email_signups
  FOR SELECT USING (auth.uid() IN (
    SELECT id FROM auth.users WHERE email = 'admin@ceople.com' OR raw_user_meta_data->>'role' = 'admin'
  ));

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_email_signups_updated_at 
    BEFORE UPDATE ON email_signups 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
