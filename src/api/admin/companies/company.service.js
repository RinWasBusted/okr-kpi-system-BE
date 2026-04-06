import prisma from "../../../utils/prisma.js";
import { UserRole, Prisma, AIPlan } from "@prisma/client";
import AppError from "../../../utils/appError.js";
import { deleteImageFromCloudinary, getCloudinaryImageUrl } from "../../../utils/cloudinary.js";

export const ensureCompanyExists = async (id) => {
    const company = await prisma.companies.findUnique({
        where: { id },
        select: { id: true },
    });

    if (!company) {
        throw new AppError("Company not found", 404);
    }

    return company;
};

export const getCompanies = async (filters, pagination) => {
    const { is_active, search, ai_plan, sort_by = "created_at", sort_order = "desc", from_date, to_date } = filters;
    const { page, per_page } = pagination;

    // Validate sort parameters to prevent Prisma errors on unexpected values
    const allowedSortBy    = ["name", "created_at"];
    const allowedSortOrder = ["asc", "desc"];
    const safeSortBy    = allowedSortBy.includes(sort_by)    ? sort_by    : "created_at";
    const safeSortOrder = allowedSortOrder.includes(sort_order) ? sort_order : "desc";

    if (sort_by && !allowedSortBy.includes(sort_by)) {
        throw new AppError(`Invalid sort_by value. Allowed: ${allowedSortBy.join(", ")}`, 422);
    }
    if (sort_order && !allowedSortOrder.includes(sort_order)) {
        throw new AppError(`Invalid sort_order value. Allowed: ${allowedSortOrder.join(", ")}`, 422);
    }

    // Validate date filters
    let parsedFromDate, parsedToDate;
    if (from_date) {
        parsedFromDate = new Date(from_date);
        if (isNaN(parsedFromDate.getTime())) {
            throw new AppError("Invalid from_date. Expected an ISO 8601 date string.", 422);
        }
    }
    if (to_date) {
        parsedToDate = new Date(to_date);
        if (isNaN(parsedToDate.getTime())) {
            throw new AppError("Invalid to_date. Expected an ISO 8601 date string.", 422);
        }
    }

    const where = {
        ...(is_active !== undefined && { is_active }),
        ...(ai_plan && { ai_plan }),
        ...((parsedFromDate || parsedToDate) && {
            created_at: {
                ...(parsedFromDate && { gte: parsedFromDate }),
                ...(parsedToDate  && { lte: parsedToDate  }),
            },
        }),
        ...(search && {
            OR: [
                { name: { contains: search, mode: "insensitive" } },
                { slug: { contains: search, mode: "insensitive" } },
            ],
        }),
    };

    const orderByMap = {
        name:       { name:       safeSortOrder },
        created_at: { created_at: safeSortOrder },
    };

    const [companies, total] = await Promise.all([
        prisma.companies.findMany({
            where,
            skip: (page - 1) * per_page,
            take: per_page,
            select: {
                id: true,
                name: true,
                slug: true,
                logo: true,
                is_active: true,
                ai_plan: true,
                created_at: true,
                _count: {
                    select: {
                        users: {
                            where: { role: UserRole.ADMIN_COMPANY },
                        },
                    },
                },
            },
            orderBy: orderByMap[safeSortBy],
        }),
        prisma.companies.count({ where }),
    ]);

    const companyIds = companies.map((c) => c.id);
    const employeeCountMap = {};

    if (companyIds.length > 0) {
        const employeeCountRows = await prisma.users.groupBy({
            by: ["company_id"],
            where: {
                company_id: { in: companyIds },
                role: UserRole.EMPLOYEE,
            },
            _count: { _all: true },
        });

        for (const row of employeeCountRows) {
            employeeCountMap[row.company_id] = row._count._all;
        }
    }

    const data = companies.map((company) => ({
        id: company.id,
        name: company.name,
        slug: company.slug,
        logo_url: company.logo ? getCloudinaryImageUrl(company.logo, 80, 80, "fill") : null,
        is_active: company.is_active,
        ai_plan: company.ai_plan,
        admin_count: company._count.users,
        employee_count: employeeCountMap[company.id] ?? 0,
        created_at: company.created_at,
    }));
    const meta = {
        total,
        page,
        per_page,
        last_page: Math.ceil(total / per_page),
    };

    return { data, meta };
};

