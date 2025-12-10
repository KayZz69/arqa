-- Fix: Remove overly permissive "Anyone can view roles" policy
-- The existing "Users can view their own roles" and "Managers can view all roles" policies are sufficient

DROP POLICY IF EXISTS "Anyone can view roles" ON public.user_roles;