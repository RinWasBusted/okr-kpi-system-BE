import prisma from "../../../utils/prisma.js";
import AppError from "../../../utils/appError.js";
import { isAncestorUnit } from "../../../utils/path.js";
import { recalculateCurrentValueFromChildren } from "../assignments/assignments.service.js";

const toDateOnlyUtc = (date) =>
    new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

const recordSelect = {
    id: true,
    actual_value: true,
    period_start: true,
    period_end: true,
    progress_percentage: true,
    status: true,
    trend: true,
    created_at: true,
};

const calculateStatus = (progress) => {
    // An toàn (xanh lá): progress >= 80%
    if (progress >= 80) return "ON_TRACK";
    // Chú ý (vàng): 50% <= progress < 80%
    if (progress >= 50) return "AT_RISK";
    // Nguy hiểm (đỏ): progress < 50%
    return "CRITICAL";
};

const calculateTrend = (currentValue, previousValue) => {
    if (previousValue === null || previousValue === undefined) return "Stable";
    const difference = currentValue - previousValue;
    if (difference > 0) return "Upward";
    if (difference < 0) return "Downward";
    return "Stable";
};

export const createKPIRecord = async (user, assignmentId, payload) => {
    const assignment = await prisma.kPIAssignments.findFirst({
        where: { id: assignmentId, deleted_at: null },
        select: {
            id: true,
            target_value: true,
            start_value: true,
            current_value: true,
            unit_id: true,
            owner_id: true,
            parent_assignment_id: true,
            kpi_dictionary: { select: { evaluation_method: true } },
        },
    });

    if (!assignment) throw new AppError("KPI Assignment not found", 404);

    // Check if assignment is a leaf node (no children)
    const hasChildren = await prisma.kPIAssignments.findFirst({
        where: { parent_assignment_id: assignmentId, deleted_at: null },
    });

    if (hasChildren) {
        throw new AppError("Cannot create KPI records for assignment with children", 400);
    }

    // Check permission based on assignment type
    let canCreate = user.role === "ADMIN_COMPANY";

    if (!canCreate) {
        if (assignment.unit_id) {
            // For unit KPI: user from same unit or ancestor units
            const isFromUnit = user.unit_id === assignment.unit_id;
            const isFromAncestorUnit = user.unit_id && user.unit_id !== assignment.unit_id && (await isAncestorUnit(user.unit_id, assignment.unit_id));
            canCreate = isFromUnit || isFromAncestorUnit;
        } else if (assignment.owner_id) {
            // For personal KPI: only the owner or users from ancestor units of owner's unit
            const isOwner = user.id === assignment.owner_id;
            const ownerUnit = await prisma.users.findUnique({
                where: { id: assignment.owner_id },
                select: { unit_id: true },
            });
            const isFromAncestorUnit = user.unit_id && ownerUnit?.unit_id && user.unit_id !== ownerUnit.unit_id && (await isAncestorUnit(user.unit_id, ownerUnit.unit_id));
            canCreate = isOwner || isFromAncestorUnit;
        }
    }

    if (!canCreate) {
        throw new AppError("You do not have permission to create records for this assignment", 403);
    }

    const periodStart = toDateOnlyUtc(payload.period_start);
    const periodEnd = toDateOnlyUtc(payload.period_end);

    if (periodStart > periodEnd) {
        throw new AppError("period_start must be before period_end", 422);
    }

    // Calculate metrics
    const progress = calculateProgress(
        payload.actual_value,
        assignment.target_value,
        assignment.start_value,
        assignment.kpi_dictionary.evaluation_method,
    );

    const status = calculateStatus(progress);

    // Get previous record for trend
    const previousRecord = await prisma.kPIRecords.findFirst({
        where: { kpi_assignment_id: assignmentId },
        orderBy: { created_at: "desc" },
        select: { actual_value: true },
    });

    const trend = calculateTrend(payload.actual_value, previousRecord?.actual_value);

    // Create record
    const record = await prisma.kPIRecords.create({
        data: {
            company_id: user.company_id,
            kpi_assignment_id: assignmentId,
            period_start: periodStart,
            period_end: periodEnd,
            actual_value: payload.actual_value,
            progress_percentage: progress,
            status,
            trend,
        },
        select: recordSelect,
    });

    // Update assignment's current_value to the latest record's actual_value
    const newProgress = calculateProgress(
        payload.actual_value,
        assignment.target_value,
        assignment.start_value,
        assignment.kpi_dictionary.evaluation_method,
    );

    await prisma.kPIAssignments.update({
        where: { id: assignmentId },
        data: {
            current_value: payload.actual_value,
            progress_percentage: newProgress,
        },
    });

    // Recalculate all ancestors' current_value
    if (assignment.parent_assignment_id) {
        await recalculateCurrentValueFromChildren(assignment.parent_assignment_id);
    }

    // Calculate time elapsed percentage for the period
    const now = new Date();
    const totalPeriodDays = (periodEnd - periodStart) / (1000 * 60 * 60 * 24);
    const elapsedDays = Math.max(0, Math.min(totalPeriodDays, (now - periodStart) / (1000 * 60 * 60 * 24)));
    const timeElapsedPercentage = totalPeriodDays > 0 ? (elapsedDays / totalPeriodDays) * 100 : 0;

    return {
        ...record,
        time_elapsed_percentage: Math.round(timeElapsedPercentage * 100) / 100,
    };
};

