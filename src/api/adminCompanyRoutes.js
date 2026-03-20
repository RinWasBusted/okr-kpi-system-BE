import express from 'express';
import prisma from '../utils/prisma';

const router = express.Router();

const COMPANY_ADMIN_ROLE = 'COMPANY_ADMIN';

const parseBoolean = (value) => {
  if (value === undefined || value === null) return undefined;
  const lower = String(value).toLowerCase();
  if (['true', '1', 'yes'].includes(lower)) return true;
  if (['false', '0', 'no'].includes(lower)) return false;
  return undefined;
};

const parsePositiveInt = (value, fallback) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return parsed;
};

// GET /admin/companies/:company_id/admins
router.get('/companies/:company_id/admins', async (req, res, next) => {
  try {
    const companyId = Number(req.params.company_id);
    if (!Number.isInteger(companyId) || companyId <= 0) {
      return res.status(400).json({ error: 'INVALID_COMPANY_ID' });
    }

    const company = await prisma.companies.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      return res.status(404).json({ error: 'COMPANY_NOT_FOUND' });
    }

    const isActiveFilter = parseBoolean(req.query.is_active);
    const page = parsePositiveInt(req.query.page, 1);
    const per_page = parsePositiveInt(req.query.per_page, 20);

    const where = {
      company_id: companyId,
      role: COMPANY_ADMIN_ROLE,
      ...(isActiveFilter !== undefined ? { is_active: isActiveFilter } : {}),
    };

    const [total, data] = await Promise.all([
      prisma.users.count({ where }),
      prisma.users.findMany({
        where,
        skip: (page - 1) * per_page,
        take: per_page,
        orderBy: { id: 'asc' },
        select: {
          id: true,
          full_name: true,
          email: true,
          is_active: true,
          created_at: true,
          last_login_at: true,
        },
      }),
    ]);

    return res.json({
      data,
      meta: {
        page,
        per_page,
        total,
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /admin/companies/:company_id/admins
router.post('/companies/:company_id/admins', async (req, res, next) => {
  try {
    const companyId = Number(req.params.company_id);
    if (!Number.isInteger(companyId) || companyId <= 0) {
      return res.status(400).json({ error: 'INVALID_COMPANY_ID' });
    }

    const { full_name, email, password } = req.body;

    if (!full_name || !email || !password) {
      return res.status(400).json({ error: 'INVALID_PAYLOAD', message: 'full_name, email and password are required' });
    }

    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ error: 'INVALID_PASSWORD', message: 'Password must be at least 8 characters' });
    }

    const company = await prisma.companies.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      return res.status(404).json({ error: 'COMPANY_NOT_FOUND' });
    }

    if (!company.is_active) {
      return res.status(403).json({ error: 'COMPANY_INACTIVE' });
    }

    const existing = await prisma.users.findFirst({
      where: { company_id: companyId, role: COMPANY_ADMIN_ROLE, email },
    });
    if (existing) {
      return res.status(409).json({ error: 'EMAIL_EXISTS' });
    }

    const admin = await prisma.users.create({
      data: {
        company_id: companyId,
        full_name,
        email,
        password,
        role: COMPANY_ADMIN_ROLE,
        is_active: true,
      },
      select: {
        id: true,
        full_name: true,
        email: true,
        is_active: true,
        created_at: true,
        last_login_at: true,
      },
    });

    return res.status(201).json({ data: admin });
  } catch (error) {
    next(error);
  }
});

// PUT /admin/companies/:company_id/admins/:admin_id
router.put('/companies/:company_id/admins/:admin_id', async (req, res, next) => {
  try {
    const companyId = Number(req.params.company_id);
    const adminId = Number(req.params.admin_id);

    if (!Number.isInteger(companyId) || companyId <= 0 || !Number.isInteger(adminId) || adminId <= 0) {
      return res.status(400).json({ error: 'INVALID_PARAMS' });
    }

    const company = await prisma.companies.findUnique({ where: { id: companyId } });
    if (!company) {
      return res.status(404).json({ error: 'COMPANY_NOT_FOUND' });
    }

    const admin = await prisma.users.findFirst({
      where: { id: adminId, company_id: companyId, role: COMPANY_ADMIN_ROLE },
    });
    if (!admin) {
      return res.status(404).json({ error: 'ADMIN_NOT_FOUND' });
    }

    const updates = {};
    const { full_name, email, password, is_active } = req.body;

    if (full_name !== undefined) updates.full_name = full_name;
    if (email !== undefined) updates.email = email;
    if (password !== undefined) {
      if (typeof password !== 'string' || password.length < 8) {
        return res.status(400).json({ error: 'INVALID_PASSWORD', message: 'Password must be at least 8 characters' });
      }
      updates.password = password;
    }
    if (is_active !== undefined) {
      const parsed = parseBoolean(is_active);
      if (parsed === undefined) {
        return res.status(400).json({ error: 'INVALID_PAYLOAD', message: 'is_active must be boolean' });
      }
      updates.is_active = parsed;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'NO_UPDATES', message: 'No fields provided to update' });
    }

    if (email && email !== admin.email) {
      const emailExists = await prisma.users.findFirst({
        where: { company_id: companyId, role: COMPANY_ADMIN_ROLE, email },
      });
      if (emailExists) {
        return res.status(409).json({ error: 'EMAIL_EXISTS' });
      }
    }

    const updated = await prisma.users.update({
      where: { id: adminId },
      data: updates,
      select: {
        id: true,
        full_name: true,
        email: true,
        is_active: true,
        created_at: true,
        last_login_at: true,
      },
    });

    return res.json({ data: updated });
  } catch (error) {
    next(error);
  }
});

// DELETE /admin/companies/:company_id/admins/:admin_id
router.delete('/companies/:company_id/admins/:admin_id', async (req, res, next) => {
  try {
    const companyId = Number(req.params.company_id);
    const adminId = Number(req.params.admin_id);

    if (!Number.isInteger(companyId) || companyId <= 0 || !Number.isInteger(adminId) || adminId <= 0) {
      return res.status(400).json({ error: 'INVALID_PARAMS' });
    }

    const admin = await prisma.users.findFirst({
      where: { id: adminId, company_id: companyId, role: COMPANY_ADMIN_ROLE },
    });

    if (!admin) {
      return res.status(404).json({ error: 'ADMIN_NOT_FOUND' });
    }

    const activeAdmins = await prisma.users.count({
      where: { company_id: companyId, role: COMPANY_ADMIN_ROLE, is_active: true },
    });

    if (activeAdmins <= 1) {
      return res.status(400).json({ error: 'LAST_ADMIN' });
    }

    const deactivated = await prisma.users.update({
      where: { id: adminId },
      data: { is_active: false },
      select: {
        id: true,
        full_name: true,
        email: true,
        is_active: true,
        created_at: true,
        last_login_at: true,
      },
    });

    return res.json({ data: deactivated });
  } catch (error) {
    next(error);
  }
});

export default router;
