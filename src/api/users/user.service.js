import prisma from "../../utils/prisma.js";
import AppError from "../../utils/appError.js";
import { hashPassword } from "../../utils/bcrypt.js";
import { UserRole } from "@prisma/client";
import { deleteImageFromCloudinary, getCloudinaryImageUrl } from "../../utils/cloudinary.js";
import { updateAccessPathForUserOwnedItems } from "../../utils/path.js";

const userSelect = {
    id: true,
    full_name: true,
    email: true,
    job_title: true,
    avatar_url: true,
    role: true,
    is_active: true,
    created_at: true,
    unit: {
        select: {
            id: true,
            name: true,
        },
    },
};

const formatUser = (user) => ({
    id: user.id,
    full_name: user.full_name,
    email: user.email,
    job_title: user.job_title ?? null,
    avatar_url: user.avatar_url
        ? getCloudinaryImageUrl(user.avatar_url, 50, 50, "fill")
        : null,
    role: user.role,
    unit: user.unit ?? null,
    is_active: user.is_active,
    created_at: user.created_at,
});

// ─── List ─────────────────────────────────────────────────────────────────────

export const listUsers = async ({ unit_id, search, page, per_page }) => {
    const where = {
        // Exclude system admin (ADMIN role) - only show ADMIN_COMPANY and EMPLOYEE
        role: { not: UserRole.ADMIN },
        ...(unit_id !== undefined && { unit_id }),
        ...(search && {
            OR: [
                { full_name: { contains: search, mode: "insensitive" } },
                { email: { contains: search, mode: "insensitive" } },
            ],
        }),
    };

    const [total, users] = await Promise.all([
        prisma.users.count({ where }),
        prisma.users.findMany({
            where,
            skip: (page - 1) * per_page,
            take: per_page,
            orderBy: { id: "asc" },
            select: userSelect,
        }),
    ]);

    return {
        total,
        data: users.map(formatUser),
        last_page: Math.ceil(total / per_page),
    };
};

// ─── Find ─────────────────────────────────────────────────────────────────────

export const findUserById = async (userId) => {
    const user = await prisma.users.findFirst({
        where: { id: userId },
        select: userSelect,
    });

    if (!user) throw new AppError("User not found", 404);

    return formatUser(user);
};

// ─── Create ───────────────────────────────────────────────────────────────────

export const createUser = async (companyId, { full_name, email, password, unit_id, avatar_url }) => {
    // email is @unique globally in schema — check globally to give a clean error
    // instead of letting Prisma throw a constraint violation
    const existing = await prisma.users.findFirst({ where: { email } });
    if (existing) throw new AppError("Email already exists", 409, "EMAIL_EXISTS");

    if (unit_id !== undefined && unit_id !== null) {
        const unit = await prisma.units.findFirst({
            where: { id: unit_id },
        });
        if (!unit) throw new AppError("Unit not found", 404, "UNIT_NOT_FOUND");
    }

    const hashed = await hashPassword(password);

    const user = await prisma.users.create({
        data: {
            company_id: companyId,
            full_name,
            email,
            password: hashed,
            role: UserRole.EMPLOYEE,
            unit_id: unit_id ?? null,
            is_active: true,
            avatar_url: avatar_url ?? null,
        },
        select: userSelect,
    });

    return formatUser(user);
};

// ─── Update ───────────────────────────────────────────────────────────────────

export const updateUser = async (userId, { full_name, unit_id, password, is_active }) => {
    const existing = await prisma.users.findFirst({
        where: { id: userId, role: UserRole.EMPLOYEE },
    });
    if (!existing) throw new AppError("User not found", 404);

    const unitIdChanged = unit_id !== undefined && unit_id !== existing.unit_id;

    if (unit_id !== undefined && unit_id !== null) {
        const unit = await prisma.units.findFirst({
            where: { id: unit_id },
        });
        if (!unit) throw new AppError("Unit not found", 404, "UNIT_NOT_FOUND");
    }

    const updates = {};
    if (full_name !== undefined) updates.full_name = full_name;
    if (unit_id !== undefined) updates.unit_id = unit_id ?? null;
    if (is_active !== undefined) updates.is_active = is_active;
    if (password !== undefined) updates.password = await hashPassword(password);

    // Use transaction to ensure consistency between user update and access_path updates
    const updated = await prisma.$transaction(async (tx) => {
        const user = await tx.users.update({
            where: { id: userId },
            data: updates,
            select: userSelect,
        });

        // Update access_path for user's owned objectives and assignments when unit changes
        if (unitIdChanged) {
            await updateAccessPathForUserOwnedItems(tx, userId, unit_id ?? null);
        }

        return user;
    });

    return formatUser(updated);
};

// ─── Avatar ───────────────────────────────────────────────────────────────────

export const updateUserAvatar = async (userId, publicId) => {
    const existing = await prisma.users.findFirst({
        where: { id: userId },
        select: { id: true },
    });

    if (!existing) throw new AppError("User not found", 404);

    // Delete old avatar from Cloudinary if exists
    if (existing.avatar_url) {
        await deleteImageFromCloudinary(existing.avatar_url);
    }

    const updated = await prisma.users.update({
        where: { id: userId },
        data: { avatar_url: publicId },
        select: userSelect,
    });

    return formatUser(updated);
};

export const deleteUserAvatar = async (userId) => {
    const existing = await prisma.users.findFirst({
        where: { id: userId },
        select: { id: true, avatar_url: true },
    });

    if (!existing) throw new AppError("User not found", 404);

    // Delete avatar from Cloudinary if exists
    if (existing.avatar_url) {
        await deleteImageFromCloudinary(existing.avatar_url);
    }

    const updated = await prisma.users.update({
        where: { id: userId },
        data: { avatar_url: null },
        select: userSelect,
    });

    return formatUser(updated);
};
