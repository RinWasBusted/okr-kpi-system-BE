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

/**
 * Calculate progress percentage for Key Results.
 * Uses the same formulas as KPI but bounded between 0% and 100%.
 *
 * @param {number} currentValue - The current actual value
 * @param {number} targetValue - The target goal value
 * @param {number} startValue - The baseline value at creation (from KeyResult.start_value)
 * @param {string} evaluationMethod - The evaluation method: MAXIMIZE, MINIMIZE, or TARGET
 * @returns {number} Progress percentage (bounded 0-100%)
 *
 * @example
 * // MAXIMIZE: Sales target (start: 0, target: 100, current: 50) → 50%
 * // MINIMIZE: Defect reduction (start: 100, target: 20, current: 60) → 50%
 * // TARGET: Temperature control (start: 20, target: 25, current: 22.5) → 50%
 */
export const calculateKeyResultProgress = (currentValue, targetValue, startValue, evaluationMethod) => {
    // Explicitly convert to numbers to handle Decimal/string types from Prisma
    const actual = parseFloat(currentValue);
    const target = parseFloat(targetValue);
    const start = parseFloat(startValue);

    // Validate inputs
    if (isNaN(actual) || isNaN(target) || isNaN(start)) {
        return 0;
    }

    // Edge case: start equals target
    if (start === target) {
        return actual === target ? 100 : 0;
    }

    let progress = 0;

    switch (evaluationMethod) {
        case "MAXIMIZE":
            // Higher is better. Formula: (actual - start) / (target - start) * 100
            // Example: start=0, target=100, actual=50 → 50%
            progress = ((actual - start) / (target - start)) * 100;
            break;

        case "MINIMIZE":
            // Lower is better. Formula: (start - actual) / (start - target) * 100
            // Example: start=100, target=20, actual=60 → 50%
            progress = ((start - actual) / (start - target)) * 100;
            break;

        case "TARGET":
            // Closer to target is better. Formula: (1 - |actual - target| / |start - target|) * 100
            // Example: start=20, target=25, actual=22.5 → 50%
            // Symmetric: actual=8 and actual=12 with target=10 are equally off
            const deviation = Math.abs(actual - target);
            const maxDeviation = Math.abs(start - target);
            if (maxDeviation === 0) {
                return actual === target ? 100 : 0;
            }
            progress = (1 - deviation / maxDeviation) * 100;
            break;

        default:
            // Fallback to MAXIMIZE behavior for unknown methods
            progress = ((actual - start) / (target - start)) * 100;
    }

    // Bound between 0% and 100% for Key Results
    return Math.max(0, Math.min(progress, 100));
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