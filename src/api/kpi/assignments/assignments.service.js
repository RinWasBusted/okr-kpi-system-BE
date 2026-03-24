import prisma from "../../../utils/prisma.js";
import AppError from "../../../utils/appError.js";
import {
    getUnitPath,
    getUnitAncestors,
    getUnitDescendants,
    isAncestorUnit,
} from "../../../utils/path.js";
import { UserRole } from "@prisma/client";

const toDateOnlyUtc = (date) =>
    new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

const isDescendantOrEqual = (candidate, ancestor) => {
    if (!candidate || !ancestor) return false;
    return candidate === ancestor || candidate.startsWith(`${ancestor}.`);
};

const isAncestorOrEqual = (candidate, descendant) => {
    if (!candidate || !descendant) return false;
    return descendant === candidate || descendant.startsWith(`${candidate}.`);
};

const calculateProgressPercentage = (currentValue, targetValue, evaluationMethod) => {
    if (targetValue === 0) return 0;
    if (evaluationMethod === "Positive") {
        return Math.min((currentValue / targetValue) * 100, 100);
    }
    if (evaluationMethod === "Negative") {
        return Math.max((1 - currentValue / targetValue) * 100, 0);
    }
    // Stabilizing - assume range is 0 to targetValue
    return Math.min((currentValue / targetValue) * 100, 100);
};

const assignmentSelect = {
    id: true,
    kpi_dictionary_id: true,
    target_value: true,
    current_value: true,
    progress_percentage: true,
    visibility: true,
    owner_id: true,
    unit_id: true,
    parent_assignment_id: true,
    cycle_id: true,
};

const formatAssignment = async (assignment) => {
    const [dictionary, owner, unit, parentAssignment, latestRecord] = await Promise.all([
        prisma.kPIDictionaries.findUnique({
            where: { id: assignment.kpi_dictionary_id },
            select: { id: true, name: true, unit: true, evaluation_method: true },
        }),
        assignment.owner_id
            ? prisma.users.findUnique({
                  where: { id: assignment.owner_id },
                  select: { id: true, full_name: true, email: true },
              })
            : null,
        assignment.unit_id
            ? prisma.units.findUnique({
                  where: { id: assignment.unit_id },
                  select: { id: true, name: true },
              })
            : null,
        assignment.parent_assignment_id
            ? prisma.kPIAssignments.findUnique({
                  where: { id: assignment.parent_assignment_id },
                  select: { id: true, target_value: true },
              })
            : null,
        prisma.kPIRecords.findFirst({
            where: { kpi_assignment_id: assignment.id },
            orderBy: { created_at: "desc" },
            select: { status: true, trend: true },
        }),
    ]);

    return {
        id: assignment.id,
        kpi_dictionary: dictionary,
        target_value: assignment.target_value,
        current_value: assignment.current_value,
        progress_percentage: Math.round(assignment.progress_percentage * 100) / 100,
        visibility: assignment.visibility,
        owner: owner,
        unit: unit,
        parent_assignment: parentAssignment,
        latest_record: latestRecord,
    };
};

const canViewAssignment = async (user, assignment) => {
    if (user.role === UserRole.ADMIN_COMPANY) return true;

    if (assignment.visibility === "PUBLIC") return true;

    const userPath = user.unit_id ? await getUnitPath(user.unit_id) : null;
    const assignmentPath = assignment.access_path
        ? assignment.access_path
        : assignment.unit_id
          ? await getUnitPath(assignment.unit_id)
          : null;

    if (assignment.visibility === "INTERNAL") {
        if (!assignmentPath || !userPath) return false;
        return (
            isAncestorOrEqual(assignmentPath, userPath) ||
            isDescendantOrEqual(assignmentPath, userPath)
        );
    }

    if (assignment.visibility === "PRIVATE") {
        if (assignment.owner_id === user.id) return true;
        if (!assignmentPath || !userPath) return false;
        return assignmentPath !== userPath && isDescendantOrEqual(assignmentPath, userPath);
    }

    return false;
};

const canEditAssignment = async (user, assignment) => {
    if (user.role === UserRole.ADMIN_COMPANY) return true;
    if (assignment.owner_id === user.id) return true;
    if (assignment.unit_id && (await isAncestorUnit(user.id, assignment.unit_id))) return true;
    return false;
};

export const listKPIAssignments = async (user, filters) => {
    const where = {};

    if (filters.cycle_id) where.cycle_id = filters.cycle_id;
    if (filters.visibility) where.visibility = filters.visibility;
    if (filters.parent_assignment_id !== undefined) {
        where.parent_assignment_id = filters.parent_assignment_id;
    }
    if (filters.unit_id) where.unit_id = filters.unit_id;
    if (filters.owner_id) where.owner_id = filters.owner_id;

    if (user.role !== UserRole.ADMIN_COMPANY) {
        // Get visible assignments based on permission logic
        const visibleIds = await prisma.kPIAssignments.findMany({
            where,
            select: { id: true },
        }).then(async (assignments) => {
            const visibleAssignments = [];
            for (const a of assignments) {
                const full = await prisma.kPIAssignments.findUnique({
                    where: { id: a.id },
                });
                const allowed = await canViewAssignment(user, full);
                if (allowed) visibleAssignments.push(a.id);
            }
            return visibleAssignments;
        });

        where.id = { in: visibleIds };
    }

    const page = filters.page || 1;
    const per_page = filters.per_page || 20;
    const skip = (page - 1) * per_page;

    const [assignments, total] = await Promise.all([
        prisma.kPIAssignments.findMany({
            where,
            select: { ...assignmentSelect, access_path: true },
            orderBy: { id: "asc" },
            skip,
            take: per_page,
        }),
        prisma.kPIAssignments.count({ where }),
    ]);

    const formatted = await Promise.all(assignments.map((a) => formatAssignment(a)));

    return {
        data: formatted,
        meta: {
            total,
            page,
            per_page,
            last_page: Math.ceil(total / per_page),
        },
    };
};

