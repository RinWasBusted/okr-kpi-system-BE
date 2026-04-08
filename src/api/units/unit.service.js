import prisma from "../../utils/prisma.js";
import AppError from "../../utils/appError.js";
import { UserRole } from "@prisma/client";
import { getCloudinaryImageUrl } from "../../utils/cloudinary.js";
import {
    getUnitPath,
    updateObjectivesAccessPathForUnit,
    updateKPIAssignmentsAccessPathForUnit,
    updateAccessPathForUserOwnedItems,
} from "../../utils/path.js";


const formatUnitRow = (row, includeStats = false, currentUser = null) => {
    const isAdmin = currentUser?.role === UserRole.ADMIN_COMPANY;
    const isManager = currentUser?.id === row.manager_id;

    const base = {
        id: row.id,
        name: row.name,
        parent_id: row.parent_id ?? null,
        path: row.path,
        manager: row.manager_id
            ? { id: row.manager_id, full_name: row.manager_full_name }
            : null,
        member_count: Number(row.member_count ?? 0),
        created_at: row.created_at,
    };

    if (includeStats) {
        base.okr_count = Number(row.okr_count ?? 0);
        base.kpi_count = Number(row.kpi_count ?? 0);
        base.okr_progress = row.okr_progress !== null ? Number(row.okr_progress) : null;
        base.kpi_health = row.kpi_health !== null ? Number(row.kpi_health) : null;
    }

    // Only add permission for ADMIN_COMPANY
    if (isAdmin) {
        base.permission = {
            editable: true,
            deletable: true,
        };
    }

    return base;
};

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

