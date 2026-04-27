import AppError from "../../utils/appError.js";
import * as evaluationService from "./evaluations.service.js";

const parsePositiveInt = (value, fallback) => {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
    return parsed;
};

// POST /evaluations/generate
export const generateEvaluations = async (req, res) => {
    const companyId = req.user.company_id;
    if (!companyId) throw new AppError("Company context is required", 403);

    const { cycle_id } = req.validated.body;
    const result = await evaluationService.generateEvaluationsForCycle(cycle_id, companyId);

    res.success("Evaluation generated", 200, result);
};

// GET /evaluations
export const getEvaluations = async (req, res) => {
    const companyId = req.user.company_id;
    if (!companyId) throw new AppError("Company context is required", 403);

    const { cycle_id, unit_id, rating, page, per_page } = req.validated.query;
    const result = await evaluationService.listEvaluations(companyId, {
        cycle_id,
        unit_id,
        rating,
        page,
        per_page,
    });

    res.success("Evaluations retrieved successfully", 200, result.data, result.meta);
};

// GET /evaluations/me
export const getMyEvaluations = async (req, res) => {
    const companyId = req.user.company_id;
    if (!companyId) throw new AppError("Company context is required", 403);

    const { page, per_page } = req.validated.query;
    const result = await evaluationService.listMyEvaluations(req.user, { page, per_page });

    res.success("My evaluations retrieved successfully", 200, result.data, result.meta);
};

// GET /evaluations/:id
export const getEvaluationDetail = async (req, res) => {
    const evaluationId = parsePositiveInt(req.params.id, null);
    if (!evaluationId) throw new AppError("Invalid evaluation ID", 400);

    const evaluation = await evaluationService.getEvaluationById(req.user, evaluationId);

    res.success("Evaluation retrieved successfully", 200, evaluation);
};
