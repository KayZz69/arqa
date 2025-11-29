-- Allow users to insert their own initial role during setup
-- This is safe because it only allows the FIRST role to be self-assigned
CREATE POLICY "Users can insert their own initial role"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id 
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = auth.uid()
  )
);