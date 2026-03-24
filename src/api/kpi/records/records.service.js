import prisma from "../../../utils/prisma.js";
import AppError from "../../../utils/appError.js";
import { canEditObjective } from "../../../utils/okr.js";

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

const calculateStatus = (progress, timeElapsed, ratio) => {
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
        where: { id: assignmentId },
        include: {
            kpi_dictionary: { select: { evaluation_method: true } },
            cycle: { select: { start_date: true, end_date: true } },
        },
    });

    if (!assignment) throw new AppError("KPI Assignment not found", 404);

    // Verify user can edit this assignment
    const canEdit = user.role === "ADMIN_COMPANY" || 
                    assignment.owner_id === user.id ||
                    (assignment.unit_id && await isAncestorUnit(user.id, assignment.unit_id));

    if (!canEdit) {
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
    const ratio = timeElapsed > 0 ? progress / timeElapsed : 0;

    const status = calculateStatus(progress, timeElapsed, ratio);

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

    // Update assignment's current_value
    const newCurrentValue = assignment.current_value + (payload.actual_value - (previousRecord?.actual_value ?? 0));
    await prisma.kPIAssignments.update({
        where: { id: assignmentId },
        data: {
            current_value: newCurrentValue,
            progress_percentage: calculateProgress(
                newCurrentValue,
                assignment.target_value,
                assignment.kpi_dictionary.evaluation_method,
            ),
        },
    });

    return {
        ...record,
        time_elapsed_percentage: Math.round(timeElapsed * 100) / 100,
        ratio: Math.round(ratio * 100) / 100,
    };
};

export const listKPIRecords = async (user, assignmentId) => {
    const assignment = await prisma.kPIAssignments.findFirst({
        where: { id: assignmentId },
        select: { id: true },
    });

    if (!assignment) throw new AppError("KPI Assignment not found", 404);

    const records = await prisma.kPIRecords.findMany({
        where: { kpi_assignment_id: assignmentId },
        orderBy: { created_at: "asc" },
        select: recordSelect,
    });

    return records;
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

const isAncestorUnit = async (userId, unitId) => {
    const user = await prisma.users.findUnique({
        where: { id: userId },
        select: { managed_units: { select: { id: true } } },
    });

    if (!user) return false;
    return user.managed_units.some((u) => u.id === unitId);
};
