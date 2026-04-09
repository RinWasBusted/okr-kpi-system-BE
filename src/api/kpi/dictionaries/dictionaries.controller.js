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

// GET /kpi-dictionaries/for-assignment/:unit_id
export const getKPIDictionariesForAssignment = async (req, res) => {
    try {
        const unitId = parsePositiveInt(req.params.unit_id, null);
        if (!unitId) throw new AppError("Invalid unit ID", 400);

        const data = await dictionariesService.getKPIDictionariesForUnitAssignment(req.user, unitId);
        res.success("KPI Dictionaries for unit assignment retrieved successfully", 200, data);
    } catch (error) {
        throw error;
    }
};

// POST /kpi-dictionaries
export const createKPIDictionary = async (req, res) => {
    try {
        const { name, unit, evaluation_method, unit_id, description } = req.validated.body;

        const dictionary = await dictionariesService.createKPIDictionary(req.user, {
            name: name.trim(),
            unit: unit.trim(),
            evaluation_method,
            description: description?.trim() || null,
            unit_id: unit_id ?? undefined,
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

        const { name, unit, evaluation_method, unit_id, description } = req.validated.body;
        const updates = {};

        if (name !== undefined) {
            updates.name = name.trim();
        }

        if (unit !== undefined) {
            updates.unit = unit.trim();
        }

        if (evaluation_method !== undefined) {
            updates.evaluation_method = evaluation_method;
        }

        if (description !== undefined) {
            updates.description = description ? description.trim() : null;
        }

        if (unit_id !== undefined) {
            updates.unit_id = unit_id;
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
