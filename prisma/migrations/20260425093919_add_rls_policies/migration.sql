-- AlterTable
ALTER TABLE "Companies" ALTER COLUMN "usage_limit" SET DEFAULT 1000000;

-- =========================================================================
-- PHẦN 1: CÁC BẢNG QUẢN TRỊ (Giữ nguyên vì đã có quyền ADMIN)
-- =========================================================================

-- 1. BẢNG COMPANIES
ALTER TABLE "Companies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Companies" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "Companies";

CREATE POLICY tenant_isolation_policy ON "Companies"
FOR ALL
USING (
  current_setting('app.user_role', true) = 'ADMIN'
  OR id = NULLIF(current_setting('app.current_company_id', true), '')::integer
);

-- 2. BẢNG USERS
ALTER TABLE "Users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Users" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "Users";

CREATE POLICY tenant_isolation_policy ON "Users"
FOR ALL
USING (
  current_setting('app.user_role', true) = 'ADMIN'
  OR (company_id IS NULL AND NULLIF(current_setting('app.current_company_id', true), '')::integer IS NULL)
  OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::integer
);


-- =========================================================================
-- PHẦN 2: CÁC BẢNG NGHIỆP VỤ (Đã cập nhật để ADMIN có quyền truy cập)
-- =========================================================================

DO $$ 
DECLARE 
    table_name text;
BEGIN 
    FOR table_name IN 
        SELECT unnest(ARRAY[
            'Units', 'Cycles', 'KPIDictionaries', 'KPIAssignments', 'KPIRecords', 
            'Objectives', 'KeyResults', 'CheckIns', 'Feedbacks', 'Notifications', 'AIUsageLogs'
        ])
    LOOP
        EXECUTE format('ALTER TABLE "%s" ENABLE ROW LEVEL SECURITY;', table_name);
        EXECUTE format('ALTER TABLE "%s" FORCE ROW LEVEL SECURITY;', table_name);
        EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_policy ON "%s";', table_name);
        
        -- CẬP NHẬT: Thêm điều kiện kiểm tra app.user_role = 'ADMIN'
        EXECUTE format('
            CREATE POLICY tenant_isolation_policy ON "%s"
            FOR ALL
            USING (
                current_setting(''app.user_role'', true) = ''ADMIN''
                OR company_id = NULLIF(current_setting(''app.current_company_id'', true), '''')::integer
            );
        ', table_name);
    END LOOP;
END $$;

-- Policy cho Objectives: chỉ thấy record thuộc cycle CHƯA bị locked
-- Hoặc khi không có context (app.skip_locked_filter = 'true') thì bypass
DROP POLICY IF EXISTS "filter_locked_cycles_objectives" ON "Objectives";
CREATE POLICY "filter_locked_cycles_objectives"
ON "Objectives"
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
FOR ALL
USING (
  current_setting('app.skip_locked_filter', true) = 'true'
  OR NOT EXISTS (
    SELECT 1 FROM "Cycles" c
    WHERE c.id = "KPIAssignments".cycle_id
      AND c.is_locked = true
  )
);


GRANT SELECT, INSERT, UPDATE, DELETE
ON ALL TABLES IN SCHEMA public
TO app_user;
GRANT USAGE, SELECT
ON ALL SEQUENCES IN SCHEMA public
TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT USAGE, SELECT ON SEQUENCES TO app_user;
GRANT USAGE ON SCHEMA public TO app_user;