import express from "express";
import {
    getCompanies,
    createCompany,
    updateCompany,
    getCompanyStats,
    uploadLogo,
    deleteLogo,
    getMyCompany,
    getCompanyById,
} from "./company.controller.js";
import adminCompanyRoutes from "../AdminCompany/adminCompany.route.js";
import { authenticate, authorize } from "../../../middlewares/auth.js";
import { uploadSingle } from "../../../utils/multer.js";
import { wrapMulter } from "../../../utils/wrapMulter.js";
import requestContext from "../../../utils/context.js";
import { validate } from "../../../middlewares/validate.js";
import {
    createCompanySchema,
    updateCompanySchema,
} from "../../../schemas/company.schema.js";

const router = express.Router();

/**
 * @swagger
 * /admin/companies/me:
 *   get:
 *     summary: Get current ADMIN_COMPANY's company details
 *     description: Returns detailed information about the company of the currently authenticated ADMIN_COMPANY user. Company ID is extracted from the access token. Requires ADMIN_COMPANY role.
 *     tags: [Admin - Companies]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Company retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Company retrieved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     name:
 *                       type: string
 *                       example: "Acme Corp"
 *                     slug:
 *                       type: string
 *                       example: "acme-corp"
 *                     logo:
 *                       type: string
 *                       nullable: true
 *                       example: "okr-kpi-system/companies/logos/123456"
 *                     logo_url:
 *                       type: string
 *                       nullable: true
 *                       example: "https://res.cloudinary.com/.../image.jpg"
 *                     is_active:
 *                       type: boolean
 *                       example: true
 *                     ai_plan:
 *                       type: string
 *                       enum: [FREE, SUBSCRIPTION, PAY_AS_YOU_GO]
 *                       example: "FREE"
 *                     token_usage:
 *                       type: integer
 *                       example: 1500
 *                     credit_cost:
 *                       type: number
 *                       format: float
 *                       example: 0.05
 *                     usage_limit:
 *                       type: integer
 *                       example: 10000
 *                     admin_count:
 *                       type: integer
 *                       example: 2
 *                     employee_count:
 *                       type: integer
 *                       example: 50
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *                       example: "2026-01-01T00:00:00.000Z"
 *       401:
 *         description: Unauthenticated or Company ID not found in token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Company ID not found in token"
 *       403:
 *         description: Forbidden - requires ADMIN_COMPANY role
 *       404:
 *         description: Company not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Company not found"
 */
router.get("/me", authenticate, authorize("ADMIN_COMPANY"), getMyCompany);

router.use(authenticate, authorize("ADMIN"));
router.use("/:company_id/admins", adminCompanyRoutes);

/**
 * @swagger
 * tags:
 *   - name: Admin - Companies
 *     description: Company management
 */

/**
 * @swagger
 * /admin/companies:
 *   get:
 *     summary: Get list of companies with pagination and filters
 *     description: Returns a paginated list of companies with optional filters by status, AI plan, search keyword, and date range. Results can be sorted by various fields.
 *     tags: [Admin - Companies]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: is_active
 *         schema:
 *           type: boolean
 *         description: "true = active, false = inactive (deactivated)"
 *       - in: query
 *         name: ai_plan
 *         schema:
 *           type: string
 *           enum: [FREE, SUBSCRIPTION, PAY_AS_YOU_GO]
 *         description: Filter by AI plan type
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *           maxLength: 255
 *         description: Search by name or slug (partial match, case-insensitive)
 *       - in: query
 *         name: from_date
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter companies created from this date (ISO 8601)
 *       - in: query
 *         name: to_date
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter companies created until this date (ISO 8601)
 *       - in: query
 *         name: sort_by
 *         schema:
 *           type: string
 *           enum: [name, created_at]
 *           default: created_at
 *         description: Field to sort by
 *       - in: query
 *         name: sort_order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort direction
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Current page number
 *       - in: query
 *         name: per_page
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *         description: Records per page (max 100)
 *     responses:
 *       200:
 *         description: List of companies
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         example: 1
 *                       name:
 *                         type: string
 *                         example: "Acme Corp"
 *                       slug:
 *                         type: string
 *                         example: "acme-corp"
 *                       logo_url:
 *                         type: string
 *                         nullable: true
 *                         example: "https://res.cloudinary.com/.../image.jpg"
 *                       is_active:
 *                         type: boolean
 *                         example: true
 *                       ai_plan:
 *                         type: string
 *                         enum: [FREE, SUBSCRIPTION, PAY_AS_YOU_GO]
 *                         example: "FREE"
 *                       admin_count:
 *                         type: integer
 *                         example: 2
 *                       employee_count:
 *                         type: integer
 *                         example: 50
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *                         example: "2026-01-01T00:00:00.000Z"
 *                 meta:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                       example: 100
 *                     page:
 *                       type: integer
 *                       example: 1
 *                     per_page:
 *                       type: integer
 *                       example: 20
 *                     last_page:
 *                       type: integer
 *                       example: 5
 *       401:
 *         description: Unauthenticated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Access token is missing"
 *       403:
 *         description: Forbidden
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Access denied"
 */
