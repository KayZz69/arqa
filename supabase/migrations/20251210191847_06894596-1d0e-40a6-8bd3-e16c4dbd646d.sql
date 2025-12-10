-- Add cost_per_unit to inventory_batches
ALTER TABLE public.inventory_batches 
ADD COLUMN cost_per_unit NUMERIC DEFAULT 0;

-- Add last_cost to positions for quick access
ALTER TABLE public.positions 
ADD COLUMN last_cost NUMERIC DEFAULT 0;