export const listUnits = async ({ page, per_page, mode = "tree" }, currentUser) => {
    return prisma.$transaction(async (tx) => {
        const allUnits = await tx.$queryRaw`
            SELECT
                u.id,
                u.name,
                u.parent_id,
                u.path::text AS path,
                u.created_at,
                m.id AS manager_id,
                m.full_name AS manager_full_name,
                COALESCE(up.total_users, 0) AS member_count,
                COALESCE(up.total_okrs, 0) AS okr_count,
                COALESCE(up.total_kpis, 0) AS kpi_count,
                COALESCE(up.avg_okr_progress, 0) AS okr_progress,
                COALESCE(up.avg_kpi_progress, 0) AS kpi_health
            FROM "Units" u
            LEFT JOIN "Users" m ON m.id = u.manager_id
            LEFT JOIN unit_performance up ON up.unit_id = u.id
            ORDER BY u.id ASC
        `;

        // Flat list mode: return all units as flat list with pagination
        if (mode === "list") {
            const total = allUnits.length;
            const offset = (page - 1) * per_page;
            const paginatedUnits = allUnits.slice(offset, offset + per_page);

            return {
                total,
                data: paginatedUnits.map((unit) => formatUnitRow(unit, true, currentUser)),
            };
        }

        // Tree mode: build tree structure (default behavior)
        const unitsMap = new Map();
        const formattedUnits = allUnits.map((unit) => ({
            ...formatUnitRow(unit, true, currentUser),
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
    return prisma.$transaction(async (tx) => {
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
                  AND role != ${UserRole.ADMIN}::"UserRole"
                LIMIT 1
            `;
            if (manager.length === 0) throw new AppError("Manager not found or is not eligible to be assigned as a unit manager", 404);

            // Check if manager is already managing another unit, if so, remove them from that unit
            const currentManagedUnit = await tx.$queryRaw`
                SELECT id FROM "Units" WHERE manager_id = ${manager_id} LIMIT 1
            `;
            if (currentManagedUnit.length > 0) {
                const oldUnitId = currentManagedUnit[0].id;
                await tx.$executeRaw`
                    UPDATE "Units" SET manager_id = null WHERE id = ${oldUnitId}
                `;
                // Update unit_id for the old manager's user record
                await tx.$executeRaw`
                    UPDATE "Users" SET unit_id = null WHERE id = ${manager_id}
                `;
                // Update access_path for old manager's owned items
                await updateAccessPathForUserOwnedItems(tx, manager_id, null);
            }
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
    return prisma.$transaction(async (tx) => {
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
                WHERE id = ${manager_id}
                  AND role != ${UserRole.ADMIN}::"UserRole"
                LIMIT 1
            `;
            if (manager.length === 0) throw new AppError("Manager not found or is not eligible to be assigned as a unit manager", 404);

            // Check if manager is already managing another unit (not this unit)
            const currentManagedUnit = await tx.$queryRaw`
                SELECT id FROM "Units" WHERE manager_id = ${manager_id} AND id != ${unitId} LIMIT 1
            `;
            if (currentManagedUnit.length > 0) {
                const oldUnitId = currentManagedUnit[0].id;
                await tx.$executeRaw`
                    UPDATE "Units" SET manager_id = null WHERE id = ${oldUnitId}
                `;
                // Update unit_id for the old manager's user record
                await tx.$executeRaw`
                    UPDATE "Users" SET unit_id = null WHERE id = ${manager_id}
                `;
                // Update access_path for old manager's owned items
                await updateAccessPathForUserOwnedItems(tx, manager_id, null);
            }
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
                // Update access_path for old manager's owned items (now without unit)
                await updateAccessPathForUserOwnedItems(tx, oldManagerId, null);
            }
            if (newManagerId !== null) {
                await tx.$executeRaw`
                    UPDATE "Users" SET unit_id = ${unitId} WHERE id = ${newManagerId}
                `;
                // Update access_path for new manager's owned items (now with this unit)
                await updateAccessPathForUserOwnedItems(tx, newManagerId, unitId);
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

            // Update access_path for Objectives and KPIAssignments of affected units
            // Get all affected units (the updated unit and its descendants)
            const affectedUnits = await tx.$queryRaw`
                SELECT id, path::text AS path
                FROM "Units"
                WHERE path <@ ${newPath}::ltree
            `;

            for (const unit of affectedUnits) {
                await updateObjectivesAccessPathForUnit(tx, unit.id, unit.path);
                await updateKPIAssignmentsAccessPathForUnit(tx, unit.id, unit.path);
            }
        }

        const unitRow = await getUnitRowById(tx, unitId);
        return formatUnitRow(unitRow);
    });
};

// ─── Delete ───────────────────────────────────────────────────────────────────

export const deleteUnit = async (unitId) => {
    return prisma.$transaction(async (tx) => {
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

// ─── Info (lightweight) ───────────────────────────────────────────────────────

export const getUnitInfo = async (unitId) => {
    return prisma.$transaction(async (tx) => {
        const rows = await tx.$queryRaw`
            SELECT
                u.id,
                u.name AS unit_name,
                m.full_name AS manager_name,
                m.job_title AS manager_job_title,
                m.email AS manager_email
            FROM "Units" u
            LEFT JOIN "Users" m ON m.id = u.manager_id
            WHERE u.id = ${unitId}
        `;

        if (rows.length === 0) throw new AppError("Unit not found", 404);

        const unit = rows[0];
        return {
            unit_id: unit.id,
            unit_name: unit.unit_name,
            manager_name: unit.manager_name ?? null,
            manager_job_title: unit.manager_job_title ?? null,
            manager_email: unit.manager_email ?? null,
        };
    });
};

// ─── Detail ───────────────────────────────────────────────────────────────────

export const getUnitDetail = async (unitId, currentUser) => {
    return prisma.$transaction(async (tx) => {
        const rows = await tx.$queryRaw`
            SELECT
                u.id,
                u.name,
                u.parent_id,
                u.path::text AS path,
                u.created_at,
                m.id AS manager_id,
                m.full_name AS manager_full_name,
                m.email AS manager_email,
                m.avatar_url,
                m.job_title,
                COALESCE(up.total_users, 0) AS member_count,
                COALESCE(up.total_kpis, 0) AS kpi_count,
                COALESCE(up.total_okrs, 0) AS okr_count,
                COALESCE(up.avg_okr_progress, 0) AS okr_progress,
                COALESCE(up.avg_kpi_progress, 0) AS kpi_health
            FROM "Units" u
            LEFT JOIN "Users" m ON m.id = u.manager_id
            LEFT JOIN unit_performance up ON up.unit_id = u.id
            WHERE u.id = ${unitId}
        `;

        if (rows.length === 0) throw new AppError("Unit not found", 404);
        const unit = rows[0];

        const isAdmin = currentUser?.role === UserRole.ADMIN_COMPANY;

        const result = {
            id: unit.id,
            name: unit.name,
            parent_id: unit.parent_id ?? null,
            path: unit.path,
            manager: unit.manager_id
                ? {
                    id: unit.manager_id,
                    full_name: unit.manager_full_name,
                    email: unit.manager_email,
                    avatar_url: unit.avatar_url
                        ? getCloudinaryImageUrl(unit.avatar_url, 50, 50, "fill")
                        : null,
                    job_title: unit.job_title,
                  }
                : null,
            member_count: Number(unit.member_count ?? 0),
            okr_count: Number(unit.okr_count ?? 0),
            kpi_count: Number(unit.kpi_count ?? 0),
            okr_progress: unit.okr_progress !== null ? Number(unit.okr_progress) : null,
            kpi_health: unit.kpi_health !== null ? Number(unit.kpi_health) : null,
            created_at: unit.created_at,
        };

        // Only add permission for ADMIN_COMPANY
        if (isAdmin) {
            result.permission = {
                editable: true,
                deletable: true,
            };
        }

        return result;
    });
};
