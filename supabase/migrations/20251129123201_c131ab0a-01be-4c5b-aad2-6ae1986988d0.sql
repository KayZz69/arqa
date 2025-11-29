-- Add unique constraint on profiles.user_id
ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_user_id_unique UNIQUE (user_id);

-- Add foreign key from user_roles to profiles
ALTER TABLE public.user_roles 
ADD CONSTRAINT user_roles_profile_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;