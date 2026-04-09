import prisma from "../../utils/prisma.js";
import AppError from "../../utils/appError.js";
import { notifyCycleEvent } from "../../utils/notificationHelper.js";

const cycleSelect = {
    id: true,
    name: true,
    start_date: true,
    end_date: true,
    is_locked: true,
};

const formatCycle = (cycle) => ({
    id: cycle.id,
    name: cycle.name,
    start_date: cycle.start_date,
    end_date: cycle.end_date,
    is_locked: cycle.is_locked,
});

const toDateOnlyUtc = (date) =>
    new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

const daysBetweenUtc = (endDate, startDate) => {
    const end = toDateOnlyUtc(endDate);
    const start = toDateOnlyUtc(startDate);
    const diffMs = end.getTime() - start.getTime();
    return Math.floor(diffMs / (24 * 60 * 60 * 1000));
};

const ensureNoOverlap = async ({ companyId, startDate, endDate, excludeId }) => {
    const overlap = await prisma.cycles.findFirst({
        where: {
            company_id: companyId,
            ...(excludeId !== undefined && { id: { not: excludeId } }),
            start_date: { lte: endDate },
            end_date: { gte: startDate },
        },
        select: { id: true },
    });

    if (overlap) {
        throw new AppError("Cycle date range overlaps with an existing cycle", 422, "DATE_OVERLAP");
    }
};

// ─── List ────────────────────────────────────────────────────────────────────

export const listCycles = async ({ companyId, is_locked, year, page, per_page }) => {
    const where = {
        company_id: companyId,
        ...(is_locked !== undefined && { is_locked }),
    };

    if (year !== undefined) {
        const start = new Date(Date.UTC(year, 0, 1));
        const end = new Date(Date.UTC(year, 11, 31));
        where.start_date = { gte: start, lte: end };
    }

    const [total, openCyclesCount, cycles] = await Promise.all([
        prisma.cycles.count({ where }),
        prisma.cycles.count({ where: { company_id: companyId, is_locked: false } }),
        prisma.cycles.findMany({
            where,
            skip: (page - 1) * per_page,
            take: per_page,
            orderBy: { start_date: "asc" },
            select: cycleSelect,
        }),
    ]);

    // Get all cycle IDs for batch querying statistics
    const cycleIds = cycles.map((c) => c.id);

    // Fetch objectives statistics for all cycles in batch
    const objectivesByCycle = await prisma.objectives.groupBy({
        by: ["cycle_id"],
        where: {
            company_id: companyId,
            cycle_id: { in: cycleIds },
            deleted_at: null,
        },
        _count: { id: true },
        _avg: { progress_percentage: true },
    });

    // Fetch KPI assignments statistics for all cycles in batch
    const kpiByCycle = await prisma.kPIAssignments.groupBy({
        by: ["cycle_id"],
        where: {
            company_id: companyId,
            cycle_id: { in: cycleIds },
            deleted_at: null,
        },
        _count: { id: true },
        _avg: { progress_percentage: true },
    });

    // Create lookup maps
    const objectivesStatsMap = new Map();
    objectivesByCycle.forEach((stat) => {
        objectivesStatsMap.set(stat.cycle_id, {
            count: stat._count.id,
            avgProgress: stat._avg.progress_percentage || 0,
        });
    });

    const kpiStatsMap = new Map();
    kpiByCycle.forEach((stat) => {
        kpiStatsMap.set(stat.cycle_id, {
            count: stat._count.id,
            avgProgress: stat._avg.progress_percentage || 0,
        });
    });

    const today = new Date();
    const data = cycles.map((cycle) => {
        const objStats = objectivesStatsMap.get(cycle.id) || { count: 0, avgProgress: 0 };
        const kpiStats = kpiStatsMap.get(cycle.id) || { count: 0, avgProgress: 0 };

        return {
            ...formatCycle(cycle),
            days_remaining: daysBetweenUtc(cycle.end_date, today),
            statistics: {
                total_objectives: objStats.count,
                total_kpis: kpiStats.count,
                avg_objective_progress: Math.round(objStats.avgProgress * 100) / 100,
                avg_kpi_progress: Math.round(kpiStats.avgProgress * 100) / 100,
            },
        };
    });

    return {
        total,
        open_cycles_count: openCyclesCount,
        data,
        last_page: Math.ceil(total / per_page),
    };
};