router.get("/", getCompanies);

/**
 * @swagger
 * /admin/companies:
 *   post:
 *     summary: Create a new company
 *     description: Creating a new company requires a unique slug. The slug is used as a unique identifier for the company across the platform, especially during login. Slug format must be lowercase letters, numbers, and hyphens (3-60 characters). Optionally upload a logo image file.
 *     tags: [Admin - Companies]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [name, slug]
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 255
 *                 example: "Acme Corp"
 *               slug:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 60
 *                 pattern: ^[a-z0-9-]+$
 *                 example: "acme-corp"
 *                 description: Unique identifier slug across the platform. Must contain only lowercase letters, numbers, and hyphens (3-60 characters).
 *               ai_plan:
 *                 type: string
 *                 enum: [FREE, SUBSCRIPTION, PAY_AS_YOU_GO]
 *                 default: FREE
 *                 description: Optional AI plan type (defaults to FREE)
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Optional company logo image file (max 2MB, must be image)
 *     responses:
 *       201:
 *         description: Company created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     company:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                           example: 1
 *                         name:
 *                           type: string
 *                           example: "Acme Corp"
 *                         slug:
 *                           type: string
 *                           example: "acme-corp"
 *                         logo:
 *                           type: string
 *                           nullable: true
 *                           example: "okr-kpi-system/companies/logos/1234567890"
 *                           description: Cloudinary public_id or null
 *                         logo_url:
 *                           type: string
 *                           nullable: true
 *                           example: "https://res.cloudinary.com/.../image.jpg"
 *                         is_active:
 *                           type: boolean
 *                           example: true
 *                         ai_plan:
 *                           type: string
 *                           enum: [FREE, SUBSCRIPTION, PAY_AS_YOU_GO]
 *                           example: "FREE"
 *                         admin_count:
 *                           type: integer
 *                           example: 0
 *                         employee_count:
 *                           type: integer
 *                           example: 0
 *                         created_at:
 *                           type: string
 *                           format: date-time
 *                           example: "2026-01-01T00:00:00.000Z"
 *       409:
 *         description: Slug already exists on the platform
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Slug already exists on this platform"
 *       400:
 *         description: Invalid file format or file too large
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "File must be an image (max 2MB)"
 *       401:
 *         description: Unauthenticated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Access token is missing"
 *       403:
 *         description: Forbidden
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Access denied"
 *       422:
 *         description: Validation error (invalid slug format, name too short, etc.)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "slug must contain only lowercase letters, numbers, and hyphens"
 */
router.post("/", wrapMulter(requestContext, uploadSingle("file")), validate(createCompanySchema), createCompany);

