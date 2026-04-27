import { PerformanceRating, ProgressStatus, UserRole } from "@prisma/client";
import prisma from "../../utils/prisma.js";
import requestContext from "../../utils/context.js";
import AppError from "../../utils/appError.js";
import { getCloudinaryImageUrl } from "../../utils/cloudinary.js";

const TIMEZONE = "Asia/Ho_Chi_Minh";
const DEFAULT_TOP_PERFORMERS_LIMIT = 5;

const ratingOrder = [
    PerformanceRating.EXCELLENT,
    PerformanceRating.GOOD,
    PerformanceRating.ABOVE_AVERAGE,
    PerformanceRating.SATISFACTORY,
    PerformanceRating.NEEDS_IMPROVEMENT,
];

const roundMetric = (value) => Math.round((Number(value) || 0) * 100) / 100;

const getDateOnlyInTimezone = (timeZone = TIMEZONE, date = new Date()) => {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(date);

    const year = parts.find((part) => part.type === "year")?.value;
    const month = parts.find((part) => part.type === "month")?.value;
    const day = parts.find((part) => part.type === "day")?.value;

    return new Date(`${year}-${month}-${day}T00:00:00.000Z`);
};

export const getYesterdayInTimezone = (timeZone = TIMEZONE, date = new Date()) => {
    const today = getDateOnlyInTimezone(timeZone, date);
    return new Date(today.getTime() - 24 * 60 * 60 * 1000);
};

const withCompanyContext = async (companyId, callback) => {
    const currentStore = requestContext.getStore();

    if (currentStore?.company_id === companyId) {
        return callback();
    }

    return requestContext.run(
        {
            company_id: companyId,
            role: currentStore?.role || UserRole.ADMIN_COMPANY,
            user_id: currentStore?.user_id ?? "",
            unit_path: currentStore?.unit_path ?? "",
        },
        callback,
    );
};

const buildPaginationMeta = (total, page, per_page) => ({
    total,
    page,
    per_page,
    last_page: Math.ceil(total / per_page),
});

const formatEvaluatee = (user) => ({
    id: user.id,
    full_name: user.full_name,
    job_title: user.job_title ?? null,
    avatar_url: user.avatar_url
        ? getCloudinaryImageUrl(user.avatar_url, 50, 50, "fill")
        : null,
});

const formatUnit = (unit) =>
    unit
        ? {
            id: unit.id,
            name: unit.name,
        }
        : null;

const formatCycle = (cycle) =>
    cycle
        ? {
            id: cycle.id,
            name: cycle.name,
            start_date: cycle.start_date,
            end_date: cycle.end_date,
        }
        : null;

const formatEvaluationListItem = (evaluation) => ({
    id: evaluation.id,
    evaluatee: formatEvaluatee(evaluation.evaluatee),
    unit: formatUnit(evaluation.unit),
    okr_count: evaluation.okr_count,
    kpi_count: evaluation.kpi_count,
    avg_okr_progress: roundMetric(evaluation.avg_okr_progress),
    avg_kpi_progress: roundMetric(evaluation.avg_kpi_progress),
    composite_score: roundMetric(evaluation.composite_score),
    rating: evaluation.rating,
    created_at: evaluation.created_at,
});

const formatEvaluationHistoryItem = (evaluation) => ({
    id: evaluation.id,
    cycle: formatCycle(evaluation.cycle),
    unit: formatUnit(evaluation.unit),
    okr_count: evaluation.okr_count,
    kpi_count: evaluation.kpi_count,
    avg_okr_progress: roundMetric(evaluation.avg_okr_progress),
    avg_kpi_progress: roundMetric(evaluation.avg_kpi_progress),
    composite_score: roundMetric(evaluation.composite_score),
    rating: evaluation.rating,
    created_at: evaluation.created_at,
});

const formatEvaluationDetail = (evaluation) => ({
    id: evaluation.id,
    cycle: formatCycle(evaluation.cycle),
    evaluatee: formatEvaluatee(evaluation.evaluatee),
    unit: formatUnit(evaluation.unit),
    okr_count: evaluation.okr_count,
    kpi_count: evaluation.kpi_count,
    avg_okr_progress: roundMetric(evaluation.avg_okr_progress),
    avg_kpi_progress: roundMetric(evaluation.avg_kpi_progress),
    composite_score: roundMetric(evaluation.composite_score),
    rating: evaluation.rating,
    created_at: evaluation.created_at,
    updated_at: evaluation.updated_at,
});

