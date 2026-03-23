import prisma from "../../../utils/prisma.js";
import AppError from "../../../utils/appError.js";
import { UserRole } from "@prisma/client";
import {
    canApproveObjective,
    canEditObjective,
    canViewObjective,
    getUnitContext,
    isAncestorUnit,
    recalculateObjectiveProgress,
    daysBetweenUtc,
} from "../okr.utils.js";

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
        cycle_id: objective.cycle_id,
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

const buildVisibilityWhere = async (user) => {
    if (user.role === UserRole.ADMIN_COMPANY) return null;

    const context = user.unit_id ? await getUnitContext(user.unit_id) : null;
    const orConditions = [{ visibility: "PUBLIC" }];

    if (context && context.lineage.length > 0) {
        orConditions.push({
            visibility: "INTERNAL",
            unit_id: { in: context.lineage },
        });
    }

    const privateConditions = [{ owner_id: user.id }];
    if (context && context.descendants.length > 0) {
        privateConditions.push({ unit_id: { in: context.descendants } });
    }

    orConditions.push({
        visibility: "PRIVATE",
        OR: privateConditions,
    });

    return { OR: orConditions };
};

const getObjectiveOrThrow = async (companyId, objectiveId, includeRelations = false) => {
    const objective = await prisma.objectives.findFirst({
        where: { id: objectiveId, company_id: companyId },
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
    return objective;
};

const ensureCycleExists = async (companyId, cycleId) => {
    const cycle = await prisma.cycles.findFirst({
        where: { id: cycleId, company_id: companyId },
        select: { id: true },
    });
    if (!cycle) throw new AppError("Cycle not found", 404);
};

const ensureUnitExists = async (companyId, unitId) => {
    const unit = await prisma.units.findFirst({
        where: { id: unitId, company_id: companyId },
        select: { id: true, parent_id: true },
    });
    if (!unit) throw new AppError("Unit not found", 404);
    return unit;
};

const ensureUserExists = async (companyId, userId) => {
    const user = await prisma.users.findFirst({
        where: { id: userId, company_id: companyId },
        select: { id: true, unit_id: true },
    });
    if (!user) throw new AppError("User not found", 404);
    return user;
};

const resolveVisibility = (visibility) => visibility ?? "INTERNAL";

const determineObjectiveStatus = async (user, targetUnitId, ownerId) => {
    if (user.role === UserRole.ADMIN_COMPANY) return "Active";

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
    companyId,
    user,
    filters,
    include_key_results,
    page,
    per_page,
}) => {
    const where = {
        company_id: companyId,
        ...(filters.cycle_id !== undefined && { cycle_id: filters.cycle_id }),
        ...(filters.unit_id !== undefined && { unit_id: filters.unit_id }),
        ...(filters.owner_id !== undefined && { owner_id: filters.owner_id }),
        ...(filters.status !== undefined && { status: filters.status }),
        ...(filters.parent_objective_id !== undefined && {
            parent_objective_id: filters.parent_objective_id,
        }),
        ...(filters.visibility !== undefined && { visibility: filters.visibility }),
    };

    const visibilityWhere = await buildVisibilityWhere(user);
    if (visibilityWhere) {
        where.AND = [visibilityWhere];
    }

    const select = {
        ...objectiveBaseSelect,
        ...(include_key_results && { key_results: { select: keyResultSelect } }),
    };

    const [total, objectives] = await Promise.all([
        prisma.objectives.count({ where }),
        prisma.objectives.findMany({
            where,
            skip: (page - 1) * per_page,
            take: per_page,
            orderBy: { created_at: "desc" },
            select,
        }),
    ]);

    return {
        total,
        data: objectives.map((objective) => formatObjective(objective, include_key_results)),
        last_page: Math.ceil(total / per_page),
    };
};

export const createObjective = async (user, payload) => {
    const companyId = user.company_id;
    await ensureCycleExists(companyId, payload.cycle_id);

    let owner = null;
    if (payload.owner_id) {
        owner = await ensureUserExists(companyId, payload.owner_id);
    }

    let unitId = payload.unit_id ?? owner?.unit_id ?? null;
    if (!unitId) throw new AppError("unit_id is required", 422);

    await ensureUnitExists(companyId, unitId);

    if (owner && owner.unit_id && owner.unit_id !== unitId) {
        throw new AppError("owner_id does not belong to unit_id", 422);
    }

    if (payload.parent_objective_id) {
        const parent = await prisma.objectives.findFirst({
            where: { id: payload.parent_objective_id, company_id: companyId },
            select: { id: true },
        });
        if (!parent) throw new AppError("Parent objective not found", 404);
    }

    const resolvedVisibility = resolveVisibility(payload.visibility);
    if (resolvedVisibility === "PRIVATE" && !payload.owner_id) {
        throw new AppError("owner_id is required for PRIVATE objectives", 422);
    }

    const status = await determineObjectiveStatus(user, unitId, payload.owner_id ?? null);

    const objective = await prisma.objectives.create({
        data: {
            company_id: companyId,
            title: payload.title,
            cycle_id: payload.cycle_id,
            unit_id: unitId,
            owner_id: payload.owner_id ?? null,
            parent_objective_id: payload.parent_objective_id ?? null,
            visibility: resolvedVisibility,
            status,
            approved_by: null,
            progress_percentage: 0,
        },
        select: objectiveBaseSelect,
    });

    return formatObjective(objective);
};

export const updateObjective = async (user, objectiveId, updates) => {
    const companyId = user.company_id;
    const objective = await getObjectiveOrThrow(companyId, objectiveId);

    if (!await canEditObjective(user, objective)) {
        throw new AppError("You do not have permission to update this objective", 403);
    }

    if (!['Draft', 'Rejected'].includes(objective.status)) {
        throw new AppError("Objective cannot be updated in its current status", 400);
    }

    if (updates.parent_objective_id !== undefined && updates.parent_objective_id !== null) {
        if (updates.parent_objective_id === objectiveId) {
            throw new AppError("Objective cannot be its own parent", 400);
        }
        const parent = await prisma.objectives.findFirst({
            where: { id: updates.parent_objective_id, company_id: companyId },
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
            status: "Draft",
            approved_by: null,
        },
        select: objectiveBaseSelect,
    });

    return formatObjective(updated);
};

export const submitObjective = async (user, objectiveId) => {
    const companyId = user.company_id;
    const objective = await getObjectiveOrThrow(companyId, objectiveId);

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
    const companyId = user.company_id;
    const objective = await getObjectiveOrThrow(companyId, objectiveId);

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
            where: { id: updates.parent_objective_id, company_id: companyId },
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
    const companyId = user.company_id;
    const objective = await getObjectiveOrThrow(companyId, objectiveId);

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
                company_id: companyId,
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
    const companyId = user.company_id;
    const objective = await getObjectiveOrThrow(companyId, objectiveId);
    const canView = await canViewObjective(user, objective);
    if (!canView) {
        throw new AppError("You do not have permission to view this objective", 403);
    }
    return objective;
};

export const ensureObjectiveEditable = async (user, objectiveId) => {
    const companyId = user.company_id;
    const objective = await getObjectiveOrThrow(companyId, objectiveId);
    const canEdit = await canEditObjective(user, objective);
    if (!canEdit) {
        throw new AppError("You do not have permission to edit this objective", 403);
    }
    return objective;
};
