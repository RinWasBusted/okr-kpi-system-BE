import prisma from "../../utils/prisma.js";
import AppError from "../../utils/appError.js";
import { UserRole } from "@prisma/client";
import requestContext from "../../utils/context.js";

const withContext = async (fn) => {
    const store = requestContext.getStore();
    const company_id = store?.company_id ?? "";
    const role = store?.role ?? "";

    return prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.current_company_id', ${String(company_id)}, true);`;
        await tx.$executeRaw`SELECT set_config('app.user_role', ${String(role)}, true);`;
        return fn(tx);
    });
};

const formatUnitRow = (row) => ({
    id: row.id,
    name: row.name,
    parent_id: row.parent_id ?? null,
    path: row.path,
    manager: row.manager_id
        ? { id: row.manager_id, full_name: row.manager_full_name }
        : null,
    member_count: Number(row.member_count ?? 0),
    created_at: row.created_at,
});

const getUnitCore = async (tx, unitId) => {
    const rows = await tx.$queryRaw`
        SELECT id, parent_id, manager_id, path::text AS path
        FROM "Units"
        WHERE id = ${unitId}
    `;
    return rows[0] ?? null;
};

const getUnitRowById = async (tx, unitId) => {
    const rows = await tx.$queryRaw`
        SELECT
            u.id,
            u.name,
            u.parent_id,
            u.path::text AS path,
            u.created_at,
            m.id AS manager_id,
            m.full_name AS manager_full_name,
            COUNT(uu.id) AS member_count
        FROM "Units" u
        LEFT JOIN "Users" m ON m.id = u.manager_id
        LEFT JOIN "Users" uu ON uu.unit_id = u.id
        WHERE u.id = ${unitId}
        GROUP BY
            u.id,
            u.name,
            u.parent_id,
            u.path,
            u.created_at,
            m.id,
            m.full_name
    `;
    return rows[0] ?? null;
};

// ─── List ────────────────────────────────────────────────────────────────────

export const listUnits = async ({ page, per_page }) => {
    return withContext(async (tx) => {
        // Get all units (no pagination for tree building)
        const allUnits = await tx.$queryRaw`
            SELECT
                u.id,
                u.name,
                u.parent_id,
                u.path::text AS path,
                u.created_at,
                m.id AS manager_id,
                m.full_name AS manager_full_name,
                COUNT(uu.id) AS member_count
            FROM "Units" u
            LEFT JOIN "Users" m ON m.id = u.manager_id
            LEFT JOIN "Users" uu ON uu.unit_id = u.id
            GROUP BY
                u.id,
                u.name,
                u.parent_id,
                u.path,
                u.created_at,
                m.id,
                m.full_name
            ORDER BY u.id ASC
        `;

        // Build tree structure
        const unitsMap = new Map();
        const formattedUnits = allUnits.map((unit) => ({
            ...formatUnitRow(unit),
            sub_units: [],
        }));

        // Create map for quick lookup
        formattedUnits.forEach((unit) => {
            unitsMap.set(unit.id, unit);
        });

        // Build parent-child relationships
        const rootUnits = [];
        formattedUnits.forEach((unit) => {
            if (unit.parent_id === null) {
                rootUnits.push(unit);
            } else {
                const parent = unitsMap.get(unit.parent_id);
                if (parent) {
                    parent.sub_units.push(unit);
                }
            }
        });

        // Apply pagination to root units
        const offset = (page - 1) * per_page;
        const paginatedRoots = rootUnits.slice(offset, offset + per_page);

        return {
            total: rootUnits.length,
            data: paginatedRoots,
        };
    });
};

// ─── Create ───────────────────────────────────────────────────────────────────

export const createUnit = async (companyId, { name, parent_id, manager_id }) => {
    return withContext(async (tx) => {
        let parentPath = null;

        if (parent_id !== undefined && parent_id !== null) {
            const parent = await getUnitCore(tx, parent_id);
            if (!parent) throw new AppError("Parent unit not found", 404);
            parentPath = parent.path;
        }

        if (manager_id !== undefined && manager_id !== null) {
            const manager = await tx.$queryRaw`
                SELECT id
                FROM "Users"
                WHERE id = ${manager_id} 
                LIMIT 1
            `;
            if (manager.length === 0) throw new AppError("Manager not found in this company", 404);
        }

        const nextIdRows = await tx.$queryRaw`
            SELECT nextval(pg_get_serial_sequence('"Units"', 'id'))::int AS id
        `;
        const nextId = nextIdRows[0]?.id;
        if (!nextId) throw new AppError("Failed to allocate unit ID", 500);

        const path = parentPath ? `${parentPath}.${nextId}` : `${nextId}`;

        await tx.$executeRaw`
            INSERT INTO "Units" (id, company_id, name, parent_id, manager_id, path)
            VALUES (${nextId}, ${companyId}, ${name}, ${parent_id ?? null}, ${manager_id ?? null}, ${path}::ltree)
        `;

        if (manager_id !== undefined && manager_id !== null) {
            await tx.$executeRaw`
                UPDATE "Users"
                SET unit_id = ${nextId}
                WHERE id = ${manager_id}
            `;
        }

        const unitRow = await getUnitRowById(tx, nextId);
        return formatUnitRow(unitRow);
    });
};

// ─── Update ───────────────────────────────────────────────────────────────────