const getRatingFromCompositeScore = (score) => {
    if (score >= 90) return PerformanceRating.EXCELLENT;
    if (score >= 75) return PerformanceRating.GOOD;
    if (score >= 65) return PerformanceRating.ABOVE_AVERAGE;
    if (score >= 50) return PerformanceRating.SATISFACTORY;
    return PerformanceRating.NEEDS_IMPROVEMENT;
};

const dedupeItemsById = (items = []) => {
    const unique = new Map();

    for (const item of items) {
        unique.set(item.id, item);
    }

    return Array.from(unique.values());
};

export const getResponsibleObjectives = (objectives, user) => {
    const directObjectives = objectives.filter((objective) => objective.owner_id === user.id);
    const unitObjectives = user.unit_id
        ? objectives.filter((objective) => objective.unit_id === user.unit_id)
        : [];

    return dedupeItemsById([...directObjectives, ...unitObjectives]);
};

export const getResponsibleKPIs = (assignments, user) => {
    const directAssignments = assignments.filter((assignment) => assignment.owner_id === user.id);
    const unitAssignments = user.unit_id
        ? assignments.filter((assignment) => assignment.unit_id === user.unit_id)
        : [];

    return dedupeItemsById([...directAssignments, ...unitAssignments]);
};

export const computeMetrics = ({ objectives, assignments }) => {
    const okr_count = objectives.length;
    const kpi_count = assignments.length;

    const avg_okr_progress = okr_count > 0
        ? objectives.reduce((sum, objective) => sum + Number(objective.progress_percentage || 0), 0) / okr_count
        : 0;

    const avg_kpi_progress = kpi_count > 0
        ? assignments.reduce((sum, assignment) => sum + Number(assignment.progress_percentage || 0), 0) / kpi_count
        : 0;

    let composite_score = 0;
    if (okr_count > 0 && kpi_count > 0) {
        composite_score =
            ((avg_okr_progress * okr_count) + (avg_kpi_progress * kpi_count)) / (okr_count + kpi_count);
    } else if (okr_count > 0) {
        composite_score = avg_okr_progress;
    } else if (kpi_count > 0) {
        composite_score = avg_kpi_progress;
    }

    return {
        okr_count,
        kpi_count,
        avg_okr_progress: roundMetric(avg_okr_progress),
        avg_kpi_progress: roundMetric(avg_kpi_progress),
        composite_score: roundMetric(composite_score),
        rating: getRatingFromCompositeScore(composite_score),
    };
};

const evaluationListSelect = {
    id: true,
    okr_count: true,
    kpi_count: true,
    avg_okr_progress: true,
    avg_kpi_progress: true,
    composite_score: true,
    rating: true,
    created_at: true,
    evaluatee: {
        select: {
            id: true,
            full_name: true,
            job_title: true,
            avatar_url: true,
        },
    },
    unit: {
        select: {
            id: true,
            name: true,
        },
    },
};

const evaluationHistorySelect = {
    id: true,
    okr_count: true,
    kpi_count: true,
    avg_okr_progress: true,
    avg_kpi_progress: true,
    composite_score: true,
    rating: true,
    created_at: true,
    cycle: {
        select: {
            id: true,
            name: true,
            start_date: true,
            end_date: true,
        },
    },
    unit: {
        select: {
            id: true,
            name: true,
        },
    },
};

const evaluationDetailSelect = {
    id: true,
    okr_count: true,
    kpi_count: true,
    avg_okr_progress: true,
    avg_kpi_progress: true,
    composite_score: true,
    rating: true,
    created_at: true,
    updated_at: true,
    cycle: {
        select: {
            id: true,
            name: true,
            start_date: true,
            end_date: true,
        },
    },
    evaluatee: {
        select: {
            id: true,
            full_name: true,
            avatar_url: true,
            job_title: true,
        },
    },
    unit: {
        select: {
            id: true,
            name: true,
        },
    },
};

