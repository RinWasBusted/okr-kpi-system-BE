import * as checkInService from "./check-in.service.js";
import AppError from "../../../utils/appError.js";

const parsePositiveInt = (value, fallback) => {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
    return parsed;
};

const roundProgress = (value) => Math.round(value * 100) / 100;

// POST /key-results/:kr_id/check-ins
export const createCheckIn = async (req, res) => {
    try {
        const keyResultId = parsePositiveInt(req.params.kr_id, null);
        if (!keyResultId) throw new AppError("Invalid key result ID", 400);

        const { achieved_value, evidence_url, comment } = req.validated.body;

        const result = await checkInService.createCheckIn(req.user, keyResultId, {
            achieved_value,
            evidence_url: evidence_url.trim(),
            comment: comment?.trim(),
        });

        res.success("Check-in created successfully", 200, {
            id: result.check_in.id,
            achieved_value: result.check_in.achieved_value,
            progress_snapshot: roundProgress(result.check_in.progress_snapshot),
            obj_progress_snapshot: roundProgress(result.check_in.obj_progress_snapshot),
            kr_progress: roundProgress(result.kr_progress),
            objective_progress: roundProgress(result.objective_progress),
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
        const keyResultId = parsePositiveInt(req.params.kr_id, null);
        if (!keyResultId) throw new AppError("Invalid key result ID", 400);

        const data = await checkInService.listCheckIns(req.user, keyResultId);

        res.success(
            "Check-ins retrieved successfully",
            200,
            data.map((checkIn) => ({
                ...checkIn,
                progress_snapshot: roundProgress(checkIn.progress_snapshot),
                obj_progress_snapshot: roundProgress(checkIn.obj_progress_snapshot),
            })),
        );
    } catch (error) {
        throw error;
    }
};
