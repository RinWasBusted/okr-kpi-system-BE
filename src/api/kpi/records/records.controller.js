import * as recordsService from "./records.service.js";
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

const parseDateInput = (value) => {
    if (value === undefined || value === null || value === "") return undefined;
    if (typeof value !== "string") return undefined;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
    const date = new Date(`${value}T00:00:00Z`);
    if (Number.isNaN(date.getTime())) return undefined;
    return date;
};

// POST /kpi-assignments/:assignment_id/records
export const createKPIRecord = async (req, res) => {
    try {
        const assignmentId = parsePositiveInt(req.params.assignment_id, null);
        if (!assignmentId) throw new AppError("Invalid assignment ID", 400);

        const { period_start, period_end, actual_value } = req.body;

        const periodStart = parseDateInput(period_start);
        if (!periodStart) throw new AppError("period_start is required in YYYY-MM-DD format", 422);

        const periodEnd = parseDateInput(period_end);
        if (!periodEnd) throw new AppError("period_end is required in YYYY-MM-DD format", 422);

        const actualValue = parseNumber(actual_value);
        if (actualValue === undefined) throw new AppError("actual_value is required", 422);

        const record = await recordsService.createKPIRecord(req.user, assignmentId, {
            period_start: periodStart,
            period_end: periodEnd,
            actual_value: actualValue,
        });

        res.success("KPI Record created successfully", 200, {
            progress_percentage: Math.round(record.progress_percentage * 100) / 100,
            time_elapsed_percentage: record.time_elapsed_percentage,
            ratio: record.ratio,
            status: record.status,
            trend: record.trend,
        });
    } catch (error) {
        throw error;
    }
};

// GET /kpi-assignments/:assignment_id/records
export const getKPIRecords = async (req, res) => {
    try {
        const assignmentId = parsePositiveInt(req.params.assignment_id, null);
        if (!assignmentId) throw new AppError("Invalid assignment ID", 400);

        const data = await recordsService.listKPIRecords(req.user, assignmentId);

        res.success("KPI Records retrieved successfully", 200, data);
    } catch (error) {
        throw error;
    }
};
