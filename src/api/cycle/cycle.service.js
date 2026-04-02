import prisma from "../../utils/prisma.js";
import AppError from "../../utils/appError.js";

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

    const today = new Date();
    const data = cycles.map((cycle) => ({
        ...formatCycle(cycle),
        days_remaining: daysBetweenUtc(cycle.end_date, today),
    }));

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

// ─── Lock ─────────────────────────────────────────────────────────────────────

export const lockCycle = async (companyId, cycleId) => {
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

    return formatCycle(updated);
};

// ─── Clone ────────────────────────────────────────────────────────────────────

export const cloneCycle = async (companyId, sourceCycleId) => {
    const source = await prisma.cycles.findFirst({
        where: { id: sourceCycleId, company_id: companyId },
    });

    if (!source) throw new AppError("Source cycle not found", 404);

    const objectives = await prisma.objectives.findMany({
        where: { company_id: companyId, cycle_id: sourceCycleId },
        include: { key_results: true },
        orderBy: { id: "asc" },
    });

    const assignments = await prisma.kPIAssignments.findMany({
        where: { company_id: companyId, cycle_id: sourceCycleId },
        orderBy: { id: "asc" },
    });

    const result = await prisma.$transaction(async (tx) => {
        const newCycle = await tx.cycles.create({
            data: {
                company_id: companyId,
                name: source.name,
                start_date: source.start_date,
                end_date: source.end_date,
                is_locked: false,
            },
            select: cycleSelect,
        });

        const objectiveIdMap = new Map();
        let clonedKeyResults = 0;

        for (const objective of objectives) {
            const created = await tx.objectives.create({
                data: {
                    company_id: companyId,
                    title: objective.title,
                    cycle_id: newCycle.id,
                    unit_id: objective.unit_id,
                    owner_id: objective.owner_id,
                    parent_objective_id: null,
                    visibility: objective.visibility,
                    status: "Draft",
                    approved_by: null,
                    progress_percentage: 0,
                },
            });
            objectiveIdMap.set(objective.id, created.id);
        }

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
                clonedKeyResults += 1;
            }
        }

        const assignmentIdMap = new Map();

        for (const assignment of assignments) {
            const created = await tx.kPIAssignments.create({
                data: {
                    company_id: companyId,
                    parent_assignment_id: null,
                    kpi_dictionary_id: assignment.kpi_dictionary_id,
                    cycle_id: newCycle.id,
                    owner_id: assignment.owner_id,
                    unit_id: assignment.unit_id,
                    visibility: assignment.visibility,
                    target_value: assignment.target_value,
                    weight: assignment.weight,
                },
            });
            assignmentIdMap.set(assignment.id, created.id);
        }

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

        return {
            cycle: formatCycle(newCycle),
            cloned_objectives: objectiveIdMap.size,
            cloned_key_results: clonedKeyResults,
            cloned_kpi_assignments: assignmentIdMap.size,
        };
    });

    return result;
};
