import * as companyService from "./company.service.js";
import AppError from "../../../utils/appError.js";
import { uploadImageToCloudinary } from "../../../utils/cloudinary.js";

export const getCompanies = async (req, res) => {
    try {
        const { is_active, search, page = 1, per_page = 20 } = req.query;

        const filters = {
            is_active: is_active !== undefined ? is_active === "true" : undefined,
            search: search || undefined,
        };

        const pagination = {
            page: parseInt(page),
            per_page: Math.min(parseInt(per_page), 100),
        };

        const { data, meta } = await companyService.getCompanies(filters, pagination);

        res.success("Companies retrieved successfully", 200, data, meta);
    } catch (error) {
        throw error;
    }
};

export const createCompany = async (req, res) => {
    try {
        const { name, slug } = req.body;

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

        const company = await companyService.createCompany({ name, slug, logo: logoPublicId });

        res.success("Company created successfully", 201, { company });
    } catch (error) {
        throw error;
    }
};

export const updateCompany = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, slug, is_active, ai_plan, token_usage, credit_cost, usage_limit } = req.body;

        const company = await companyService.updateCompany(parseInt(id), {
            name,
            slug,
            is_active,
            ai_plan,
            token_usage,
            credit_cost,
            usage_limit,
        });

        res.success("Company updated successfully", 200, { company });
    } catch (error) {
        throw error;
    }
};

export const deactivateCompany = async (req, res) => {
    try {
        const { id } = req.params;

        await companyService.deactivateCompany(parseInt(id));

        res.status(204).send();
    } catch (error) {
        throw error;
    }
};

export const getCompanyStats = async (req, res) => {
    try {
        const { id } = req.params;

        const companyStats = await companyService.getCompanyStats(parseInt(id));

        res.success("Company stats retrieved successfully", 200, companyStats);
    } catch (error) {
        throw error;
    }
};

// PATCH /admin/companies/:id/logo - Upload or update logo
export const uploadLogo = async (req, res) => {
    try {
        const companyId = parseInt(req.params.id);
        if (!Number.isInteger(companyId) || companyId <= 0) {
            throw new AppError("Invalid company ID", 400);
        }

        // Check if company exists
        await companyService.ensureCompanyExists(companyId);

        // If no file provided, delete logo
        if (!req.file) {
            const company = await companyService.deleteCompanyLogo(companyId);
            return res.success("Logo deleted successfully", 200, company);
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
        const companyId = parseInt(req.params.id);
        if (!Number.isInteger(companyId) || companyId <= 0) {
            throw new AppError("Invalid company ID", 400);
        }

        const company = await companyService.deleteCompanyLogo(companyId);

        res.success("Logo deleted successfully", 200, company);
    } catch (error) {
        throw error;
    }
};

// GET /admin/companies/me - Get current ADMIN_COMPANY's company details
export const getMyCompany = async (req, res) => {
    try {
        // Get company_id from authenticated user's token (req.user is set by authenticate middleware)
        const companyId = req.user?.company_id;

        if (!companyId) {
            throw new AppError("Company ID not found in token", 400);
        }

        const company = await companyService.getMyCompanyDetails(companyId);

        res.success("Company retrieved successfully", 200, company);
    } catch (error) {
        throw error;
    }
};
