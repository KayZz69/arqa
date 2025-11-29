-- Create pre-made user accounts
-- Note: These INSERT statements create the auth users directly

-- Insert auth users (baristas and manager)
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  role,
  aud,
  confirmation_token,
  recovery_token
) VALUES 
  -- Barista 1
  (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    '1@barista.local',
    crypt('1', gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    false,
    'authenticated',
    'authenticated',
    '',
    ''
  ),
  -- Barista 2
  (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    '2@barista.local',
    crypt('2', gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    false,
    'authenticated',
    'authenticated',
    '',
    ''
  ),
  -- Manager
  (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    '69@barista.local',
    crypt('69', gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    false,
    'authenticated',
    'authenticated',
    '',
    ''
  );

-- Insert user roles for baristas
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'barista'::app_role
FROM auth.users
WHERE email IN ('1@barista.local', '2@barista.local');

-- Insert user role for manager
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'manager'::app_role
FROM auth.users
WHERE email = '69@barista.local';