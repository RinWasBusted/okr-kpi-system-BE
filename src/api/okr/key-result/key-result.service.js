import prisma from "../../../utils/prisma.js";
import AppError from "../../../utils/appError.js";
import {
    canApproveObjective,
    canEditObjective,
    calculateKeyResultProgress,
    recalculateObjectiveProgress,
} from "../../../utils/okr.js";
import { daysBetweenUtc } from "../../../utils/date.js";
import {
    getObjectiveAccessPath,
    getUnitPath,
} from "../../../utils/path.js";

// Utility functions
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
    const UserRole = (await import("@prisma/client")).UserRole;
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

const keyResultSelect = {
    id: true,
    title: true,
    start_value: true,
    target_value: true,
    current_value: true,
    unit: true,
    weight: true,
    due_date: true,
    progress_percentage: true,
    evaluation_method: true,
};

const formatKeyResult = (kr, now) => ({
    id: kr.id,
    title: kr.title,
    start_value: kr.start_value,
    target_value: kr.target_value,
    current_value: kr.current_value,
    unit: kr.unit,
    weight: kr.weight,
    due_date: kr.due_date,
    progress_percentage: Math.round(kr.progress_percentage * 100) / 100,
    evaluation_method: kr.evaluation_method,
    days_until_due: kr.due_date ? daysBetweenUtc(kr.due_date, now) : null,
});

const getObjectiveForKeyResult = async (objectiveId) => {
    const objective = await prisma.$queryRaw`
        SELECT id, status, visibility, unit_id, owner_id, access_path::text AS access_path
        FROM "Objectives"
        WHERE id = ${objectiveId}
    `;

    if (!objective || objective.length === 0) throw new AppError("Objective not found", 404);
    return objective[0];
};

const getKeyResultOrThrow = async (keyResultId) => {
    const keyResult = await prisma.$queryRaw`
        SELECT
            kr.id, kr.objective_id, kr.title, kr.start_value, kr.target_value, kr.current_value, kr.unit, kr.weight, kr.due_date, kr.progress_percentage, kr.evaluation_method,
            obj.id AS objective_id_obj, obj.status, obj.visibility, obj.unit_id, obj.owner_id, obj.access_path::text AS access_path
        FROM "KeyResults" kr
        JOIN "Objectives" obj ON kr.objective_id = obj.id
        WHERE kr.id = ${keyResultId}
    `;

    if (!keyResult || keyResult.length === 0) throw new AppError("Key Result not found", 404);

    const kr = keyResult[0];
    return {
        id: kr.id,
        objective_id: kr.objective_id,
        title: kr.title,
        start_value: kr.start_value,
        target_value: kr.target_value,
        current_value: kr.current_value,
        unit: kr.unit,
        weight: kr.weight,
        due_date: kr.due_date,
        progress_percentage: kr.progress_percentage,
        evaluation_method: kr.evaluation_method,
        objective: {
            id: kr.objective_id_obj,
            status: kr.status,
            visibility: kr.visibility,
            unit_id: kr.unit_id,
            owner_id: kr.owner_id,
            access_path: kr.access_path,
        },
    };
};

const ensureObjectiveEditableStatus = (objective) => {
    if (!["Draft", "Rejected"].includes(objective.status)) {
        throw new AppError("Objective cannot be modified in its current status", 400);
    }
};

export const listKeyResults = async (user, objectiveId) => {
    const objective = await getObjectiveForKeyResult(objectiveId);

    const allowed = await canViewObjective(user, objective);
    if (!allowed) {
        throw new AppError("You do not have permission to view this objective", 403);
    }

    const keyResults = await prisma.keyResults.findMany({
        where: { objective_id: objectiveId },
        orderBy: { id: "asc" },
        select: keyResultSelect,
    });

    const now = new Date();
    return keyResults.map((kr) => formatKeyResult(kr, now));
};

