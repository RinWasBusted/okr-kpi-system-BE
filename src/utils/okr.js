import prisma from "./prisma.js";
import AppError from "./appError.js";
import { UserRole } from "@prisma/client";
import {
  getUnitPath,
  getObjectiveAccessPath,
  isAncestorUnit,
  isUnitManager,
} from "./path.js";

/**
 * Calculate expected progress percentage based on time elapsed in cycle.
 * Used for OKR to determine if objective is on track relative to timeline.
 *
 * @param {Date} cycleStart - Cycle start date
 * @param {Date} cycleEnd - Cycle end date
 * @param {Date} now - Current date (default: new Date())
 * @returns {number} Expected progress percentage (0-100)
 *
 * @example
 * // Cycle: Jan 1 - Jan 31, Today: Jan 16 → Expected: ~50%
 */
export const calculateExpectedProgress = (cycleStart, cycleEnd, now = new Date()) => {
  const start = new Date(cycleStart).getTime();
  const end = new Date(cycleEnd).getTime();
  const current = now.getTime();

  // Cycle hasn't started yet
  if (current <= start) return 0;

  // Cycle has ended
  if (current >= end) return 100;

  // Calculate percentage of time elapsed
  const totalDuration = end - start;
  if (totalDuration <= 0) return 100; // Default to 100 if dates are invalid or start >= end

  const elapsed = current - start;
  const progress = (elapsed / totalDuration) * 100;

  return Math.max(0, Math.min(100, Math.round(progress)));
};

/**
 * Calculate OKR progress status based on actual progress vs expected progress.
 * Compares current completion % with expected % based on time elapsed.
 *
 * @param {number} actualProgress - Current progress percentage (0-100)
 * @param {number} expectedProgress - Expected progress based on time elapsed (0-100)
 * @returns {string} ProgressStatus enum value
 *
 * Logic:
 * - NOT_STARTED: 0% completion
 * - COMPLETED: 100% completion
 * - ON_TRACK: actual >= expected (tiến độ đạt hoặc vượt kỳ vọng)
 * - AT_RISK: actual >= expected - 20% (chậm 1 chút, trong ngưỡng cho phép)
 * - CRITICAL: actual < expected - 20% (chậm nhiều, cần can thiệp)
 */
export const calculateOKRProgressStatus = (actualProgress, expectedProgress) => {
  const actual = Number(actualProgress) || 0;

  if (actual === 0) return "NOT_STARTED";
  if (actual >= 100) return "COMPLETED";

  const expected = Number(expectedProgress) || 0;
  const tolerance = 20; // Ngưỡng chấp nhận được (20%)

  // So sánh thực tế với kỳ vọng
  if (actual >= expected) {
    // Tiến độ đạt hoặc vượt kỳ vọng theo thời gian
    return "ON_TRACK";
  } else if (actual >= expected - tolerance) {
    // Chậm hơn kỳ vọng nhưng trong ngưỡng cho phép (20%)
    return "AT_RISK";
  } else {
    // Chậm nhiều so với kỳ vọng
    return "CRITICAL";
  }
};

const isDescendantOrEqual = (candidate, ancestor) => {
  if (!candidate || !ancestor) return false;
  return candidate === ancestor || candidate.startsWith(`${ancestor}.`);
};

const isAncestorOrEqual = (candidate, descendant) => {
  if (!candidate || !descendant) return false;
  return descendant === candidate || descendant.startsWith(`${candidate}.`);
};

/**
 * Check if user is owner of any ancestor objective in the hierarchy
 * @param {number} userId - The user ID
 * @param {number} objectiveId - The objective ID to check
 * @returns {Promise<boolean>} - True if user owns any ancestor objective
 */
const isOwnerOfAncestorObjective = async (userId, objectiveId) => {
  if (!userId || !objectiveId) return false;

  // Query to find all ancestor objectives and check if user is owner of any
  const ancestors = await prisma.$queryRaw`
        WITH RECURSIVE objective_ancestors AS (
            -- Base case: start from the given objective
            SELECT id, parent_objective_id, owner_id
            FROM "Objectives"
            WHERE id = ${objectiveId}
              AND deleted_at IS NULL

            UNION ALL

            -- Recursive case: join with parent objectives
            SELECT o.id, o.parent_objective_id, o.owner_id
            FROM "Objectives" o
            INNER JOIN objective_ancestors oa ON o.id = oa.parent_objective_id
            WHERE o.deleted_at IS NULL
        )
        SELECT 1
        FROM objective_ancestors
        WHERE owner_id = ${userId}
          AND id != ${objectiveId}
        LIMIT 1
    `;

  return ancestors.length > 0;
};

