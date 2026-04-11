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
        const objectiveId = parsePositiveInt(req.params.objective_id, null);
        if (!objectiveId) throw new AppError("Invalid objective ID", 400);

        const { title, target_value, current_value, unit, weight, due_date } = req.validated.body;

        const keyResult = await keyResultService.createKeyResult(req.user, objectiveId, {
            title: title.trim(),
            target_value,
            current_value,
            unit: unit.trim(),
            weight,
            due_date,
        });

        res.success("Key result created successfully", 201, { key_result: keyResult });
    } catch (error) {
        throw error;
    }
};

// POST /objectives/:objective_id/key-results/batch
export const createMultipleKeyResults = async (req, res) => {
    try {
        const objectiveId = parsePositiveInt(req.params.objective_id, null);
        if (!objectiveId) throw new AppError("Invalid objective ID", 400);

        const { key_results } = req.validated.body;

        const payloads = key_results.map((kr) => ({
            title: kr.title.trim(),
            target_value: kr.target_value,
            current_value: kr.current_value,
            unit: kr.unit.trim(),
            weight: kr.weight,
            due_date: kr.due_date,
            evaluation_method: kr.evaluation_method,
        }));

        const keyResults = await keyResultService.createMultipleKeyResults(req.user, objectiveId, payloads);

        res.success("Key results created successfully", 201, { key_results: keyResults });
    } catch (error) {
        throw error;
    }
};

// PUT /key-results/:id
export const updateKeyResult = async (req, res) => {
    try {
        const keyResultId = parsePositiveInt(req.params.id, null);
        if (!keyResultId) throw new AppError("Invalid key result ID", 400);

        const { title, target_value, current_value, unit, weight, due_date } = req.validated.body;
        const updates = {};

        if (title !== undefined) {
            updates.title = title.trim();
        }

        if (target_value !== undefined) {
            updates.target_value = target_value;
        }

        if (current_value !== undefined) {
            updates.current_value = current_value;
        }

        if (unit !== undefined) {
            updates.unit = unit.trim();
        }

        if (weight !== undefined) {
            updates.weight = weight;
        }

        if (due_date !== undefined) {
            updates.due_date = due_date;
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
        const keyResultId = parsePositiveInt(req.params.id, null);
        if (!keyResultId) throw new AppError("Invalid key result ID", 400);

        await keyResultService.deleteKeyResult(req.user, keyResultId);

        res.status(204).send();
    } catch (error) {
        throw error;
    }
};
