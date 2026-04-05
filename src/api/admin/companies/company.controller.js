import * as companyService from "./company.service.js";
import AppError from "../../../utils/appError.js";
import { uploadImageToCloudinary } from "../../../utils/cloudinary.js";

// Validate company ID from params - must be positive integer
const validateCompanyId = (id) => {
    const companyId = parseInt(id, 10);
    if (!Number.isInteger(companyId) || companyId <= 0) {
        throw new AppError("Invalid company ID", 400);
    }
    return companyId;
};

// Validate pagination params
const validatePagination = (page, per_page) => {
    const parsedPage = parseInt(page, 10);
    const parsedPerPage = parseInt(per_page, 10);

    // Check for NaN and ensure page >= 1
    const validPage = !Number.isNaN(parsedPage) && parsedPage >= 1 ? parsedPage : 1;
    const validPerPage = !Number.isNaN(parsedPerPage) && parsedPerPage >= 1 ? Math.min(parsedPerPage, 100) : 20;

    return { page: validPage, per_page: validPerPage };
};

export const getCompanies = async (req, res) => {
    try {
        const { is_active, search, ai_plan, sort_by = "created_at", sort_order = "desc", from_date, to_date, page = 1, per_page = 20 } = req.query;

        const filters = {
            is_active: is_active !== undefined ? is_active === "true" : undefined,
            search: search || undefined,
            ai_plan: ai_plan || undefined,
            sort_by: sort_by || "created_at",
            sort_order: sort_order || "desc",
            from_date: from_date || undefined,
            to_date: to_date || undefined,
        };

        const pagination = validatePagination(page, per_page);

        const { data, meta } = await companyService.getCompanies(filters, pagination);

        res.success("Companies retrieved successfully", 200, data, meta);
    } catch (error) {
        throw error;
    }
};

export const createCompany = async (req, res) => {
    try {
        const { name, slug, ai_plan = "FREE" } = req.body;

        // Validate ai_plan is valid enum value
        const validPlans = ["FREE", "SUBSCRIPTION", "PAY_AS_YOU_GO"];
        if (!validPlans.includes(ai_plan)) {
            throw new AppError(`Invalid ai_plan. Must be one of: ${validPlans.join(", ")}`, 422);
        }

        let logoPublicId = null;
        // Upload logo if file is provided
        if (req.file) {
            const uploadResult = await uploadImageToCloudinary(
                req.file.buffer,
                req.file.originalname,
                "okr-kpi-system/companies/logos"
            );
            logoPublicId = uploadResult.public_id;
        }

        const company = await companyService.createCompany({ name, slug, logo: logoPublicId, ai_plan });

        res.success("Company created successfully", 201, { company });
    } catch (error) {
        throw error;
    }
};

export const updateCompany = async (req, res) => {
    try {
        const companyId = validateCompanyId(req.params.id);
        // Note: is_active is intentionally excluded - use separate deactivate/reactivate endpoints
        const { name, slug, ai_plan, usage_limit } = req.body;

        const company = await companyService.updateCompany(companyId, {
            name,
            slug,
            ai_plan,
            usage_limit,
        });

        res.success("Company updated successfully", 200, { company });
    } catch (error) {
        throw error;
    }
};

export const getCompanyById = async (req, res) => {
    try {
        const companyId = validateCompanyId(req.params.id);

        const company = await companyService.getCompanyById(companyId);

        res.success("Company retrieved successfully", 200, company);
    } catch (error) {
        throw error;
    }
};

export const deactivateCompany = async (req, res) => {
    try {
        const companyId = validateCompanyId(req.params.id);

        const result = await companyService.deactivateCompany(companyId);

        res.success("Company deactivated successfully", 200, { id: companyId, is_active: false, affected_users: result.affectedUsers });
    } catch (error) {
        throw error;
    }
};

export const getCompanyStats = async (req, res) => {
    try {
        const companyId = validateCompanyId(req.params.id);

        const companyStats = await companyService.getCompanyStats(companyId);

        res.success("Company stats retrieved successfully", 200, companyStats);
    } catch (error) {
        throw error;
    }
};

// PATCH /admin/companies/:id/logo - Upload or update logo
export const uploadLogo = async (req, res) => {
    try {
        const companyId = validateCompanyId(req.params.id);

        // Check if company exists
        await companyService.ensureCompanyExists(companyId);

        // Require file for PATCH /logo endpoint
        if (!req.file) {
            throw new AppError("Logo file is required", 400);
        }

        // Upload new logo to Cloudinary
        const uploadResult = await uploadImageToCloudinary(
            req.file.buffer,
            req.file.originalname,
            "okr-kpi-system/companies/logos"
        );

        const company = await companyService.updateCompanyLogo(companyId, uploadResult.public_id);

        res.success("Logo updated successfully", 200, company);
    } catch (error) {
        throw error;
    }
};

// DELETE /admin/companies/:id/logo - Delete logo
export const deleteLogo = async (req, res) => {
    try {
        const companyId = validateCompanyId(req.params.id);

        const company = await companyService.deleteCompanyLogo(companyId);

        res.success("Logo deleted successfully", 200, company);
    } catch (error) {
        throw error;
    }
};

export const getMyCompany = async (req, res) => {
    try {
        // Get company_id from authenticated user's token (req.user is set by authenticate middleware)
        const companyId = req.user?.company_id;

        if (!companyId) {
            throw new AppError("Company ID not found in token", 401);
        }

        const company = await companyService.getMyCompanyDetails(companyId);

        res.success("Company retrieved successfully", 200, company);
    } catch (error) {
        throw error;
    }
};
