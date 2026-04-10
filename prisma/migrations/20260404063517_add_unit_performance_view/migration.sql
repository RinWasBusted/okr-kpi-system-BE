-- prisma/migrations/YYYYMMDDHHMMSS_add_unit_performance_view/migration.sql

CREATE OR REPLACE VIEW unit_performance AS
WITH

-- 1. Lấy context user từ session variable
user_context AS (
  SELECT
    NULLIF(current_setting('app.current_user_id', true), '')::int           AS user_id,
    NULLIF(current_setting('app.current_user_unit_path', true), '')::ltree  AS user_unit_path,
    current_setting('app.user_role', true)                                 AS user_role
),

-- 2. OKR mà user được phép xem (Giữ nguyên logic cũ)
visible_objectives AS (
  SELECT
    o.id,
    o.unit_id,
    o.progress_percentage
  FROM "Objectives" o, user_context uc
  WHERE
    o.deleted_at IS NULL
    AND (
      uc.user_role = 'ADMIN_COMPANY'
      OR o.visibility = 'PUBLIC'
      OR (
        o.visibility = 'INTERNAL'
        AND (
          uc.user_unit_path <@ o.access_path
          OR uc.user_unit_path @> o.access_path
          OR uc.user_unit_path = o.access_path
        )
      )
      OR (
        o.visibility = 'PRIVATE'
        AND (
          uc.user_unit_path @> o.access_path
          OR o.owner_id = uc.user_id
        )
      )
    )
),

-- 3. KPI mà user được phép xem (Thêm lọc parent_assignment_id và kẹp giá trị 0-100)
visible_kpis AS (
  SELECT
    k.id,
    k.unit_id,
    -- Giới hạn progress trong khoảng [0, 100]
    LEAST(GREATEST(k.progress_percentage, 0), 100) AS clamped_progress
  FROM "KPIAssignments" k, user_context uc
  WHERE
    k.deleted_at IS NULL
    -- Chỉ tính các KPI cấp cao nhất (không có cha)
    AND k.parent_assignment_id IS NULL
    AND (
      uc.user_role = 'ADMIN_COMPANY'
      OR k.visibility = 'PUBLIC'
      OR (
        k.visibility = 'INTERNAL'
        AND (
          uc.user_unit_path <@ k.access_path
          OR uc.user_unit_path @> k.access_path
        )
      )
      OR (
        k.visibility = 'PRIVATE'
        AND (
          uc.user_unit_path @> k.access_path
          OR k.owner_id = uc.user_id
        )
      )
    )
),

-- 4. Tổng hợp OKR theo unit
okr_stats AS (
  SELECT
    unit_id,
    COUNT(*)                  AS total_okrs,
    AVG(progress_percentage)  AS avg_okr_progress
  FROM visible_objectives
  WHERE unit_id IS NOT NULL
  GROUP BY unit_id
),

-- 5. Tổng hợp KPI theo unit (Dựa trên giá trị đã xử lý)
kpi_stats AS (
  SELECT
    unit_id,
    COUNT(*)                  AS total_kpis,
    AVG(clamped_progress)     AS avg_kpi_progress
  FROM visible_kpis
  WHERE unit_id IS NOT NULL
  GROUP BY unit_id
),

-- 6. Đếm user thực tế của unit và các unit con (ltree logic)
user_stats AS (
  SELECT
    parent_unit.id AS unit_id,
    COUNT(DISTINCT u.id) AS total_users
  FROM "Units" parent_unit
  JOIN "Units" child_unit ON parent_unit.path @> child_unit.path
  JOIN "Users" u ON u.unit_id = child_unit.id
  WHERE
    u.deleted_at IS NULL
    AND u.is_active = true
    AND parent_unit.deleted_at IS NULL
    AND child_unit.deleted_at IS NULL
  GROUP BY parent_unit.id
)

-- 7. Kết quả cuối cùng
SELECT
  un.id                                           AS unit_id,
  un.company_id,
  un.name,
  un.parent_id,
  un.manager_id,
  un.path,
  COALESCE(us.total_users, 0)                     AS total_users,
  COALESCE(os.total_okrs, 0)                      AS total_okrs,
  COALESCE(os.avg_okr_progress, 0)                AS avg_okr_progress,
  COALESCE(ks.total_kpis, 0)                      AS total_kpis,
  COALESCE(ks.avg_kpi_progress, 0)                AS avg_kpi_progress
FROM "Units" un
LEFT JOIN okr_stats os  ON os.unit_id  = un.id
LEFT JOIN kpi_stats ks  ON ks.unit_id  = un.id
LEFT JOIN user_stats us ON us.unit_id  = un.id
WHERE un.deleted_at IS NULL;