export const generateEvaluationsForCycle = async (cycleId, companyId) => {
    return withCompanyContext(companyId, async () => {
        const cycle = await prisma.cycles.findFirst({
            where: { id: cycleId, company_id: companyId },
            select: {
                id: true,
                company_id: true,
                end_date: true,
            },
        });

        if (!cycle) {
            throw new AppError("Cycle not found", 404);
        }

        const today = getDateOnlyInTimezone();
        if (cycle.end_date >= today) {
            throw new AppError("Cycle has not ended yet", 400, "CYCLE_NOT_ENDED");
        }

        return prisma.$withLockedCycleFilterBypassed(async (tx) => {
            const [users, objectives, assignments] = await Promise.all([
                tx.users.findMany({
                    where: {
                        company_id: companyId,
                        is_active: true,
                        deleted_at: null,
                        role: { not: UserRole.ADMIN },
                    },
                    select: {
                        id: true,
                        unit_id: true,
                    },
                }),
                tx.objectives.findMany({
                    where: {
                        company_id: companyId,
                        cycle_id: cycleId,
                        deleted_at: null,
                        status: {
                            notIn: [ProgressStatus.Draft, ProgressStatus.Rejected],
                        },
                    },
                    select: {
                        id: true,
                        owner_id: true,
                        unit_id: true,
                        progress_percentage: true,
                    },
                    distinct: ["id"],
                }),
                tx.kPIAssignments.findMany({
                    where: {
                        company_id: companyId,
                        cycle_id: cycleId,
                        deleted_at: null,
                    },
                    select: {
                        id: true,
                        owner_id: true,
                        unit_id: true,
                        progress_percentage: true,
                    },
                    distinct: ["id"],
                }),
            ]);

            const evaluationRows = [];

            for (const user of users) {
                const responsibleObjectives = getResponsibleObjectives(objectives, user);
                const responsibleKPIs = getResponsibleKPIs(assignments, user);

                if (responsibleObjectives.length === 0 && responsibleKPIs.length === 0) {
                    continue;
                }

                const unit_id =
                    user.unit_id ??
                    responsibleObjectives.find((objective) => objective.unit_id)?.unit_id ??
                    responsibleKPIs.find((assignment) => assignment.unit_id)?.unit_id;

                if (!unit_id) {
                    continue;
                }

                const metrics = computeMetrics({
                    objectives: responsibleObjectives,
                    assignments: responsibleKPIs,
                });

                evaluationRows.push({
                    company_id: companyId,
                    cycle_id: cycleId,
                    evaluatee_id: user.id,
                    unit_id,
                    ...metrics,
                });
            }

            const created = evaluationRows.length > 0
                ? await tx.evaluations.createMany({
                    data: evaluationRows,
                    skipDuplicates: true,
                })
                : { count: 0 };

            return {
                created: created.count,
                skipped: users.length - created.count,
            };
        });
    });
};

export const listEvaluations = async (companyId, { cycle_id, unit_id, rating, page, per_page }) => {
    const where = {
        company_id: companyId,
        cycle_id,
        deleted_at: null,
        ...(unit_id !== undefined && { unit_id }),
        ...(rating && { rating }),
    };

    const [total, evaluations] = await Promise.all([
        prisma.evaluations.count({ where }),
        prisma.evaluations.findMany({
            where,
            skip: (page - 1) * per_page,
            take: per_page,
            orderBy: [
                { composite_score: "desc" },
                { created_at: "desc" },
            ],
            select: evaluationListSelect,
        }),
    ]);

    return {
        data: evaluations.map(formatEvaluationListItem),
        meta: buildPaginationMeta(total, page, per_page),
    };
};

export const listMyEvaluations = async (user, { page, per_page }) => {
    const where = {
        company_id: user.company_id,
        evaluatee_id: user.id,
        deleted_at: null,
    };

    const [total, evaluations] = await Promise.all([
        prisma.evaluations.count({ where }),
        prisma.evaluations.findMany({
            where,
            skip: (page - 1) * per_page,
            take: per_page,
            orderBy: [
                { cycle: { end_date: "desc" } },
                { created_at: "desc" },
            ],
            select: evaluationHistorySelect,
        }),
    ]);

    return {
        data: evaluations.map(formatEvaluationHistoryItem),
        meta: buildPaginationMeta(total, page, per_page),
    };
};

