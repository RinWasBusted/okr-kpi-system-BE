import * as aiUsageService from "./aiUsage.service.js";
import AppError from "../../../utils/appError.js";

// Update company AI plan and usage limit
export const updateCompanyAIPlan = async (req, res) => {
    const { id } = req.params;
    const { ai_plan, usage_limit } = req.body;

    const companyId = parseInt(id);
    if (!Number.isInteger(companyId) || companyId <= 0) {
        throw new AppError("Invalid company ID", 400);
    }

    const updated = await aiUsageService.updateCompanyAIPlan(companyId, {
        ai_plan,
        usage_limit,
    });

    res.success("Company AI plan updated successfully", 200, updated);
};

// Reset company credit cost
export const resetCompanyCreditCost = async (req, res) => {
    const { id } = req.params;

    const companyId = parseInt(id);
    if (!Number.isInteger(companyId) || companyId <= 0) {
        throw new AppError("Invalid company ID", 400);
    }

    const updated = await aiUsageService.resetCompanyCreditCost(companyId);

    res.success("Company credit cost reset successfully", 200, updated);
};

// Get AI usage logs with filters
export const getAIUsageLogs = async (req, res) => {
    const {
        company_id,
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
        ...(company_id !== undefined && { company_id: parseInt(company_id) }),
        ...(user_id !== undefined && { user_id: parseInt(user_id) }),
        ...(feature_name !== undefined && { feature_name }),
        ...(model_name !== undefined && { model_name }),
        ...(status !== undefined && { status }),
        ...(start_date !== undefined && { start_date: new Date(start_date) }),
        ...(end_date !== undefined && { end_date: new Date(end_date) }),
        ...(min_credit_cost !== undefined && { min_credit_cost: parseFloat(min_credit_cost) }),
        ...(max_credit_cost !== undefined && { max_credit_cost: parseFloat(max_credit_cost) }),
    };

    const pagination = {
        page: parseInt(page) || 1,
        per_page: Math.min(parseInt(per_page) || 20, 100),
    };

    const { data, meta } = await aiUsageService.getAIUsageLogs(filters, pagination);

    res.success("AI usage logs retrieved successfully", 200, data, meta);
};

// Calculate total cost with filters
export const calculateTotalCost = async (req, res) => {
    const {
        company_id,
        user_id,
        feature_name,
        model_name,
        status,
        start_date,
        end_date,
    } = req.query;

    const filters = {
        ...(company_id !== undefined && { company_id: parseInt(company_id) }),
        ...(user_id !== undefined && { user_id: parseInt(user_id) }),
        ...(feature_name !== undefined && { feature_name }),
        ...(model_name !== undefined && { model_name }),
        ...(status !== undefined && { status }),
        ...(start_date !== undefined && { start_date: new Date(start_date) }),
        ...(end_date !== undefined && { end_date: new Date(end_date) }),
    };

    const result = await aiUsageService.calculateTotalCost(filters);

    res.success("Total cost calculated successfully", 200, result);
};

// Get company AI usage summary
export const getCompanyAIUsageSummary = async (req, res) => {
    const { id } = req.params;

    const companyId = parseInt(id);
    if (!Number.isInteger(companyId) || companyId <= 0) {
        throw new AppError("Invalid company ID", 400);
    }

    const summary = await aiUsageService.getCompanyAIUsageSummary(companyId);

    res.success("Company AI usage summary retrieved successfully", 200, summary);
};
