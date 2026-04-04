import * as dictionariesService from "./dictionaries.service.js";
import AppError from "../../../utils/appError.js";

const parsePositiveInt = (value, fallback) => {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
    return parsed;
};

const parseNumber = (value) => {
    if (value === undefined || value === null || value === "") return undefined;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return undefined;
    return parsed;
};

const parseOptionalInt = (value) => {
    if (value === undefined || value === null || value === "") return undefined;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) return undefined;
    return parsed;
};

// GET /kpi-dictionaries
export const getKPIDictionaries = async (req, res) => {
    try {
        const forUnitId = parseOptionalInt(req.query.for_unit_id);
        const data = await dictionariesService.listKPIDictionaries(req.user, forUnitId);
        res.success("KPI Dictionaries retrieved successfully", 200, data);
    } catch (error) {
        throw error;
    }
};

// POST /kpi-dictionaries
export const createKPIDictionary = async (req, res) => {
    try {
        const { name, unit, evaluation_method, unit_id } = req.body;

        if (!name || typeof name !== "string" || name.trim() === "") {
            throw new AppError("name is required", 422);
        }

        if (!unit || typeof unit !== "string" || unit.trim() === "") {
            throw new AppError("unit is required", 422);
        }

        if (!evaluation_method || typeof evaluation_method !== "string") {
            throw new AppError("evaluation_method is required", 422);
        }

        const validMethods = ["Positive", "Negative", "Stabilizing"];
        if (!validMethods.includes(evaluation_method)) {
            throw new AppError(
                "evaluation_method must be one of: Positive, Negative, Stabilizing",
                422,
            );
        }

        const parsedUnitId = parseOptionalInt(unit_id);

        const dictionary = await dictionariesService.createKPIDictionary(req.user, {
            name: name.trim(),
            unit: unit.trim(),
            evaluation_method,
            unit_id: parsedUnitId,
        });

        res.success("KPI Dictionary created successfully", 201, { kpi_dictionary: dictionary });
    } catch (error) {
        throw error;
    }
};

// PUT /kpi-dictionaries/:id
export const updateKPIDictionary = async (req, res) => {
    try {
        const dictionaryId = parsePositiveInt(req.params.id, null);
        if (!dictionaryId) throw new AppError("Invalid dictionary ID", 400);

        const { name, unit, evaluation_method, unit_id } = req.body;
        const updates = {};

        if (name !== undefined) {
            if (typeof name !== "string" || name.trim() === "") {
                throw new AppError("name must be a non-empty string", 422);
            }
            updates.name = name.trim();
        }

        if (unit !== undefined) {
            if (typeof unit !== "string" || unit.trim() === "") {
                throw new AppError("unit must be a non-empty string", 422);
            }
            updates.unit = unit.trim();
        }

        if (evaluation_method !== undefined) {
            if (typeof evaluation_method !== "string") {
                throw new AppError("evaluation_method must be a string", 422);
            }
            const validMethods = ["Positive", "Negative", "Stabilizing"];
            if (!validMethods.includes(evaluation_method)) {
                throw new AppError(
                    "evaluation_method must be one of: Positive, Negative, Stabilizing",
                    422,
                );
            }
            updates.evaluation_method = evaluation_method;
        }

        if (unit_id !== undefined) {
            const parsedUnitId = parseOptionalInt(unit_id);
            updates.unit_id = parsedUnitId;
        }

        if (Object.keys(updates).length === 0) {
            throw new AppError("No fields provided to update", 400);
        }

        const dictionary = await dictionariesService.updateKPIDictionary(
            req.user,
            dictionaryId,
            updates,
        );

        res.success("KPI Dictionary updated successfully", 200, { kpi_dictionary: dictionary });
    } catch (error) {
        throw error;
    }
};

// DELETE /kpi-dictionaries/:id
export const deleteKPIDictionary = async (req, res) => {
    try {
        const dictionaryId = parsePositiveInt(req.params.id, null);
        if (!dictionaryId) throw new AppError("Invalid dictionary ID", 400);

        await dictionariesService.deleteKPIDictionary(req.user, dictionaryId);

        res.status(204).send();
    } catch (error) {
        throw error;
    }
};
