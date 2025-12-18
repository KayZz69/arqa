-- Fix security definer view by adding security_invoker = true
-- This ensures RLS policies of the querying user are enforced

DROP VIEW IF EXISTS public.current_stock_levels;

CREATE VIEW public.current_stock_levels 
WITH (security_invoker = true)
AS
SELECT 
  p.id as position_id,
  p.name,
  p.category,
  p.unit,
  p.min_stock,
  p.order_quantity,
  p.last_cost,
  p.shelf_life_days,
  p.active,
  COALESCE(
    (
      SELECT ri.ending_stock::numeric 
      FROM report_items ri
      JOIN daily_reports dr ON dr.id = ri.report_id
      WHERE ri.position_id = p.id
      ORDER BY dr.report_date DESC, ri.created_at DESC
      LIMIT 1
    ), 
    0
  ) as current_stock
FROM positions p;

-- Grant access to authenticated users
GRANT SELECT ON public.current_stock_levels TO authenticated;
GRANT SELECT ON public.current_stock_levels TO anon;