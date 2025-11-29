-- Make expiry_date nullable since it will be calculated automatically
ALTER TABLE public.inventory_batches 
ALTER COLUMN expiry_date DROP NOT NULL;

-- Add comment explaining the auto-calculation
COMMENT ON COLUMN public.inventory_batches.expiry_date IS 'Calculated as arrival_date + position.shelf_life_days. Can be null if position has no shelf_life_days.';