export const createKPIAssignment = async (user, payload) => {
    const kpiDictionary = await prisma.kPIDictionaries.findFirst({
        where: {
            id: payload.kpi_dictionary_id,
            deleted_at: null,
        },
        select: { id: true, unit_id: true },
    });

    if (!kpiDictionary) throw new AppError("KPI Dictionary not found", 404);

    const cycle = await prisma.cycles.findFirst({
        where: { id: payload.cycle_id },
        select: { id: true },
    });

    if (!cycle) throw new AppError("Cycle not found", 404);

    // Validate owner_id and unit_id are provided and mutually exclusive
    if (!payload.owner_id && !payload.unit_id) {
        throw new AppError("Either owner_id or unit_id must be provided", 422);
    }

    if (payload.owner_id && payload.unit_id) {
        throw new AppError("Cannot specify both owner_id and unit_id", 422);
    }

    let unitId, ownerId;

    if (payload.owner_id) {
        const owner = await prisma.users.findFirst({
            where: { id: payload.owner_id },
            select: { id: true, unit_id: true },
        });
        if (!owner) throw new AppError("Owner not found", 404);
        ownerId = owner.id;
        unitId = owner.unit_id;
    } else {
        const unit = await prisma.units.findFirst({
            where: { id: payload.unit_id },
            select: { id: true },
        });
        if (!unit) throw new AppError("Unit not found", 404);
        unitId = unit.id;
    }

    // Check KPI dictionary is accessible for this unit
    if (
        kpiDictionary.unit_id &&
        !(await isAncestorUnit(kpiDictionary.unit_id, unitId))
    ) {
        throw new AppError("This KPI Dictionary is not accessible for the selected unit", 400);
    }

    // Validate parent_assignment_id if provided
    if (payload.parent_assignment_id) {
        const parentAssignment = await prisma.kPIAssignments.findFirst({
            where: {
                id: payload.parent_assignment_id,
            },
            select: { kpi_dictionary_id: true },
        });

        if (!parentAssignment) throw new AppError("Parent assignment not found", 404);
        if (parentAssignment.kpi_dictionary_id !== payload.kpi_dictionary_id) {
            throw new AppError("Parent assignment must use the same KPI Dictionary", 400);
        }
    }

    const accessPath = await getUnitPath(unitId);
    if (!accessPath) throw new AppError("Unit not found", 404);

    const visibility = payload.visibility || "INTERNAL";

    const created = await prisma.kPIAssignments.create({
        data: {
            company_id: user.company_id,
            kpi_dictionary_id: payload.kpi_dictionary_id,
            cycle_id: payload.cycle_id,
            target_value: payload.target_value,
            current_value: payload.current_value ?? 0,
            unit_id: unitId,
            owner_id: ownerId,
            parent_assignment_id: payload.parent_assignment_id ?? null,
            visibility,
            access_path: accessPath,
            progress_percentage: 0,
        },
        select: { ...assignmentSelect, access_path: true },
    });

    return await formatAssignment(created);
};

export const updateKPIAssignment = async (user, assignmentId, payload) => {
    const assignment = await prisma.kPIAssignments.findFirst({
        where: { id: assignmentId },
    });

    if (!assignment) throw new AppError("KPI Assignment not found", 404);

    const allowed = await canEditAssignment(user, assignment);
    if (!allowed) throw new AppError("You do not have permission to edit this assignment", 403);

    const updates = {};

    if (payload.target_value !== undefined) {
        updates.target_value = payload.target_value;
    }

    if (payload.current_value !== undefined) {
        // Only allow updating current_value if no KPI records exist
        const existingRecords = await prisma.kPIRecords.findFirst({
            where: { kpi_assignment_id: assignmentId },
        });

        if (existingRecords) {
            throw new AppError("Cannot update current_value when KPI records exist", 400);
        }

        updates.current_value = payload.current_value;
    }

    if (payload.visibility !== undefined) {
        updates.visibility = payload.visibility;
    }

    if (Object.keys(updates).length === 0) {
        throw new AppError("No fields provided to update", 400);
    }

    // Recalculate progress if target_value or current_value changed
    if (updates.target_value !== undefined || updates.current_value !== undefined) {
        const dict = await prisma.kPIDictionaries.findUnique({
            where: { id: assignment.kpi_dictionary_id },
            select: { evaluation_method: true },
        });

        const targetValue = updates.target_value ?? assignment.target_value;
        const currentValue = updates.current_value ?? assignment.current_value;

        updates.progress_percentage = calculateProgressPercentage(
            currentValue,
            targetValue,
            dict.evaluation_method,
        );
    }

    const updated = await prisma.kPIAssignments.update({
        where: { id: assignmentId },
        data: updates,
        select: { ...assignmentSelect, access_path: true },
    });

    return await formatAssignment(updated);
};

export const deleteKPIAssignment = async (user, assignmentId) => {
    const assignment = await prisma.kPIAssignments.findFirst({
        where: { id: assignmentId },
    });

    if (!assignment) throw new AppError("KPI Assignment not found", 404);

    const allowed = await canEditAssignment(user, assignment);
    if (!allowed) throw new AppError("You do not have permission to delete this assignment", 403);

    // Cascade delete KPI records
    await prisma.$transaction([
        prisma.kPIRecords.deleteMany({ where: { kpi_assignment_id: assignmentId } }),
        prisma.kPIAssignments.deleteMany({
            where: { parent_assignment_id: assignmentId },
        }),
        prisma.kPIAssignments.delete({ where: { id: assignmentId } }),
    ]);
};
