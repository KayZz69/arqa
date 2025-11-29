-- Fix the default value for is_locked to be false instead of true
ALTER TABLE public.daily_reports 
ALTER COLUMN is_locked SET DEFAULT false;