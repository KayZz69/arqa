-- Drop the existing policy with incorrect WITH CHECK clause
DROP POLICY IF EXISTS "Baristas can update their own unlocked reports" ON public.daily_reports;

-- Create corrected policy that allows baristas to lock their reports
CREATE POLICY "Baristas can update their own unlocked reports" 
ON public.daily_reports 
FOR UPDATE 
TO authenticated
USING (
  (auth.uid() = barista_id) 
  AND (NOT is_locked) 
  AND has_role(auth.uid(), 'barista'::app_role)
)
WITH CHECK (
  (auth.uid() = barista_id)
  AND has_role(auth.uid(), 'barista'::app_role)
);