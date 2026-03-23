import prisma from "../../../utils/prisma.js";
import AppError from "../../../utils/appError.js";
import {
    calculateKeyResultProgress,
    daysBetweenUtc,
    recalculateObjectiveProgress,
    canViewObjective,
    canEditObjective,
} from "../okr.utils.js";

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

const getObjectiveForKeyResult = async (companyId, objectiveId) => {
    const objective = await prisma.objectives.findFirst({
        where: { id: objectiveId, company_id: companyId },
        select: {
            id: true,
            status: true,
            visibility: true,
            unit_id: true,
            owner_id: true,
        },
    });

    if (!objective) throw new AppError("Objective not found", 404);
    return objective;
};

const getKeyResultOrThrow = async (companyId, keyResultId) => {
    const keyResult = await prisma.keyResults.findFirst({
        where: { id: keyResultId, company_id: companyId },
        include: {
            objective: {
                select: {
                    id: true,
                    status: true,
                    visibility: true,
                    unit_id: true,
                    owner_id: true,
                },
            },
        },
    });

    if (!keyResult) throw new AppError("Key Result not found", 404);
    return keyResult;
};

const ensureObjectiveEditableStatus = (objective) => {
    if (!["Draft", "Rejected"].includes(objective.status)) {
        throw new AppError("Objective cannot be modified in its current status", 400);
    }
};

export const listKeyResults = async (user, objectiveId) => {
    const companyId = user.company_id;
    const objective = await getObjectiveForKeyResult(companyId, objectiveId);

    const allowed = await canViewObjective(user, objective);
    if (!allowed) {
        throw new AppError("You do not have permission to view this objective", 403);
    }

    const keyResults = await prisma.keyResults.findMany({
        where: { objective_id: objectiveId, company_id: companyId },
        orderBy: { id: "asc" },
        select: keyResultSelect,
    });

    const now = new Date();
    return keyResults.map((kr) => formatKeyResult(kr, now));
};

export const createKeyResult = async (user, objectiveId, payload) => {
    const companyId = user.company_id;
    const objective = await getObjectiveForKeyResult(companyId, objectiveId);

    const allowed = await canEditObjective(user, objective);
    if (!allowed) {
        throw new AppError("You do not have permission to edit this objective", 403);
    }

    ensureObjectiveEditableStatus(objective);

    const weightSum = await prisma.keyResults.aggregate({
        where: { objective_id: objectiveId, company_id: companyId },
        _sum: { weight: true },
    });

    const currentTotal = weightSum._sum.weight ?? 0;
    if (currentTotal + payload.weight > 100) {
        throw new AppError("Total KR weight cannot exceed 100", 422);
    }

    const created = await prisma.keyResults.create({
        data: {
            company_id: companyId,
            objective_id: objectiveId,
            title: payload.title,
            target_value: payload.target_value,
            current_value: 0,
            unit: payload.unit,
            weight: payload.weight,
            due_date: payload.due_date,
            progress_percentage: 0,
        },
        select: keyResultSelect,
    });

    await recalculateObjectiveProgress(objectiveId);

    return formatKeyResult(created, new Date());
};

export const updateKeyResult = async (user, keyResultId, updates) => {
    const companyId = user.company_id;
    const keyResult = await getKeyResultOrThrow(companyId, keyResultId);

    const allowed = await canEditObjective(user, keyResult.objective);
    if (!allowed) {
        throw new AppError("You do not have permission to edit this objective", 403);
    }

    ensureObjectiveEditableStatus(keyResult.objective);

    if (updates.weight !== undefined) {
        const weightSum = await prisma.keyResults.aggregate({
            where: {
                objective_id: keyResult.objective_id,
                company_id: companyId,
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
    const progressPercentage = calculateKeyResultProgress(
        keyResult.current_value,
        targetValue,
    );

    const updated = await prisma.keyResults.update({
        where: { id: keyResultId },
        data: {
            ...(updates.title !== undefined && { title: updates.title }),
            ...(updates.target_value !== undefined && { target_value: updates.target_value }),
            ...(updates.unit !== undefined && { unit: updates.unit }),
            ...(updates.weight !== undefined && { weight: updates.weight }),
            ...(updates.due_date !== undefined && { due_date: updates.due_date }),
            progress_percentage: progressPercentage,
        },
        select: keyResultSelect,
    });

    await recalculateObjectiveProgress(keyResult.objective_id);

    return formatKeyResult(updated, new Date());
};

export const deleteKeyResult = async (user, keyResultId) => {
    const companyId = user.company_id;
    const keyResult = await getKeyResultOrThrow(companyId, keyResultId);

    const allowed = await canEditObjective(user, keyResult.objective);
    if (!allowed) {
        throw new AppError("You do not have permission to edit this objective", 403);
    }

    if (keyResult.objective.status === "Active") {
        throw new AppError("Cannot delete KR when objective is active", 400);
    }

    await prisma.$transaction([
        prisma.checkIns.deleteMany({ where: { key_result_id: keyResultId } }),
        prisma.keyResults.delete({ where: { id: keyResultId } }),
    ]);

    await recalculateObjectiveProgress(keyResult.objective_id);
};
