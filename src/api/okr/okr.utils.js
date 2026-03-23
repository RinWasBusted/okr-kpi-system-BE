import prisma from "../../utils/prisma.js";
import AppError from "../../utils/appError.js";
import { UserRole } from "@prisma/client";

export const toDateOnlyUtc = (date) =>
    new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

export const daysBetweenUtc = (endDate, startDate) => {
    const end = toDateOnlyUtc(endDate);
    const start = toDateOnlyUtc(startDate);
    const diffMs = end.getTime() - start.getTime();
    return Math.floor(diffMs / (24 * 60 * 60 * 1000));
};

export const getUnitAncestors = async (unitId) => {
    if (!unitId) return [];
    const ancestors = [];
    const visited = new Set();
    let currentId = unitId;

    while (currentId !== null && currentId !== undefined) {
        if (visited.has(currentId)) break;
        visited.add(currentId);
        ancestors.push(currentId);

        const unit = await prisma.units.findFirst({
            where: { id: currentId },
            select: { parent_id: true },
        });

        currentId = unit?.parent_id ?? null;
    }

    return ancestors;
};

export const getUnitDescendants = async (unitId) => {
    if (!unitId) return [];
    const descendants = [];
    let frontier = [unitId];

    while (frontier.length > 0) {
        const children = await prisma.units.findMany({
            where: { parent_id: { in: frontier } },
            select: { id: true },
        });

        const childIds = children.map((child) => child.id);
        if (childIds.length === 0) break;

        descendants.push(...childIds);
        frontier = childIds;
    }

    return descendants;
};

export const isAncestorUnit = async (potentialAncestorId, unitId) => {
    if (!potentialAncestorId || !unitId) return false;
    let currentId = unitId;
    const visited = new Set();

    while (currentId !== null && currentId !== undefined) {
        if (visited.has(currentId)) break;
        visited.add(currentId);

        if (currentId === potentialAncestorId) return true;

        const unit = await prisma.units.findFirst({
            where: { id: currentId },
            select: { parent_id: true },
        });

        currentId = unit?.parent_id ?? null;
    }

    return false;
};

export const getUnitContext = async (unitId) => {
    if (!unitId) {
        return {
            ancestors: [],
            descendants: [],
            lineage: [],
        };
    }

    const [ancestors, descendants] = await Promise.all([
        getUnitAncestors(unitId),
        getUnitDescendants(unitId),
    ]);

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

    const context = unitContext || (user.unit_id ? await getUnitContext(user.unit_id) : null);

    if (objective.visibility === "INTERNAL") {
        if (!objective.unit_id || !context) return false;
        return context.lineage.includes(objective.unit_id);
    }

    if (objective.visibility === "PRIVATE") {
        if (objective.owner_id === user.id) return true;
        if (!objective.unit_id || !context) return false;
        return context.descendants.includes(objective.unit_id);
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
    if (!user.unit_id || !objective.unit_id) return false;

    const isAncestor = await isAncestorUnit(user.unit_id, objective.unit_id);
    return isAncestor && user.unit_id !== objective.unit_id;
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
