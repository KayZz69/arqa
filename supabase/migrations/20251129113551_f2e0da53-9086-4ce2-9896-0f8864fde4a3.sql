-- Drop existing manager policy for daily_reports
DROP POLICY IF EXISTS "Managers can manage all reports" ON public.daily_reports;

-- Recreate with explicit WITH CHECK for UPDATE operations
CREATE POLICY "Managers can manage all reports" 
ON public.daily_reports 
FOR ALL 
USING (has_role(auth.uid(), 'manager'::app_role))
WITH CHECK (has_role(auth.uid(), 'manager'::app_role));