/**
 * @swagger
 * /admin/companies/{id}:
 *   patch:
 *     summary: Update company information
 *     description: Partial update of company fields (name, slug, ai_plan, usage_limit). Note - is_active cannot be modified via this endpoint; use separate deactivate/reactivate endpoints. token_usage and credit_cost also cannot be modified directly.
 *     tags: [Admin - Companies]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Company ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 255
 *                 example: "Acme Corporation"
 *                 description: New company name
 *               slug:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 60
 *                 pattern: ^[a-z0-9-]+$
 *                 example: "acme-corporation"
 *                 description: New slug. Must be unique across the platform and contain only lowercase letters, numbers, and hyphens (3-60 characters).
 *               ai_plan:
 *                 type: string
 *                 enum: [FREE, SUBSCRIPTION, PAY_AS_YOU_GO]
 *                 example: "SUBSCRIPTION"
 *                 description: AI plan type for the company
 *               usage_limit:
 *                 type: integer
 *                 example: 10000
 *                 description: Maximum token usage limit
 *     responses:
 *       200:
 *         description: Company updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Company updated successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     name:
 *                       type: string
 *                       example: "Acme Corporation"
 *                     slug:
 *                       type: string
 *                       example: "acme-corporation"
 *                     logo:
 *                       type: string
 *                       nullable: true
 *                       example: "okr-kpi-system/companies/logos/123456"
 *                     logo_url:
 *                       type: string
 *                       nullable: true
 *                       example: "https://res.cloudinary.com/.../image.jpg"
 *                     is_active:
 *                       type: boolean
 *                       example: true
 *                     ai_plan:
 *                       type: string
 *                       example: "SUBSCRIPTION"
 *                     token_usage:
 *                       type: integer
 *                       example: 1500
 *                     credit_cost:
 *                       type: number
 *                       format: float
 *                       example: 0.05
 *                     usage_limit:
 *                       type: integer
 *                       example: 10000
 *                     admin_count:
 *                       type: integer
 *                       example: 2
 *                     employee_count:
 *                       type: integer
 *                       example: 50
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *                       example: "2026-01-01T00:00:00.000Z"
 *       409:
 *         description: Slug already exists on the platform
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Slug already exists on this platform"
 *       404:
 *         description: Company not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Company not found"
 *       422:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "slug must be at least 3 characters"
 *       401:
 *         description: Unauthenticated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Access token is missing"
 *       403:
 *         description: Forbidden
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Access denied"
 */
router.get("/:id", getCompanyById);

/**
 * @swagger
 * /admin/companies/{id}:
 *   get:
 *     summary: Get company details by ID
 *     description: Returns detailed information about a specific company by ID. Use /stats endpoint instead if OKR/KPI statistics are needed.
 *     tags: [Admin - Companies]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Company ID
 *     responses:
 *       200:
 *         description: Company retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Company retrieved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     name:
 *                       type: string
 *                       example: "Acme Corp"
 *                     slug:
 *                       type: string
 *                       example: "acme-corp"
 *                     logo:
 *                       type: string
 *                       nullable: true
 *                       example: "okr-kpi-system/companies/logos/123456"
 *                     logo_url:
 *                       type: string
 *                       nullable: true
 *                       example: "https://res.cloudinary.com/.../image.jpg"
 *                     is_active:
 *                       type: boolean
 *                       example: true
 *                     ai_plan:
 *                       type: string
 *                       example: "FREE"
 *                     token_usage:
 *                       type: integer
 *                       example: 1500
 *                     credit_cost:
 *                       type: number
 *                       format: float
 *                       example: 0.05
 *                     usage_limit:
 *                       type: integer
 *                       example: 10000
 *                     admin_count:
 *                       type: integer
 *                       example: 2
 *                     employee_count:
 *                       type: integer
 *                       example: 50
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *                       example: "2026-01-01T00:00:00.000Z"
 *       401:
 *         description: Unauthenticated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Access token is missing"
 *       403:
 *         description: Forbidden
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Access denied"
 *       404:
 *         description: Company not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Company not found"
 */
router.patch("/:id", validate(updateCompanySchema), updateCompany);

// Note: PATCH /:id is validated by `updateCompanySchema` and does not accept `is_active`.
// Use the dedicated deactivate/reactivate endpoint(s) for activation status changes, if available.

