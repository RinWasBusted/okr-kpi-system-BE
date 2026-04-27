import prisma from "../../utils/prisma.js";
import AppError from "../../utils/appError.js";
import { getUnitPath, isAncestorUnit } from "../../utils/path.js";

const isDescendantOrEqual = (candidate, ancestor) => {
    if (!candidate || !ancestor) return false;
    return candidate === ancestor || candidate.startsWith(`${ancestor}.`);
};

const formatDateToWeek = (date) => {
    const d = new Date(date);
    const year = d.getUTCFullYear();
    // Get ISO week number
    const dayOfWeek = d.getUTCDay() || 7; // 1-7 (Mon-Sun)
    const target = new Date(Date.UTC(year, d.getUTCMonth(), d.getUTCDate() + (4 - dayOfWeek)));
    const firstThursday = new Date(Date.UTC(year, 0, 4));
    const firstThursdayDay = firstThursday.getUTCDay() || 7;
    const firstMonday = new Date(Date.UTC(year, 0, 4 - (firstThursdayDay - 1)));
    const weekNum = Math.ceil(((target - firstMonday) / 86400000 + 1) / 7);
    return `${year}-W${String(weekNum).padStart(2, "0")}`;
};

const formatDateToMonth = (date) => {
    const d = new Date(date);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

const formatDateToYear = (date) => {
    return new Date(date).getUTCFullYear().toString();
};

const getTimelinePeriod = (date, groupBy) => {
    if (groupBy === "year") {
        // Group by year = monthly data
        return formatDateToMonth(date);
    }
    // Group by month = weekly data
    return formatDateToWeek(date);
};

const sortPeriods = (a, b) => {
    return a.localeCompare(b);
};

// Validate user has access to cycle data
const validateCycleAccess = async (user, cycleId) => {
    const cycle = await prisma.cycles.findFirst({
        where: { id: cycleId },
        select: { id: true, company_id: true, name: true, start_date: true, end_date: true },
    });

    if (!cycle) throw new AppError("Cycle not found", 404);
    if (cycle.company_id !== user.company_id) {
        throw new AppError("You do not have permission to access this cycle", 403);
    }

    return cycle;
};

// Validate filter authorization for timeline endpoints
const validateTimelineFilters = async (user, { unitId, userId }) => {
    if (user.role === 'ADMIN_COMPANY') return; // unrestricted

    if (unitId) {
        // Check if user is manager of this unit
        const isUnitManager = await prisma.units.count({
            where: { id: unitId, manager_id: user.id, deleted_at: null },
        });
        if (isUnitManager > 0) return; // manager can access their managed units

        // Employee: allowed only if unit_id matches their own
        if (user.unit_id !== unitId) {
            throw new AppError("You do not have permission to view this unit's data", 403);
        }
        return;
    }

    if (userId) {
        // Employees can only see their own data
        if (user.role === 'EMPLOYEE' && userId !== user.id) {
            throw new AppError("You can only view your own data", 403);
        }
    }
};

// Get KPI timeline data for chart
export const getKPITimelineData = async (user, cycleId, groupBy = "month", filters = {}) => {
    const { unitId, userId } = filters;
    await validateTimelineFilters(user, { unitId, userId });
    const cycle = await validateCycleAccess(user, cycleId);

    // Build where clause with optional filters
    const whereClause = {
        company_id: user.company_id,
        cycle_id: cycleId,
        deleted_at: null,
    };
    if (unitId) {
        whereClause.unit_id = unitId;
    } else if (userId) {
        whereClause.owner_id = userId;
    }

    // Get all KPI assignments in this cycle with their dictionaries
    const assignments = await prisma.kPIAssignments.findMany({
        where: whereClause,
        select: {
            id: true,
            target_value: true,
            progress_percentage: true,
            unit_id: true,
            owner_id: true,
            visibility: true,
            kpi_dictionary: {
                select: {
                    id: true,
                    name: true,
                    unit: true,
                    evaluation_method: true,
                },
            },
            unit: {
                select: {
                    id: true,
                    name: true,
                },
            },
            owner: {
                select: {
                    id: true,
                    full_name: true,
                },
            },
        },
    });

    // Filter assignments based on visibility rules
    const visibleAssignments = [];
    for (const assignment of assignments) {
        if (await canViewAssignment(user, assignment)) {
            visibleAssignments.push(assignment);
        }
    }

    if (visibleAssignments.length === 0) {
        return {
            cycle: {
                id: cycle.id,
                name: cycle.name,
                start_date: cycle.start_date.toISOString().split("T")[0],
                end_date: cycle.end_date.toISOString().split("T")[0],
            },
            group_by: groupBy,
            kpis: [],
        };
    }

    const assignmentIds = visibleAssignments.map((a) => a.id);

    // Get all records for these assignments
    const records = await prisma.kPIRecords.findMany({
        where: {
            company_id: user.company_id,
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
            created_at: true,
        },
    });

    // Build timeline data for each KPI
    const kpiMap = new Map();

    // Initialize KPI entries
    for (const assignment of visibleAssignments) {
        const dict = assignment.kpi_dictionary;
        if (!kpiMap.has(dict.id)) {
            kpiMap.set(dict.id, {
                kpi_id: dict.id,
                kpi_name: dict.name,
                unit: dict.unit,
                evaluation_method: dict.evaluation_method,
                target_value: Math.round((assignment.target_value || 0) * 100) / 100,
                current_progress: Math.round((assignment.progress_percentage || 0) * 100) / 100,
                assignments: [],
                timeline: new Map(),
            });
        }

        const kpiData = kpiMap.get(dict.id);
        kpiData.assignments.push({
            assignment_id: assignment.id,
            unit_id: assignment.unit_id,
            unit_name: assignment.unit?.name || null,
            owner_id: assignment.owner_id,
            owner_name: assignment.owner?.full_name || null,
        });
    }

    // Map records to their KPI and group by period
    const assignmentToKpiMap = new Map(visibleAssignments.map((a) => [a.id, a.kpi_dictionary.id]));

    for (const record of records) {
        const kpiId = assignmentToKpiMap.get(record.kpi_assignment_id);
        if (!kpiId) continue;

        const kpiData = kpiMap.get(kpiId);
        const period = getTimelinePeriod(record.period_start, groupBy);

        // Store the latest record for each period
        if (!kpiData.timeline.has(period) ||
            new Date(record.period_start) > new Date(kpiData.timeline.get(period).period_start)) {
            kpiData.timeline.set(period, {
                period,
                period_start: record.period_start.toISOString().split("T")[0],
                period_end: record.period_end.toISOString().split("T")[0],
                actual_value: Math.round((record.actual_value || 0) * 100) / 100,
                progress_percentage: Math.round((record.progress_percentage || 0) * 100) / 100,
                status: record.status,
                trend: record.trend,
            });
        }
    }

    // Convert timeline maps to sorted arrays
    const resultKpis = Array.from(kpiMap.values()).map((kpi) => ({
        ...kpi,
        timeline: Array.from(kpi.timeline.values()).sort((a, b) => sortPeriods(a.period, b.period)),
    }));

    // Generate all periods in cycle range for consistent x-axis
    const allPeriods = generateCyclePeriods(cycle.start_date, cycle.end_date, groupBy);

    return {
        cycle: {
            id: cycle.id,
            name: cycle.name,
            start_date: cycle.start_date.toISOString().split("T")[0],
            end_date: cycle.end_date.toISOString().split("T")[0],
        },
        group_by: groupBy,
        periods: allPeriods,
        kpis: resultKpis.filter((k) => k.timeline.length > 0),
    };
};

// Get OKR timeline data for chart
export const getOKRTimelineData = async (user, cycleId, groupBy = "month", filters = {}) => {
    const { unitId, userId } = filters;
    await validateTimelineFilters(user, { unitId, userId });
    const cycle = await validateCycleAccess(user, cycleId);

    // Build where clause with optional filters
    const whereClause = {
        company_id: user.company_id,
        cycle_id: cycleId,
        deleted_at: null,
        // Only include active statuses - Draft, Pending_Approval, Rejected don't count
        status: { in: ["NOT_STARTED", "ON_TRACK", "AT_RISK", "CRITICAL", "COMPLETED"] },
    };
    if (unitId) {
        whereClause.unit_id = unitId;
    } else if (userId) {
        whereClause.owner_id = userId;
    }

    // Get all objectives in this cycle
    const objectives = await prisma.objectives.findMany({
        where: whereClause,
        select: {
            id: true,
            title: true,
            status: true,
            progress_percentage: true,
            unit_id: true,
            owner_id: true,
            visibility: true,
            unit: {
                select: {
                    id: true,
                    name: true,
                },
            },
            owner: {
                select: {
                    id: true,
                    full_name: true,
                },
            },
            key_results: {
                where: { deleted_at: null },
                select: {
                    id: true,
                    title: true,
                    target_value: true,
                    current_value: true,
                    progress_percentage: true,
                    weight: true,
                },
            },
        },
    });

    // Filter objectives based on visibility rules
    const visibleObjectives = [];
    for (const objective of objectives) {
        if (await canViewObjective(user, objective)) {
            visibleObjectives.push(objective);
        }
    }

    if (visibleObjectives.length === 0) {
        return {
            cycle: {
                id: cycle.id,
                name: cycle.name,
                start_date: cycle.start_date.toISOString().split("T")[0],
                end_date: cycle.end_date.toISOString().split("T")[0],
            },
            group_by: groupBy,
            objectives: [],
        };
    }

    // Get all check-ins for key results of these objectives
    const keyResultIds = visibleObjectives.flatMap((o) => o.key_results.map((kr) => kr.id));

    const checkIns = await prisma.checkIns.findMany({
        where: {
            company_id: user.company_id,
            key_result_id: { in: keyResultIds },
        },
        orderBy: { created_at: "asc" },
        select: {
            id: true,
            key_result_id: true,
            achieved_value: true,
            progress_snapshot: true,
            created_at: true,
        },
    });

    // Group check-ins by objective and period
    const objectiveMap = new Map();

    // Initialize objective entries
    for (const objective of visibleObjectives) {
        objectiveMap.set(objective.id, {
            objective_id: objective.id,
            objective_title: objective.title,
            status: objective.status,
            current_progress: Math.round((objective.progress_percentage || 0) * 100) / 100,
            unit_id: objective.unit_id,
            unit_name: objective.unit?.name || null,
            owner_id: objective.owner_id,
            owner_name: objective.owner?.full_name || null,
            key_results: objective.key_results.map((kr) => ({
                kr_id: kr.id,
                title: kr.title,
                target_value: Math.round((kr.target_value || 0) * 100) / 100,
                current_value: Math.round((kr.current_value || 0) * 100) / 100,
                progress_percentage: Math.round((kr.progress_percentage || 0) * 100) / 100,
                weight: kr.weight,
            })),
            timeline: new Map(),
        });
    }

    // Map key results to objectives
    const krToObjectiveMap = new Map();
    for (const objective of visibleObjectives) {
        for (const kr of objective.key_results) {
            krToObjectiveMap.set(kr.id, objective.id);
        }
    }

    // Group check-ins by period and calculate objective progress
    const checkInsByPeriod = new Map();

    for (const checkIn of checkIns) {
        const period = getTimelinePeriod(checkIn.created_at, groupBy);

        if (!checkInsByPeriod.has(period)) {
            checkInsByPeriod.set(period, new Map());
        }

        const periodData = checkInsByPeriod.get(period);
        const krId = checkIn.key_result_id;
        const objectiveId = krToObjectiveMap.get(krId);

        if (!objectiveId) continue;

        if (!periodData.has(objectiveId)) {
            periodData.set(objectiveId, new Map());
        }

        const objectiveKRs = periodData.get(objectiveId);

        // Keep the latest check-in for each KR in this period
        if (!objectiveKRs.has(krId) ||
            new Date(checkIn.created_at) > new Date(objectiveKRs.get(krId).created_at)) {
            objectiveKRs.set(krId, {
                progress: checkIn.progress_snapshot,
                created_at: checkIn.created_at,
            });
        }
    }

    // Calculate objective progress for each period
    for (const [period, objectivesData] of checkInsByPeriod) {
        for (const [objectiveId, krProgressMap] of objectivesData) {
            const objectiveData = objectiveMap.get(objectiveId);
            if (!objectiveData) continue;

            // Calculate weighted progress
            let totalWeight = 0;
            let weightedProgress = 0;

            for (const kr of objectiveData.key_results) {
                const krProgress = krProgressMap.get(kr.kr_id);
                if (krProgress) {
                    weightedProgress += krProgress.progress * kr.weight;
                    totalWeight += kr.weight;
                } else {
                    // Use 0 progress if no check-in for this KR in this period
                    weightedProgress += 0;
                    totalWeight += kr.weight;
                }
            }

            const avgProgress = totalWeight > 0 ? (weightedProgress / totalWeight) : 0;

            objectiveData.timeline.set(period, {
                period,
                progress_percentage: Math.round(avgProgress * 100) / 100,
                period_start: getPeriodStartDate(period, groupBy),
                period_end: getPeriodEndDate(period, groupBy),
            });
        }
    }

    // Convert timeline maps to sorted arrays
    const resultObjectives = Array.from(objectiveMap.values()).map((obj) => ({
        ...obj,
        timeline: Array.from(obj.timeline.values()).sort((a, b) => sortPeriods(a.period, b.period)),
    }));

    // Generate all periods in cycle range for consistent x-axis
    const allPeriods = generateCyclePeriods(cycle.start_date, cycle.end_date, groupBy);

    return {
        cycle: {
            id: cycle.id,
            name: cycle.name,
            start_date: cycle.start_date.toISOString().split("T")[0],
            end_date: cycle.end_date.toISOString().split("T")[0],
        },
        group_by: groupBy,
        periods: allPeriods,
        objectives: resultObjectives.filter((o) => o.timeline.length > 0),
    };
};

export const getStatisticsSummary = async (user) => {
    const companyId = user.company_id;
    if (!companyId) {
        throw new AppError("Company context is required", 403);
    }

    const [user_count, unit_count, cycle_count] = await Promise.all([
        prisma.users.count({
            where: {
                company_id: companyId,
                deleted_at: null,
            },
        }),
        prisma.units.count({
            where: {
                company_id: companyId,
                deleted_at: null,
            },
        }),
        prisma.cycles.count({
            where: {
                company_id: companyId,
            },
        }),
    ]);

    const { objective_count, kpi_count } = await prisma.$withLockedCycleFilterBypassed(async (tx) => {
        const [objective_count, kpi_count] = await Promise.all([
            tx.objectives.count({
                where: {
                    company_id: companyId,
                    deleted_at: null,
                },
            }),
            tx.kPIAssignments.count({
                where: {
                    company_id: companyId,
                    deleted_at: null,
                },
            }),
        ]);

        return { objective_count, kpi_count };
    });

    return {
        user_count,
        unit_count,
        cycle_count,
        objective_count,
        kpi_count,
    };
};

// Helper: Check if user can view assignment
const canViewAssignment = async (user, assignment) => {
    if (user.role === "ADMIN_COMPANY") return true;

    if (assignment.visibility === "PUBLIC") return true;

    const userPath = user.unit_id ? await getUnitPath(user.unit_id) : null;
    const assignmentPath = await getUnitPath(assignment.unit_id);

    if (assignment.visibility === "INTERNAL") {
        if (!assignmentPath || !userPath) return false;
        return (
            isDescendantOrEqual(userPath, assignmentPath) ||
            isDescendantOrEqual(assignmentPath, userPath)
        );
    }

    if (assignment.visibility === "PRIVATE") {
        if (assignment.owner_id === user.id) return true;
        if (!assignmentPath || !userPath) return false;
        return userPath !== assignmentPath && (await isAncestorUnit(user.unit_id, assignment.unit_id));
    }

    return false;
};

// Helper: Check if user can view objective
const canViewObjective = async (user, objective) => {
    if (user.role === "ADMIN_COMPANY") return true;

    if (objective.visibility === "PUBLIC") return true;

    const userPath = user.unit_id ? await getUnitPath(user.unit_id) : null;

    // Get objective's access path via unit hierarchy
    const objectivePath = objective.unit_id ? await getUnitPath(objective.unit_id) : null;

    if (objective.visibility === "INTERNAL") {
        if (!objectivePath || !userPath) return false;
        return (
            isDescendantOrEqual(userPath, objectivePath) ||
            isDescendantOrEqual(objectivePath, userPath)
        );
    }

    if (objective.visibility === "PRIVATE") {
        if (objective.owner_id === user.id) return true;
        if (!objectivePath || !userPath) return false;
        return userPath !== objectivePath && (await isAncestorUnit(user.unit_id, objective.unit_id));
    }

    return false;
};

// Helper: Generate all periods in cycle range
const generateCyclePeriods = (startDate, endDate, groupBy) => {
    const periods = [];
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (groupBy === "year") {
        // Year grouping = monthly periods (YYYY-MM)
        const current = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
        const endTime = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1);

        while (current.getTime() <= endTime) {
            periods.push(formatDateToMonth(current));
            current.setUTCMonth(current.getUTCMonth() + 1);
        }
    } else {
        // Month grouping = weekly periods (YYYY-Www)
        // Start from the week containing startDate
        const startWeek = getWeekStartDate(start);
        const endWeek = getWeekStartDate(end);

        let current = new Date(startWeek);
        while (current.getTime() <= endWeek.getTime()) {
            periods.push(formatDateToWeek(current));
            current.setUTCDate(current.getUTCDate() + 7); // Move to next week
        }
    }

    return periods;
};

