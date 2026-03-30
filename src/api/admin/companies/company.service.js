import prisma from "../../../utils/prisma.js";
import { UserRole, Prisma, AIPlan } from "@prisma/client";
import AppError from "../../../utils/appError.js";
import { deleteImageFromCloudinary, getCloudinaryUrlFromPublicId } from "../../../utils/cloudinary.js";

export const getCompanies = async (filters, pagination) => {
    const { is_active, search } = filters;
    const { page, per_page } = pagination;

    const where = {
        ...(is_active !== undefined && { is_active }),
        ...(search && {
            OR: [
                { name: { contains: search, mode: "insensitive" } },
                { slug: { contains: search, mode: "insensitive" } },
            ],
        }),
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
                created_at: true,
                token_usage: true,
                _count: {
                    select: {
                        users: {
                            where: { role: UserRole.ADMIN_COMPANY },
                        },
                    },
                },
            },
            orderBy: { created_at: "desc" },
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
        logo_url: getCloudinaryUrlFromPublicId(company.logo),
        token_usage: company.token_usage,
        is_active: company.is_active,
        admin_count: company._count.users,
        employee_count: employeeCountMap[company.id] ?? 0,
        created_at: company.created_at,
        
    }));
    const meta = {
        total,
        page,
        last_page: Math.ceil(total / per_page),
    };

    return { data, meta };
};

export const createCompany = async ({ name, slug, logo }) => {
    const existing = await prisma.companies.findUnique({ where: { slug } });

    if (existing) {
        throw new AppError("Slug already exists on this platform", 409);
    }

    try {
        const company = await prisma.companies.create({
            data: { name, slug, is_active: true, logo: logo ?? null },
            select: {
                id: true,
                name: true,
                slug: true,
                logo: true,
                is_active: true,
                created_at: true,
            },
        });

        return company;
    } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
            throw new AppError("Slug already exists on this platform", 409);
        }
        throw err;
    }
};

export const updateCompany = async (id, { name, slug, is_active, ai_plan, token_usage, credit_cost, usage_limit }) => {
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

    if (token_usage !== undefined && (!Number.isFinite(token_usage) || token_usage < 0)) {
        throw new AppError("token_usage must be a non-negative number", 422);
    }

    if (credit_cost !== undefined && (!Number.isFinite(credit_cost) || credit_cost < 0)) {
        throw new AppError("credit_cost must be a non-negative number", 422);
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
                ...(token_usage !== undefined && { token_usage }),
                ...(credit_cost !== undefined && { credit_cost }),
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

        return updated;
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

    return updated;
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

    return updated;
};

export const deactivateCompany = async (id) => {
    const company = await prisma.companies.findUnique({ where: { id } });

    if (!company) {
        throw new AppError("Company not found", 404);
    }

    await prisma.companies.update({
        where: { id },
        data: { is_active: false },
    });
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

    const [admin_count, employee_count] = await Promise.all([
        prisma.users.count({ where: { company_id: id, role: UserRole.ADMIN_COMPANY } }),
        prisma.users.count({ where: { company_id: id, role: UserRole.EMPLOYEE } }),
    ]);

    return {
        id: company.id,
        name: company.name,
        slug: company.slug,
        logo: company.logo,
        logo_url: getCloudinaryUrlFromPublicId(company.logo),
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
        logo_url: getCloudinaryUrlFromPublicId(company.logo),
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