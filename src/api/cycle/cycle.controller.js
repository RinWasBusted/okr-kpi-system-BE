import * as cycleService from "./cycle.service.js";
import AppError from "../../utils/appError.js";

// DELETE /cycles/:id
export const deleteCycle = async (req, res) => {
    try {
        const companyId = req.user.company_id;
        if (!companyId) throw new AppError("Company context is required", 403);

        const cycleId = parsePositiveInt(req.params.id, null);
        if (!cycleId) throw new AppError("Invalid cycle ID", 400);

        const result = await cycleService.deleteCycle(companyId, cycleId);

        res.success("Cycle deleted successfully", 200, { deleted_cycle: result });
    } catch (error) {
        throw error;
    }
};

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

const parseDateInput = (value) => {
    if (typeof value !== "string") return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const date = new Date(`${value}T00:00:00Z`);
    if (Number.isNaN(date.getTime())) return null;
    return date;
};

// GET /cycles
export const getCycles = async (req, res) => {
    try {
        const companyId = req.user.company_id;
        if (!companyId) throw new AppError("Company context is required", 403);

        const page = parsePositiveInt(req.query.page, 1);
        const per_page = Math.min(parsePositiveInt(req.query.per_page, 20), 100);
        const is_locked = parseBoolean(req.query.is_locked);
        const year = req.query.year ? parsePositiveInt(req.query.year, undefined) : undefined;

        const { total, open_cycles_count, data, last_page } = await cycleService.listCycles({
            companyId,
            is_locked,
            year,
            page,
            per_page,
        });

        res.success("Cycles retrieved successfully", 200, data, {
            total,
            open_cycles_count,
            page,
            per_page,
            last_page,
        });
    } catch (error) {
        throw error;
    }
};

// POST /cycles
export const createCycle = async (req, res) => {
    try {
        const companyId = req.user.company_id;
        if (!companyId) throw new AppError("Company context is required", 403);

        const { name, start_date, end_date } = req.body;

        if (!name || typeof name !== "string" || name.trim() === "") {
            throw new AppError("name is required", 422);
        }

        const parsedStart = parseDateInput(start_date);
        const parsedEnd = parseDateInput(end_date);
        if (!parsedStart || !parsedEnd) {
            throw new AppError("start_date and end_date must be in YYYY-MM-DD format", 422);
        }
        if (parsedEnd <= parsedStart) {
            throw new AppError("end_date must be after start_date", 422, "INVALID_DATE_RANGE");
        }

        const cycle = await cycleService.createCycle(companyId, {
            name: name.trim(),
            start_date: parsedStart,
            end_date: parsedEnd,
        });

        res.success("Cycle created successfully", 201, { cycle });
    } catch (error) {
        throw error;
    }
};

// GET /cycles/:id
export const getCycleById = async (req, res) => {
    try {
        const companyId = req.user.company_id;
        if (!companyId) throw new AppError("Company context is required", 403);

        const cycleId = parsePositiveInt(req.params.id, null);
        if (!cycleId) throw new AppError("Invalid cycle ID", 400);

        const cycle = await cycleService.getCycleDetail(companyId, cycleId);

        res.success("Cycle retrieved successfully", 200, { cycle });
    } catch (error) {
        throw error;
    }
};

// PUT /cycles/:id
export const updateCycle = async (req, res) => {
    try {
        const companyId = req.user.company_id;
        if (!companyId) throw new AppError("Company context is required", 403);

        const cycleId = parsePositiveInt(req.params.id, null);
        if (!cycleId) throw new AppError("Invalid cycle ID", 400);

        const { name, start_date, end_date } = req.body;
        const updates = {};

        if (name !== undefined) {
            if (typeof name !== "string" || name.trim() === "") {
                throw new AppError("name must be a non-empty string", 422);
            }
            updates.name = name.trim();
        }

        if (start_date !== undefined) {
            const parsed = parseDateInput(start_date);
            if (!parsed) throw new AppError("start_date must be in YYYY-MM-DD format", 422);
            updates.start_date = parsed;
        }

        if (end_date !== undefined) {
            const parsed = parseDateInput(end_date);
            if (!parsed) throw new AppError("end_date must be in YYYY-MM-DD format", 422);
            updates.end_date = parsed;
        }

        if (updates.start_date && updates.end_date && updates.end_date <= updates.start_date) {
            throw new AppError("end_date must be after start_date", 422, "INVALID_DATE_RANGE");
        }

        if (Object.keys(updates).length === 0) {
            throw new AppError("No fields provided to update", 400);
        }

        const cycle = await cycleService.updateCycle(companyId, cycleId, updates);

        res.success("Cycle updated successfully", 200, { cycle });
    } catch (error) {
        throw error;
    }
};

// PATCH /cycles/:id/lock
export const lockCycle = async (req, res) => {
    try {
        const companyId = req.user.company_id;
        if (!companyId) throw new AppError("Company context is required", 403);

        const cycleId = parsePositiveInt(req.params.id, null);
        if (!cycleId) throw new AppError("Invalid cycle ID", 400);

        const cycle = await cycleService.lockCycle(companyId, cycleId, req.user);

        res.success("Cycle locked successfully", 200, { cycle });
    } catch (error) {
        throw error;
    }
};

// POST /cycles/:id/clone
export const cloneCycle = async (req, res) => {
    try {
        const companyId = req.user.company_id;
        if (!companyId) throw new AppError("Company context is required", 403);

        // targetCycleId is the cycle we're copying INTO (from URL param)
        const targetCycleId = parsePositiveInt(req.params.id, null);
        if (!targetCycleId) throw new AppError("Invalid target cycle ID", 400);

        const { objective_ids, kpi_assignment_ids } = req.body;

        // Parse objective_ids if provided (array of IDs to clone)
        let parsedObjectiveIds = [];
        if (objective_ids !== undefined) {
            if (!Array.isArray(objective_ids)) {
                throw new AppError("objective_ids must be an array", 422);
            }
            parsedObjectiveIds = objective_ids
                .map((id) => parsePositiveInt(id, null))
                .filter((id) => id !== null);
        }

        // Parse kpi_assignment_ids if provided (array of IDs to clone)
        let parsedKpiIds = [];
        if (kpi_assignment_ids !== undefined) {
            if (!Array.isArray(kpi_assignment_ids)) {
                throw new AppError("kpi_assignment_ids must be an array", 422);
            }
            parsedKpiIds = kpi_assignment_ids
                .map((id) => parsePositiveInt(id, null))
                .filter((id) => id !== null);
        }

        const result = await cycleService.cloneCycle(companyId, targetCycleId, {
            objective_ids: parsedObjectiveIds,
            kpi_assignment_ids: parsedKpiIds,
        }, req.user);

        res.success("Items cloned successfully", 201, {
            cloned_objective_ids: result.cloned_objective_ids,
            cloned_kpi_assignment_ids: result.cloned_kpi_assignment_ids,
        });
    } catch (error) {
        throw error;
    }
};
