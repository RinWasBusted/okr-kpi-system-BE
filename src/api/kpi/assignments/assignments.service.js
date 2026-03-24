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

const canCreateKPIAssignment = async (user, payload) => {
    // Admin has full permission
    if (user.role === UserRole.ADMIN_COMPANY) return true;

    // If assigning to a unit: user must be from ancestor unit OR be manager of that unit
    if (payload.unit_id) {
        // Check if user is from ancestor unit (not same unit)
        const isFromAncestorUnit = user.unit_id && user.unit_id !== payload.unit_id && (await isAncestorUnit(user.unit_id, payload.unit_id));
        
        const unit = await prisma.units.findUnique({
            where: { id: payload.unit_id },
            select: { manager_id: true }
        });
        const isManagerOfUnit = unit?.manager_id === user.id;
        
        return isFromAncestorUnit || isManagerOfUnit;
    }

    // If assigning to a user: user must be from ancestor unit of owner's unit OR be manager of owner's unit
    if (payload.owner_id) {
        const owner = await prisma.users.findUnique({
            where: { id: payload.owner_id },
            select: { unit_id: true },
        });
        if (!owner || !owner.unit_id) return false;

        // Check if user is from ancestor unit (not same unit)
        const isFromAncestorUnit = user.unit_id && user.unit_id !== owner.unit_id && (await isAncestorUnit(user.unit_id, owner.unit_id));
        
        const ownerUnit = await prisma.units.findUnique({
            where: { id: owner.unit_id },
            select: { manager_id: true }
        });
        const isManagerOfOwnerUnit = ownerUnit?.manager_id === user.id;
        
        return isFromAncestorUnit || isManagerOfOwnerUnit;
    }

    return false;
};

const canUpdateKPIAssignment = async (user, assignment) => {
    // Admin has full permission
    if (user.role === UserRole.ADMIN_COMPANY) return true;

    // If unit assignment: user must be from ancestor unit OR be manager of that unit
    if (assignment.unit_id) {
        // Check if user is from ancestor unit (not same unit)
        const isFromAncestorUnit = user.unit_id && user.unit_id !== assignment.unit_id && (await isAncestorUnit(user.unit_id, assignment.unit_id));
        
        const unit = await prisma.units.findUnique({
            where: { id: assignment.unit_id },
            select: { manager_id: true }
        });
        const isManagerOfUnit = unit?.manager_id === user.id;
        
        return isFromAncestorUnit || isManagerOfUnit;
    }

    // If user assignment: user must be from ancestor unit of owner's unit OR be manager of owner's unit
    if (assignment.owner_id) {
        const owner = await prisma.users.findUnique({
            where: { id: assignment.owner_id },
            select: { unit_id: true },
        });
        if (!owner || !owner.unit_id) return false;

        // Check if user is from ancestor unit (not same unit)
        const isFromAncestorUnit = user.unit_id && user.unit_id !== owner.unit_id && (await isAncestorUnit(user.unit_id, owner.unit_id));
        
        const ownerUnit = await prisma.units.findUnique({
            where: { id: owner.unit_id },
            select: { manager_id: true }
        });
        const isManagerOfOwnerUnit = ownerUnit?.manager_id === user.id;
        
        return isFromAncestorUnit || isManagerOfOwnerUnit;
    }

    return false;
};

// Helper function to recalculate current_value from children recursively
const recalculateCurrentValueFromChildren = async (assignmentId) => {
    const children = await prisma.kPIAssignments.findMany({
        where: { parent_assignment_id: assignmentId, deleted_at: null },
        select: { id: true, current_value: true },
    });

    const totalCurrentValue = children.reduce((sum, child) => sum + (child.current_value || 0), 0);

    // Get assignment to recalculate progress
    const assignment = await prisma.kPIAssignments.findUnique({
        where: { id: assignmentId },
        select: { kpi_dictionary_id: true, target_value: true },
    });

    if (!assignment) return;

    const dict = await prisma.kPIDictionaries.findUnique({
        where: { id: assignment.kpi_dictionary_id },
        select: { evaluation_method: true },
    });

    const progressPercentage = calculateProgressPercentage(
        totalCurrentValue,
        assignment.target_value,
        dict.evaluation_method,
    );

    // Update the assignment's current_value and progress
    await prisma.kPIAssignments.update({
        where: { id: assignmentId },
        data: { current_value: totalCurrentValue, progress_percentage: progressPercentage },
    });

    // Recursively update parent
    const parentAssignment = await prisma.kPIAssignments.findUnique({
        where: { id: assignmentId },
        select: { parent_assignment_id: true },
    });

    if (parentAssignment?.parent_assignment_id) {
        await recalculateCurrentValueFromChildren(parentAssignment.parent_assignment_id);
    }
};