export const createKeyResult = async (user, objectiveId, payload) => {
    const objective = await getObjectiveForKeyResult(objectiveId);

    const allowed = await canEditObjective(user, objective);
    if (!allowed) {
        throw new AppError("You do not have permission to edit this objective", 403);
    }

    ensureObjectiveEditableStatus(objective);

    const weightSum = await prisma.keyResults.aggregate({
        where: { objective_id: objectiveId },
        _sum: { weight: true },
    });

    const currentTotal = weightSum._sum.weight ?? 0;
    if (currentTotal + payload.weight > 100) {
        throw new AppError("Total KR weight cannot exceed 100", 422);
    }

    // start_value defaults to current_value if not provided (captures baseline at creation)
    const startValue = payload.start_value ?? payload.current_value ?? 0;
    const currentValue = payload.current_value ?? 0;
    const evaluationMethod = payload.evaluation_method ?? "MAXIMIZE";

    const progressPercentage = calculateKeyResultProgress(
        currentValue,
        payload.target_value,
        startValue,
        evaluationMethod,
    );

    const created = await prisma.keyResults.create({
        data: {
            company_id: user.company_id,
            objective_id: objectiveId,
            title: payload.title,
            start_value: startValue,
            target_value: payload.target_value,
            current_value: currentValue,
            unit: payload.unit,
            weight: payload.weight,
            due_date: payload.due_date,
            progress_percentage: progressPercentage,
            evaluation_method: evaluationMethod,
        },
        select: keyResultSelect,
    });

    await recalculateObjectiveProgress(objectiveId);

    return formatKeyResult(created, new Date());
};

export const updateKeyResult = async (user, keyResultId, updates) => {
    const keyResult = await getKeyResultOrThrow(keyResultId);

    const allowed = await canEditObjective(user, keyResult.objective);
    if (!allowed) {
        throw new AppError("You do not have permission to edit this objective", 403);
    }

    ensureObjectiveEditableStatus(keyResult.objective);

    if (updates.weight !== undefined) {
        const weightSum = await prisma.keyResults.aggregate({
            where: {
                objective_id: keyResult.objective_id,
                id: { not: keyResultId },
            },
            _sum: { weight: true },
        });

        const currentTotal = weightSum._sum.weight ?? 0;
        if (currentTotal + updates.weight > 100) {
            throw new AppError("Total KR weight cannot exceed 100", 422);
        }
    }

    const targetValue = updates.target_value ?? keyResult.target_value;
    const currentValue = updates.current_value ?? keyResult.current_value;
    // If start_value is being updated but not provided, use current_value as default
    const startValue = updates.start_value ?? keyResult.start_value ?? currentValue ?? 0;
    const evaluationMethod = updates.evaluation_method ?? keyResult.evaluation_method;
    const progressPercentage = calculateKeyResultProgress(
        currentValue,
        targetValue,
        startValue,
        evaluationMethod,
    );

    const updated = await prisma.keyResults.update({
        where: { id: keyResultId },
        data: {
            ...(updates.title !== undefined && { title: updates.title }),
            ...(updates.start_value !== undefined && { start_value: updates.start_value }),
            ...(updates.target_value !== undefined && { target_value: updates.target_value }),
            ...(updates.current_value !== undefined && { current_value: updates.current_value }),
            ...(updates.unit !== undefined && { unit: updates.unit }),
            ...(updates.weight !== undefined && { weight: updates.weight }),
            ...(updates.due_date !== undefined && { due_date: updates.due_date }),
            ...(updates.evaluation_method !== undefined && { evaluation_method: updates.evaluation_method }),
            progress_percentage: progressPercentage,
        },
        select: keyResultSelect,
    });

    await recalculateObjectiveProgress(keyResult.objective_id);

    return formatKeyResult(updated, new Date());
};

export const deleteKeyResult = async (user, keyResultId) => {
    const keyResult = await getKeyResultOrThrow(keyResultId);

    const allowed = await canEditObjective(user, keyResult.objective);
    if (!allowed) {
        throw new AppError("You do not have permission to edit this objective", 403);
    }

    // Can only delete KR when objective is in Draft or Rejected status
    const deletableStatuses = ["Draft", "Rejected"];
    if (!deletableStatuses.includes(keyResult.objective.status)) {
        throw new AppError("Cannot delete KR when objective is not in Draft or Rejected status", 400);
    }

    await prisma.$transaction([
        prisma.checkIns.deleteMany({ where: { key_result_id: keyResultId } }),
        prisma.feedbacks.updateMany({
            where: { kr_tag_id: keyResultId },
            data: { kr_tag_id: null },
        }),
        prisma.keyResults.delete({ where: { id: keyResultId } }),
    ]);

    await recalculateObjectiveProgress(keyResult.objective_id);
};