export const listKPIRecords = async (user, assignmentId) => {
    const assignment = await prisma.kPIAssignments.findFirst({
        where: { id: assignmentId, deleted_at: null },
        select: {
            id: true,
            visibility: true,
            owner_id: true,
            unit_id: true,
            parent_assignment_id: true,
        },
    });

    if (!assignment) throw new AppError("KPI Assignment not found", 404);

    // Check if user can view this assignment using visibility logic
    let canView = await canViewAssignment(user, assignment);

    // If not allowed by visibility, check if user owns any parent assignment
    if (!canView && assignment.parent_assignment_id) {
        canView = await isParentAssignmentOwner(user.id, assignmentId);
    }

    if (!canView) {
        throw new AppError("You do not have permission to view records for this assignment", 403);
    }

    const records = await prisma.kPIRecords.findMany({
        where: { kpi_assignment_id: assignmentId },
        orderBy: { created_at: "asc" },
        select: recordSelect,
    });

    return records;
};

// Helper function to check if user owns any parent assignment
const isParentAssignmentOwner = async (userId, assignmentId) => {
    const assignment = await prisma.kPIAssignments.findFirst({
        where: { id: assignmentId },
        select: { parent_assignment_id: true },
    });

    if (!assignment || !assignment.parent_assignment_id) return false;

    // Check if user owns the parent assignment
    const parentAssignment = await prisma.kPIAssignments.findFirst({
        where: {
            id: assignment.parent_assignment_id,
            owner_id: userId,
            deleted_at: null,
        },
        select: { id: true },
    });

    if (parentAssignment) return true;

    // Recursively check grandparents
    return await isParentAssignmentOwner(userId, assignment.parent_assignment_id);
};

// Helper function to check view permission based on assignment visibility
const canViewAssignment = async (user, assignment) => {
    if (user.role === "ADMIN_COMPANY") return true;

    if (assignment.visibility === "PUBLIC") return true;

    const userUnit = user.unit_id;
    const assignmentUnit = assignment.unit_id;

    if (assignment.visibility === "INTERNAL") {
        if (!assignmentUnit || !userUnit) return false;
        // Can view if in same unit or ancestor/descendant
        const userPath = await getUnitPath(userUnit);
        const assignmentPath = await getUnitPath(assignmentUnit);
        return isAncestorOrEqual(assignmentPath, userPath) || isDescendantOrEqual(assignmentPath, userPath);
    }

    if (assignment.visibility === "PRIVATE") {
        if (assignment.owner_id === user.id) return true;
        if (!assignmentUnit || !userUnit) return false;
        // Can view if from ancestor unit of owner's unit
        return userUnit !== assignmentUnit && (await isAncestorUnit(userUnit, assignmentUnit));
    }

    return false;
};

/**
 * Calculate progress percentage for KPI assignments.
 * Supports values outside 0-100% (regression and over-achievement).
 *
 * @param {number} actualValue - The current actual value
 * @param {number} targetValue - The target goal value
 * @param {number} startValue - The baseline value at creation (must be provided from KPIAssignment.start_value)
 * @param {string} evaluationMethod - The evaluation method: MAXIMIZE, MINIMIZE, or TARGET
 * @returns {number} Progress percentage (can be negative for regression, >100% for over-achievement)
 *
 * @example
 * // MAXIMIZE: Sales target (start: 0, target: 100, actual: 50) → 50%
 * // MINIMIZE: Defect reduction (start: 100, target: 20, actual: 60) → 50%
 * // TARGET: Temperature control (start: 20, target: 25, actual: 22.5) → 50%
 */
