-- Create categories table
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- Authenticated users can view active categories
CREATE POLICY "Authenticated users can view categories" 
ON public.categories FOR SELECT TO authenticated USING (true);

-- Only managers can manage categories
CREATE POLICY "Only managers can manage categories" 
ON public.categories FOR ALL USING (has_role(auth.uid(), 'manager'::app_role));

-- Insert initial categories including new "Холодные напитки"
INSERT INTO public.categories (name, sort_order) VALUES
  ('Выпечка', 1),
  ('Кухня', 2),
  ('Ингредиент', 3),
  ('Расходник', 4),
  ('Пицца', 5),
  ('Холодные напитки', 6);