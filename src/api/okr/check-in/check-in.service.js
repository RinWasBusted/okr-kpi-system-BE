import prisma from "../../../utils/prisma.js";
import AppError from "../../../utils/appError.js";
import {
    calculateKeyResultProgress,
    canViewObjective,
    ensureCycleUnlocked,
    isUnitManager,
    recalculateObjectiveProgress,
} from "../okr.utils.js";
import { UserRole } from "@prisma/client";

const checkInSelect = {
    id: true,
    achieved_value: true,
    progress_snapshot: true,
    evidence_url: true,
    comment: true,
    created_at: true,
};

const getKeyResultWithObjective = async (companyId, keyResultId) => {
    const keyResult = await prisma.keyResults.findFirst({
        where: { id: keyResultId, company_id: companyId },
        include: {
            objective: {
                select: {
                    id: true,
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

const canCheckIn = async (user, objective) => {
    if (user.role === UserRole.ADMIN_COMPANY) return true;
    if (objective.owner_id && objective.owner_id === user.id) return true;
    if (objective.unit_id && await isUnitManager(user.id, objective.unit_id)) return true;
    return false;
};

export const createCheckIn = async (user, keyResultId, payload) => {
    const companyId = user.company_id;
    const keyResult = await getKeyResultWithObjective(companyId, keyResultId);

    const allowed = await canCheckIn(user, keyResult.objective);
    if (!allowed) {
        throw new AppError("You do not have permission to check in", 403, "NOT_KR_OWNER");
    }

    await ensureCycleUnlocked(keyResult.objective.cycle_id);

    const krProgress = calculateKeyResultProgress(
        payload.achieved_value,
        keyResult.target_value,
    );

    const checkIn = await prisma.checkIns.create({
        data: {
            company_id: companyId,
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
    const companyId = user.company_id;
    const keyResult = await getKeyResultWithObjective(companyId, keyResultId);

    const allowed = await canViewObjective(user, keyResult.objective);
    if (!allowed) {
        throw new AppError("You do not have permission to view this objective", 403);
    }

    const checkIns = await prisma.checkIns.findMany({
        where: { key_result_id: keyResultId, company_id: companyId },
        orderBy: { created_at: "asc" },
        select: checkInSelect,
    });

    return checkIns;
};