export const getEvaluationById = async (requestUser, evaluationId) => {
    const evaluation = await prisma.evaluations.findFirst({
        where: {
            id: evaluationId,
            deleted_at: null,
            ...(requestUser.company_id ? { company_id: requestUser.company_id } : {}),
        },
        select: evaluationDetailSelect,
    });

    if (!evaluation) {
        throw new AppError("Evaluation not found", 404);
    }

    if (requestUser.role === UserRole.EMPLOYEE && evaluation.evaluatee.id !== requestUser.id) {
        throw new AppError("Forbidden", 403);
    }

    return formatEvaluationDetail(evaluation);
};

export const listUserEvaluations = async (requestUser, userId, { page, per_page }) => {
    if (requestUser.role === UserRole.EMPLOYEE && requestUser.id !== userId) {
        throw new AppError("Forbidden", 403);
    }

    const targetUser = await prisma.users.findFirst({
        where: {
            id: userId,
            deleted_at: null,
            ...(requestUser.company_id ? { company_id: requestUser.company_id } : {}),
        },
        select: { id: true },
    });

    if (!targetUser) {
        throw new AppError("User not found", 404);
    }

    const where = {
        evaluatee_id: userId,
        deleted_at: null,
        ...(requestUser.company_id ? { company_id: requestUser.company_id } : {}),
    };

    const [total, evaluations] = await Promise.all([
        prisma.evaluations.count({ where }),
        prisma.evaluations.findMany({
            where,
            skip: (page - 1) * per_page,
            take: per_page,
            orderBy: [
                { cycle: { end_date: "desc" } },
                { created_at: "desc" },
            ],
            select: evaluationHistorySelect,
        }),
    ]);

    return {
        data: evaluations.map(formatEvaluationHistoryItem),
        meta: buildPaginationMeta(total, page, per_page),
    };
};

export const getCycleEvaluationsSummary = async (
    companyId,
    cycleId,
    { page, per_page, unit_id, rating },
) => {
    const cycle = await prisma.cycles.findFirst({
        where: {
            id: cycleId,
            company_id: companyId,
        },
        select: {
            id: true,
            name: true,
            start_date: true,
            end_date: true,
        },
    });

    if (!cycle) {
        throw new AppError("Cycle not found", 404);
    }

    const [listResult, aggregate, groupedRatings, activeUsersCount] = await Promise.all([
        listEvaluations(companyId, { cycle_id: cycleId, unit_id, rating, page, per_page }),
        prisma.evaluations.aggregate({
            where: {
                company_id: companyId,
                cycle_id: cycleId,
                deleted_at: null,
            },
            _count: { id: true },
            _avg: { composite_score: true },
        }),
        prisma.evaluations.groupBy({
            by: ["rating"],
            where: {
                company_id: companyId,
                cycle_id: cycleId,
                deleted_at: null,
            },
            _count: { rating: true },
        }),
        prisma.users.count({
            where: {
                company_id: companyId,
                is_active: true,
                deleted_at: null,
                role: { not: UserRole.ADMIN },
            },
        }),
    ]);

    const rating_distribution = ratingOrder.reduce((acc, currentRating) => {
        acc[currentRating] = 0;
        return acc;
    }, {});

    for (const row of groupedRatings) {
        rating_distribution[row.rating] = row._count.rating;
    }

    return {
        data: {
            cycle: formatCycle(cycle),
            summary: {
                total_evaluated: aggregate._count.id,
                total_skipped: Math.max(activeUsersCount - aggregate._count.id, 0),
                rating_distribution,
                avg_composite_score: roundMetric(aggregate._avg.composite_score || 0),
            },
            evaluations: listResult.data,
        },
        meta: listResult.meta,
    };
};

