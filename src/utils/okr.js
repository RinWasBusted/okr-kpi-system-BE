import prisma from "./prisma.js";
import AppError from "./appError.js";
import { UserRole } from "@prisma/client";
import { getUnitPath, getObjectiveAccessPath, isAncestorUnit, isUnitManager } from "./path.js";

const isDescendantOrEqual = (candidate, ancestor) => {
    if (!candidate || !ancestor) return false;
    return candidate === ancestor || candidate.startsWith(`${ancestor}.`);
};

const isAncestorOrEqual = (candidate, descendant) => {
    if (!candidate || !descendant) return false;
    return descendant === candidate || descendant.startsWith(`${candidate}.`);
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

// Calculate progress status based on progress_percentage
// Returns ProgressStatus enum values
const calculateProgressStatus = (progress) => {
    const p = Number(progress) || 0;
    if (p === 0) return "NOT_STARTED";
    if (p >= 100) return "COMPLETED";
    if (p >= 80) return "ON_TRACK";
    if (p >= 30) return "AT_RISK";
    return "CRITICAL";
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

    // Get current objective status
    const objective = await prisma.objectives.findUnique({
        where: { id: objectiveId },
        select: { status: true },
    });

    // Only update status if objective is in a progress-based status (not Draft, Pending_Approval, or Rejected)
    const progressBasedStatuses = ["NOT_STARTED", "ON_TRACK", "AT_RISK", "CRITICAL", "COMPLETED"];
    const updateData = { progress_percentage: progress };

    if (progressBasedStatuses.includes(objective?.status)) {
        const newStatus = calculateProgressStatus(progress);
        updateData.status = newStatus;
    }

    await prisma.objectives.update({
        where: { id: objectiveId },
        data: updateData,
    });

    return progress;
};

export default {
    canViewObjective,
    canEditObjective,
    canApproveObjective,
    ensureCycleUnlocked,
    calculateKeyResultProgress,
    recalculateObjectiveProgress,
};