import prisma from "../../../utils/prisma.js";

const COMPANY_ADMIN_ROLE = "ADMIN_COMPANY";

const adminSelect = {
  id: true,
  full_name: true,
  email: true,
  is_active: true,
  created_at: true,
};

export const findCompanyById = async (companyId) =>
  prisma.companies.findUnique({ where: { id: companyId } });

export const listCompanyAdmins = async (companyId, { is_active, page, per_page }) => {
  const where = {
    company_id: companyId,
    role: COMPANY_ADMIN_ROLE,
    ...(is_active !== undefined ? { is_active } : {}),
  };

  const [total, data] = await Promise.all([
    prisma.users.count({ where }),
    prisma.users.findMany({
      where,
      skip: (page - 1) * per_page,
      take: per_page,
      orderBy: { id: "asc" },
      select: adminSelect,
    }),
  ]);

  return { total, data };
};

export const findCompanyAdminById = async (companyId, adminId) =>
  prisma.users.findFirst({
    where: { id: adminId, company_id: companyId, role: COMPANY_ADMIN_ROLE },
  });

export const findCompanyAdminByEmail = async (companyId, email) =>
  prisma.users.findFirst({
    where: { company_id: companyId, role: COMPANY_ADMIN_ROLE, email },
  });

export const createCompanyAdmin = async (companyId, { full_name, email, password }) =>
  prisma.users.create({
    data: {
      company_id: companyId,
      full_name,
      email,
      password,
      role: COMPANY_ADMIN_ROLE,
      is_active: true,
    },
    select: adminSelect,
  });

export const updateCompanyAdmin = async (adminId, updates) =>
  prisma.users.update({
    where: { id: adminId },
    data: updates,
    select: adminSelect,
  });

export const countActiveCompanyAdmins = async (companyId) =>
  prisma.users.count({
    where: { company_id: companyId, role: COMPANY_ADMIN_ROLE, is_active: true },
  });

export const deactivateCompanyAdmin = async (adminId) =>
  prisma.users.update({
    where: { id: adminId },
    data: { is_active: false },
    select: adminSelect,
  });
