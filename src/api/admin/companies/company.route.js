import express from "express";
import {
    getCompanies,
    createCompany,
    updateCompany,
    deactivateCompany,
    getCompanyStats,
    uploadLogo,
    deleteLogo,
    getMyCompany,
} from "./company.controller.js";
import adminCompanyRoutes from "../AdminCompany/adminCompany.route.js";
import { authenticate, authorize } from "../../../middlewares/auth.js";
import { uploadSingle } from "../../../utils/multer.js";
import { wrapMulter } from "../../../utils/wrapMulter.js";
import requestContext from "../../../utils/context.js";

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
 *       400:
 *         description: Company ID not found in token
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
 *       401:
 *         description: Unauthenticated
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
 *     description: Returns a paginated list of companies with optional filters by status or search keyword.
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
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by name or slug (partial match)
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
 *                       is_active:
 *                         type: boolean
 *                         example: true
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
 *     description: Creating a new company requires a unique slug. The slug is used as a unique identifier for the company across the platform, especially during login. If the slug already exists, an error will be returned. Optionally upload a logo image file.
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
 *                 example: "Acme Corp"
 *               slug:
 *                 type: string
 *                 example: "acme-corp"
 *                 description: Unique identifier slug across the platform. Used during login.
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Optional company logo image file
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
 *                         is_active:
 *                           type: boolean
 *                           example: true
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
 *                   example: "Slug already exists"
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
 *                   example: "name and slug are required"
 */
router.post("/", wrapMulter(requestContext, uploadSingle("file")), createCompany);

/**
 * @swagger
 * /admin/companies/{id}:
 *   put:
 *     summary: Update company information
 *     description: Update company name, slug, or lock/unlock status.
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
 *                 example: "Acme Corporation"
 *                 description: New company name
 *               slug:
 *                 type: string
 *                 example: "acme-corporation"
 *                 description: New slug. Must be unique across the platform.
 *               is_active:
 *                 type: boolean
 *                 example: false
 *                 description: "false = lock the entire company, all users will lose login access"
 *               ai_plan:
 *                 type: string
 *                 enum: [FREE, SUBSCRIPTION, PAY_AS_YOU_GO]
 *                 example: "SUBSCRIPTION"
 *                 description: AI plan type for the company
 *               token_usage:
 *                 type: integer
 *                 example: 1500
 *                 description: Current token usage count
 *               credit_cost:
 *                 type: number
 *                 format: float
 *                 example: 0.05
 *                 description: Cost per token credit
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
 *                           example: "Acme Corporation"
 *                         slug:
 *                           type: string
 *                           example: "acme-corp"
 *                         is_active:
 *                           type: boolean
 *                           example: false
 *                         ai_plan:
 *                           type: string
 *                           example: "SUBSCRIPTION"
 *                         token_usage:
 *                           type: integer
 *                           example: 1500
 *                         credit_cost:
 *                           type: number
 *                           format: float
 *                           example: 0.05
 *                         usage_limit:
 *                           type: integer
 *                           example: 10000
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
 *                   example: "Slug already exists"
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
router.put("/:id", updateCompany);

/**
 * @swagger
 * /admin/companies/{id}:
 *   delete:
 *     summary: Deactivate a company (soft delete)
 *     description: Sets is_active = false. All users lose login access. Data is not physically deleted.
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
 *       204:
 *         description: Company deactivated successfully. No response body is returned.
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
router.delete("/:id", deactivateCompany);

/**
 * @swagger
 * /admin/companies/{id}/stats:
 *   get:
 *     summary: Get company details with AI usage info
 *     description: Returns company information including AI plan, token usage, credit cost, and usage limit.
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
 *                     is_active:
 *                       type: boolean
 *                       example: true
 *                     logo:
 *                       type: string
 *                       nullable: true
 *                       example: "okr-kpi-system/companies/logos/123456"
 *                     logo_url:
 *                       type: string
 *                       nullable: true
 *                       example: "https://res.cloudinary.com/.../image.jpg"
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *                       example: "2026-01-01T00:00:00.000Z"
 *                     admin_count:
 *                       type: integer
 *                       example: 2
 *                     employee_count:
 *                       type: integer
 *                       example: 50
 *                     active_cycles:
 *                       type: integer
 *                       example: 3
 *                     total_objectives:
 *                       type: integer
 *                       example: 120
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
 *     description: Upload a new logo for the company. Logo must be an image file. Send empty request (no file) to delete current logo.
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
 *       required: false
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Logo image file (optional - omit to delete current logo)
 *     responses:
 *       200:
 *         description: Logo uploaded/deleted successfully
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
 *                       nullable: true
 *                       example: "okr-kpi-system/companies/logos/1234567890"
 *                       description: Cloudinary public_id or null
 *       400:
 *         description: Invalid company ID
 *       404:
 *         description: Company not found
 *       401:
 *         description: Unauthenticated
 *       403:
 *         description: Forbidden
 */
router.patch("/:id/logo", wrapMulter(requestContext, uploadSingle("file")), uploadLogo);

/**
 * @swagger
 * /admin/companies/{id}/logo:
 *   delete:
 *     summary: Delete company logo
 *     description: Remove the logo from a company.
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
 *         description: Logo deleted successfully
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
 *       400:
 *         description: Invalid company ID
 *       404:
 *         description: Company not found
 *       401:
 *         description: Unauthenticated
 *       403:
 *         description: Forbidden
 */
router.delete("/:id/logo", deleteLogo);

export default router;