-- Temporary fix: Disable RLS to get the app working
-- Run this in Supabase SQL Editor

-- Disable RLS on all tables temporarily
ALTER TABLE public.chat_rooms DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_participants DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_queue DISABLE ROW LEVEL SECURITY;

-- This will allow the app to work immediately
-- We can add proper RLS later when the app is stable 