export const listKPIAssignments = async (user, filters) => {
    const where = {
        deleted_at: null,
    };

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
            select: assignmentSelect,
            orderBy: { id: "asc" },
            skip,
            take: per_page,
        }),
        prisma.kPIAssignments.count({ where }),
    ]);

    // Fetch access_path using raw SQL for ltree type support
    const assignmentsWithPath = await Promise.all(
        assignments.map(async (a) => {
            const pathResult = await prisma.$queryRaw`
                SELECT access_path::text AS access_path
                FROM "KPIAssignments"
                WHERE id = ${a.id}
            `;
            return {
                ...a,
                access_path: pathResult[0]?.access_path || null,
            };
        })
    );

    const formatted = await Promise.all(assignmentsWithPath.map((a) => formatAssignment(a)));

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
    // Check permission to create KPI assignment
    const allowed = await canCreateKPIAssignment(user, payload);
    if (!allowed) {
        throw new AppError("You do not have permission to create this KPI assignment", 403);
    }

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
                deleted_at: null,
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

    const visibility = payload.visibility || "PUBLIC";

    // Use raw SQL to insert since access_path is ltree type which Prisma doesn't natively support
    const created = await prisma.$queryRaw`
        INSERT INTO "KPIAssignments" (
            company_id,
            kpi_dictionary_id,
            cycle_id,
            target_value,
            current_value,
            unit_id,
            owner_id,
            parent_assignment_id,
            visibility,
            access_path,
            progress_percentage,
            created_at
        ) VALUES (
            ${user.company_id},
            ${payload.kpi_dictionary_id},
            ${payload.cycle_id},
            ${payload.target_value},
            ${payload.current_value ?? 0},
            ${unitId},
            ${ownerId},
            ${payload.parent_assignment_id ?? null},
            ${visibility},
            ${accessPath}::ltree,
            0,
            NOW()
        )
        RETURNING 
            id,
            kpi_dictionary_id,
            cycle_id,
            target_value,
            current_value,
            progress_percentage,
            visibility,
            owner_id,
            unit_id,
            parent_assignment_id,
            access_path::text,
            created_at
    `;

    const result = await formatAssignment(created[0]);

    // If parent_assignment_id is provided, recalculate parent's current_value
    if (payload.parent_assignment_id) {
        await recalculateCurrentValueFromChildren(payload.parent_assignment_id);
    }

    return result;
};

export const updateKPIAssignment = async (user, assignmentId, payload) => {
    const assignment = await prisma.kPIAssignments.findFirst({
        where: { id: assignmentId, deleted_at: null },
    });

    if (!assignment) throw new AppError("KPI Assignment not found", 404);

    const allowed = await canUpdateKPIAssignment(user, assignment);
    if (!allowed) throw new AppError("You do not have permission to edit this assignment", 403);

    const updates = {};

    if (payload.cycle_id !== undefined) {
        const cycle = await prisma.cycles.findFirst({
            where: { id: payload.cycle_id },
            select: { id: true },
        });
        if (!cycle) throw new AppError("Cycle not found", 404);
        updates.cycle_id = payload.cycle_id;
    }

    if (payload.target_value !== undefined) {
        updates.target_value = payload.target_value;
    }

    if (payload.current_value !== undefined) {
        // Check if this assignment has children
        const hasChildren = await prisma.kPIAssignments.findFirst({
            where: { parent_assignment_id: assignmentId, deleted_at: null },
        });

        if (hasChildren) {
            throw new AppError("Cannot update current_value for assignment with children. Current value is calculated from children.", 400);
        }

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
        select: assignmentSelect,
    });

    // If current_value was updated, recalculate all ancestors
    if (updates.current_value !== undefined) {
        const parent = await prisma.kPIAssignments.findUnique({
            where: { id: assignmentId },
            select: { parent_assignment_id: true },
        });

        if (parent?.parent_assignment_id) {
            await recalculateCurrentValueFromChildren(parent.parent_assignment_id);
        }
    }

    // Fetch access_path using raw SQL for ltree type support
    const pathResult = await prisma.$queryRaw`
        SELECT access_path::text AS access_path
        FROM "KPIAssignments"
        WHERE id = ${assignmentId}
    `;

    const updatedWithPath = {
        ...updated,
        access_path: pathResult[0]?.access_path || null,
    };

    return await formatAssignment(updatedWithPath);
};

export const deleteKPIAssignment = async (user, assignmentId, cascade = false) => {
    const assignment = await prisma.kPIAssignments.findFirst({
        where: { id: assignmentId, deleted_at: null },
    });

    if (!assignment) throw new AppError("KPI Assignment not found", 404);

    const allowed = await canUpdateKPIAssignment(user, assignment);
    if (!allowed) throw new AppError("You do not have permission to delete this assignment", 403);

    const parentAssignmentId = assignment.parent_assignment_id;

    if (cascade) {
        // Recursively soft delete all descendants
        const softDeleteDescendantsRecursively = async (parentId) => {
            // Find all direct children
            const children = await prisma.kPIAssignments.findMany({
                where: { parent_assignment_id: parentId, deleted_at: null },
                select: { id: true },
            });

            // Recursively soft delete all children
            for (const child of children) {
                await softDeleteDescendantsRecursively(child.id);
            }

            // Soft delete the parent
            await prisma.kPIAssignments.update({
                where: { id: parentId },
                data: { deleted_at: new Date() },
            });
        };

        await softDeleteDescendantsRecursively(assignmentId);
    } else {
        // Only soft delete the assignment itself
        await prisma.kPIAssignments.update({
            where: { id: assignmentId },
            data: { deleted_at: new Date() },
        });
    }

    // If parent exists, recalculate its current_value
    if (parentAssignmentId) {
        await recalculateCurrentValueFromChildren(parentAssignmentId);
    }
};
