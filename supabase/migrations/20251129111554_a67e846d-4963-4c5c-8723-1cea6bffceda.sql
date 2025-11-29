-- Allow baristas to update their own unlocked reports
CREATE POLICY "Baristas can update their own unlocked reports"
ON public.daily_reports
FOR UPDATE
TO authenticated
USING (
  auth.uid() = barista_id 
  AND NOT is_locked 
  AND has_role(auth.uid(), 'barista'::app_role)
)
WITH CHECK (
  auth.uid() = barista_id 
  AND NOT is_locked
);

-- Allow baristas to delete their own unlocked reports
CREATE POLICY "Baristas can delete their own unlocked reports"
ON public.daily_reports
FOR DELETE
TO authenticated
USING (
  auth.uid() = barista_id 
  AND NOT is_locked 
  AND has_role(auth.uid(), 'barista'::app_role)
);

-- Allow baristas to update report items for their unlocked reports
CREATE POLICY "Baristas can update report items for unlocked reports"
ON public.report_items
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM daily_reports
    WHERE daily_reports.id = report_items.report_id
    AND daily_reports.barista_id = auth.uid()
    AND NOT daily_reports.is_locked
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM daily_reports
    WHERE daily_reports.id = report_items.report_id
    AND daily_reports.barista_id = auth.uid()
    AND NOT daily_reports.is_locked
  )
);

-- Allow baristas to delete report items for their unlocked reports
CREATE POLICY "Baristas can delete report items for unlocked reports"
ON public.report_items
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM daily_reports
    WHERE daily_reports.id = report_items.report_id
    AND daily_reports.barista_id = auth.uid()
    AND NOT daily_reports.is_locked
  )
);