// Helper: Get week start date (Monday) containing the given date
const getWeekStartDate = (date) => {
    const d = new Date(date);
    const dayOfWeek = d.getUTCDay() || 7; // 1-7 (Mon-Sun)
    // Go back to Monday of this week
    d.setUTCDate(d.getUTCDate() - (dayOfWeek - 1));
    d.setUTCHours(0, 0, 0, 0);
    return d;
};

// Helper: Get period start date
const getPeriodStartDate = (period, groupBy) => {
    if (groupBy === "year") {
        // Monthly period: YYYY-MM
        return `${period}-01`;
    }
    // Weekly period: YYYY-Www
    const [year, weekStr] = period.split("-W");
    const week = parseInt(weekStr, 10);
    // Calculate first day of ISO week
    const firstThursday = new Date(Date.UTC(year, 0, 4));
    const firstThursdayDay = firstThursday.getUTCDay() || 7;
    const firstMonday = new Date(Date.UTC(year, 0, 4 - (firstThursdayDay - 1)));
    const weekStart = new Date(firstMonday);
    weekStart.setUTCDate(firstMonday.getUTCDate() + (week - 1) * 7);
    return weekStart.toISOString().split("T")[0];
};

// Helper: Get period end date
const getPeriodEndDate = (period, groupBy) => {
    if (groupBy === "year") {
        // Monthly period: YYYY-MM
        const [year, month] = period.split("-").map(Number);
        const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
        return `${period}-${lastDay}`;
    }
    // Weekly period: YYYY-Www (end on Sunday)
    const startDate = getPeriodStartDate(period, groupBy);
    const start = new Date(startDate);
    const end = new Date(start);
    end.setUTCDate(start.getUTCDate() + 6); // Sunday
    return end.toISOString().split("T")[0];
};
