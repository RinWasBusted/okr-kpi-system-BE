import * as companyService from "./company.service.js";
import AppError from "../../utils/appError.js";
import { uploadImageToCloudinary } from "../../utils/cloudinary.js";

/**
 * Get own company info
 */
export const getMyCompany = async (req, res) => {
    const company = await companyService.getMyCompany(req.user);
    res.success("Company retrieved successfully", 200, company);
};

/**
 * Get company stats
 */
export const getCompanyStats = async (req, res) => {
    const stats = await companyService.getCompanyStats(req.user);
    res.success("Company stats retrieved successfully", 200, stats);
};

/**
 * Upload company logo
 */
export const uploadLogo = async (req, res) => {
    if (!req.file) {
        throw new AppError("No file provided", 400);
    }

    try {
        const uploadResult = await uploadImageToCloudinary(
            req.file.buffer,
            req.file.originalname,
            "okr-kpi-system/companies/logos"
        );

        const company = await companyService.uploadLogo(req.user, uploadResult.public_id);
        res.success("Logo uploaded successfully", 200, company);
    } catch (error) {
        throw new AppError("Logo upload failed", 400, "LOGO_UPLOAD_FAILED");
    }
};

/**
 * Delete company logo
 */
export const deleteLogo = async (req, res) => {
    const company = await companyService.deleteLogo(req.user);
    res.success("Logo deleted successfully", 200, company);
};

/**
 * Get company AI usage logs
 */
export const getCompanyAIUsageLogs = async (req, res) => {
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
        ...(user_id !== undefined && { user_id }),
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

    const { data, meta } = await companyService.getCompanyAIUsageLogs(req.user, filters, pagination);
    res.success("AI usage logs retrieved successfully", 200, data, meta);
};