export const listUnitEvaluations = async (companyId, unitId, cycleId) => {
    const [unit, cycle, rows] = await Promise.all([
        prisma.units.findFirst({
            where: {
                id: unitId,
                company_id: companyId,
                deleted_at: null,
            },
            select: {
                id: true,
                name: true,
            },
        }),
        prisma.cycles.findFirst({
            where: {
                id: cycleId,
                company_id: companyId,
            },
            select: {
                id: true,
            },
        }),
        prisma.$queryRaw`
            SELECT
                u.id AS user_id,
                u.full_name,
                u.job_title,
                u.avatar_url,
                e.id AS evaluation_id,
                COALESCE(e.okr_count, 0) AS okr_count,
                COALESCE(e.kpi_count, 0) AS kpi_count,
                COALESCE(e.avg_okr_progress, 0) AS avg_okr_progress,
                COALESCE(e.avg_kpi_progress, 0) AS avg_kpi_progress,
                COALESCE(e.composite_score, 0) AS composite_score,
                e.rating::text AS rating,
                e.created_at
            FROM "Users" u
            LEFT JOIN "Evaluations" e
                ON e.evaluatee_id = u.id
               AND e.cycle_id = ${cycleId}
               AND e.deleted_at IS NULL
            WHERE u.company_id = ${companyId}
              AND u.unit_id = ${unitId}
              AND u.is_active = true
              AND u.deleted_at IS NULL
              AND u.role != ${UserRole.ADMIN}::"UserRole"
            ORDER BY COALESCE(e.composite_score, 0) DESC, u.full_name ASC
        `,
    ]);

    if (!unit) {
        throw new AppError("Unit not found", 404);
    }

    if (!cycle) {
        throw new AppError("Cycle not found", 404);
    }

    return rows.map((row) => ({
        user_id: Number(row.user_id),
        full_name: row.full_name,
        job_title: row.job_title ?? null,
        avatar_url: row.avatar_url
            ? getCloudinaryImageUrl(row.avatar_url, 50, 50, "fill")
            : null,
        evaluation_id: row.evaluation_id !== null ? Number(row.evaluation_id) : null,
        okr_count: Number(row.okr_count),
        kpi_count: Number(row.kpi_count),
        avg_okr_progress: roundMetric(row.avg_okr_progress),
        avg_kpi_progress: roundMetric(row.avg_kpi_progress),
        composite_score: roundMetric(row.composite_score),
        rating: row.rating,
        created_at: row.created_at,
    }));
};

export const getEvaluationStatisticsSummary = async (companyId) => {
    const lastCycle = await prisma.cycles.findFirst({
        where: {
            company_id: companyId,
            evaluations: {
                some: {
                    deleted_at: null,
                },
            },
        },
        orderBy: {
            end_date: "desc",
        },
        select: {
            id: true,
            name: true,
        },
    });

    if (!lastCycle) {
        return {
            evaluation_summary: {
                last_cycle: null,
                rating_distribution: ratingOrder.reduce((acc, rating) => {
                    acc[rating] = 0;
                    return acc;
                }, {}),
                avg_composite_score: 0,
                top_performers: [],
            },
        };
    }

    const [groupedRatings, aggregate, topPerformers] = await Promise.all([
        prisma.evaluations.groupBy({
            by: ["rating"],
            where: {
                company_id: companyId,
                cycle_id: lastCycle.id,
                deleted_at: null,
            },
            _count: { rating: true },
        }),
        prisma.evaluations.aggregate({
            where: {
                company_id: companyId,
                cycle_id: lastCycle.id,
                deleted_at: null,
            },
            _avg: {
                composite_score: true,
            },
        }),
        prisma.evaluations.findMany({
            where: {
                company_id: companyId,
                cycle_id: lastCycle.id,
                deleted_at: null,
            },
            orderBy: [
                { composite_score: "desc" },
                { created_at: "asc" },
            ],
            take: DEFAULT_TOP_PERFORMERS_LIMIT,
            select: {
                evaluatee_id: true,
                composite_score: true,
                rating: true,
                evaluatee: {
                    select: {
                        full_name: true,
                    },
                },
            },
        }),
    ]);

    const rating_distribution = ratingOrder.reduce((acc, currentRating) => {
        acc[currentRating] = 0;
        return acc;
    }, {});

    for (const row of groupedRatings) {
        rating_distribution[row.rating] = row._count.rating;
    }

    return {
        evaluation_summary: {
            last_cycle: lastCycle,
            rating_distribution,
            avg_composite_score: roundMetric(aggregate._avg.composite_score || 0),
            top_performers: topPerformers.map((performer) => ({
                user_id: performer.evaluatee_id,
                full_name: performer.evaluatee.full_name,
                composite_score: roundMetric(performer.composite_score),
                rating: performer.rating,
            })),
        },
    };
};
