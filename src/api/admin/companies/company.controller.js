import * as companyService from "./company.service.js";
import AppError from "../../../utils/appError.js";

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

        if (!name || !slug) {
            throw new AppError("name and slug are required", 422);
        }

        const company = await companyService.createCompany({ name, slug });

        res.success("Company created successfully", 201, { company });
    } catch (error) {
        throw error;
    }
};

export const updateCompany = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, slug, is_active } = req.body;

        const company = await companyService.updateCompany(parseInt(id), { name, slug, is_active });

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