// ─── Create ───────────────────────────────────────────────────────────────────

export const createCycle = async (companyId, { name, start_date, end_date }) => {
    if (end_date <= start_date) {
        throw new AppError("end_date must be after start_date", 422, "INVALID_DATE_RANGE");
    }
    await ensureNoOverlap({ companyId, startDate: start_date, endDate: end_date });

    const cycle = await prisma.cycles.create({
        data: {
            company_id: companyId,
            name,
            start_date,
            end_date,
            is_locked: false,
        },
        select: cycleSelect,
    });

    return formatCycle(cycle);
};

// ─── Update ───────────────────────────────────────────────────────────────────

export const updateCycle = async (companyId, cycleId, { name, start_date, end_date }) => {
    const existing = await prisma.cycles.findFirst({
        where: { id: cycleId, company_id: companyId },
        select: cycleSelect,
    });
    if (!existing) throw new AppError("Cycle not found", 404);
    if (existing.is_locked) throw new AppError("Cycle is locked and cannot be updated", 400, "CYCLE_LOCKED");

    const nextStart = start_date ?? existing.start_date;
    const nextEnd = end_date ?? existing.end_date;

    if (nextEnd <= nextStart) {
        throw new AppError("end_date must be after start_date", 422, "INVALID_DATE_RANGE");
    }

    await ensureNoOverlap({
        companyId,
        startDate: nextStart,
        endDate: nextEnd,
        excludeId: cycleId,
    });

    const updated = await prisma.cycles.update({
        where: { id: cycleId },
        data: {
            ...(name !== undefined && { name }),
            ...(start_date !== undefined && { start_date }),
            ...(end_date !== undefined && { end_date }),
        },
        select: cycleSelect,
    });

    return formatCycle(updated);
};

// ─── Get Detail ───────────────────────────────────────────────────────────────

export const getCycleDetail = async (companyId, cycleId) => {
    const cycle = await prisma.cycles.findFirst({
        where: { id: cycleId, company_id: companyId },
        select: cycleSelect,
    });

    if (!cycle) {
        throw new AppError("Cycle not found", 404);
    }

    // Get objectives statistics
    const objectivesStats = await prisma.objectives.aggregate({
        where: {
            company_id: companyId,
            cycle_id: cycleId,
            deleted_at: null,
        },
        _count: { id: true },
        _avg: { progress_percentage: true },
    });

    // Get KPI assignments statistics
    const kpiStats = await prisma.kPIAssignments.aggregate({
        where: {
            company_id: companyId,
            cycle_id: cycleId,
            deleted_at: null,
        },
        _count: { id: true },
        _avg: { progress_percentage: true },
    });

    const today = new Date();

    return {
        ...formatCycle(cycle),
        days_remaining: daysBetweenUtc(cycle.end_date, today),
        start_date: cycle.start_date,
        end_date: cycle.end_date,
        statistics: {
            total_objectives: objectivesStats._count.id,
            total_kpis: kpiStats._count.id,
            avg_objective_progress: objectivesStats._avg.progress_percentage || 0,
            avg_kpi_progress: kpiStats._avg.progress_percentage || 0,
        },
    };
};

// ─── Delete ───────────────────────────────────────────────────────────────────

