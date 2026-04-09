import express from "express";
import {
    getMyCompany,
    getCompanyStats,
    uploadLogo,
    deleteLogo,
    getCompanyAIUsageLogs,
} from "./company.controller.js";
import { authenticate, authorize } from "../../middlewares/auth.js";
import { uploadSingle } from "../../utils/multer.js";
import { wrapMulter } from "../../utils/wrapMulter.js";
import requestContext from "../../utils/context.js";

const router = express.Router();

// All routes require authentication and ADMIN_COMPANY role for company-level operations
router.use(authenticate, authorize("ADMIN_COMPANY"));

/**
 * @swagger
 * tags:
 *   - name: Company
 *     description: Company operations for authenticated users
 */

/**
 * @swagger
 * /company/me:
 *   get:
 *     summary: Get own company info
 *     description: Returns information about the company the authenticated user belongs to.
 *     tags: [Company]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Company information retrieved successfully
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
 *                       example: 1000
 *                     credit_cost:
 *                       type: number
 *                       example: 25.50
 *                     usage_limit:
 *                       type: integer
 *                       example: 10000
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
 *         description: Forbidden - User does not have ADMIN_COMPANY role
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
router.get("/me", getMyCompany);

/**
 * @swagger
 * /company/stats:
 *   get:
 *     summary: Get company stats
 *     description: Returns statistics about the company including OKR progress, KPI health, and AI usage information.
 *     tags: [Company]
 *     security:
 *       - bearerAuth: []
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
 *                 message:
 *                   type: string
 *                   example: "Company stats retrieved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     name:
 *                       type: string
 *                       example: "Acme Corp"
 *                     is_active:
 *                       type: boolean
 *                       example: true
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *                       example: "2026-01-01T00:00:00.000Z"
 *                     ai_plan:
 *                       type: string
 *                       enum: [FREE, SUBSCRIPTION, PAY_AS_YOU_GO]
 *                       example: "FREE"
 *                     token_usage:
 *                       type: integer
 *                       example: 5000
 *                       description: Number of tokens used for AI features
 *                     usage_limit:
 *                       type: integer
 *                       example: 10000
 *                       description: Monthly token usage limit
 *                     credit_cost:
 *                       type: number
 *                       example: 25.50
 *                       description: Total AI credit cost incurred
 *                     okr_progress:
 *                       type: number
 *                       example: 65.5
 *                       description: Average progress percentage of company-level objectives (unit_id = null)
 *                     total_okr:
 *                       type: integer
 *                       example: 8
 *                       description: Total number of company-level objectives
 *                     kpi_health:
 *                       type: number
 *                       example: 72.3
 *                       description: Average progress percentage of company-level KPI assignments (unit_id = null)
 *                     total_kpi:
 *                       type: integer
 *                       example: 15
 *                       description: Total number of company-level KPI assignments
 *       401:
 *         description: Unauthenticated
 *       403:
 *         description: Forbidden
 */
router.get("/stats", getCompanyStats);

/**
 * @swagger
 * /company/logo:
 *   patch:
 *     summary: Upload or update company logo
 *     description: Upload or update the logo for the authenticated user's company.
 *     tags: [Company]
 *     security:
 *       - bearerAuth: []
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
 *                 description: Logo image file (JPG, PNG, etc.)
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
 *                   example: "Logo uploaded successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     name:
 *                       type: string
 *                       example: "Acme Corp"
 *                     logo_url:
 *                       type: string
 *                       example: "https://res.cloudinary.com/.../image.jpg"
 *       400:
 *         description: No file provided or upload failed
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
 *                   example: "Logo upload failed"
 *       401:
 *         description: Unauthenticated
 *       403:
 *         description: Forbidden
 */
router.patch("/logo", wrapMulter(requestContext, uploadSingle("file")), uploadLogo);

/**
 * @swagger
 * /company/logo:
 *   delete:
 *     summary: Delete company logo
 *     description: Remove the logo from the authenticated user's company.
 *     tags: [Company]
 *     security:
 *       - bearerAuth: []
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
 *                     logo_url:
 *                       type: string
 *                       nullable: true
 *                       example: null
 *       401:
 *         description: Unauthenticated
 *       403:
 *         description: Forbidden
 */
router.delete("/logo", deleteLogo);

/**
 * @swagger
 * /company/ai-usage/logs:
 *   get:
 *     summary: Get company AI usage logs
 *     description: Returns AI usage logs for the authenticated user's company with optional filters.
 *     tags: [Company]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: user_id
 *         schema:
 *           type: integer
 *         description: Filter by specific user
 *       - in: query
 *         name: feature_name
 *         schema:
 *           type: string
 *         description: Filter by feature name (partial match)
 *       - in: query
 *         name: model_name
 *         schema:
 *           type: string
 *         description: Filter by model name (partial match)
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by status
 *       - in: query
 *         name: start_date
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter from this date (ISO 8601)
 *       - in: query
 *         name: end_date
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter until this date (ISO 8601)
 *       - in: query
 *         name: min_credit_cost
 *         schema:
 *           type: number
 *         description: Minimum credit cost
 *       - in: query
 *         name: max_credit_cost
 *         schema:
 *           type: number
 *         description: Maximum credit cost
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: per_page
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *         description: Records per page
 *     responses:
 *       200:
 *         description: AI usage logs retrieved successfully
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
 *                   example: "AI usage logs retrieved successfully"
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       company:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                           name:
 *                             type: string
 *                       user:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                           full_name:
 *                             type: string
 *                           email:
 *                             type: string
 *                       feature_name:
 *                         type: string
 *                       model_name:
 *                         type: string
 *                       input_tokens:
 *                         type: integer
 *                       output_tokens:
 *                         type: integer
 *                       total_tokens:
 *                         type: integer
 *                       request_id:
 *                         type: string
 *                       credit_cost:
 *                         type: number
 *                       status:
 *                         type: string
 *                       created_at:
 *                         type: string
 *                         format: date-time
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
 *       403:
 *         description: Forbidden
 */
router.get("/ai-usage/logs", getCompanyAIUsageLogs);

export default router;