export const createCompany = async ({ name, slug, logo, ai_plan = "FREE" }) => {
    const existing = await prisma.companies.findUnique({ where: { slug } });

    if (existing) {
        throw new AppError("Slug already exists on this platform", 409);
    }

    try {
        const company = await prisma.companies.create({
            data: { name, slug, is_active: true, logo: logo ?? null, ai_plan },
            select: {
                id: true,
                name: true,
                slug: true,
                logo: true,
                is_active: true,
                ai_plan: true,
                created_at: true,
            },
        });

        return {
            ...company,
            logo_url: company.logo ? getCloudinaryImageUrl(company.logo, 80, 80, "fill") : null,
            admin_count: 0,
            employee_count: 0,
        };
    } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
            throw new AppError("Slug already exists on this platform", 409);
        }
        throw err;
    }
};

export const getCompanyById = async (id) => {
    const company = await prisma.companies.findUnique({
        where: { id },
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

    // Get user counts
    const [admin_count, employee_count] = await Promise.all([
        prisma.users.count({ where: { company_id: id, role: UserRole.ADMIN_COMPANY } }),
        prisma.users.count({ where: { company_id: id, role: UserRole.EMPLOYEE } }),
    ]);

    return {
        ...company,
        logo_url: company.logo ? getCloudinaryImageUrl(company.logo, 80, 80, "fill") : null,
        admin_count,
        employee_count,
    };
};

export const updateCompany = async (id, { name, slug, is_active, ai_plan, usage_limit }) => {
    const company = await prisma.companies.findUnique({ where: { id } });

    if (!company) {
        throw new AppError("Company not found", 404);
    }

    if (slug !== undefined && slug !== company.slug) {
        const existing = await prisma.companies.findUnique({ where: { slug } });
        if (existing) {
            throw new AppError("Slug already exists on this platform", 409);
        }
    }

    if (ai_plan !== undefined && !Object.values(AIPlan).includes(ai_plan)) {
        throw new AppError(`Invalid ai_plan. Must be one of: ${Object.values(AIPlan).join(", ")}`, 422);
    }

    if (usage_limit !== undefined && (!Number.isFinite(usage_limit) || usage_limit < 0)) {
        throw new AppError("usage_limit must be a non-negative number", 422);
    }

    try {
        const updated = await prisma.companies.update({
            where: { id },
            data: {
                ...(name !== undefined && { name }),
                ...(slug !== undefined && { slug }),
                ...(is_active !== undefined && { is_active }),
                ...(ai_plan !== undefined && { ai_plan }),
                ...(usage_limit !== undefined && { usage_limit }),
            },
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

        // Get user counts
        const [admin_count, employee_count] = await Promise.all([
            prisma.users.count({ where: { company_id: id, role: UserRole.ADMIN_COMPANY } }),
            prisma.users.count({ where: { company_id: id, role: UserRole.EMPLOYEE } }),
        ]);

        return {
            ...updated,
            logo_url: updated.logo ? getCloudinaryImageUrl(updated.logo, 80, 80, "fill") : null,
            admin_count,
            employee_count,
        };
    } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
            throw new AppError("Slug already exists on this platform", 409);
        }
        throw err;
    }
};

// ─── Logo ────────────────────────────────────────────────────────────────────

export const updateCompanyLogo = async (id, publicId) => {
    const company = await prisma.companies.findUnique({
        where: { id },
        select: { id: true, logo: true },
    });

    if (!company) {
        throw new AppError("Company not found", 404);
    }

    // Delete old logo from Cloudinary if exists
    if (company.logo) {
        await deleteImageFromCloudinary(company.logo);
    }

    const updated = await prisma.companies.update({
        where: { id },
        data: { logo: publicId },
        select: {
            id: true,
            name: true,
            slug: true,
            logo: true,
            is_active: true,
            created_at: true,
        },
    });

    return {
        ...updated,
        logo_url: updated.logo ? getCloudinaryImageUrl(updated.logo, 80, 80, "fill") : null,
    };
};

export const deleteCompanyLogo = async (id) => {
    const company = await prisma.companies.findUnique({
        where: { id },
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
        where: { id },
        data: { logo: null },
        select: {
            id: true,
            name: true,
            slug: true,
            logo: true,
            is_active: true,
            created_at: true,
        },
    });

    return {
        ...updated,
        logo_url: null,
    };
};

export const deactivateCompany = async (id) => {
    const company = await prisma.companies.findUnique({ where: { id } });

    if (!company) {
        throw new AppError("Company not found", 404);
    }

    if (!company.is_active) {
        throw new AppError("Company is already deactivated", 409);
    }

    await prisma.companies.update({
        where: { id },
        data: { is_active: false },
    });

    // Count affected users
    const affectedUsers = await prisma.users.count({
        where: { company_id: id },
    });

    return { affectedUsers };
};

export const getCompanyStats = async (id) => {
    const company = await prisma.companies.findUnique({
        where: { id },
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

    const [admin_count, employee_count, total_objectives, total_cycles, total_key_results, active_objectives] = await Promise.all([
        prisma.users.count({ where: { company_id: id, role: UserRole.ADMIN_COMPANY } }),
        prisma.users.count({ where: { company_id: id, role: UserRole.EMPLOYEE } }),
        prisma.objectives.count({ where: { company_id: id, deleted_at: null } }),
        prisma.cycles.count({ where: { company_id: id } }),
        prisma.keyResults.count({
            where: { objective: { company_id: id, deleted_at: null } },
        }),
        prisma.objectives.count({ where: { company_id: id, deleted_at: null, status: { in: ["Active", "Pending_Approval"] } } }),
    ]);

    // Calculate completion rate (completed objectives / total objectives)
    const completedObjectives = await prisma.objectives.count({
        where: { company_id: id, deleted_at: null, status: "Completed" },
    });
    const completion_rate = total_objectives > 0 ? (completedObjectives / total_objectives) : 0;

    return {
        id: company.id,
        name: company.name,
        slug: company.slug,
        logo: company.logo,
        logo_url: company.logo ? getCloudinaryImageUrl(company.logo, 80, 80, "fill") : null,
        is_active: company.is_active,
        ai_plan: company.ai_plan,
        token_usage: company.token_usage,
        credit_cost: company.credit_cost,
        usage_limit: company.usage_limit,
        admin_count,
        employee_count,
        created_at: company.created_at,
        total_objectives,
        total_cycles,
        total_key_results,
        active_objectives,
        completion_rate: parseFloat(completion_rate.toFixed(2)),
    };
};

// Get company details for ADMIN_COMPANY (from JWT token)
export const getMyCompanyDetails = async (companyId) => {
    const company = await prisma.companies.findUnique({
        where: { id: companyId },
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

    const [admin_count, employee_count] = await Promise.all([
        prisma.users.count({ where: { company_id: companyId, role: UserRole.ADMIN_COMPANY } }),
        prisma.users.count({ where: { company_id: companyId, role: UserRole.EMPLOYEE } }),
    ]);

    return {
        id: company.id,
        name: company.name,
        slug: company.slug,
        logo: company.logo,
        logo_url: company.logo ? getCloudinaryImageUrl(company.logo, 80, 80, "fill") : null,
        is_active: company.is_active,
        ai_plan: company.ai_plan,
        token_usage: company.token_usage,
        credit_cost: company.credit_cost,
        usage_limit: company.usage_limit,
        admin_count,
        employee_count,
        created_at: company.created_at,
    };
};