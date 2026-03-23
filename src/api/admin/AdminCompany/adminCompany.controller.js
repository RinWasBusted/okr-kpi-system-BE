import * as adminCompanyService from "./adminCompany.service.js";
import AppError from "../../../utils/appError.js";

const parseBoolean = (value) => {
  if (value === undefined || value === null) return undefined;
  const lower = String(value).toLowerCase();
  if (["true", "1", "yes"].includes(lower)) return true;
  if (["false", "0", "no"].includes(lower)) return false;
  return undefined;
};

const parsePositiveInt = (value, fallback) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return parsed;
};

export const getCompanyAdmins = async (req, res) => {
  try {
    const companyId = Number(req.params.company_id);
    if (!Number.isInteger(companyId) || companyId <= 0) {
      throw new AppError("Invalid company ID", 400);
    }

    const company = await adminCompanyService.findCompanyById(companyId);
    if (!company) {
      throw new AppError("Company not found", 404);
    }

    const isActiveFilter = parseBoolean(req.query.is_active);
    const page = parsePositiveInt(req.query.page, 1);
    const per_page = parsePositiveInt(req.query.per_page, 20);

    const { total, data } = await adminCompanyService.listCompanyAdmins(companyId, {
      is_active: isActiveFilter,
      page,
      per_page,
    });

    res.success("Company admins retrieved successfully", 200, data, {
      page,
      per_page,
      total,
    });
  } catch (error) {
    throw error;
  }
};

export const createCompanyAdmin = async (req, res) => {
  try {
    const companyId = Number(req.params.company_id);
    if (!Number.isInteger(companyId) || companyId <= 0) {
      throw new AppError("Invalid company ID", 400);
    }

    const { full_name, email, password } = req.body;

    if (!full_name || !email || !password) {
      throw new AppError("full_name, email and password are required", 400);
    }

    if (typeof password !== "string" || password.length < 8) {
      throw new AppError("Password must be at least 8 characters", 400);
    }

    const company = await adminCompanyService.findCompanyById(companyId);
    if (!company) {
      throw new AppError("Company not found", 404);
    }

    if (!company.is_active) {
      throw new AppError("Company is inactive", 403);
    }

    const existing = await adminCompanyService.findCompanyAdminByEmail(companyId, email);
    if (existing) {
      throw new AppError("Email already exists", 409);
    }

    const admin = await adminCompanyService.createCompanyAdmin(companyId, {
      full_name,
      email,
      password,
    });

    res.success("Company admin created successfully", 201, { admin });
  } catch (error) {
    throw error;
  }
};

export const updateCompanyAdmin = async (req, res) => {
  try {
    const companyId = Number(req.params.company_id);
    const adminId = Number(req.params.admin_id);

    if (!Number.isInteger(companyId) || companyId <= 0 || !Number.isInteger(adminId) || adminId <= 0) {
      throw new AppError("Invalid parameters", 400);
    }

    const company = await adminCompanyService.findCompanyById(companyId);
    if (!company) {
      throw new AppError("Company not found", 404);
    }

    const admin = await adminCompanyService.findCompanyAdminById(companyId, adminId);
    if (!admin) {
      throw new AppError("Admin not found", 404);
    }

    const updates = {};
    const { full_name, email, password, is_active } = req.body;

    if (full_name !== undefined) updates.full_name = full_name;
    if (email !== undefined) updates.email = email;
    if (password !== undefined) {
      if (typeof password !== "string" || password.length < 8) {
        throw new AppError("Password must be at least 8 characters", 400);
      }
      updates.password = password;
    }
    if (is_active !== undefined) {
      const parsed = parseBoolean(is_active);
      if (parsed === undefined) {
        throw new AppError("is_active must be boolean", 400);
      }
      updates.is_active = parsed;
    }

    if (Object.keys(updates).length === 0) {
      throw new AppError("No fields provided to update", 400);
    }

    if (email && email !== admin.email) {
      const emailExists = await adminCompanyService.findCompanyAdminByEmail(companyId, email);
      if (emailExists) {
        throw new AppError("Email already exists", 409);
      }
    }

    const updated = await adminCompanyService.updateCompanyAdmin(adminId, updates);

    res.success("Company admin updated successfully", 200, { admin: updated });
  } catch (error) {
    throw error;
  }
};

export const deactivateCompanyAdmin = async (req, res) => {
  try {
    const companyId = Number(req.params.company_id);
    const adminId = Number(req.params.admin_id);

    if (!Number.isInteger(companyId) || companyId <= 0 || !Number.isInteger(adminId) || adminId <= 0) {
      throw new AppError("Invalid parameters", 400);
    }

    const admin = await adminCompanyService.findCompanyAdminById(companyId, adminId);
    if (!admin) {
      throw new AppError("Admin not found", 404);
    }

    const activeAdmins = await adminCompanyService.countActiveCompanyAdmins(companyId);
    if (activeAdmins <= 1) {
      throw new AppError("Cannot deactivate the last admin", 400);
    }

    const deactivated = await adminCompanyService.deactivateCompanyAdmin(adminId);

    res.success("Company admin deactivated successfully", 200, { admin: deactivated });
  } catch (error) {
    throw error;
  }
};
