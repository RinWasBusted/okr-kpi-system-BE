import * as assignmentsService from "./assignments.service.js";
import AppError from "../../../utils/appError.js";

const parsePositiveInt = (value, fallback) => {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
    return parsed;
};

const parseOptionalInt = (value) => {
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

const parseMode = (value) => {
    if (value === undefined || value === null || value === "") return "tree";
    const lower = String(value).toLowerCase();
    if (["tree", "list"].includes(lower)) return lower;
    return "tree";
};

// GET /kpi-assignments
export const getKPIAssignments = async (req, res) => {
    try {
        const filters = {
            cycle_id: parseOptionalInt(req.query.cycle_id),
            unit_id: parseOptionalInt(req.query.unit_id),
            owner_id: parseOptionalInt(req.query.owner_id),
            visibility: req.query.visibility,
            parent_assignment_id:
                req.query.parent_assignment_id === "null"
                    ? null
                    : parseOptionalInt(req.query.parent_assignment_id),
            progress_status: req.query.progress_status,
            kpi_status: req.query.kpi_status,
            status: req.query.status || "active",
            page: parsePositiveInt(req.query.page, 1),
            per_page: parsePositiveInt(req.query.per_page, 20),
        };

        const mode = parseMode(req.query.mode);
        const data = await assignmentsService.listKPIAssignments(req.user, filters, mode);
        res.success("KPI Assignments retrieved successfully", 200, data.data, data.meta);
    } catch (error) {
        throw error;
    }
};

// POST /kpi-assignments
export const createKPIAssignment = async (req, res) => {
    try {
        const { kpi_dictionary_id, cycle_id, target_value, current_value, owner_id, unit_id, parent_assignment_id, visibility } = req.validated.body;

        const assignment = await assignmentsService.createKPIAssignment(req.user, {
            kpi_dictionary_id,
            cycle_id,
            target_value,
            current_value,
            owner_id,
            unit_id,
            parent_assignment_id,
            visibility,
        });

        res.success("KPI Assignment created successfully", 201, { kpi_assignment: assignment });
    } catch (error) {
        throw error;
    }
};

// PUT /kpi-assignments/:id
export const updateKPIAssignment = async (req, res) => {
    try {
        const assignmentId = parsePositiveInt(req.params.id, null);
        if (!assignmentId) throw new AppError("Invalid assignment ID", 400);

        const { cycle_id, target_value, current_value, visibility } = req.validated.body;
        const updates = {};

        if (cycle_id !== undefined) {
            updates.cycle_id = cycle_id;
        }

        if (target_value !== undefined) {
            updates.target_value = target_value;
        }

        if (current_value !== undefined) {
            updates.current_value = current_value;
        }

        if (visibility !== undefined) {
            updates.visibility = visibility;
        }

        if (Object.keys(updates).length === 0) {
            throw new AppError("No fields provided to update", 400);
        }

        const assignment = await assignmentsService.updateKPIAssignment(
            req.user,
            assignmentId,
            updates,
        );

        res.success("KPI Assignment updated successfully", 200, { kpi_assignment: assignment });
    } catch (error) {
        throw error;
    }
};

// DELETE /kpi-assignments/:id
export const deleteKPIAssignment = async (req, res) => {
    try {
        const assignmentId = parsePositiveInt(req.params.id, null);
        if (!assignmentId) throw new AppError("Invalid assignment ID", 400);

        const cascade = req.query.cascade === "true";

        await assignmentsService.deleteKPIAssignment(req.user, assignmentId, cascade);

        res.status(204).send();
    } catch (error) {
        throw error;
    }
};
