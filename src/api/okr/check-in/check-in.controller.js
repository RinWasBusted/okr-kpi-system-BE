import * as checkInService from "./check-in.service.js";
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

// POST /key-results/:kr_id/check-ins
export const createCheckIn = async (req, res) => {
    try {
        const companyId = req.user.company_id;
        if (!companyId) throw new AppError("Company context is required", 403);

        const keyResultId = parsePositiveInt(req.params.kr_id, null);
        if (!keyResultId) throw new AppError("Invalid key result ID", 400);

        const { achieved_value, evidence_url, comment } = req.body;

        const achievedValue = parseNumber(achieved_value);
        if (achievedValue === undefined) throw new AppError("achieved_value is required", 422);

        if (!evidence_url || typeof evidence_url !== "string" || evidence_url.trim() === "") {
            throw new AppError("evidence_url is required", 422, "EVIDENCE_REQUIRED");
        }

        if (comment !== undefined && comment !== null && typeof comment !== "string") {
            throw new AppError("comment must be a string", 422);
        }

        const result = await checkInService.createCheckIn(req.user, keyResultId, {
            achieved_value: achievedValue,
            evidence_url: evidence_url.trim(),
            comment: comment?.trim(),
        });

        res.success("Check-in created successfully", 200, {
            id: result.check_in.id,
            achieved_value: result.check_in.achieved_value,
            progress_snapshot: result.check_in.progress_snapshot,
            kr_progress: result.kr_progress,
            objective_progress: result.objective_progress,
            evidence_url: result.check_in.evidence_url,
            comment: result.check_in.comment,
            created_at: result.check_in.created_at,
        });
    } catch (error) {
        throw error;
    }
};

// GET /key-results/:kr_id/check-ins
export const getCheckIns = async (req, res) => {
    try {
        const companyId = req.user.company_id;
        if (!companyId) throw new AppError("Company context is required", 403);

        const keyResultId = parsePositiveInt(req.params.kr_id, null);
        if (!keyResultId) throw new AppError("Invalid key result ID", 400);

        const data = await checkInService.listCheckIns(req.user, keyResultId);

        res.success("Check-ins retrieved successfully", 200, data);
    } catch (error) {
        throw error;
    }
};
