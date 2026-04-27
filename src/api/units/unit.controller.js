import * as unitService from "./unit.service.js";
import * as evaluationService from "../evaluations/evaluations.service.js";
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

        const { page, per_page, mode } = req.validated.query;

        const { total, data } = await unitService.listUnits({ page, per_page, mode }, req.user);

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

        const { name, parent_id, manager_id } = req.validated.body;

        const unit = await unitService.createUnit(companyId, {
            name: name.trim(),
            parent_id: parent_id ?? undefined,
            manager_id: manager_id ?? undefined,
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

        const { name, parent_id, manager_id } = req.validated.body;

        const updates = {};
        if (name !== undefined && name !== null) {
            updates.name = name.trim();
        }
        if (parent_id !== undefined) updates.parent_id = parent_id;
        if (manager_id !== undefined) updates.manager_id = manager_id;

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

        const unit = await unitService.getUnitDetail(unitId, req.user);

        res.success("Unit detail retrieved successfully", 200, unit);
    } catch (error) {
        throw error;
    }
};

// GET /units/:id/evaluations
export const getUnitEvaluations = async (req, res) => {
    const companyId = req.user.company_id;
    if (!companyId) throw new AppError("Company context is required", 403);

    const unitId = Number(req.params.id);
    if (!Number.isInteger(unitId) || unitId <= 0) {
        throw new AppError("Invalid unit ID", 400);
    }

    const cycleId = parsePositiveInt(req.query.cycle_id, null);
    if (!cycleId) {
        throw new AppError("cycle_id is required", 422);
    }

    const evaluations = await evaluationService.listUnitEvaluations(companyId, unitId, cycleId);

    res.success("Unit evaluations retrieved successfully", 200, evaluations);
};
