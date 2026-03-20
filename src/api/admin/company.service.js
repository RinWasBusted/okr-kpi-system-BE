import prisma, { Prisma } from "../../utils/prisma.js";
import AppError from "../../utils/appError.js";

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
                is_active: true,
                created_at: true,
                _count: {
                    select: {
                        users: {
                            where: { role: Prisma.UserRole.ADMIN_COMPANY },
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
            where: { company_id: { in: companyIds }, role: Prisma.UserRole.EMPLOYEE },
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

export const createCompany = async ({ name, slug }) => {
    const existing = await prisma.companies.findUnique({ where: { slug } });

    if (existing) {
        throw new AppError("Slug already exists on this platform", 409);
    }

    const company = await prisma.companies.create({
        data: { name, slug, is_active: true },
        select: {
            id: true,
            name: true,
            slug: true,
            is_active: true,
            created_at: true,
        },
    });

    return company;
};

export const updateCompany = async (id, { name, is_active }) => {
    const company = await prisma.companies.findUnique({ where: { id } });

    if (!company) {
        throw new AppError("Company not found", 404);
    }

    const updated = await prisma.companies.update({
        where: { id },
        data: {
            ...(name !== undefined && { name }),
            ...(is_active !== undefined && { is_active }),
        },
        select: {
            id: true,
            name: true,
            slug: true,
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
    const company = await prisma.companies.findUnique({ where: { id } });

    if (!company) {
        throw new AppError("Company not found", 404);
    }

    const [admin_count, employee_count, active_cycles, total_objectives, total_kpi_assignments, okr_progress] =
        await Promise.all([
            prisma.users.count({ where: { company_id: id, role: Prisma.UserRole.ADMIN_COMPANY } }),
            prisma.users.count({ where: { company_id: id, role: Prisma.UserRole.EMPLOYEE } }),
            prisma.cycles.count({ where: { company_id: id, is_locked: false } }),
            prisma.objectives.count({ where: { company_id: id } }),
            prisma.kPIAssignments.count({ where: { company_id: id } }),
            prisma.objectives.aggregate({
                where: { company_id: id, status: "Active" },
                _avg: { progress_percentage: true },
            }),
        ]);

    return {
        admin_count,
        employee_count,
        active_cycles,
        total_objectives,
        avg_okr_progress: okr_progress._avg.progress_percentage ?? 0,
        total_kpi_assignments,
    };
};