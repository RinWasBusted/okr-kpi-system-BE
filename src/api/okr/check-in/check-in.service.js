import prisma from "../../../utils/prisma.js";
import AppError from "../../../utils/appError.js";
import { getCloudinaryImageUrl } from "../../../utils/cloudinary.js";
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
    obj_progress_snapshot: true,
    evidence_url: true,
    comment: true,
    created_at: true,
    user: {
        select: {
            id: true,
            full_name: true,
            avatar_url: true,
        },
    },
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
        keyResult.start_value,
        keyResult.evaluation_method,
    );

    const now = new Date();

    const { checkIn, objectiveProgress } = await prisma.$transaction(async (tx) => {
        await tx.keyResults.update({
            where: { id: keyResultId },
            data: {
                current_value: payload.achieved_value,
                progress_percentage: krProgress,
            },
        });

        const updatedObjectiveProgress = await recalculateObjectiveProgress(
            keyResult.objective_id,
            now,
            tx,
        );

        const createdCheckIn = await tx.checkIns.create({
            data: {
                company_id: user.company_id,
                key_result_id: keyResultId,
                user_id: user.id,
                achieved_value: payload.achieved_value,
                progress_snapshot: krProgress,
                obj_progress_snapshot: updatedObjectiveProgress,
                evidence_url: payload.evidence_url,
                comment: payload.comment ?? null,
            },
            select: checkInSelect,
        });

        return {
            checkIn: createdCheckIn,
            objectiveProgress: updatedObjectiveProgress,
        };
    });

    return {
        check_in: {
            ...checkIn,
            achieved_value: Math.round((checkIn.achieved_value || 0) * 100) / 100,
            progress_snapshot: Math.round((checkIn.progress_snapshot || 0) * 100) / 100,
            obj_progress_snapshot: Math.round((checkIn.obj_progress_snapshot || 0) * 100) / 100,
        },
        kr_progress: Math.round((krProgress || 0) * 100) / 100,
        objective_progress: Math.round((objectiveProgress || 0) * 100) / 100,
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

    return checkIns.map(ci => ({
        ...ci,
        achieved_value: Math.round((ci.achieved_value || 0) * 100) / 100,
        progress_snapshot: Math.round((ci.progress_snapshot || 0) * 100) / 100,
        obj_progress_snapshot: Math.round((ci.obj_progress_snapshot || 0) * 100) / 100,
        user: ci.user ? {
            ...ci.user,
            avatar_url: ci.user.avatar_url
                ? getCloudinaryImageUrl(ci.user.avatar_url, 50, 50, "fill")
                : null,
        } : null,
    }));
};

export const listObjectiveCheckIns = async (user, objectiveId) => {
    const objective = await prisma.objectives.findUnique({
        where: { id: objectiveId },
        select: {
            id: true,
            status: true,
            cycle_id: true,
            visibility: true,
            unit_id: true,
            owner_id: true,
        },
    });

    if (!objective) throw new AppError("Objective not found", 404);

    const allowed = await canViewObjective(user, objective);
    if (!allowed) {
        throw new AppError("You do not have permission to view this objective", 403);
    }

    const checkIns = await prisma.checkIns.findMany({
        where: {
            key_result: {
                objective_id: objectiveId,
            },
        },
        include: {
            key_result: {
                select: {
                    id: true,
                    title: true,
                },
            },
            user: {
                select: {
                    id: true,
                    full_name: true,
                    avatar_url: true,
                },
            },
        },
        orderBy: { created_at: "desc" },
    });

    return checkIns.map((ci) => ({
        id: ci.id,
        achieved_value: Math.round((ci.achieved_value || 0) * 100) / 100,
        progress_snapshot: Math.round((ci.progress_snapshot || 0) * 100) / 100,
        obj_progress_snapshot: Math.round((ci.obj_progress_snapshot || 0) * 100) / 100,
        evidence_url: ci.evidence_url,
        comment: ci.comment,
        created_at: ci.created_at,
        key_result: ci.key_result,
        user: ci.user ? {
            ...ci.user,
            avatar_url: ci.user.avatar_url
                ? getCloudinaryImageUrl(ci.user.avatar_url, 50, 50, "fill")
                : null,
        } : null,
    }));
};

export const listUserActivities = async (user, { cycle_id, limit = 20 }) => {
    // 1. Fetch OKR check-ins performed by this user
    const checkIns = await prisma.checkIns.findMany({
        where: {
            user_id: user.id,
            key_result: {
                objective: {
                    cycle_id: cycle_id,
                    deleted_at: null,
                },
            },
        },
        include: {
            key_result: {
                select: {
                    id: true,
                    title: true,
                    objective: {
                        select: {
                            id: true,
                            title: true,
                        },
                    },
                },
            },
            user: {
                select: {
                    id: true,
                    full_name: true,
                    avatar_url: true,
                },
            },
        },
        orderBy: { created_at: "desc" },
        take: limit,
    });

    // 2. Fetch KPI records for assignments owned by this user
    const kpiRecords = await prisma.kPIRecords.findMany({
        where: {
            kpi_assignment: {
                owner_id: user.id,
                cycle_id: cycle_id,
                deleted_at: null,
            },
        },
        include: {
            kpi_assignment: {
                include: {
                    kpi_dictionary: {
                        select: { name: true },
                    },
                    owner: {
                        select: { id: true, full_name: true, avatar_url: true },
                    },
                },
            },
        },
        orderBy: { created_at: "desc" },
        take: limit,
    });

    // 3. Format and merge
    const okrActivities = checkIns.map((ci) => ({
        id: `okr-${ci.id}`,
        type: "okr",
        title: ci.key_result?.objective?.title || "Unknown Objective",
        subtitle: ci.key_result?.title || "Unknown KR",
        progress: Math.round((ci.progress_snapshot || 0) * 100) / 100,
        comment: ci.comment,
        date: ci.created_at,
        user: ci.user ? {
            ...ci.user,
            avatar_url: ci.user.avatar_url
                ? getCloudinaryImageUrl(ci.user.avatar_url, 50, 50, "fill")
                : null,
        } : null,
    }));

    const kpiActivities = kpiRecords.map((rec) => ({
        id: `kpi-${rec.id}`,
        type: "kpi",
        title: rec.kpi_assignment?.kpi_dictionary?.name || "Unknown KPI",
        subtitle: `${rec.period_start.toISOString().split("T")[0]} → ${rec.period_end.toISOString().split("T")[0]}`,
        progress: Math.round((rec.progress_percentage || 0) * 100) / 100,
        comment: null,
        date: rec.created_at,
        user: rec.kpi_assignment?.owner ? {
            ...rec.kpi_assignment.owner,
            avatar_url: rec.kpi_assignment.owner.avatar_url
                ? getCloudinaryImageUrl(rec.kpi_assignment.owner.avatar_url, 50, 50, "fill")
                : null,
        } : null,
    }));

    const combined = [...okrActivities, ...kpiActivities]
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, limit);

    return combined;
};
