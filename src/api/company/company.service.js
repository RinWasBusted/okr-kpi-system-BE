import prisma from "../../utils/prisma.js";
import AppError from "../../utils/appError.js";
import { deleteImageFromCloudinary, getCloudinaryImageUrl } from "../../utils/cloudinary.js";

/**
 * Get own company info for authenticated user
 */
export const getMyCompany = async (user) => {
    if (!user.company_id) {
        throw new AppError("User is not associated with any company", 400);
    }

    const company = await prisma.companies.findUnique({
        where: { id: user.company_id },
        select: {
            id: true,
            name: true,
            slug: true,
            logo: true,
            is_active: true,
            ai_plan: true,
            token_usage: true,
            credit_cost: true,
            usage_limit: true,
            created_at: true,
        },
    });

    if (!company) {
        throw new AppError("Company not found", 404);
    }

    // Transform logo public_id to full Cloudinary URL
    return {
        ...company,
        logo_url: company.logo ? getCloudinaryImageUrl(company.logo) : null,
        logo: undefined, // Remove logo public_id from response
    };
};

/**
 * Get company stats
 */
export const getCompanyStats = async (user) => {
    if (!user.company_id) {
        throw new AppError("User is not associated with any company", 400);
    }

    // Get top-level units (parent_id is null) for this company
    const topLevelUnits = await prisma.units.findMany({
        where: {
            company_id: user.company_id,
            parent_id: null,
            deleted_at: null,
        },
        select: { id: true },
    });
    const topLevelUnitIds = topLevelUnits.map((u) => u.id);

    const [company, objectivesAggregate, kpiAggregate] = await Promise.all([
        prisma.companies.findUnique({
            where: { id: user.company_id },
            select: {
                id: true,
                name: true,
                is_active: true,
                ai_plan: true,
                token_usage: true,
                usage_limit: true,
                credit_cost: true,
                created_at: true,
            },
        }),
        // Get objectives stats for top-level units
        prisma.objectives.aggregate({
            where: {
                company_id: user.company_id,
                deleted_at: null,
                unit_id: { in: topLevelUnitIds },
            },
            _avg: { progress_percentage: true },
            _count: { _all: true },
        }),
        // Get KPI assignments stats for top-level units
        prisma.kPIAssignments.aggregate({
            where: {
                company_id: user.company_id,
                deleted_at: null,
                unit_id: { in: topLevelUnitIds },
            },
            _avg: { progress_percentage: true },
            _count: { _all: true },
        }),
    ]);

    if (!company) {
        throw new AppError("Company not found", 404);
    }

    // Calculate OKR stats (objectives belonging to top-level units)
    const total_okr = objectivesAggregate._count._all;
    const okr_progress = parseFloat((objectivesAggregate._avg.progress_percentage ?? 0).toFixed(2));

    // Calculate KPI stats (KPI assignments belonging to top-level units)
    const total_kpi = kpiAggregate._count._all;
    const kpi_health = parseFloat((kpiAggregate._avg.progress_percentage ?? 0).toFixed(2));

    return {
        id: company.id,
        name: company.name,
        is_active: company.is_active,
        created_at: company.created_at,
        ai_plan: company.ai_plan,
        token_usage: company.token_usage,
        usage_limit: company.usage_limit,
        credit_cost: company.credit_cost,
        okr_progress,
        total_okr,
        kpi_health,
        total_kpi,
    };
};

/**
 * Upload company logo
 */
export const uploadLogo = async (user, logoPublicId) => {
    if (!user.company_id) {
        throw new AppError("User is not associated with any company", 400);
    }

    const company = await prisma.companies.findUnique({
        where: { id: user.company_id },
        select: { id: true, logo: true },
    });

    if (!company) {
        throw new AppError("Company not found", 404);
    }

    // Delete old logo if exists
    if (company.logo) {
        await deleteImageFromCloudinary(company.logo);
    }

    const updated = await prisma.companies.update({
        where: { id: user.company_id },
        data: { logo: logoPublicId },
        select: {
            id: true,
            name: true,
            logo: true,
        },
    });

    return {
        ...updated,
        logo_url: logoPublicId ? getCloudinaryImageUrl(logoPublicId) : null,
        logo: undefined,
    };
};

/**
 * Delete company logo
 */
export const deleteLogo = async (user) => {
    if (!user.company_id) {
        throw new AppError("User is not associated with any company", 400);
    }

    const company = await prisma.companies.findUnique({
        where: { id: user.company_id },
        select: { id: true, logo: true },
    });

    if (!company) {
        throw new AppError("Company not found", 404);
    }

    // Delete logo from Cloudinary if exists
    if (company.logo) {
        await deleteImageFromCloudinary(company.logo);
    }

    const updated = await prisma.companies.update({
        where: { id: user.company_id },
        data: { logo: null },
        select: {
            id: true,
            name: true,
            logo: true,
        },
    });

    return {
        ...updated,
        logo_url: null,
        logo: undefined,
    };
};

/**
 * Get company AI usage logs
 */
export const getCompanyAIUsageLogs = async (user, filters, pagination) => {
    if (!user.company_id) {
        throw new AppError("User is not associated with any company", 400);
    }

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
        company_id: user.company_id, // Always filter by user's company
        ...(user_id !== undefined && { user_id: parseInt(user_id) }),
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
        per_page,
        last_page: Math.ceil(total / per_page),
    };

    return { data, meta };
};
