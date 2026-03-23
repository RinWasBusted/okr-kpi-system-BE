import * as keyResultService from "./key-result.service.js";
import AppError from "../../../utils/appError.js";

const parsePositiveInt = (value, fallback) => {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
    return parsed;
};

const parseOptionalId = (value) => {
    if (value === undefined || value === null || value === "") return undefined;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) return undefined;
    return parsed;
};

const parseNumber = (value) => {
    if (value === undefined || value === null || value === "") return undefined;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return undefined;
    return parsed;
};

const parseDateInput = (value) => {
    if (value === undefined || value === null || value === "") return undefined;
    if (typeof value !== "string") return undefined;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
    const date = new Date(`${value}T00:00:00Z`);
    if (Number.isNaN(date.getTime())) return undefined;
    return date;
};

// GET /objectives/:objective_id/key-results
export const getKeyResults = async (req, res) => {
    try {
        const companyId = req.user.company_id;
        if (!companyId) throw new AppError("Company context is required", 403);

        const objectiveId = parsePositiveInt(req.params.objective_id, null);
        if (!objectiveId) throw new AppError("Invalid objective ID", 400);

        const data = await keyResultService.listKeyResults(req.user, objectiveId);

        res.success("Key results retrieved successfully", 200, data);
    } catch (error) {
        throw error;
    }
};

// POST /objectives/:objective_id/key-results
export const createKeyResult = async (req, res) => {
    try {
        const companyId = req.user.company_id;
        if (!companyId) throw new AppError("Company context is required", 403);

        const objectiveId = parsePositiveInt(req.params.objective_id, null);
        if (!objectiveId) throw new AppError("Invalid objective ID", 400);

        const { title, target_value, unit, weight, due_date } = req.body;

        if (!title || typeof title !== "string" || title.trim() === "") {
            throw new AppError("title is required", 422);
        }

        const targetValue = parseNumber(target_value);
        if (targetValue === undefined) throw new AppError("target_value is required", 422);

        if (!unit || typeof unit !== "string" || unit.trim() === "") {
            throw new AppError("unit is required", 422);
        }

        const weightValue = parseNumber(weight);
        if (weightValue === undefined) throw new AppError("weight is required", 422);
        if (weightValue < 0 || weightValue > 100) {
            throw new AppError("weight must be between 0 and 100", 422);
        }

        const parsedDueDate = parseDateInput(due_date);
        if (due_date !== undefined && !parsedDueDate) {
            throw new AppError("due_date must be in YYYY-MM-DD format", 422);
        }

        const keyResult = await keyResultService.createKeyResult(req.user, objectiveId, {
            title: title.trim(),
            target_value: targetValue,
            unit: unit.trim(),
            weight: weightValue,
            due_date: parsedDueDate,
        });

        res.success("Key result created successfully", 201, { key_result: keyResult });
    } catch (error) {
        throw error;
    }
};

// PUT /key-results/:id
export const updateKeyResult = async (req, res) => {
    try {
        const companyId = req.user.company_id;
        if (!companyId) throw new AppError("Company context is required", 403);

        const keyResultId = parsePositiveInt(req.params.id, null);
        if (!keyResultId) throw new AppError("Invalid key result ID", 400);

        const { title, target_value, unit, weight, due_date } = req.body;
        const updates = {};

        if (title !== undefined) {
            if (typeof title !== "string" || title.trim() === "") {
                throw new AppError("title must be a non-empty string", 422);
            }
            updates.title = title.trim();
        }

        if (target_value !== undefined) {
            const parsed = parseNumber(target_value);
            if (parsed === undefined) throw new AppError("target_value must be a number", 422);
            updates.target_value = parsed;
        }

        if (unit !== undefined) {
            if (typeof unit !== "string" || unit.trim() === "") {
                throw new AppError("unit must be a non-empty string", 422);
            }
            updates.unit = unit.trim();
        }

        if (weight !== undefined) {
            const parsed = parseNumber(weight);
            if (parsed === undefined) throw new AppError("weight must be a number", 422);
            if (parsed < 0 || parsed > 100) {
                throw new AppError("weight must be between 0 and 100", 422);
            }
            updates.weight = parsed;
        }

        if (due_date !== undefined) {
            const parsed = parseDateInput(due_date);
            if (!parsed) throw new AppError("due_date must be in YYYY-MM-DD format", 422);
            updates.due_date = parsed;
        }

        if (Object.keys(updates).length === 0) {
            throw new AppError("No fields provided to update", 400);
        }

        const keyResult = await keyResultService.updateKeyResult(req.user, keyResultId, updates);

        res.success("Key result updated successfully", 200, { key_result: keyResult });
    } catch (error) {
        throw error;
    }
};

// DELETE /key-results/:id
export const deleteKeyResult = async (req, res) => {
    try {
        const companyId = req.user.company_id;
        if (!companyId) throw new AppError("Company context is required", 403);

        const keyResultId = parsePositiveInt(req.params.id, null);
        if (!keyResultId) throw new AppError("Invalid key result ID", 400);

        await keyResultService.deleteKeyResult(req.user, keyResultId);

        res.status(204).send();
    } catch (error) {
        throw error;
    }
};
