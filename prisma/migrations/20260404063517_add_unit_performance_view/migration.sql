-- prisma/migrations/YYYYMMDDHHMMSS_add_unit_performance_view/migration.sql

CREATE OR REPLACE VIEW unit_performance AS
WITH

-- Lấy context user từ session variable (set bởi app trước mỗi query)
user_context AS (
  SELECT
    NULLIF(current_setting('app.current_user_id', true), '')::int           AS user_id,
    NULLIF(current_setting('app.current_user_unit_path', true), '')::ltree  AS user_unit_path,
    current_setting('app.user_role', true)                    AS user_role
),

-- OKR mà user được phép xem, gắn với unit_id của OKR đó
visible_objectives AS (
  SELECT
    o.id,
    o.unit_id,
    o.progress_percentage
  FROM "Objectives" o, user_context uc
  WHERE
    o.deleted_at IS NULL
    -- ADMIN_COMPANY thấy tất cả
    AND (
      uc.user_role = 'ADMIN_COMPANY'

      -- PUBLIC: tất cả user trong công ty (RLS đã filter company_id rồi)
      OR o.visibility = 'PUBLIC'

      -- INTERNAL: user phải thuộc nhánh unit của OKR
      -- (unit_path của user là ancestor, chính nó, hoặc descendant của access_path OKR)
      OR (
        o.visibility = 'INTERNAL'
        AND (
          uc.user_unit_path <@ o.access_path   -- user ở unit cha của OKR
          OR uc.user_unit_path @> o.access_path -- user ở unit con của OKR
          OR uc.user_unit_path = o.access_path  -- user ở đúng unit của OKR
        )
      )

      -- PRIVATE: chỉ unit cấp trên (ancestor) hoặc chính owner
      OR (
        o.visibility = 'PRIVATE'
        AND (
          uc.user_unit_path @> o.access_path   -- user ở unit cha (cấp trên)
          OR o.owner_id = uc.user_id            -- chính là owner
        )
      )
    )
),

-- KPI mà user được phép xem
visible_kpis AS (
  SELECT
    k.id,
    k.unit_id,
    k.progress_percentage
  FROM "KPIAssignments" k, user_context uc
  WHERE
    k.deleted_at IS NULL
    AND (
      uc.user_role = 'ADMIN_COMPANY'
      OR k.visibility = 'PUBLIC'
      OR (
        k.visibility = 'INTERNAL'
        AND (
          uc.user_unit_path <@ k.access_path
          OR uc.user_unit_path @> k.access_path
          OR uc.user_unit_path = k.access_path
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

-- Tổng hợp OKR theo unit
okr_stats AS (
  SELECT
    unit_id,
    COUNT(*)                  AS total_okrs,
    AVG(progress_percentage)  AS avg_okr_progress
  FROM visible_objectives
  WHERE unit_id IS NOT NULL
  GROUP BY unit_id
),

-- Tổng hợp KPI theo unit
kpi_stats AS (
  SELECT
    unit_id,
    COUNT(*)                  AS total_kpis,
    AVG(progress_percentage)  AS avg_kpi_progress
  FROM visible_kpis
  GROUP BY unit_id
),

-- Đếm user thuộc từng unit (bao gồm user của chính unit đó và tất cả sub-units)
user_stats AS (
  SELECT
    parent_unit.id AS unit_id,
    COUNT(DISTINCT u.id) AS total_users
  FROM "Units" parent_unit
  -- Join với các unit con (ltree @> check xem parent có chứa child không)
  JOIN "Units" child_unit ON parent_unit.path @> child_unit.path
  -- Join user thuộc các unit con đó
  JOIN "Users" u ON u.unit_id = child_unit.id
  WHERE
    u.deleted_at IS NULL
    AND u.is_active = true
    AND parent_unit.deleted_at IS NULL
    AND child_unit.deleted_at IS NULL
  GROUP BY parent_unit.id
)

-- Join tất cả vào Units
SELECT
  un.id                                           AS unit_id,
  un.company_id,
  un.name,
  un.parent_id,
  un.manager_id,
  un.path,

  -- User stats (không phụ thuộc permission — ai cũng thấy số lượng member)
  COALESCE(us.total_users, 0)                     AS total_users,

  -- OKR stats (chỉ tính OKR user được phép xem)
  COALESCE(os.total_okrs, 0)                      AS total_okrs,
  COALESCE(os.avg_okr_progress, 0)                AS avg_okr_progress,

  -- KPI stats (chỉ tính KPI user được phép xem)
  COALESCE(ks.total_kpis, 0)                      AS total_kpis,
  COALESCE(ks.avg_kpi_progress, 0)                AS avg_kpi_progress

FROM "Units" un
LEFT JOIN okr_stats os  ON os.unit_id  = un.id
LEFT JOIN kpi_stats ks  ON ks.unit_id  = un.id
LEFT JOIN user_stats us ON us.unit_id  = un.id
WHERE un.deleted_at IS NULL;