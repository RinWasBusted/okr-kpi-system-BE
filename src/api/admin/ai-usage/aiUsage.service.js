import prisma from "../../../utils/prisma.js";
import AppError from "../../../utils/appError.js";
import { AIPlan } from "@prisma/client";

// Update company AI plan and usage limit
export const updateCompanyAIPlan = async (companyId, { ai_plan, usage_limit }) => {
    const company = await prisma.companies.findUnique({ where: { id: companyId } });

    if (!company) {
        throw new AppError("Company not found", 404);
    }

    const data = {};
    if (ai_plan !== undefined) {
        if (!Object.values(AIPlan).includes(ai_plan)) {
            throw new AppError(`Invalid ai_plan. Must be one of: ${Object.values(AIPlan).join(", ")}`, 422);
        }
        data.ai_plan = ai_plan;
    }
    if (usage_limit !== undefined) {
        if (typeof usage_limit !== "number" || usage_limit < 0) {
            throw new AppError("usage_limit must be a non-negative number", 422);
        }
        data.usage_limit = usage_limit;
    }

    const updated = await prisma.companies.update({
        where: { id: companyId },
        data,
        select: {
            id: true,
            name: true,
            ai_plan: true,
            usage_limit: true,
            token_usage: true,
            credit_cost: true,
            updated_at: true,
        },
    });

    return updated;
};

// Reset credit cost for a company
export const resetCompanyCreditCost = async (companyId) => {
    const company = await prisma.companies.findUnique({ where: { id: companyId } });

    if (!company) {
        throw new AppError("Company not found", 404);
    }

    const updated = await prisma.companies.update({
        where: { id: companyId },
        data: { credit_cost: 0 },
        select: {
            id: true,
            name: true,
            credit_cost: true,
            updated_at: true,
        },
    });

    return updated;
};

// Get AI usage logs with filters
export const getAIUsageLogs = async (filters, pagination) => {
    const {
        company_id,
        user_id,
        feature_name,
        model_name,
        status,
        start_date,
        end_date,
        min_credit_cost,
        max_credit_cost,
    } = filters;
    const { page, per_page } = pagination;

    const where = {
        ...(company_id !== undefined && { company_id }),
        ...(user_id !== undefined && { user_id }),
        ...(feature_name !== undefined && { feature_name: { contains: feature_name, mode: "insensitive" } }),
        ...(model_name !== undefined && { model_name: { contains: model_name, mode: "insensitive" } }),
        ...(status !== undefined && { status }),
        ...(start_date !== undefined && end_date !== undefined && {
            created_at: { gte: new Date(start_date), lte: new Date(end_date) },
        }),
        ...(start_date !== undefined && end_date === undefined && {
            created_at: { gte: new Date(start_date) },
        }),
        ...(start_date === undefined && end_date !== undefined && {
            created_at: { lte: new Date(end_date) },
        }),
        ...(min_credit_cost !== undefined && max_credit_cost !== undefined && {
            credit_cost: { gte: min_credit_cost, lte: max_credit_cost },
        }),
        ...(min_credit_cost !== undefined && max_credit_cost === undefined && {
            credit_cost: { gte: min_credit_cost },
        }),
        ...(min_credit_cost === undefined && max_credit_cost !== undefined && {
            credit_cost: { lte: max_credit_cost },
        }),
    };

    const [logs, total] = await Promise.all([
        prisma.aIUsageLogs.findMany({
            where,
            skip: (page - 1) * per_page,
            take: per_page,
            orderBy: { created_at: "desc" },
            include: {
                company: { select: { id: true, name: true } },
                user: { select: { id: true, full_name: true, email: true } },
            },
        }),
        prisma.aIUsageLogs.count({ where }),
    ]);

    const data = logs.map((log) => ({
        id: log.id,
        company: log.company,
        user: log.user,
        feature_name: log.feature_name,
        model_name: log.model_name,
        input_tokens: log.input_tokens,
        output_tokens: log.output_tokens,
        total_tokens: log.total_tokens,
        request_id: log.request_id,
        credit_cost: log.credit_cost,
        status: log.status,
        created_at: log.created_at,
    }));

    const meta = {
        total,
        page,
        last_page: Math.ceil(total / per_page),
    };

    return { data, meta };
};

