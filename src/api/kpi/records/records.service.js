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

const calculateTimeElapsedPercentage = (cycleStart, cycleEnd, periodEnd) => {
    const totalDays = Math.max(1, cycleEnd.getTime() - cycleStart.getTime()) / (1000 * 60 * 60 * 24);
    const elapsedDays = Math.max(1, periodEnd.getTime() - cycleStart.getTime()) / (1000 * 60 * 60 * 24);
    return Math.min((elapsedDays / totalDays) * 100, 100);
};

const calculateStatus = (progress, ratio) => {
    if (progress >= 100) return "OnTrack";
    if (ratio >= 0.9) return "OnTrack";
    if (ratio >= 0.75) return "AtRisk";
    if (ratio >= 0.5) return "Behind";
    return "Critical";
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
        include: {
            kpi_dictionary: { select: { evaluation_method: true } },
            cycle: { select: { start_date: true, end_date: true } },
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
    const cycleStart = toDateOnlyUtc(assignment.cycle.start_date);
    const cycleEnd = toDateOnlyUtc(assignment.cycle.end_date);

    if (periodStart > periodEnd) {
        throw new AppError("period_start must be before period_end", 422);
    }

    // Calculate metrics
    const progress = calculateProgress(
        payload.actual_value,
        assignment.target_value,
        assignment.kpi_dictionary.evaluation_method,
    );

    const timeElapsed = calculateTimeElapsedPercentage(cycleStart, cycleEnd, periodEnd);
    const ratio = timeElapsed > 0 ? progress / timeElapsed : 1;

    const status = calculateStatus(progress, ratio);

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

    return {
        ...record,
        time_elapsed_percentage: Math.round(timeElapsed * 100) / 100,
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
        },
    });

    if (!assignment) throw new AppError("KPI Assignment not found", 404);

    // Check if user can view this assignment using visibility logic
    const canView = await canViewAssignment(user, assignment);
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

const calculateProgress = (actualValue, targetValue, evaluationMethod) => {
    if (targetValue === 0) return 0;
    if (evaluationMethod === "Positive") {
        return Math.min((actualValue / targetValue) * 100, 100);
    }
    if (evaluationMethod === "Negative") {
        return Math.max((1 - actualValue / targetValue) * 100, 0);
    }
    return Math.min((actualValue / targetValue) * 100, 100);
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
