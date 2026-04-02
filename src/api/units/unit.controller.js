import * as unitService from "./unit.service.js";
import AppError from "../../utils/appError.js";

const parsePositiveInt = (value, fallback) => {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
    return parsed;
};

const parseOptionalId = (value) => {
    if (value === undefined) return undefined;
    if (value === null) return null;
    if (value === 0 || value === "0" || value === null) return null; // explicit null to unset
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) return undefined; // invalid → ignore
    return parsed;
};

// GET /units
export const getUnits = async (req, res) => {
    try {
        const companyId = req.user.company_id;
        if (!companyId) throw new AppError("Company context is required", 403);

        const page = parsePositiveInt(req.query.page, 1);
        const per_page = parsePositiveInt(req.query.per_page, 100);
        const mode = req.query.mode === "list" ? "list" : "tree"; // "tree" | "list"

        const { total, data } = await unitService.listUnits({ page, per_page, mode });

        res.success("Units retrieved successfully", 200, data, {
            page,
            per_page,
            total,
            mode,
        });
    } catch (error) {
        throw error;
    }
};

// POST /units
export const createUnit = async (req, res) => {
    try {
        const companyId = req.user.company_id;
        if (!companyId) throw new AppError("Company context is required", 403);

        const { name, parent_id, manager_id } = req.body;

        if (!name || typeof name !== "string" || name.trim() === "") {
            throw new AppError("name is required", 422);
        }

        const unit = await unitService.createUnit(companyId, {
            name: name.trim(),
            parent_id: parent_id !== undefined ? parseOptionalId(parent_id) : undefined,
            manager_id: manager_id !== undefined ? parseOptionalId(manager_id) : undefined,
        });

        res.success("Unit created successfully", 201, { unit });
    } catch (error) {
        throw error;
    }
};

// PUT /units/:id
export const updateUnit = async (req, res) => {
    try {
        const companyId = req.user.company_id;
        if (!companyId) throw new AppError("Company context is required", 403);

        const unitId = Number(req.params.id);
        if (!Number.isInteger(unitId) || unitId <= 0) {
            throw new AppError("Invalid unit ID", 400);
        }

        const { name, parent_id, manager_id } = req.body;

        const updates = {};
        if (name !== undefined && name !== null) {
            if (typeof name !== "string" || name.trim() === "") {
                throw new AppError("name must be a non-empty string", 422);
            }
            updates.name = name.trim();
        }
        if (parent_id !== undefined) updates.parent_id = parseOptionalId(parent_id);
        if (manager_id !== undefined) updates.manager_id = parseOptionalId(manager_id);

        if (Object.keys(updates).length === 0) {
            throw new AppError("No fields provided to update", 400);
        }

        const unit = await unitService.updateUnit(unitId, updates);

        res.success("Unit updated successfully", 200, { unit });
    } catch (error) {
        throw error;
    }
};

// DELETE /units/:id
export const deleteUnit = async (req, res) => {
    try {
        const companyId = req.user.company_id;
        if (!companyId) throw new AppError("Company context is required", 403);

        const unitId = Number(req.params.id);
        if (!Number.isInteger(unitId) || unitId <= 0) {
            throw new AppError("Invalid unit ID", 400);
        }

        await unitService.deleteUnit(unitId);

        res.status(204).send();
    } catch (error) {
        throw error;
    }
};

// GET /units/:id/info
export const getUnitInfo = async (req, res) => {
    try {
        const companyId = req.user.company_id;
        if (!companyId) throw new AppError("Company context is required", 403);

        const unitId = Number(req.params.id);
        if (!Number.isInteger(unitId) || unitId <= 0) {
            throw new AppError("Invalid unit ID", 400);
        }

        const unit = await unitService.getUnitInfo(unitId);

        res.success("Unit info retrieved successfully", 200, unit);
    } catch (error) {
        throw error;
    }
};

// GET /units/:id/detail
export const getUnitDetail = async (req, res) => {
    try {
        const companyId = req.user.company_id;
        if (!companyId) throw new AppError("Company context is required", 403);

        const unitId = Number(req.params.id);
        if (!Number.isInteger(unitId) || unitId <= 0) {
            throw new AppError("Invalid unit ID", 400);
        }

        const unit = await unitService.getUnitDetail(unitId);

        res.success("Unit detail retrieved successfully", 200, unit);
    } catch (error) {
        throw error;
    }
};
