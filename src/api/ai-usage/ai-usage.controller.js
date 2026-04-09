import * as aiUsageService from "./ai-usage.service.js";
import AppError from "../../utils/appError.js";

// Get company AI plan info
export const getCompanyAIPlan = async (req, res) => {
    const companyId = req.user.company_id;

    const result = await aiUsageService.getCompanyAIPlan(companyId);

    if (!result) {
        throw new AppError("Company not found", 404);
    }

    res.success("Company AI plan retrieved successfully", 200, result);
};

// Get AI usage logs with filters
export const getAIUsageLogs = async (req, res) => {
    const companyId = req.user.company_id;
    const {
        user_id,
        feature_name,
        model_name,
        status,
        start_date,
        end_date,
        min_credit_cost,
        max_credit_cost,
        page = 1,
        per_page = 20,
    } = req.query;

    const filters = {
        ...(user_id !== undefined && { user_id: parseInt(user_id) }),
        ...(feature_name !== undefined && { feature_name }),
        ...(model_name !== undefined && { model_name }),
        ...(status !== undefined && { status }),
        ...(start_date !== undefined && { start_date }),
        ...(end_date !== undefined && { end_date }),
        ...(min_credit_cost !== undefined && { min_credit_cost: parseFloat(min_credit_cost) }),
        ...(max_credit_cost !== undefined && { max_credit_cost: parseFloat(max_credit_cost) }),
    };

    const pagination = {
        page: parseInt(page) || 1,
        per_page: Math.min(parseInt(per_page) || 20, 100),
    };

    const { data, meta } = await aiUsageService.getAIUsageLogs(companyId, filters, pagination);

    res.success("AI usage logs retrieved successfully", 200, data, meta);
};
