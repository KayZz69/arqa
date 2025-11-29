-- Создание типа роли
CREATE TYPE public.app_role AS ENUM ('barista', 'manager');

-- Таблица ролей пользователей
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Функция для проверки роли пользователя
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Таблица позиций товаров
CREATE TABLE public.positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  unit TEXT NOT NULL,
  shelf_life_days INTEGER,
  active BOOLEAN DEFAULT true NOT NULL,
  sort_order INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;

-- Таблица ежедневных отчётов
CREATE TABLE public.daily_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date DATE NOT NULL UNIQUE,
  barista_id UUID REFERENCES auth.users(id) NOT NULL,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  is_locked BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.daily_reports ENABLE ROW LEVEL SECURITY;

-- Таблица позиций в отчётах
CREATE TABLE public.report_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID REFERENCES public.daily_reports(id) ON DELETE CASCADE NOT NULL,
  position_id UUID REFERENCES public.positions(id) NOT NULL,
  ending_stock DECIMAL(10, 2) NOT NULL DEFAULT 0,
  write_off DECIMAL(10, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE (report_id, position_id)
);

ALTER TABLE public.report_items ENABLE ROW LEVEL SECURITY;

-- Таблица партий товаров (для учёта сроков годности)
CREATE TABLE public.inventory_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id UUID REFERENCES public.positions(id) NOT NULL,
  arrival_date DATE NOT NULL,
  expiry_date DATE NOT NULL,
  quantity DECIMAL(10, 2) NOT NULL,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.inventory_batches ENABLE ROW LEVEL SECURITY;

-- RLS политики для user_roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Managers can view all roles"
ON public.user_roles FOR SELECT
USING (public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Only managers can manage roles"
ON public.user_roles FOR ALL
USING (public.has_role(auth.uid(), 'manager'));

-- RLS политики для positions
CREATE POLICY "Authenticated users can view positions"
ON public.positions FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Only managers can manage positions"
ON public.positions FOR ALL
USING (public.has_role(auth.uid(), 'manager'));

-- RLS политики для daily_reports
CREATE POLICY "Users can view their own reports"
ON public.daily_reports FOR SELECT
USING (auth.uid() = barista_id);

CREATE POLICY "Managers can view all reports"
ON public.daily_reports FOR SELECT
USING (public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Baristas can create reports"
ON public.daily_reports FOR INSERT
WITH CHECK (auth.uid() = barista_id AND public.has_role(auth.uid(), 'barista'));

CREATE POLICY "Managers can manage all reports"
ON public.daily_reports FOR ALL
USING (public.has_role(auth.uid(), 'manager'));

-- RLS политики для report_items
CREATE POLICY "Users can view report items for their reports"
ON public.report_items FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.daily_reports
    WHERE daily_reports.id = report_items.report_id
    AND (daily_reports.barista_id = auth.uid() OR public.has_role(auth.uid(), 'manager'))
  )
);

CREATE POLICY "Baristas can create report items"
ON public.report_items FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.daily_reports
    WHERE daily_reports.id = report_items.report_id
    AND daily_reports.barista_id = auth.uid()
    AND NOT daily_reports.is_locked
  )
);

CREATE POLICY "Managers can manage all report items"
ON public.report_items FOR ALL
USING (public.has_role(auth.uid(), 'manager'));

-- RLS политики для inventory_batches
CREATE POLICY "Authenticated users can view batches"
ON public.inventory_batches FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Only managers can manage batches"
ON public.inventory_batches FOR ALL
USING (public.has_role(auth.uid(), 'manager'));

-- Триггер для обновления updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_positions_updated_at
BEFORE UPDATE ON public.positions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();