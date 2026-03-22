import * as userService from "./user.service.js";
import AppError from "../../utils/appError.js";

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

// GET /users
export const getUsers = async (req, res) => {
    try {
        const companyId = req.user.company_id;
        if (!companyId) throw new AppError("Company context is required", 403);

        const { search } = req.query;
        const unit_id = req.query.unit_id ? parsePositiveInt(req.query.unit_id, undefined) : undefined;
        const page = parsePositiveInt(req.query.page, 1);
        const per_page = Math.min(parsePositiveInt(req.query.per_page, 20), 100);

        const { total, data, last_page } = await userService.listUsers({
            unit_id,
            search: search || undefined,
            page,
            per_page,
        });

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

        const user = await userService.findUserById(userId);

        res.success("User retrieved successfully", 200, { user });
    } catch (error) {
        throw error;
    }
};

// POST /users
export const createUser = async (req, res) => {
    try {
        const companyId = req.user.company_id;
        if (!companyId) throw new AppError("Company context is required", 403);

        const { full_name, email, password, unit_id } = req.body;

        if (!full_name || typeof full_name !== "string" || full_name.trim() === "") {
            throw new AppError("full_name is required", 422);
        }
        if (!email || typeof email !== "string") {
            throw new AppError("email is required", 422);
        }
        if (!password || typeof password !== "string") {
            throw new AppError("password is required", 422);
        }
        if (password.length < 8) {
            throw new AppError("Password must be at least 8 characters", 422);
        }

        const user = await userService.createUser(companyId, {
            full_name: full_name.trim(),
            email: email.trim().toLowerCase(),
            password,
            unit_id: unit_id !== undefined ? Number(unit_id) || null : undefined,
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

        const { full_name, unit_id, password, is_active } = req.body;

        // Build only provided fields
        const updates = {};

        if (full_name !== undefined) {
            if (typeof full_name !== "string" || full_name.trim() === "") {
                throw new AppError("full_name must be a non-empty string", 422);
            }
            updates.full_name = full_name.trim();
        }

        if (unit_id !== undefined) {
            updates.unit_id = unit_id === null ? null : Number(unit_id) || null;
        }

        if (password !== undefined) {
            if (typeof password !== "string" || password.length < 8) {
                throw new AppError("Password must be at least 8 characters", 422);
            }
            updates.password = password;
        }

        if (is_active !== undefined) {
            const parsed = parseBoolean(is_active);
            if (parsed === undefined) throw new AppError("is_active must be a boolean", 422);
            updates.is_active = parsed;
        }

        if (Object.keys(updates).length === 0) {
            throw new AppError("No fields provided to update", 400);
        }

        const user = await userService.updateUser(userId, updates);

        res.success("User updated successfully", 200, { user });
    } catch (error) {
        throw error;
    }
};
