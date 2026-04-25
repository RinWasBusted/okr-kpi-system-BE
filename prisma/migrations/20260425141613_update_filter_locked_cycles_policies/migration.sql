-- This is an empty migration.
-- Policy cho Objectives: chỉ thấy record thuộc cycle CHƯA bị locked
-- Hoặc khi không có context (app.skip_locked_filter = 'true') thì bypass
DROP POLICY IF EXISTS "filter_locked_cycles_objectives" ON "Objectives";
CREATE POLICY "filter_locked_cycles_objectives"
ON "Objectives"
AS RESTRICTIVE
FOR ALL
USING (
  current_setting('app.skip_locked_filter', true) = 'true'
  OR NOT EXISTS (
    SELECT 1 FROM "Cycles" c
    WHERE c.id = "Objectives".cycle_id
      AND c.is_locked = true
  )
);

-- Policy cho KPIAssignments
DROP POLICY IF EXISTS "filter_locked_cycles_kpi_assignments" ON "KPIAssignments";
CREATE POLICY "filter_locked_cycles_kpi_assignments"
ON "KPIAssignments"
AS RESTRICTIVE
FOR ALL
USING (
  current_setting('app.skip_locked_filter', true) = 'true'
  OR NOT EXISTS (
    SELECT 1 FROM "Cycles" c
    WHERE c.id = "KPIAssignments".cycle_id
      AND c.is_locked = true
  )
);