export const updateUnit = async (unitId, { name, parent_id, manager_id }) => {
    return withContext(async (tx) => {
        const existing = await getUnitCore(tx, unitId);
        if (!existing) throw new AppError("Unit not found", 404);

        let parentPath = null;

        if (parent_id !== undefined && parent_id !== null) {
            if (parent_id === unitId) throw new AppError("Unit cannot be its own parent", 400);

            const parent = await getUnitCore(tx, parent_id);
            if (!parent) throw new AppError("Parent unit not found", 404);
            parentPath = parent.path;

            if (parentPath === existing.path || parentPath.startsWith(`${existing.path}.`)) {
                throw new AppError("Circular unit hierarchy is not allowed", 400);
            }
        }

        if (manager_id !== undefined && manager_id !== null) {
            const manager = await tx.$queryRaw`
                SELECT id
                FROM "Users"
                WHERE id = ${manager_id} AND role = ${UserRole.EMPLOYEE}
                LIMIT 1
            `;
            if (manager.length === 0) throw new AppError("Manager not found in this company", 404);
        }

        const nameProvided = name !== undefined && name !== null;
        const parentProvided = parent_id !== undefined;
        const managerProvided = manager_id !== undefined;

        const oldManagerId = existing.manager_id ?? null;
        const newManagerId = managerProvided ? (manager_id ?? null) : oldManagerId;

        await tx.$executeRaw`
            UPDATE "Units"
            SET
                name = CASE WHEN ${nameProvided} THEN ${name} ELSE name END,
                parent_id = CASE WHEN ${parentProvided} THEN ${parent_id ?? null} ELSE parent_id END,
                manager_id = CASE WHEN ${managerProvided} THEN ${manager_id ?? null} ELSE manager_id END
            WHERE id = ${unitId}
        `;

        if (managerProvided && newManagerId !== oldManagerId) {
            if (oldManagerId !== null) {
                await tx.$executeRaw`
                    UPDATE "Users" SET unit_id = null WHERE id = ${oldManagerId}
                `;
            }
            if (newManagerId !== null) {
                await tx.$executeRaw`
                    UPDATE "Users" SET unit_id = ${unitId} WHERE id = ${newManagerId}
                `;
            }
        }

        const parentChanged =
            parentProvided && (parent_id ?? null) !== (existing.parent_id ?? null);

        if (parentChanged) {
            const newPath = parent_id === null ? `${unitId}` : `${parentPath}.${unitId}`;
            const oldPath = existing.path;

            await tx.$executeRaw`
                UPDATE "Units"
                SET path = CASE
                    WHEN path = ${oldPath}::ltree THEN ${newPath}::ltree
                    ELSE ${newPath}::ltree || subpath(path, nlevel(${oldPath}::ltree))
                END
                WHERE path <@ ${oldPath}::ltree
            `;
        }

        const unitRow = await getUnitRowById(tx, unitId);
        return formatUnitRow(unitRow);
    });
};

// ─── Delete ───────────────────────────────────────────────────────────────────

export const deleteUnit = async (unitId) => {
    return withContext(async (tx) => {
        const rows = await tx.$queryRaw`
            SELECT
                u.id,
                (SELECT COUNT(*) FROM "Users" uu WHERE uu.unit_id = u.id) AS member_count,
                (SELECT COUNT(*) FROM "Units" c WHERE c.parent_id = u.id) AS child_count
            FROM "Units" u
            WHERE u.id = ${unitId}
        `;

        const unit = rows[0];
        if (!unit) throw new AppError("Unit not found", 404);
        if (Number(unit.member_count) > 0) {
            throw new AppError("Unit still has members and cannot be deleted", 400);
        }
        if (Number(unit.child_count) > 0) {
            throw new AppError("Unit still has child units and cannot be deleted", 400);
        }

        await tx.$executeRaw`DELETE FROM "Units" WHERE id = ${unitId}`;
    });
};

// ─── Detail ───────────────────────────────────────────────────────────────────

export const getUnitDetail = async (unitId) => {
    return withContext(async (tx) => {
        const rows = await tx.$queryRaw`
            SELECT
                u.id,
                u.name,
                u.parent_id,
                u.created_at,
                m.id AS manager_id,
                m.full_name AS manager_full_name,
                m.email AS manager_email,
                m.avatar_url,
                m.job_title
            FROM "Units" u
            LEFT JOIN "Users" m ON m.id = u.manager_id
            WHERE u.id = ${unitId}
        `;

        if (rows.length === 0) throw new AppError("Unit not found", 404);
        const unit = rows[0];

        // Get total KPI assignments for this unit
        const kpiResult = await tx.$queryRaw`
            SELECT COUNT(*) AS total
            FROM "KPIAssignments"
            WHERE unit_id = ${unitId} AND deleted_at IS NULL
        `;
        const total_kpi = Number(kpiResult[0]?.total ?? 0);

        // Get total objectives for this unit
        const objectiveResult = await tx.$queryRaw`
            SELECT COUNT(*) AS total
            FROM "Objectives"
            WHERE unit_id = ${unitId} AND deleted_at IS NULL
        `;
        const total_objective = Number(objectiveResult[0]?.total ?? 0);

        return {
            id: unit.id,
            name: unit.name,
            parent_id: unit.parent_id ?? null,
            manager: unit.manager_id
                ? {
                    id: unit.manager_id,
                    full_name: unit.manager_full_name,
                    email: unit.manager_email,
                    avatar_url: unit.avatar_url,
                    job_title: unit.job_title,
                  }
                : null,
            total_kpi,
            total_objective,
        };
    });
};
