import prisma from "../../../utils/prisma.js";
import AppError from "../../../utils/appError.js";
import { UserRole } from "@prisma/client";
import {
    canApproveObjective,
    canEditObjective,
    recalculateObjectiveProgress,
    calculateKeyResultProgress,
} from "../../../utils/okr.js";
import { daysBetweenUtc } from "../../../utils/date.js";
import {
    getObjectiveAccessPath,
    getUnitPath,
    isAncestorUnit,
} from "../../../utils/path.js";

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

const canViewObjective = async (user, objective, unitContext) => {
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

const ownerSelect = {
    id: true,
    full_name: true,
    email: true,
    avatar_url: true,
    job_title: true,
    unit_id: true,
};

const unitSelect = {
    id: true,
    name: true,
    parent_id: true,
};

const objectiveBaseSelect = {
    id: true,
    title: true,
    status: true,
    visibility: true,
    progress_percentage: true,
    cycle_id: true,
    unit_id: true,
    owner_id: true,
    parent_objective_id: true,
    created_at: true,
    cycle: { select: { id: true, name: true } },
    owner: { select: ownerSelect },
    unit: { select: unitSelect },
    parent_objective: { select: { id: true, title: true } },
    approver: { select: { id: true, full_name: true, email: true, avatar_url: true } },
};

const keyResultSelect = {
    id: true,
    title: true,
    target_value: true,
    current_value: true,
    unit: true,
    weight: true,
    due_date: true,
    progress_percentage: true,
};

const formatKeyResult = (kr, now) => ({
    id: kr.id,
    title: kr.title,
    target_value: kr.target_value,
    current_value: kr.current_value,
    unit: kr.unit,
    weight: kr.weight,
    due_date: kr.due_date,
    progress_percentage: kr.progress_percentage,
    days_until_due: kr.due_date ? daysBetweenUtc(kr.due_date, now) : null,
});

const formatObjective = (objective, includeKeyResults = false) => {
    const now = new Date();
    return {
        id: objective.id,
        title: objective.title,
        status: objective.status,
        visibility: objective.visibility,
        progress_percentage: objective.progress_percentage,
        cycle_name: objective.cycle?.name,
        unit_id: objective.unit_id,
        owner_id: objective.owner_id,
        parent_objective_id: objective.parent_objective_id,
        created_at: objective.created_at,
        owner: objective.owner ?? null,
        unit: objective.unit ?? null,
        parent_objective: objective.parent_objective ?? null,
        approved_by: objective.approver ?? null,
        ...(includeKeyResults && {
            key_results: (objective.key_results || []).map((kr) => formatKeyResult(kr, now)),
        }),
    };
};

const getVisibleObjectiveIds = async (user) => {
    if (user.role === UserRole.ADMIN_COMPANY) return null;

    const userPath = user.unit_id ? await getUnitPath(user.unit_id) : null;

    if (!userPath) {
        const rows = await prisma.$queryRaw`
            SELECT id
            FROM "Objectives"
            WHERE (
                visibility = 'PUBLIC'
                OR (visibility = 'PRIVATE' AND owner_id = ${user.id})
              )
        `;
        return rows.map((row) => row.id);
    }

    const rows = await prisma.$queryRaw`
        SELECT id
        FROM "Objectives"
        WHERE (
            visibility = 'PUBLIC'
            OR (
                visibility = 'INTERNAL'
                AND (access_path <@ ${userPath}::ltree OR access_path @> ${userPath}::ltree)
            )
            OR (
                visibility = 'PRIVATE'
                AND (
                    owner_id = ${user.id}
                    OR (access_path <@ ${userPath}::ltree AND access_path <> ${userPath}::ltree)
                )
            )
          )
    `;

    return rows.map((row) => row.id);
};

const getObjectiveOrThrow = async (objectiveId, includeRelations = false) => {
    const objective = await prisma.objectives.findFirst({
        where: { id: objectiveId },
        ...(includeRelations
            ? {
                  select: {
                      ...objectiveBaseSelect,
                      ...(includeRelations.key_results && { key_results: { select: keyResultSelect } }),
                  },
              }
            : { select: objectiveBaseSelect }),
    });

    if (!objective) throw new AppError("Objective not found", 404);
    objective.access_path = await getObjectiveAccessPath(objective.id);
    return objective;
};

const ensureCycleExists = async (cycleId) => {
    const cycle = await prisma.cycles.findFirst({
        where: { id: cycleId },
        select: { id: true },
    });
    if (!cycle) throw new AppError("Cycle not found", 404);
};

const ensureUnitExists = async (unitId) => {
    const unit = await prisma.units.findFirst({
        where: { id: unitId },
        select: { id: true, parent_id: true },
    });
    if (!unit) throw new AppError("Unit not found", 404);
    return unit;
};

const ensureUserExists = async (userId) => {
    const user = await prisma.users.findFirst({
        where: { id: userId },
        select: { id: true, unit_id: true },
    });
    if (!user) throw new AppError("User not found", 404);
    return user;
};

const resolveVisibility = (visibility) => visibility ?? "INTERNAL";

const determineObjectiveStatus = async (user, targetUnitId, ownerId) => {
    if (user.role === UserRole.ADMIN_COMPANY) return "Active";

    if (!targetUnitId && !ownerId) {
        throw new AppError("You do not have permission to create this objective", 403);
    }

    if (ownerId && ownerId === user.id) return "Draft";

    if (!user.unit_id || !targetUnitId) {
        throw new AppError("You do not have permission to create this objective", 403);
    }

    if (user.unit_id === targetUnitId) return "Draft";

    const isAncestor = await isAncestorUnit(user.unit_id, targetUnitId);
    if (!isAncestor) {
        throw new AppError("You do not have permission to create this objective", 403);
    }

    return "Active";
};

export const listObjectives = async ({
    user,
    filters,
    include_key_results,
    page,
    per_page,
}) => {
    const visibleObjectiveIds = await getVisibleObjectiveIds(user);

    const where = {
        ...(filters.cycle_id !== undefined && { cycle_id: filters.cycle_id }),
        ...(filters.unit_id !== undefined && { unit_id: filters.unit_id }),
        ...(filters.owner_id !== undefined && { owner_id: filters.owner_id }),
        ...(filters.status !== undefined && { status: filters.status }),
        ...(filters.parent_objective_id !== undefined && {
            parent_objective_id: filters.parent_objective_id,
        }),
        ...(filters.visibility !== undefined && { visibility: filters.visibility }),
    };

    if (visibleObjectiveIds) {
        if (visibleObjectiveIds.length === 0) {
            return { total: 0, data: [], last_page: 0 };
        }
        where.id = { in: visibleObjectiveIds };
    }

    const select = {
        ...objectiveBaseSelect,
        ...(include_key_results && { key_results: { select: keyResultSelect } }),
    };

    // Get all objectives matching filters (no pagination yet)
    const allObjectives = await prisma.objectives.findMany({
        where,
        orderBy: { created_at: "desc" },
        select,
    });

    // Build tree structure
    const objectivesMap = new Map();
    const formattedObjectives = allObjectives.map((objective) => ({
        ...formatObjective(objective, include_key_results),
        sub_objectives: [],
    }));

    // Create map for quick lookup
    formattedObjectives.forEach((objective) => {
        objectivesMap.set(objective.id, objective);
    });

    // Build parent-child relationships
    const rootObjectives = [];
    formattedObjectives.forEach((objective) => {
        if (objective.parent_objective_id === null) {
            rootObjectives.push(objective);
        } else {
            const parent = objectivesMap.get(objective.parent_objective_id);
            if (parent) {
                parent.sub_objectives.push(objective);
            }
        }
    });

    // Apply pagination to root objectives
    const offset = (page - 1) * per_page;
    const paginatedRoots = rootObjectives.slice(offset, offset + per_page);

    return {
        total: rootObjectives.length,
        data: paginatedRoots,
        last_page: Math.ceil(rootObjectives.length / per_page),
    };
};

export const createObjective = async (user, payload) => {
    await ensureCycleExists(payload.cycle_id);

    let owner = null;
    if (payload.owner_id) {
        owner = await ensureUserExists(payload.owner_id);
    }

    let unitId = payload.unit_id ?? owner?.unit_id ?? null;

    const isCompanyWide = !unitId && !payload.owner_id;

    if (isCompanyWide) {
        // Only AdminCompany can create a company-wide objective
        if (user.role !== UserRole.ADMIN_COMPANY) {
            throw new AppError("Only admins can create company-wide objectives", 403);
        }
        // Company-wide objectives must be PUBLIC — other visibilities make no sense
        // without a unit scope
        if (payload.visibility && payload.visibility !== "PUBLIC") {
            throw new AppError("Company-wide objectives must have PUBLIC visibility", 422);
        }
    } else {
        // Unit-scoped or personal objective — unit_id is required
        if (!unitId) throw new AppError("unit_id is required", 422);

        await ensureUnitExists(unitId);

        if (owner && owner.unit_id && owner.unit_id !== unitId) {
            throw new AppError("owner_id does not belong to unit_id", 422);
        }
    }

    if (payload.parent_objective_id) {
        const parent = await prisma.objectives.findFirst({
            where: { id: payload.parent_objective_id },
            select: { id: true },
        });
        if (!parent) throw new AppError("Parent objective not found", 404);
    }

    const resolvedVisibility = resolveVisibility(payload.visibility);
    if (resolvedVisibility === "PRIVATE" && !payload.owner_id) {
        throw new AppError("owner_id is required for PRIVATE objectives", 422);
    }

    const status = await determineObjectiveStatus(user, unitId, payload.owner_id ?? null);
    
    let accessPath;
    if (unitId) {
        accessPath = await getUnitPath(unitId);
        if (!accessPath) throw new AppError("Unit not found", 404);
    } else {
        accessPath = "company";
    }

    const nextIdRows = await prisma.$queryRaw`
        SELECT nextval(pg_get_serial_sequence('"Objectives"', 'id'))::int AS id
    `;
    const objectiveId = nextIdRows[0]?.id;
    if (!objectiveId) throw new AppError("Failed to allocate objective ID", 500);

    await prisma.$executeRaw`
        INSERT INTO "Objectives" (
            id,
            company_id,
            title,
            cycle_id,
            unit_id,
            owner_id,
            parent_objective_id,
            visibility,
            access_path,
            status,
            approved_by,
            progress_percentage
        )
        VALUES (
            ${objectiveId},
            ${user.company_id},
            ${payload.title},
            ${payload.cycle_id},
            ${unitId},
            ${payload.owner_id ?? null},
            ${payload.parent_objective_id ?? null},
            ${resolvedVisibility},
            ${accessPath}::ltree,
            ${status},
            ${null},
            ${0}
        )
    `;

    const objective = await prisma.objectives.findFirst({
        where: { id: objectiveId },
        select: objectiveBaseSelect,
    });

    return formatObjective(objective);
};

export const updateObjective = async (user, objectiveId, updates) => {
    const objective = await getObjectiveOrThrow(objectiveId);

    if (!await canEditObjective(user, objective)) {
        throw new AppError("You do not have permission to update this objective", 403);
    }

    const editableStatuses = ["Draft", "Rejected", "Active"];
    if (!editableStatuses.includes(objective.status)) {
        throw new AppError("Objective cannot be updated in its current status", 400);
    }

    const keepActiveState = objective.status === "Active";

    if (updates.parent_objective_id !== undefined && updates.parent_objective_id !== null) {
        if (updates.parent_objective_id === objectiveId) {
            throw new AppError("Objective cannot be its own parent", 400);
        }
        const parent = await prisma.objectives.findFirst({
            where: { id: updates.parent_objective_id },
            select: { id: true },
        });
        if (!parent) throw new AppError("Parent objective not found", 404);
    }

    if (updates.visibility === "PRIVATE" && !objective.owner_id) {
        throw new AppError("owner_id is required for PRIVATE objectives", 422);
    }

    const data = {
        ...(updates.title !== undefined && { title: updates.title }),
        ...(updates.parent_objective_id !== undefined && {
            parent_objective_id: updates.parent_objective_id,
        }),
        ...(updates.visibility !== undefined && { visibility: updates.visibility }),
    };

    if (!keepActiveState) {
        data.status = "Draft";
        data.approved_by = null;
    }

    const updated = await prisma.objectives.update({
        where: { id: objectiveId },
        data,
        select: objectiveBaseSelect,
    });

    return formatObjective(updated);
};

export const submitObjective = async (user, objectiveId) => {
    const objective = await getObjectiveOrThrow(objectiveId);

    if (!await canEditObjective(user, objective)) {
        throw new AppError("You do not have permission to submit this objective", 403);
    }

    if (!['Draft', 'Rejected'].includes(objective.status)) {
        throw new AppError("Objective cannot be submitted in its current status", 400);
    }

    const updated = await prisma.objectives.update({
        where: { id: objectiveId },
        data: { status: "Pending_Approval", approved_by: null },
        select: objectiveBaseSelect,
    });

    return formatObjective(updated);
};

export const approveObjective = async (user, objectiveId, updates) => {
    const objective = await getObjectiveOrThrow(objectiveId);

    if (!await canApproveObjective(user, objective)) {
        throw new AppError("You do not have permission to approve this objective", 403);
    }

    if (objective.status !== "Pending_Approval") {
        throw new AppError("Objective is not pending approval", 400);
    }

    if (updates.parent_objective_id !== undefined && updates.parent_objective_id !== null) {
        if (updates.parent_objective_id === objectiveId) {
            throw new AppError("Objective cannot be its own parent", 400);
        }
        const parent = await prisma.objectives.findFirst({
            where: { id: updates.parent_objective_id },
            select: { id: true },
        });
        if (!parent) throw new AppError("Parent objective not found", 404);
    }

    if (updates.visibility === "PRIVATE" && !objective.owner_id) {
        throw new AppError("owner_id is required for PRIVATE objectives", 422);
    }

    const updated = await prisma.objectives.update({
        where: { id: objectiveId },
        data: {
            ...(updates.title !== undefined && { title: updates.title }),
            ...(updates.parent_objective_id !== undefined && {
                parent_objective_id: updates.parent_objective_id,
            }),
            ...(updates.visibility !== undefined && { visibility: updates.visibility }),
            status: "Active",
            approved_by: user.id,
        },
        select: objectiveBaseSelect,
    });

    await recalculateObjectiveProgress(objectiveId);

    return formatObjective(updated);
};

export const rejectObjective = async (user, objectiveId, comment) => {
    const objective = await getObjectiveOrThrow(objectiveId);

    if (!await canApproveObjective(user, objective)) {
        throw new AppError("You do not have permission to reject this objective", 403);
    }

    if (objective.status !== "Pending_Approval") {
        throw new AppError("Objective is not pending approval", 400);
    }

    const updated = await prisma.objectives.update({
        where: { id: objectiveId },
        data: { status: "Rejected", approved_by: user.id },
        select: objectiveBaseSelect,
    });

    if (comment) {
        await prisma.feedbacks.create({
            data: {
                company_id: user.company_id,
                objective_id: objectiveId,
                user_id: user.id,
                content: comment,
                type: "rejection",
            },
        });
    }

    return formatObjective(updated);
};

export const ensureObjectiveVisible = async (user, objectiveId) => {
    const objective = await getObjectiveOrThrow(objectiveId);
    const canView = await canViewObjective(user, objective);
    if (!canView) {
        throw new AppError("You do not have permission to view this objective", 403);
    }
    return objective;
};

export const ensureObjectiveEditable = async (user, objectiveId) => {
    const objective = await getObjectiveOrThrow(objectiveId);
    const canEdit = await canEditObjective(user, objective);
    if (!canEdit) {
        throw new AppError("You do not have permission to edit this objective", 403);
    }
    return objective;
};

export const deleteObjective = async (user, objectiveId) => {
    const objective = await getObjectiveOrThrow(objectiveId);

    if (!await canEditObjective(user, objective)) {
        throw new AppError("You do not have permission to delete this objective", 403);
    }

    const now = new Date();

    await prisma.$transaction([
        
        prisma.feedbacks.deleteMany({
            where: { objective_id: objectiveId, parent_id: { not: null } },
        }),
        
        prisma.feedbacks.deleteMany({
            where: { objective_id: objectiveId },
        }),

        prisma.keyResults.updateMany({
            where: { objective_id: objectiveId },
            data: { deleted_at: now },
        }),
        prisma.objectives.update({
            where: { id: objectiveId },
            data: { deleted_at: now },
        }),
    ]);

    return { success: true, message: "Objective deleted successfully" };
};