/**
 * @swagger
 * /admin/companies/{id}/stats:
 *   get:
 *     summary: Get company details with comprehensive statistics
 *     description: Returns company information including AI plan, token usage, and comprehensive OKR/KPI statistics for the company.
 *     tags: [Admin - Companies]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Company ID
 *     responses:
 *       200:
 *         description: Company stats retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     name:
 *                       type: string
 *                       example: "Acme Corp"
 *                     slug:
 *                       type: string
 *                       example: "acme-corp"
 *                     logo:
 *                       type: string
 *                       nullable: true
 *                       example: "okr-kpi-system/companies/logos/123456"
 *                     logo_url:
 *                       type: string
 *                       nullable: true
 *                       example: "https://res.cloudinary.com/.../image.jpg"
 *                     is_active:
 *                       type: boolean
 *                       example: true
 *                     ai_plan:
 *                       type: string
 *                       enum: [FREE, SUBSCRIPTION, PAY_AS_YOU_GO]
 *                       example: "FREE"
 *                     token_usage:
 *                       type: integer
 *                       example: 1500
 *                     credit_cost:
 *                       type: number
 *                       format: float
 *                       example: 0.05
 *                     usage_limit:
 *                       type: integer
 *                       example: 10000
 *                     admin_count:
 *                       type: integer
 *                       example: 2
 *                     employee_count:
 *                       type: integer
 *                       example: 50
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *                       example: "2026-01-01T00:00:00.000Z"
 *                     total_objectives:
 *                       type: integer
 *                       example: 120
 *                     total_cycles:
 *                       type: integer
 *                       example: 6
 *                     total_key_results:
 *                       type: integer
 *                       example: 340
 *                     active_objectives:
 *                       type: integer
 *                       description: Count of objectives with status 'Active' only
 *                       example: 45
 *                     completion_rate:
 *                       type: number
 *                       format: float
 *                       description: Completion rate of objectives (0.0 to 1.0)
 *                       example: 0.72
 *       404:
 *         description: Company not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Company not found"
 *       401:
 *         description: Unauthenticated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Access token is missing"
 *       403:
 *         description: Forbidden
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Access denied"
 */
router.get("/:id/stats", getCompanyStats);

/**
 * @swagger
 * /admin/companies/{id}/logo:
 *   patch:
 *     summary: Upload or update company logo
 *     description: Upload a new logo for the company. Logo must be an image file (max 2MB). To delete a logo, use the DELETE /logo endpoint instead.
 *     tags: [Admin - Companies]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Company ID
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Logo image file (required, max 2MB, must be image - jpg, png, gif, webp)
 *     responses:
 *       200:
 *         description: Logo uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Logo updated successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     name:
 *                       type: string
 *                       example: "Acme Corp"
 *                     logo:
 *                       type: string
 *                       example: "okr-kpi-system/companies/logos/1234567890"
 *                       description: Cloudinary public_id
 *                     logo_url:
 *                       type: string
 *                       example: "https://res.cloudinary.com/.../image.jpg"
 *                       description: Full Cloudinary URL for display
 *       400:
 *         description: Invalid file format or file too large
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "File must be an image (max 2MB)"
 *       404:
 *         description: Company not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Company not found"
 *       401:
 *         description: Unauthenticated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Access token is missing"
 *       403:
 *         description: Forbidden
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Access denied"
 */
router.patch("/:id/logo", wrapMulter(requestContext, uploadSingle("file")), uploadLogo);

/**
 * @swagger
 * /admin/companies/{id}/logo:
 *   delete:
 *     summary: Delete company logo
 *     description: Delete the company's logo. This operation is idempotent - returns 200 whether logo exists or not.
 *     tags: [Admin - Companies]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Company ID
 *     responses:
 *       200:
 *         description: Logo deleted successfully (or was already deleted)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Logo deleted successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     name:
 *                       type: string
 *                       example: "Acme Corp"
 *                     logo:
 *                       type: string
 *                       nullable: true
 *                       example: null
 *                       description: Always null after deletion
 *                     logo_url:
 *                       type: string
 *                       nullable: true
 *                       example: null
 *                       description: Always null after deletion
 *       404:
 *         description: Company not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Company not found"
 *       401:
 *         description: Unauthenticated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Access token is missing"
 *       403:
 *         description: Forbidden
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Access denied"
 */
router.delete("/:id/logo", deleteLogo);

export default router;