const calculateProgress = (actualValue, targetValue, startValue, evaluationMethod) => {
    // Explicitly convert to numbers to handle Decimal/string types from Prisma
    const actual = parseFloat(actualValue);
    const target = parseFloat(targetValue);
    const start = parseFloat(startValue);

    // Validate inputs
    if (isNaN(actual) || isNaN(target) || isNaN(start)) {
        console.log("[DEBUG] Invalid inputs:", { actualValue, targetValue, startValue, evaluationMethod });
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
            // Example: start=10, target=110, actual=60 → 50%
            // Can exceed 100% (over-achievement) or be negative (regression)
            progress = ((actual - start) / (target - start)) * 100;
            break;

        case "MINIMIZE":
            // Lower is better. Formula: (start - actual) / (start - target) * 100
            // Example: start=100, target=20, actual=60 → 50%
            // Example: start=100, target=0, actual=50 → 50%
            // Can exceed 100% (over-achievement) or be negative (regression)
            progress = ((start - actual) / (start - target)) * 100;
            break;

        case "TARGET":
            // Closer to target is better. Formula: (1 - |actual - target| / |start - target|) * 100
            // Example: start=20, target=25, actual=22.5 → 50%
            // Example: start=0, target=100, actual=100 → 100%
            // Symmetric: actual=8 and actual=12 with target=10 are equally off
            // Can be negative if drifting further from start direction
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

    return progress;
};

const getUnitPath = async (unitId) => {
    const unit = await prisma.units.findUnique({
        where: { id: unitId },
        select: { path: true },
    });
    return unit?.path || null;
};

const isDescendantOrEqual = (candidate, ancestor) => {
    if (!candidate || !ancestor) return false;
    return candidate === ancestor || candidate.startsWith(`${ancestor}.`);
};

const isAncestorOrEqual = (candidate, descendant) => {
    if (!candidate || !descendant) return false;
    return descendant === candidate || descendant.startsWith(`${candidate}.`);
};

// Get KPI chart data for a unit (all cycles, all history)
export const getKPIChartData = async (user, unitId) => {
    // Validate unit exists
    const unit = await prisma.units.findFirst({
        where: { id: unitId },
        select: { id: true, name: true },
    });
    if (!unit) throw new AppError("Unit not found", 404);

    // Check permission: ADMIN_COMPANY or user from same/ancestor unit
    if (user.role !== "ADMIN_COMPANY") {
        const userPath = user.unit_id ? await getUnitPath(user.unit_id) : null;
        const unitPath = await getUnitPath(unitId);

        if (!userPath) {
            throw new AppError("You do not have permission to view this unit's data", 403);
        }

        // Check if user's unit is the same or ancestor of target unit
        const isAuthorized =
            user.unit_id === unitId ||
            (unitPath && isDescendantOrEqual(unitPath, userPath));

        if (!isAuthorized) {
            throw new AppError("You do not have permission to view this unit's data", 403);
        }
    }

    // Get all assignments for this unit with their dictionaries (all cycles, including locked)
    const assignments = await prisma.kPIAssignments.findMany({
        where: {
            deleted_at: null,
            unit_id: unitId,
        },
        select: {
            id: true,
            target_value: true,
            kpi_dictionary: {
                select: {
                    id: true,
                    name: true,
                    unit: true,
                    evaluation_method: true,
                },
            },
            cycle: {
                select: {
                    id: true,
                    name: true,
                    start_date: true,
                    end_date: true,
                    is_locked: true,
                },
            },
        },
    });

    if (assignments.length === 0) {
        return {
            unit: { id: unit.id, name: unit.name },
            kpis: [],
        };
    }

    // Get all records for these assignments (all time, all cycles)
    const assignmentIds = assignments.map((a) => a.id);

    const records = await prisma.kPIRecords.findMany({
        where: {
            kpi_assignment_id: { in: assignmentIds },
        },
        orderBy: { period_start: "asc" },
        select: {
            id: true,
            kpi_assignment_id: true,
            actual_value: true,
            progress_percentage: true,
            status: true,
            trend: true,
            period_start: true,
            period_end: true,
        },
    });

    // Group data by KPI dictionary
    const kpiMap = new Map();

    for (const assignment of assignments) {
        const dict = assignment.kpi_dictionary;
        if (!kpiMap.has(dict.id)) {
            kpiMap.set(dict.id, {
                kpi_id: dict.id,
                kpi_name: dict.name,
                unit: dict.unit,
                evaluation_method: dict.evaluation_method,
                target_value: assignment.target_value,
                records: [],
            });
        }
    }

    // Map records to their KPI
    const assignmentToKpiMap = new Map(assignments.map((a) => [a.id, a.kpi_dictionary.id]));

    for (const record of records) {
        const kpiId = assignmentToKpiMap.get(record.kpi_assignment_id);
        if (kpiId) {
            const kpiData = kpiMap.get(kpiId);
            kpiData.records.push({
                period_start: record.period_start.toISOString().split("T")[0],
                period_end: record.period_end.toISOString().split("T")[0],
                actual_value: record.actual_value,
                progress_percentage: Math.round(record.progress_percentage * 100) / 100,
                status: record.status,
                trend: record.trend,
            });
        }
    }

    return {
        unit: {
            id: unit.id,
            name: unit.name,
        },
        kpis: Array.from(kpiMap.values()).filter((k) => k.records.length > 0),
    };
};
