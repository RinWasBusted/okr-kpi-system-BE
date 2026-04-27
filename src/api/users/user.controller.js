import * as userService from "./user.service.js";
import * as evaluationService from "../evaluations/evaluations.service.js";
import AppError from "../../utils/appError.js";
import { uploadImageToCloudinary } from "../../utils/cloudinary.js";

const parsePositiveInt = (value, fallback) => {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
    return parsed;
};

const parseBoolean = (value) => {
    if (value === undefined || value === null) return undefined;
    const lower = String(value).toLowerCase();
    if (["true", "1", "yes"].includes(lower)) return true;
    if (["false", "0", "no"].includes(lower)) return false;
    return undefined;
};

// Middleware to check if user is owner or ADMIN_COMPANY
export const isOwnerOrAdmin = (req, res, next) => {
    const { id } = req.params;
    const userId = parsePositiveInt(id, null);
    const currentUser = req.user;

    if (!userId) {
        return res.status(400).json({
            success: false,
            error: { code: "BAD_REQUEST", message: "Invalid user ID" }
        });
    }

    // Allow if: is the user themselves, or is ADMIN_COMPANY, or is ADMIN
    if (currentUser.id === userId || currentUser.role === "ADMIN_COMPANY" || currentUser.role === "ADMIN") {
        return next();
    }

    return res.status(403).json({
        success: false,
        error: { code: "FORBIDDEN", message: "Bạn không có quyền cập nhật avatar của user này" }
    });
};

// GET /users
export const getUsers = async (req, res) => {
    try {
        const companyId = req.user.company_id;
        if (!companyId) throw new AppError("Company context is required", 403);

        const { search, unit_id, page, per_page } = req.validated.query;

        const { total, data, last_page } = await userService.listUsers({
            unit_id,
            search,
            page,
            per_page,
        }, req.user);

        res.success("Users retrieved successfully", 200, data, {
            total,
            page,
            per_page,
            last_page,
        });
    } catch (error) {
        throw error;
    }
};

// GET /users/:id
export const getUserById = async (req, res) => {
    try {
        const companyId = req.user.company_id;
        if (!companyId) throw new AppError("Company context is required", 403);

        const userId = parsePositiveInt(req.params.id, null);
        if (!userId) throw new AppError("Invalid user ID", 400);

        const user = await userService.findUserById(userId, req.user);

        res.success("User retrieved successfully", 200, { user });
    } catch (error) {
        throw error;
    }
};

// GET /users/:id/evaluations
export const getUserEvaluations = async (req, res) => {
    const userId = parsePositiveInt(req.params.id, null);
    if (!userId) throw new AppError("Invalid user ID", 400);

    const page = parsePositiveInt(req.query.page, 1);
    const per_page = Math.min(parsePositiveInt(req.query.per_page, 10), 100);

    const result = await evaluationService.listUserEvaluations(req.user, userId, {
        page,
        per_page,
    });

    res.success("User evaluations retrieved successfully", 200, result.data, result.meta);
};

// POST /users
export const createUser = async (req, res) => {
    try {
        const companyId = req.user.company_id;
        if (!companyId) throw new AppError("Company context is required", 403);

        const { full_name, email, password, unit_id, job_title } = req.validated.body;

        let avatarPublicId = null;
        // Upload avatar if file is provided
        if (req.file) {
            try {
                const uploadResult = await uploadImageToCloudinary(
                    req.file.buffer,
                    req.file.originalname,
                    "okr-kpi-system/users/avatars"
                );
                avatarPublicId = uploadResult.public_id;
            } catch (uploadError) {
                console.error("Avatar upload failed:", uploadError);
                throw new AppError("Avatar upload failed", 400, "AVATAR_UPLOAD_FAILED");
            }
        }

        const user = await userService.createUser(companyId, {
            full_name: full_name.trim(),
            email: email.trim().toLowerCase(),
            password,
            job_title: job_title ? job_title.trim() : null,
            unit_id: unit_id ?? undefined,
            avatar_url: avatarPublicId,
        });

        res.success("User created successfully", 201, { user });
    } catch (error) {
        throw error;
    }
};

// PUT /users/:id
export const updateUser = async (req, res) => {
    try {
        const companyId = req.user.company_id;
        if (!companyId) throw new AppError("Company context is required", 403);

        const userId = parsePositiveInt(req.params.id, null);
        if (!userId) throw new AppError("Invalid user ID", 400);

        const { full_name, job_title, unit_id, password, is_active } = req.validated.body;

        // Build only provided fields
        const updates = {};

        if (full_name !== undefined) {
            updates.full_name = full_name.trim();
        }

        if (job_title !== undefined) {
            updates.job_title = job_title ? job_title.trim() : null;
        }

        if (unit_id !== undefined) {
            updates.unit_id = unit_id;
        }

        if (password !== undefined) {
            updates.password = password;
        }

        if (is_active !== undefined) {
            updates.is_active = is_active;
        }

        const user = await userService.updateUser(userId, updates);

        res.success("User updated successfully", 200, { user });
    } catch (error) {
        throw error;
    }
};

// PATCH /users/:id/avatar - Upload or update avatar
export const uploadAvatar = async (req, res) => {
    try {
        const userId = parsePositiveInt(req.params.id, null);
        if (!userId) throw new AppError("Invalid user ID", 400);

        // Check if user exists
        await userService.findUserById(userId);

        // If no file provided, delete avatar
        if (!req.file) {
            const user = await userService.deleteUserAvatar(userId);
            return res.success("Avatar deleted successfully", 200, { user });
        }

        // Upload new avatar to Cloudinary
        const uploadResult = await uploadImageToCloudinary(
            req.file.buffer,
            req.file.originalname,
            "okr-kpi-system/users/avatars"
        );

        const user = await userService.updateUserAvatar(userId, uploadResult.public_id);

        res.success("Avatar updated successfully", 200, { user });
    } catch (error) {
        throw error;
    }
};

// DELETE /users/:id/avatar - Delete avatar
export const deleteAvatar = async (req, res) => {
    try {
        const userId = parsePositiveInt(req.params.id, null);
        if (!userId) throw new AppError("Invalid user ID", 400);

        const user = await userService.deleteUserAvatar(userId);

        res.success("Avatar deleted successfully", 200, { user });
    } catch (error) {
        throw error;
    }
};

// DELETE /users/:id - Soft delete user
export const deleteUser = async (req, res) => {
    try {
        const userId = parsePositiveInt(req.params.id, null);
        if (!userId) throw new AppError("Invalid user ID", 400);

        await userService.softDeleteUser(userId);

        res.status(204).send();
    } catch (error) {
        throw error;
    }
};
