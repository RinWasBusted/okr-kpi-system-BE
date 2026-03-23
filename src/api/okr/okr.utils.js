import prisma from "../../utils/prisma.js";
import AppError from "../../utils/appError.js";
import { UserRole } from "@prisma/client";
import requestContext from "../../utils/context.js";

export const toDateOnlyUtc = (date) =>
    new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

export const daysBetweenUtc = (endDate, startDate) => {
    const end = toDateOnlyUtc(endDate);
    const start = toDateOnlyUtc(startDate);
    const diffMs = end.getTime() - start.getTime();
    return Math.floor(diffMs / (24 * 60 * 60 * 1000));
};

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
    
    // Tìm tất cả units có path chứa unit path (ancestors)
    const ancestors = await prisma.units.findMany({
        where: {
            path: {
                // Sử dụng ltree operator: @> (contains)
                // Cú pháp: path @> unitPath::ltree
                // Nhưng Prisma không hỗ trợ trực tiếp, nên dùng raw query
            },
        },
        select: { id: true },
    });

    // Dùng raw query để sử dụng ltree operator
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
    
    // Dùng raw query để sử dụng ltree operator
    // path <@ unitPath::ltree (path được chứa bởi unitPath - descendants)
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

export const canViewObjective = async (user, objective, unitContext) => {
    if (!objective) return false;
    if (user.role === UserRole.ADMIN_COMPANY) return true;

    if (objective.visibility === "PUBLIC") return true;

    const userPath = unitContext || (user.unit_id ? await getUnitPath(user.unit_id) : null);
    const objectivePath =
        objective.access_path ?? (objective.id ? await getObjectiveAccessPath(objective.id) : null);

    if (objective.visibility === "INTERNAL") {
        if (!objectivePath || !userPath) return false;
        return (
            isAncestorOrEqual(objectivePath, userPath) ||
            isDescendantOrEqual(objectivePath, userPath)
        );
    }

    if (objective.visibility === "PRIVATE") {
        if (objective.owner_id === user.id) return true;
        if (!objectivePath || !userPath) return false;
        return objectivePath !== userPath && isDescendantOrEqual(objectivePath, userPath);
    }

    return false;
};

export const canEditObjective = async (user, objective) => {
    if (!objective) return false;
    if (user.role === UserRole.ADMIN_COMPANY) return true;
    if (objective.owner_id && objective.owner_id === user.id) return true;
    if (objective.unit_id && await isUnitManager(user.id, objective.unit_id)) return true;
    return false;
};

export const canApproveObjective = async (user, objective) => {
    if (!objective) return false;
    if (user.role === UserRole.ADMIN_COMPANY) return true;
    if (!user.unit_id) return false;

    const userPath = await getUnitPath(user.unit_id);
    const objectivePath = objective.access_path ?? (objective.id ? await getObjectiveAccessPath(objective.id) : null);
    
    if (!userPath || !objectivePath) return false;
    return objectivePath !== userPath && isDescendantOrEqual(objectivePath, userPath);
};

export const ensureCycleUnlocked = async (cycleId) => {
    const cycle = await prisma.cycles.findFirst({
        where: { id: cycleId },
        select: { is_locked: true },
    });

    if (!cycle) throw new AppError("Cycle not found", 404);
    if (cycle.is_locked) throw new AppError("Cycle is locked", 403, "CYCLE_LOCKED");
};

export const calculateKeyResultProgress = (currentValue, targetValue) => {
    const target = Number(targetValue);
    const current = Number(currentValue);
    if (!Number.isFinite(target) || target === 0) return 0;
    if (!Number.isFinite(current)) return 0;
    return (current / target) * 100;
};

export const recalculateObjectiveProgress = async (objectiveId) => {
    const keyResults = await prisma.keyResults.findMany({
        where: { objective_id: objectiveId },
        select: { progress_percentage: true, weight: true },
    });

    const progress = keyResults.reduce(
        (sum, kr) => sum + (kr.progress_percentage * kr.weight) / 100,
        0,
    );

    await prisma.objectives.update({
        where: { id: objectiveId },
        data: { progress_percentage: progress },
    });

    return progress;
};