export const deleteCycle = async (companyId, cycleId) => {
    // Check cycle exists and belongs to company
    const cycle = await prisma.cycles.findFirst({
        where: { id: cycleId, company_id: companyId },
        select: { id: true, name: true, is_locked: true },
    });

    if (!cycle) throw new AppError("Cycle not found", 404);

    // Check if cycle has objectives
    const objectivesCount = await prisma.objectives.count({
        where: {
            company_id: companyId,
            cycle_id: cycleId,
            deleted_at: null,
        },
    });

    if (objectivesCount > 0) {
        throw new AppError(
            `Cannot delete cycle: ${objectivesCount} objective(s) exist. Please remove objectives first.`,
            400,
            "CYCLE_HAS_DATA"
        );
    }

    // Check if cycle has KPI assignments
    const assignmentsCount = await prisma.kPIAssignments.count({
        where: {
            company_id: companyId,
            cycle_id: cycleId,
            deleted_at: null,
        },
    });

    if (assignmentsCount > 0) {
        throw new AppError(
            `Cannot delete cycle: ${assignmentsCount} KPI assignment(s) exist. Please remove KPI assignments first.`,
            400,
            "CYCLE_HAS_DATA"
        );
    }

    // Delete cycle
    await prisma.cycles.delete({
        where: { id: cycleId },
    });

    return { id: cycle.id, name: cycle.name };
};

// ─── Lock ─────────────────────────────────────────────────────────────────────

export const lockCycle = async (companyId, cycleId, user = null) => {
    const existing = await prisma.cycles.findFirst({
        where: { id: cycleId, company_id: companyId },
        select: cycleSelect,
    });
    if (!existing) throw new AppError("Cycle not found", 404);

    if (existing.is_locked) {
        return formatCycle(existing);
    }

    const updated = await prisma.cycles.update({
        where: { id: cycleId },
        data: { is_locked: true },
        select: cycleSelect,
    });

    // Notify all company users about cycle lock
    if (user) {
        try {
            await notifyCycleEvent({
                companyId,
                eventType: "LOCKED",
                cycle: { id: cycleId, name: existing.name },
                actorName: user.full_name || user.email,
                actorId: user.id,
            });
        } catch (error) {
            // Log error but don't fail the main operation
            console.error("Failed to send cycle lock notification:", error);
        }
    }

    return formatCycle(updated);
};

// ─── Clone ────────────────────────────────────────────────────────────────────