export const canViewObjective = async (user, objective, unitContext) => {
  if (!objective) return false;
  if (user.role === UserRole.ADMIN_COMPANY) return true;

  // Keep permission model consistent: if user can edit, user can always view.
  if (objective.owner_id && objective.owner_id === user.id) return true;
  if (objective.unit_id && (await isUnitManager(user.id, objective.unit_id)))
    return true;

  if (objective.visibility === "PUBLIC") return true;

  const userPath =
    unitContext || (user.unit_id ? await getUnitPath(user.unit_id) : null);
  const objectivePath =
    objective.access_path ??
    (objective.id ? await getObjectiveAccessPath(objective.id) : null);

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
    if (
      objectivePath !== userPath &&
      isDescendantOrEqual(objectivePath, userPath)
    )
      return true;

    // Check if user is owner of any ancestor objective
    if (
      objective.id &&
      (await isOwnerOfAncestorObjective(user.id, objective.id))
    )
      return true;

    return false;
  }

  return false;
};

export const canEditObjective = async (user, objective) => {
  if (!objective) return false;
  if (user.role === UserRole.ADMIN_COMPANY) return true;
  if (objective.owner_id && objective.owner_id === user.id) return true;
  if (objective.unit_id && (await isUnitManager(user.id, objective.unit_id)))
    return true;
  return false;
};

export const canApproveObjective = async (user, objective) => {
  if (!objective) return false;
  if (user.role === UserRole.ADMIN_COMPANY) return true;
  if (!user.unit_id) return false;

  const userPath = await getUnitPath(user.unit_id);
  const objectivePath =
    objective.access_path ??
    (objective.id ? await getObjectiveAccessPath(objective.id) : null);

  if (!userPath || !objectivePath) return false;
  return (
    objectivePath !== userPath && isDescendantOrEqual(objectivePath, userPath)
  );
};

export const ensureCycleUnlocked = async (cycleId, companyId = null) => {
  const cycle = await prisma.cycles.findFirst({
    where: {
      id: cycleId,
      ...(companyId !== null && { company_id: companyId }),
    },
    select: { is_locked: true },
  });

  if (!cycle) throw new AppError("Cycle not found", 404);
  if (cycle.is_locked)
    throw new AppError("Cycle is locked", 403, "CYCLE_LOCKED");
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
export const calculateKeyResultProgress = (
  currentValue,
  targetValue,
  startValue,
  evaluationMethod,
) => {
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
  const boundedProgress = Math.max(0, Math.min(progress, 100));
  // Round to 2 decimal places
  return Math.round(boundedProgress * 100) / 100;
};

/**
 * Calculate KPI progress status based on fixed thresholds.
 * Used for KPI assignments where status is determined by absolute progress values.
 *
 * @param {number} progress - Progress percentage (can be negative or >100%)
 * @returns {string} ProgressStatus enum value
 *
 * Logic:
 * - NOT_STARTED: 0%
 * - COMPLETED: >= 100%
 * - ON_TRACK: >= 80%
 * - AT_RISK: >= 50%
 * - CRITICAL: < 50%
 */
export const calculateKPIProgressStatus = (progress) => {
  const p = Number(progress) || 0;
  if (p === 0) return "NOT_STARTED";
  if (p >= 100) return "COMPLETED";
  if (p >= 80) return "ON_TRACK";
  if (p >= 50) return "AT_RISK";
  return "CRITICAL";
};

export const recalculateObjectiveProgress = async (objectiveId, now = new Date()) => {
  const keyResults = await prisma.keyResults.findMany({
    where: { objective_id: objectiveId },
    select: { progress_percentage: true, weight: true },
  });

  const progress = keyResults.reduce(
    (sum, kr) => sum + (kr.progress_percentage * kr.weight) / 100,
    0,
  );
  // Round to 2 decimal places
  const roundedProgress = Math.round(progress * 100) / 100;

  // Get current objective with cycle info for time-based calculation
  const objective = await prisma.objectives.findUnique({
    where: { id: objectiveId },
    select: {
      status: true,
      cycle: { select: { start_date: true, end_date: true } }
    },
  });

  // Only update status if objective is in a progress-based status (not Draft, Pending_Approval, or Rejected)
  const progressBasedStatuses = [
    "NOT_STARTED",
    "ON_TRACK",
    "AT_RISK",
    "CRITICAL",
    "COMPLETED",
  ];
  const updateData = { progress_percentage: roundedProgress };

  if (progressBasedStatuses.includes(objective?.status)) {
    // For OKR: calculate status based on time elapsed vs actual progress
    const expectedProgress = objective?.cycle?.start_date && objective?.cycle?.end_date
      ? calculateExpectedProgress(objective.cycle.start_date, objective.cycle.end_date, now)
      : roundedProgress; // Fallback: use actual progress if no cycle dates

    const newStatus = calculateOKRProgressStatus(roundedProgress, expectedProgress);
    updateData.status = newStatus;
  }

  await prisma.objectives.update({
    where: { id: objectiveId },
    data: updateData,
  });

  return roundedProgress;
};

export default {
  canViewObjective,
  canEditObjective,
  canApproveObjective,
  ensureCycleUnlocked,
  calculateKeyResultProgress,
  recalculateObjectiveProgress,
  calculateKPIProgressStatus,
  calculateOKRProgressStatus,
  calculateExpectedProgress,
};
