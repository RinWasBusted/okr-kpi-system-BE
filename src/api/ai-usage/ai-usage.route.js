import express from "express";
import { getCompanyAIPlan, getAIUsageLogs } from "./ai-usage.controller.js";
import { authenticate, authorize } from "../../middlewares/auth.js";

const router = express.Router();

// All routes require ADMIN or ADMIN_COMPANY authentication
router.use(authenticate, authorize("ADMIN","ADMIN_COMPANY"));

/**
 * @swagger
 * tags:
 *   - name: AI Usage - Company Admin
 *     description: AI usage management for company administrators
 */

/**
 * @swagger
 * /ai-usage/plan:
 *   get:
 *     summary: Get company AI plan info
 *     description: Get AI plan information for the current company including ai_plan, token_usage, credit_cost, usage_limit.
 *     tags: [AI Usage - Company Admin]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Company AI plan retrieved successfully
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
 *                   example: "Company AI plan retrieved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     company:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                         name:
 *                           type: string
 *                     ai_plan:
 *                       type: string
 *                       enum: [FREE, SUBSCRIPTION, PAY_AS_YOU_GO]
 *                     token_usage:
 *                       type: integer
 *                     credit_cost:
 *                       type: number
 *                     usage_limit:
 *                       type: integer
 *                     remaining_tokens:
 *                       type: integer
 *                     usage_percentage:
 *                       type: number
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - requires ADMIN_COMPANY role
 *       404:
 *         description: Company not found
 */
router.get("/plan", getCompanyAIPlan);

/**
 * @swagger
 * /ai-usage/logs:
 *   get:
 *     summary: Get AI usage logs with filters
 *     description: Get paginated AI usage logs for the current company with various filters.
 *     tags: [AI Usage - Company Admin]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: user_id
 *         schema:
 *           type: integer
 *         description: Filter by user ID
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
 *           enum: [PENDING, SUCCESS, FAILED, REFUNDED, BILLED, EXCLUDED]
 *         description: Filter by status
 *       - in: query
 *         name: start_date
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter from date (YYYY-MM-DD)
 *       - in: query
 *         name: end_date
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter to date (YYYY-MM-DD)
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
 *                       user_fullname:
 *                         type: string
 *                       feature_name:
 *                         type: string
 *                       input_tokens:
 *                         type: integer
 *                       output_tokens:
 *                         type: integer
 *                       cached_token:
 *                         type: integer
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
 *                     page:
 *                       type: integer
 *                     last_page:
 *                       type: integer
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - requires ADMIN_COMPANY role
 */
router.get("/logs", getAIUsageLogs);

export default router;