export const cloneCycle = async (
    companyId,
    targetCycleId,
    { objective_ids, kpi_assignment_ids },
    user = null
) => {
    // Verify target cycle exists and belongs to company
    const targetCycle = await prisma.cycles.findFirst({
        where: { id: targetCycleId, company_id: companyId },
    });
    if (!targetCycle) throw new AppError("Target cycle not found", 404);
    if (targetCycle.is_locked) throw new AppError("Target cycle is locked and cannot be modified", 400, "CYCLE_LOCKED");

    // Determine what to clone based on provided IDs
    const shouldCloneObjectives = objective_ids?.length > 0;
    const shouldCloneKpis = kpi_assignment_ids?.length > 0;

    // Build where clauses for objectives and KPIs
    const objectiveWhere = {
        company_id: companyId,
        deleted_at: null,
        ...(shouldCloneObjectives && { id: { in: objective_ids } }),
    };

    const kpiWhere = {
        company_id: companyId,
        deleted_at: null,
        ...(shouldCloneKpis && { id: { in: kpi_assignment_ids } }),
    };

    // Fetch objectives if cloning
    const objectives = shouldCloneObjectives
        ? await prisma.objectives.findMany({
              where: objectiveWhere,
              include: { key_results: true },
              orderBy: { id: "asc" },
          })
        : [];

    // Fetch KPI assignments if cloning
    const assignments = shouldCloneKpis
        ? await prisma.kPIAssignments.findMany({
              where: kpiWhere,
              orderBy: { id: "asc" },
          })
        : [];

    // Fetch unit paths for access_path calculation
    const unitIds = new Set();
    objectives.forEach((o) => {
        if (o.unit_id) unitIds.add(o.unit_id);
    });
    assignments.forEach((a) => {
        if (a.unit_id) unitIds.add(a.unit_id);
    });

    const units =
        unitIds.size > 0
            ? await prisma.units.findMany({
                  where: { id: { in: Array.from(unitIds) }, company_id: companyId },
                  select: { id: true, path: true },
              })
            : [];

    const unitPathMap = new Map(units.map((u) => [u.id, u.path]));

    const result = await prisma.$transaction(async (tx) => {
        // ─── Clone Objectives ───────────────────────────────────────────────────
        const objectiveIdMap = new Map();

        if (shouldCloneObjectives && objectives.length > 0) {
            for (const objective of objectives) {
                const accessPath = unitPathMap.get(objective.unit_id) ?? null;

                const created = await tx.objectives.create({
                    data: {
                        company_id: companyId,
                        title: objective.title,
                        cycle_id: targetCycleId,
                        unit_id: objective.unit_id,
                        owner_id: objective.owner_id,
                        parent_objective_id: null,
                        visibility: objective.visibility,
                        access_path: accessPath,
                        status: "Draft",
                        approved_by: null,
                        progress_percentage: 0,
                    },
                });
                objectiveIdMap.set(objective.id, created.id);
            }

            // Link parent objectives
            for (const objective of objectives) {
                if (objective.parent_objective_id) {
                    const newId = objectiveIdMap.get(objective.id);
                    const newParentId = objectiveIdMap.get(objective.parent_objective_id);
                    if (newId && newParentId) {
                        await tx.objectives.update({
                            where: { id: newId },
                            data: { parent_objective_id: newParentId },
                        });
                    }
                }
            }

            // Clone key results (automatically cloned with objectives)
            for (const objective of objectives) {
                const newObjectiveId = objectiveIdMap.get(objective.id);
                if (!newObjectiveId) continue;

                for (const keyResult of objective.key_results) {
                    await tx.keyResults.create({
                        data: {
                            company_id: companyId,
                            objective_id: newObjectiveId,
                            title: keyResult.title,
                            target_value: keyResult.target_value,
                            current_value: 0,
                            unit: keyResult.unit,
                            weight: keyResult.weight,
                            due_date: keyResult.due_date,
                            progress_percentage: 0,
                        },
                    });
                }
            }
        }

        // ─── Clone KPI Assignments ──────────────────────────────────────────────
        const assignmentIdMap = new Map();

        if (shouldCloneKpis && assignments.length > 0) {
            for (const assignment of assignments) {
                const accessPath = unitPathMap.get(assignment.unit_id) ?? null;

                const created = await tx.kPIAssignments.create({
                    data: {
                        company_id: companyId,
                        parent_assignment_id: null,
                        kpi_dictionary_id: assignment.kpi_dictionary_id,
                        cycle_id: targetCycleId,
                        owner_id: assignment.owner_id,
                        unit_id: assignment.unit_id,
                        visibility: assignment.visibility,
                        access_path: accessPath,
                        target_value: assignment.target_value,
                        current_value: 0,
                        progress_percentage: 0,
                    },
                });
                assignmentIdMap.set(assignment.id, created.id);
            }

            // Link parent assignments
            for (const assignment of assignments) {
                if (assignment.parent_assignment_id) {
                    const newId = assignmentIdMap.get(assignment.id);
                    const newParentId = assignmentIdMap.get(assignment.parent_assignment_id);
                    if (newId && newParentId) {
                        await tx.kPIAssignments.update({
                            where: { id: newId },
                            data: { parent_assignment_id: newParentId },
                        });
                    }
                }
            }
        }

        return {
            cloned_objective_ids: Array.from(objectiveIdMap.values()),
            cloned_kpi_assignment_ids: Array.from(assignmentIdMap.values()),
        };
    });

    // Notify about successful cloning
    if (user) {
        try {
            const targetCycle = await prisma.cycles.findFirst({
                where: { id: targetCycleId, company_id: companyId },
                select: { id: true, name: true },
            });

            if (targetCycle) {
                await notifyCycleEvent({
                    companyId,
                    eventType: "CLONED",
                    cycle: { id: targetCycleId, name: targetCycle.name },
                    actorName: user.full_name || user.email,
                    actorId: user.id,
                });
            }
        } catch (error) {
            // Log error but don't fail the main operation
            console.error("Failed to send cycle clone notification:", error);
        }
    }

    return result;
};
