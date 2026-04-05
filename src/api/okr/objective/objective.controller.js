import * as objectiveService from "./objective.service.js";
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

const parseBoolean = (value) => {
    if (value === undefined || value === null) return undefined;
    const lower = String(value).toLowerCase();
    if (["true", "1", "yes"].includes(lower)) return true;
    if (["false", "0", "no"].includes(lower)) return false;
    return undefined;
};

const parseVisibility = (value) => {
    if (value === undefined || value === null || value === "") return undefined;
    const upper = String(value).toUpperCase();
    if (["PUBLIC", "INTERNAL", "PRIVATE"].includes(upper)) return upper;
    throw new AppError("Invalid visibility", 422);
};

const parseStatus = (value) => {
    if (value === undefined || value === null || value === "") return undefined;
    const normalized = String(value);
    const allowed = ["Draft", "Pending_Approval", "Active", "Rejected", "Completed"];
    if (allowed.includes(normalized)) return normalized;
    throw new AppError("Invalid status", 422);
};

const parseProgressStatus = (value) => {
    if (value === undefined || value === null || value === "") return undefined;
    const normalized = String(value).toUpperCase();
    const allowed = ["NOT_STARTED", "DANGER", "WARNING", "ON_TRACK", "COMPLETED"];
    if (allowed.includes(normalized)) return normalized;
    throw new AppError("Invalid progress_status", 422);
};

// GET /objectives
export const getObjectives = async (req, res) => {
    try {
        const {
            cycle_id,
            unit_id,
            owner_id,
            status,
            progress_status,
            parent_objective_id,
            visibility,
            include_key_results,
            page,
            per_page,
            mode,
        } = req.validated.query;

        const filters = {
            cycle_id,
            unit_id,
            owner_id,
            status,
            progress_status,
            parent_objective_id,
            visibility,
        };

        const { total, data, last_page } = await objectiveService.listObjectives({
            user: req.user,
            filters,
            include_key_results,
            page,
            per_page,
            mode,
        });

        res.success("Objectives retrieved successfully", 200, data, {
            total,
            page,
            per_page,
            last_page,
        });
    } catch (error) {
        throw error;
    }
};

// POST /objectives
export const createObjective = async (req, res) => {
    try {
        const { title, cycle_id, unit_id, owner_id, parent_objective_id, visibility, description } = req.validated.body;

        const objective = await objectiveService.createObjective(req.user, {
            title: title.trim(),
            cycle_id,
            unit_id,
            owner_id,
            parent_objective_id,
            visibility,
            description: description?.trim() || null,
        });

        res.success("Objective created successfully", 201, { objective });
    } catch (error) {
        throw error;
    }
};

// PUT /objectives/:id
export const updateObjective = async (req, res) => {
    try {
        const objectiveId = parsePositiveInt(req.params.id, null);
        if (!objectiveId) throw new AppError("Invalid objective ID", 400);

        const { title, parent_objective_id, visibility, description } = req.validated.body;
        const updates = {};

        if (title !== undefined) {
            updates.title = title.trim();
        }

        if (description !== undefined) {
            updates.description = description ? description.trim() : null;
        }

        if (parent_objective_id !== undefined) {
            updates.parent_objective_id = parent_objective_id;
        }

        if (visibility !== undefined) {
            updates.visibility = visibility;
        }

        if (Object.keys(updates).length === 0) {
            throw new AppError("No fields provided to update", 400);
        }

        const objective = await objectiveService.updateObjective(req.user, objectiveId, updates);

        res.success("Objective updated successfully", 200, { objective });
    } catch (error) {
        throw error;
    }
};

// POST /objectives/:id/submit
export const submitObjective = async (req, res) => {
    try {
        const objectiveId = parsePositiveInt(req.params.id, null);
        if (!objectiveId) throw new AppError("Invalid objective ID", 400);

        const objective = await objectiveService.submitObjective(req.user, objectiveId);

        res.success("Objective submitted successfully", 200, { objective });
    } catch (error) {
        throw error;
    }
};

// POST /objectives/:id/approve
export const approveObjective = async (req, res) => {
    try {
        const objectiveId = parsePositiveInt(req.params.id, null);
        if (!objectiveId) throw new AppError("Invalid objective ID", 400);

        const { title, parent_objective_id, visibility, description } = req.validated.body;
        const updates = {};

        if (title !== undefined) {
            updates.title = title.trim();
        }

        if (description !== undefined) {
            updates.description = description ? description.trim() : null;
        }

        if (parent_objective_id !== undefined) {
            updates.parent_objective_id = parent_objective_id;
        }

        if (visibility !== undefined) {
            updates.visibility = visibility;
        }

        const objective = await objectiveService.approveObjective(req.user, objectiveId, updates);

        res.success("Objective approved successfully", 200, { objective });
    } catch (error) {
        throw error;
    }
};

// POST /objectives/:id/reject
export const rejectObjective = async (req, res) => {
    try {
        const objectiveId = parsePositiveInt(req.params.id, null);
        if (!objectiveId) throw new AppError("Invalid objective ID", 400);

        const { comment } = req.body;
        if (comment !== undefined && comment !== null && typeof comment !== "string") {
            throw new AppError("comment must be a string", 422);
        }

        const objective = await objectiveService.rejectObjective(req.user, objectiveId, comment?.trim());

        res.success("Objective rejected successfully", 200, { objective });
    } catch (error) {
        throw error;
    }
};

// DELETE /objectives/:id
export const deleteObjective = async (req, res) => {
    try {
        const objectiveId = parsePositiveInt(req.params.id, null);
        if (!objectiveId) throw new AppError("Invalid objective ID", 400);

        await objectiveService.deleteObjective(req.user, objectiveId);

        res.success("Objective deleted successfully", 200, null);
    } catch (error) {
        throw error;
    }
};

// GET /objectives/available-parents
export const getAvailableParentObjectives = async (req, res) => {
    try {
        const { unit_id, cycle_id, include_key_results } = req.validated.query;

        const result = await objectiveService.getAvailableParentObjectives(
            req.user,
            unit_id,
            cycle_id,
            include_key_results
        );

        res.success("Available parent objectives retrieved successfully", 200, result.data, {
            unit_id: result.unit_id,
            unit_ids_searched: result.unit_ids_searched,
            total: result.total,
        });
    } catch (error) {
        throw error;
    }
};

// GET /objectives/:id
export const getObjectiveById = async (req, res) => {
    try {
        const objectiveId = parsePositiveInt(req.params.id, null);
        if (!objectiveId) throw new AppError("Invalid objective ID", 400);

        const objective = await objectiveService.getObjectiveById(req.user, objectiveId);

        res.success("Objective retrieved successfully", 200, { objective });
    } catch (error) {
        throw error;
    }
};
