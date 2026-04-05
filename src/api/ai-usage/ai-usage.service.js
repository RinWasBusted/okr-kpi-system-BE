import prisma from "../../utils/prisma.js";

// Get company AI plan info (ai_plan, token_usage, credit_cost, usage_limit)
export const getCompanyAIPlan = async () => {
    const company = await prisma.companies.findFirst({
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
        return null;
    }

    const usagePercentage = company.usage_limit > 0
        ? Math.round((company.token_usage / company.usage_limit) * 100 * 100) / 100
        : 0;

    return {
        company: {
            id: company.id,
            name: company.name,
        },
        ai_plan: company.ai_plan,
        token_usage: company.token_usage,
        credit_cost: company.credit_cost,
        usage_limit: company.usage_limit,
        remaining_tokens: Math.max(0, company.usage_limit - company.token_usage),
        usage_percentage: usagePercentage,
    };
};

// Get AI usage logs with filters for company
export const getAIUsageLogs = async (filters, pagination) => {
    const {
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
                user: { select: { id: true, full_name: true } },
            },
        }),
        prisma.aIUsageLogs.count({ where }),
    ]);

    const data = logs.map((log) => ({
        id: log.id,
        user_fullname: log.user?.full_name || null,
        feature_name: log.feature_name,
        input_tokens: log.input_tokens,
        output_tokens: log.output_tokens,
        cached_token: log.total_tokens - log.input_tokens - log.output_tokens,
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
