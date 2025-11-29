-- Add username column to profiles table
ALTER TABLE public.profiles ADD COLUMN username text;

-- Fill existing user data
UPDATE public.profiles SET username = '1' WHERE display_name = 'Маншук';
UPDATE public.profiles SET username = '2' WHERE display_name = 'Диана';
UPDATE public.profiles SET username = '69' WHERE display_name = 'Батыр';

-- Create policy for anonymous reading of profiles (only basic info needed for login)
CREATE POLICY "Anyone can view basic profile info"
ON public.profiles
FOR SELECT
TO anon
USING (true);

-- Create policy for anonymous reading of user_roles (needed to filter users by role)
CREATE POLICY "Anyone can view roles"
ON public.user_roles
FOR SELECT
TO anon
USING (true);