import prisma from "./prisma.js";

const isDescendantOrEqual = (candidate, ancestor) => {
    if (!candidate || !ancestor) return false;
    return candidate === ancestor || candidate.startsWith(`${ancestor}.`);
};

const isAncestorOrEqual = (candidate, descendant) => {
    if (!candidate || !descendant) return false;
    return descendant === candidate || descendant.startsWith(`${candidate}.`);
};

export const getUnitPath = async (unitId) => {
    if (!unitId) return null;
    const rows = await prisma.$queryRaw`
        SELECT path::text AS path
        FROM "Units"
        WHERE id = ${unitId}
    `;
    return rows[0]?.path ?? null;
};

export const getObjectiveAccessPath = async (objectiveId) => {
    if (!objectiveId) return null;
    const rows = await prisma.$queryRaw`
        SELECT access_path::text AS access_path
        FROM "Objectives"
        WHERE id = ${objectiveId}
    `;
    return rows[0]?.access_path ?? null;
};

export const getUnitAncestors = async (unitId) => {
    if (!unitId) return [];
    
    const unitPath = await getUnitPath(unitId);
    if (!unitPath) return [];

    const rows = await prisma.$queryRaw`
        SELECT id
        FROM "Units"
        WHERE path @> ${unitPath}::ltree AND id != ${unitId}
        ORDER BY nlevel(path) DESC
    `;
    
    return rows.map((row) => row.id);
};

export const getUnitDescendants = async (unitId) => {
    if (!unitId) return [];
    
    const unitPath = await getUnitPath(unitId);
    if (!unitPath) return [];
    
    const rows = await prisma.$queryRaw`
        SELECT id
        FROM "Units"
        WHERE path <@ ${unitPath}::ltree AND id != ${unitId}
        ORDER BY nlevel(path) ASC
    `;
    
    return rows.map((row) => row.id);
};


export const isAncestorUnit = async (potentialAncestorId, unitId) => {
    if (!potentialAncestorId || !unitId) return false;
    const ancestorPath = await getUnitPath(potentialAncestorId);
    if (!ancestorPath) return false;
    
    const unitPath = await getUnitPath(unitId);
    if (!unitPath) return false;
    return isDescendantOrEqual(unitPath, ancestorPath);
};

export const getUnitContext = async (unitId) => {
    if (!unitId) {
        return {
            ancestors: [],
            descendants: [],
            lineage: [],
        };
    }

    const ancestors = await getUnitAncestors(unitId);
    const descendants = await getUnitDescendants(unitId);

    const lineage = Array.from(new Set([...ancestors, ...descendants]));
    return { ancestors, descendants, lineage };
};

export const isUnitManager = async (userId, unitId) => {
    if (!userId || !unitId) return false;
    const unit = await prisma.units.findFirst({
        where: { id: unitId },
        select: { manager_id: true },
    });
    return unit?.manager_id === userId;
};

/**
 * Update access_path for Objectives belonging to a specific unit
 * @param {Object} tx - Prisma transaction
 * @param {number} unitId - The unit ID
 * @param {string} newPath - The new path for the unit
 * @returns {Promise<void>}
 */
export const updateObjectivesAccessPathForUnit = async (tx, unitId, newPath) => {
    await tx.$executeRaw`
        UPDATE "Objectives"
        SET access_path = ${newPath}::ltree
        WHERE unit_id = ${unitId} AND deleted_at IS NULL
    `;
};

/**
 * Update access_path for KPIAssignments belonging to a specific unit
 * @param {Object} tx - Prisma transaction
 * @param {number} unitId - The unit ID
 * @param {string} newPath - The new path for the unit
 * @returns {Promise<void>}
 */
export const updateKPIAssignmentsAccessPathForUnit = async (tx, unitId, newPath) => {
    await tx.$executeRaw`
        UPDATE "KPIAssignments"
        SET access_path = ${newPath}::ltree
        WHERE unit_id = ${unitId} AND deleted_at IS NULL
    `;
};

/**
 * Update access_path for all objectives and assignments owned by a user
 * @param {Object} tx - Prisma transaction or prisma client
 * @param {number} userId - The user ID
 * @param {number|null} newUnitId - The new unit ID (null if removed from unit)
 * @returns {Promise<void>}
 */
export const updateAccessPathForUserOwnedItems = async (tx, userId, newUnitId) => {
    if (newUnitId) {
        // Get the new unit's path
        const rows = await tx.$queryRaw`
            SELECT path::text AS path
            FROM "Units"
            WHERE id = ${newUnitId}
        `;
        const newUnitPath = rows[0]?.path;

        if (newUnitPath) {
            // Update Objectives owned by user (only those with unit_id = null, i.e., personal objectives)
            await tx.$executeRaw`
                UPDATE "Objectives"
                SET access_path = ${newUnitPath}::ltree
                WHERE owner_id = ${userId} AND unit_id IS NULL AND deleted_at IS NULL
            `;

            // Update KPIAssignments owned by user (only those with unit_id = null)
            await tx.$executeRaw`
                UPDATE "KPIAssignments"
                SET access_path = ${newUnitPath}::ltree
                WHERE owner_id = ${userId} AND unit_id IS NULL AND deleted_at IS NULL
            `;
        }
    } else {
        // User removed from unit - set access_path to 'company' for personal items
        await tx.$executeRaw`
            UPDATE "Objectives"
            SET access_path = 'company'::ltree
            WHERE owner_id = ${userId} AND unit_id IS NULL AND deleted_at IS NULL
        `;

        await tx.$executeRaw`
            UPDATE "KPIAssignments"
            SET access_path = 'company'::ltree
            WHERE owner_id = ${userId} AND unit_id IS NULL AND deleted_at IS NULL
        `;
    }
};

export default {
    getUnitPath,
    getObjectiveAccessPath,
    getUnitAncestors,
    getUnitDescendants,
    isAncestorUnit,
    getUnitContext,
    isUnitManager,
    updateObjectivesAccessPathForUnit,
    updateKPIAssignmentsAccessPathForUnit,
    updateAccessPathForUserOwnedItems,
};
