import prisma from "../../../utils/prisma.js";
import AppError from "../../../utils/appError.js";
import {
    calculateKeyResultProgress,
    canEditObjective,
    canViewObjective,
    ensureCycleUnlocked,
    recalculateObjectiveProgress,
} from "../../../utils/okr.js";

const checkInSelect = {
    id: true,
    achieved_value: true,
    progress_snapshot: true,
    evidence_url: true,
    comment: true,
    created_at: true,
};

const getKeyResultWithObjective = async (keyResultId) => {
    const keyResult = await prisma.keyResults.findFirst({
        where: { id: keyResultId },
        include: {
            objective: {
                select: {
                    id: true,
                    status: true,
                    cycle_id: true,
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

export const createCheckIn = async (user, keyResultId, payload) => {
    const keyResult = await getKeyResultWithObjective(keyResultId);

    // Check-in allowed on progress-based statuses (after approval)
    const allowedStatuses = ["NOT_STARTED", "ON_TRACK", "AT_RISK", "CRITICAL", "COMPLETED"];
    if (!allowedStatuses.includes(keyResult.objective.status)) {
        throw new AppError("Objective must be approved to check in", 400);
    }

    const allowed = await canEditObjective(user, keyResult.objective);
    if (!allowed) {
        throw new AppError("You do not have permission to check in", 403);
    }

    await ensureCycleUnlocked(keyResult.objective.cycle_id);

    const krProgress = calculateKeyResultProgress(
        payload.achieved_value,
        keyResult.target_value,
    );

    const checkIn = await prisma.checkIns.create({
        data: {
            company_id: user.company_id,
            key_result_id: keyResultId,
            user_id: user.id,
            achieved_value: payload.achieved_value,
            progress_snapshot: krProgress,
            evidence_url: payload.evidence_url,
            comment: payload.comment ?? null,
        },
        select: checkInSelect,
    });

    await prisma.keyResults.update({
        where: { id: keyResultId },
        data: {
            current_value: payload.achieved_value,
            progress_percentage: krProgress,
        },
    });

    const objectiveProgress = await recalculateObjectiveProgress(keyResult.objective_id);

    return {
        check_in: checkIn,
        kr_progress: krProgress,
        objective_progress: objectiveProgress,
    };
};

export const listCheckIns = async (user, keyResultId) => {
    const keyResult = await getKeyResultWithObjective(keyResultId);

    const allowed = await canViewObjective(user, keyResult.objective);
    if (!allowed) {
        throw new AppError("You do not have permission to view this objective", 403);
    }

    const checkIns = await prisma.checkIns.findMany({
        where: { key_result_id: keyResultId },
        orderBy: { created_at: "asc" },
        select: checkInSelect,
    });

    return checkIns;
};
