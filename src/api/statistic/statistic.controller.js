import * as statisticService from "./statistic.service.js";
import * as evaluationService from "../evaluations/evaluations.service.js";
import AppError from "../../utils/appError.js";

const parsePositiveInt = (value, fallback) => {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
    return parsed;
};

/**
 * Checks whether an error is a Prisma/DB-level error that indicates
 * missing data rather than a real application bug.
 * Examples: missing table, invalid enum value, raw-query failure.
 */
const isDataNotReadyError = (error) => {
    if (!error) return false;
    const code = error.code || "";
    const msg = (error.message || "").toLowerCase();
    // P2010 = raw query failed (e.g. relation does not exist)
    // P2023 = inconsistent column data
    if (["P2010", "P2023"].includes(code)) return true;
    // Prisma validation: "Invalid value for argument `in`. Expected ProgressStatus."
    if (msg.includes("invalid value for argument") || msg.includes("expected progressstatus")) return true;
    // Missing table
    if (msg.includes("does not exist") && msg.includes("relation")) return true;
    return false;
};

// GET /api/statistics/kpi-timeline
export const getKPITimeline = async (req, res) => {
    try {
        const { cycle_id, group_by, unit_id, user_id } = req.query;

        const cycleId = parsePositiveInt(cycle_id, null);
        if (!cycleId) throw new AppError("cycle_id is required", 422);

        // Validate group_by parameter
        const validGroupBy = ["month", "year"];
        const groupBy = validGroupBy.includes(group_by) ? group_by : "month";

        const unitId = parsePositiveInt(unit_id, null);
        const userId = parsePositiveInt(user_id, null);

        const data = await statisticService.getKPITimelineData(req.user, cycleId, groupBy, { unitId, userId });

        res.success("KPI timeline data retrieved successfully", 200, data);
    } catch (error) {
        if (isDataNotReadyError(error)) {
            return res.success("KPI timeline data retrieved successfully", 200, {
                cycle: null,
                group_by: req.query.group_by || "month",
                periods: [],
                kpis: [],
                _notice: "Chưa có dữ liệu KPI timeline cho chu kỳ này.",
            });
        }
        throw error;
    }
};

// GET /api/statistics/okr-timeline
export const getOKRTimeline = async (req, res) => {
    try {
        const { cycle_id, group_by, unit_id, user_id } = req.query;

        const cycleId = parsePositiveInt(cycle_id, null);
        if (!cycleId) throw new AppError("cycle_id is required", 422);

        // Validate group_by parameter
        const validGroupBy = ["month", "year"];
        const groupBy = validGroupBy.includes(group_by) ? group_by : "month";

        const unitId = parsePositiveInt(unit_id, null);
        const userId = parsePositiveInt(user_id, null);

        const data = await statisticService.getOKRTimelineData(req.user, cycleId, groupBy, { unitId, userId });

        res.success("OKR timeline data retrieved successfully", 200, data);
    } catch (error) {
        if (isDataNotReadyError(error)) {
            return res.success("OKR timeline data retrieved successfully", 200, {
                cycle: null,
                group_by: req.query.group_by || "month",
                periods: [],
                objectives: [],
                _notice: "Chưa có dữ liệu OKR timeline cho chu kỳ này.",
            });
        }
        throw error;
    }
};

// GET /api/statistics
export const getStatisticsSummary = async (req, res) => {
    const companyId = req.user.company_id;
    if (!companyId) throw new AppError("Company context is required", 403);

    const summary = await statisticService.getStatisticsSummary(req.user);

    let evaluationSummary = {};
    try {
        evaluationSummary = await evaluationService.getEvaluationStatisticsSummary(companyId);
    } catch (err) {
        if (isDataNotReadyError(err)) {
            evaluationSummary = {
                evaluation_summary: {
                    last_cycle: null,
                    rating_distribution: {},
                    avg_composite_score: 0,
                    top_performers: [],
                    _notice: "Chưa có dữ liệu đánh giá.",
                },
            };
        } else {
            throw err;
        }
    }

    res.success("Statistics summary retrieved successfully", 200, {
        ...summary,
        ...evaluationSummary,
    });
};
