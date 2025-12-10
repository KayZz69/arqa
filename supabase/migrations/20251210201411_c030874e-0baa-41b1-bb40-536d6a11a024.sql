-- Allow anonymous read access for login page to fetch available users
CREATE POLICY "Allow public read for login" 
ON public.user_roles 
FOR SELECT 
TO anon, authenticated
USING (true);