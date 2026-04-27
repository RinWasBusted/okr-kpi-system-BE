import prisma from "../../../utils/prisma.js";
import { hashPassword } from "../../../utils/bcrypt.js";
import { deleteImageFromCloudinary, getCloudinaryImageUrl } from "../../../utils/cloudinary.js";
import AppError from "../../../utils/appError.js";

const COMPANY_ADMIN_ROLE = "ADMIN_COMPANY";

const adminSelect = {
  id: true,
  full_name: true,
  email: true,
  avatar_url: true,
  is_active: true,
  created_at: true,
};

const formatAdmin = (admin) => ({
    id: admin.id,
    full_name: admin.full_name,
    email: admin.email,
    avatar_url: admin.avatar_url
        ? getCloudinaryImageUrl(admin.avatar_url, 50, 50, "fill")
        : null,
    is_active: admin.is_active,
    created_at: admin.created_at,
});

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

  return { total, data: data.map(formatAdmin) };
};

export const findCompanyAdminById = async (companyId, adminId) =>
  prisma.users.findFirst({
    where: { id: adminId, company_id: companyId, role: COMPANY_ADMIN_ROLE },
  });

export const findCompanyAdminByEmail = async (companyId, email) =>
  prisma.users.findFirst({
    where: { company_id: companyId, role: COMPANY_ADMIN_ROLE, email },
  });

export const createCompanyAdmin = async (companyId, { full_name, email, password, avatar_url }) => {
  const hashedPassword = await hashPassword(password, 10);
  
  return await prisma.$transaction(async (tx) => {
    // 1. Create the admin user
    const admin = await tx.users.create({
      data: {
        company_id: companyId,
        full_name,
        email,
        password: hashedPassword,
        role: COMPANY_ADMIN_ROLE,
        is_active: true,
        avatar_url: avatar_url ?? null,
      },
      select: adminSelect,
    });

    // 2. Check if this is the first admin for this company
    const adminCount = await tx.users.count({
      where: { company_id: companyId, role: COMPANY_ADMIN_ROLE },
    });

    if (adminCount === 1) {
      // 3. Find the root unit of the company (parent_id is null)
      const rootUnit = await tx.units.findFirst({
        where: { company_id: companyId, parent_id: null },
      });

      if (rootUnit) {
        // 4. Assign admin as manager of the root unit
        await tx.units.update({
          where: { id: rootUnit.id },
          data: { manager_id: admin.id },
        });

        // 5. Assign admin to that root unit
        await tx.users.update({
          where: { id: admin.id },
          data: { unit_id: rootUnit.id },
        });
      }
    }

    return formatAdmin(admin);
  });
};

export const updateCompanyAdmin = async (adminId, updates) =>
  prisma.users.update({
    where: { id: adminId },
    data: updates,
    select: adminSelect,
  }).then(formatAdmin);

export const countActiveCompanyAdmins = async (companyId) =>
  prisma.users.count({
    where: { company_id: companyId, role: COMPANY_ADMIN_ROLE, is_active: true },
  });

export const deactivateCompanyAdmin = async (adminId) =>
  prisma.users.update({
    where: { id: adminId },
    data: { is_active: false },
    select: adminSelect,
  }).then(formatAdmin);

// ─── Avatar ───────────────────────────────────────────────────────────────────

export const updateAdminAvatar = async (adminId, publicId) => {
  const admin = await prisma.users.findFirst({
    where: { id: adminId, role: COMPANY_ADMIN_ROLE },
    select: { id: true, avatar_url: true },
  });

  if (!admin) throw new AppError("Admin not found", 404);

  // Delete old avatar from Cloudinary if exists
  if (admin.avatar_url) {
    await deleteImageFromCloudinary(admin.avatar_url);
  }

  const updated = await prisma.users.update({
    where: { id: adminId },
    data: { avatar_url: publicId },
    select: adminSelect,
  });

  return formatAdmin(updated);
};

export const deleteAdminAvatar = async (adminId) => {
  const admin = await prisma.users.findFirst({
    where: { id: adminId, role: COMPANY_ADMIN_ROLE },
    select: { id: true, avatar_url: true },
  });

  if (!admin) throw new AppError("Admin not found", 404);

  // Delete avatar from Cloudinary if exists
  if (admin.avatar_url) {
    await deleteImageFromCloudinary(admin.avatar_url);
  }

  const updated = await prisma.users.update({
    where: { id: adminId },
    data: { avatar_url: null },
    select: adminSelect,
  });

  return formatAdmin(updated);
};
