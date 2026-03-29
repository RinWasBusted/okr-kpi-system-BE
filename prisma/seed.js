import "dotenv/config";
import prisma from '../src/utils/prisma.js';
import { hashPassword } from "../src/utils/bcrypt.js";

const main = async () => {
  await prisma.$connect();

  console.log("Seeding database and setting policies...");

  // Create a database user and set policies
  await prisma.$executeRawUnsafe(`
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
                'Objectives', 'KeyResults', 'CheckIns', 'Feedbacks', 
                'Evaluations', 'Notifications', 'AIUsageLogs'
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
`);


  // Create a user
  const password = "admin123";
  const hashedPassword = await hashPassword(password);

  const user = await prisma.users.create({
    data: {
      full_name: "admin",
      email: "admin@phamhoangthai.site",
      password: hashedPassword,
      role: "ADMIN",
    }
  });

  console.log("Database seeded successfully!");
};

main()
  .catch(async (error) => {
    console.error("Prisma seed failed:", error);
    await prisma.$disconnect();
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