// Calculate total cost with filters
export const calculateTotalCost = async (filters) => {
    const {
        company_id,
        user_id,
        feature_name,
        model_name,
        status,
        start_date,
        end_date,
    } = filters;

    const where = {
        ...(company_id !== undefined && { company_id }),
        ...(user_id !== undefined && { user_id }),
        ...(feature_name !== undefined && { feature_name: { contains: feature_name, mode: "insensitive" } }),
        ...(model_name !== undefined && { model_name: { contains: model_name, mode: "insensitive" } }),
        ...(status !== undefined && { status }),
        ...(start_date !== undefined && end_date !== undefined && {
            created_at: { gte: new Date(start_date), lte: new Date(end_date) },
        }),
        ...(start_date !== undefined && end_date === undefined && {
            created_at: { gte: new Date(start_date) },
        }),
        ...(start_date === undefined && end_date !== undefined && {
            created_at: { lte: new Date(end_date) },
        }),
    };

    const [aggregateResult, groupedByStatus, groupedByModel] = await Promise.all([
        // Total cost and token aggregates
        prisma.aIUsageLogs.aggregate({
            where,
            _sum: {
                credit_cost: true,
                input_tokens: true,
                output_tokens: true,
                total_tokens: true,
            },
            _count: { _all: true },
        }),
        // Group by status
        prisma.aIUsageLogs.groupBy({
            by: ["status"],
            where,
            _sum: { credit_cost: true },
            _count: { _all: true },
        }),
        // Group by model_name
        prisma.aIUsageLogs.groupBy({
            by: ["model_name"],
            where,
            _sum: { credit_cost: true, total_tokens: true },
            _count: { _all: true },
        }),
    ]);

    const summary = {
        total_cost: aggregateResult._sum.credit_cost ?? 0,
        total_input_tokens: aggregateResult._sum.input_tokens ?? 0,
        total_output_tokens: aggregateResult._sum.output_tokens ?? 0,
        total_tokens: aggregateResult._sum.total_tokens ?? 0,
        total_requests: aggregateResult._count._all,
    };

    const byStatus = groupedByStatus.map((item) => ({
        status: item.status,
        cost: item._sum.credit_cost ?? 0,
        count: item._count._all,
    }));

    const byModel = groupedByModel.map((item) => ({
        model_name: item.model_name,
        cost: item._sum.credit_cost ?? 0,
        tokens: item._sum.total_tokens ?? 0,
        count: item._count._all,
    }));

    return {
        summary,
        by_status: byStatus,
        by_model: byModel,
    };
};

// Get company AI usage summary
export const getCompanyAIUsageSummary = async (companyId) => {
    const company = await prisma.companies.findUnique({
        where: { id: companyId },
        select: {
            id: true,
            name: true,
            ai_plan: true,
            token_usage: true,
            credit_cost: true,
            usage_limit: true,
        },
    });

    if (!company) {
        throw new AppError("Company not found", 404);
    }

    // Get additional stats from AIUsageLogs
    const [recentLogs, monthlyStats] = await Promise.all([
        // Recent 30 days usage
        prisma.aIUsageLogs.aggregate({
            where: {
                company_id: companyId,
                created_at: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
            },
            _sum: {
                credit_cost: true,
                total_tokens: true,
            },
            _count: { _all: true },
        }),
        // Monthly stats for last 6 months
        prisma.$queryRaw`
            SELECT
                DATE_TRUNC('month', created_at) as month,
                SUM(credit_cost) as total_cost,
                SUM(total_tokens) as total_tokens,
                COUNT(*) as request_count
            FROM "AIUsageLogs"
            WHERE company_id = ${companyId}
                AND created_at >= ${new Date(Date.now() - 180 * 24 * 60 * 60 * 1000)}
            GROUP BY DATE_TRUNC('month', created_at)
            ORDER BY month DESC
        `,
    ]);

    const usagePercentage = company.usage_limit > 0
        ? Math.round((company.token_usage / company.usage_limit) * 100 * 100) / 100
        : 0;

    return {
        company: {
            id: company.id,
            name: company.name,
            ai_plan: company.ai_plan,
        },
        current_usage: {
            token_usage: company.token_usage,
            credit_cost: company.credit_cost,
            usage_limit: company.usage_limit,
            usage_percentage: usagePercentage,
            remaining_tokens: Math.max(0, company.usage_limit - company.token_usage),
        },
        last_30_days: {
            credit_cost: recentLogs._sum.credit_cost ?? 0,
            total_tokens: recentLogs._sum.total_tokens ?? 0,
            request_count: recentLogs._count._all,
        },
        monthly_history: monthlyStats.map((stat) => ({
            month: stat.month,
            credit_cost: Number(stat.total_cost) || 0,
            total_tokens: Number(stat.total_tokens) || 0,
            request_count: Number(stat.request_count) || 0,
        })),
    };
};
