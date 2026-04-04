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

const parseMode = (value) => {
    if (value === undefined || value === null || value === "") return "tree";
    const lower = String(value).toLowerCase();
    if (["tree", "list"].includes(lower)) return lower;
    return "tree";
};

// GET /objectives
export const getObjectives = async (req, res) => {
    try {
        const filters = {
            cycle_id: parseOptionalId(req.query.cycle_id),
            unit_id: parseOptionalId(req.query.unit_id),
            owner_id: parseOptionalId(req.query.owner_id),
            status: parseStatus(req.query.status),
            progress_status: parseProgressStatus(req.query.progress_status),
            parent_objective_id: parseOptionalId(req.query.parent_objective_id),
            visibility: parseVisibility(req.query.visibility),
        };

        const include_key_results = parseBoolean(req.query.include_key_results) ?? false;
        const page = parsePositiveInt(req.query.page, 1);
        const per_page = Math.min(parsePositiveInt(req.query.per_page, 20), 100);
        const mode = parseMode(req.query.mode);

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
        const { title, cycle_id, unit_id, owner_id, parent_objective_id, visibility } = req.body;

        if (!title || typeof title !== "string" || title.trim() === "") {
            throw new AppError("title is required", 422);
        }

        const parsedCycleId = parseOptionalId(cycle_id);
        if (!parsedCycleId) throw new AppError("cycle_id is required", 422);

        const objective = await objectiveService.createObjective(req.user, {
            title: title.trim(),
            cycle_id: parsedCycleId,
            unit_id: parseOptionalId(unit_id),
            owner_id: parseOptionalId(owner_id),
            parent_objective_id: parseOptionalId(parent_objective_id),
            visibility: parseVisibility(visibility),
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

        const { title, parent_objective_id, visibility } = req.body;
        const updates = {};

        if (title !== undefined) {
            if (typeof title !== "string" || title.trim() === "") {
                throw new AppError("title must be a non-empty string", 422);
            }
            updates.title = title.trim();
        }

        if (parent_objective_id !== undefined) {
            updates.parent_objective_id = parseOptionalId(parent_objective_id) ?? null;
        }

        if (visibility !== undefined) {
            updates.visibility = parseVisibility(visibility);
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

        const { title, parent_objective_id, visibility } = req.body;
        const updates = {};

        if (title !== undefined) {
            if (typeof title !== "string" || title.trim() === "") {
                throw new AppError("title must be a non-empty string", 422);
            }
            updates.title = title.trim();
        }

        if (parent_objective_id !== undefined) {
            updates.parent_objective_id = parseOptionalId(parent_objective_id) ?? null;
        }

        if (visibility !== undefined) {
            updates.visibility = parseVisibility(visibility);
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
