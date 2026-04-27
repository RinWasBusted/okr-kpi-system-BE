import * as statisticService from "./statistic.service.js";
import * as evaluationService from "../evaluations/evaluations.service.js";
import AppError from "../../utils/appError.js";

const parsePositiveInt = (value, fallback) => {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
    return parsed;
};

// GET /api/statistics/kpi-timeline
export const getKPITimeline = async (req, res) => {
    try {
        const { cycle_id, group_by } = req.query;

        const cycleId = parsePositiveInt(cycle_id, null);
        if (!cycleId) throw new AppError("cycle_id is required", 422);

        // Validate group_by parameter
        const validGroupBy = ["month", "year"];
        const groupBy = validGroupBy.includes(group_by) ? group_by : "month";

        const data = await statisticService.getKPITimelineData(req.user, cycleId, groupBy);

        res.success("KPI timeline data retrieved successfully", 200, data);
    } catch (error) {
        throw error;
    }
};

// GET /api/statistics/okr-timeline
export const getOKRTimeline = async (req, res) => {
    try {
        const { cycle_id, group_by } = req.query;

        const cycleId = parsePositiveInt(cycle_id, null);
        if (!cycleId) throw new AppError("cycle_id is required", 422);

        // Validate group_by parameter
        const validGroupBy = ["month", "year"];
        const groupBy = validGroupBy.includes(group_by) ? group_by : "month";

        const data = await statisticService.getOKRTimelineData(req.user, cycleId, groupBy);

        res.success("OKR timeline data retrieved successfully", 200, data);
    } catch (error) {
        throw error;
    }
};

// GET /api/statistics
export const getStatisticsSummary = async (req, res) => {
    const companyId = req.user.company_id;
    if (!companyId) throw new AppError("Company context is required", 403);

    const summary = await statisticService.getStatisticsSummary(req.user);
    const evaluationSummary = await evaluationService.getEvaluationStatisticsSummary(companyId);

    res.success("Statistics summary retrieved successfully", 200, {
        ...summary,
        ...evaluationSummary,
    });
};
