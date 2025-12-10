-- Add minimum stock level and order quantity to positions
ALTER TABLE public.positions 
ADD COLUMN min_stock NUMERIC NOT NULL DEFAULT 5,
ADD COLUMN order_quantity NUMERIC NOT NULL DEFAULT 10,
ADD COLUMN avg_daily_usage NUMERIC NOT NULL DEFAULT 0;

-- Add comment for clarity
COMMENT ON COLUMN public.positions.min_stock IS 'Minimum stock level before reorder alert';
COMMENT ON COLUMN public.positions.order_quantity IS 'Recommended quantity to order';
COMMENT ON COLUMN public.positions.avg_daily_usage IS 'Average daily usage calculated from write-offs';