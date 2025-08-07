-- Create feedback table
CREATE TABLE IF NOT EXISTS feedback (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  rating TEXT NOT NULL CHECK (rating IN ('positive', 'negative')),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  room_id UUID REFERENCES chat_rooms(id) ON DELETE SET NULL,
  chat_type TEXT DEFAULT 'unknown',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_rating ON feedback(rating);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at);

-- Enable RLS
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- RLS policies for feedback
CREATE POLICY "Users can insert their own feedback" ON feedback
  FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can view their own feedback" ON feedback
  FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

-- Allow anonymous feedback (for guest users)
CREATE POLICY "Allow anonymous feedback" ON feedback
  FOR INSERT WITH CHECK (user_id IS NULL);

CREATE POLICY "Allow viewing anonymous feedback" ON feedback
  FOR SELECT USING (user_id IS NULL);
