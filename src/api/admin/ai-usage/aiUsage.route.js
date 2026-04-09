import express from "express";
import {
    updateCompanyAIPlan,
    resetCompanyCreditCost,
    getAIUsageLogs,
    calculateTotalCost,
    getCompanyAIUsageSummary,
} from "./aiUsage.controller.js";
import { authenticate, authorize } from "../../../middlewares/auth.js";

const router = express.Router();

// All routes require ADMIN authentication
router.use(authenticate, authorize("ADMIN_COMPANY", "ADMIN"));

/**
 * @swagger
 * tags:
 *   - name: Admin - AI Usage
 *     description: AI usage management and monitoring for administrators
 */

/**
 * @swagger
 * /admin/ai-usage/companies/{id}/plan:
 *   patch:
 *     summary: Update company AI plan and usage limit
 *     description: Update the AI plan (FREE, SUBSCRIPTION, PAY_AS_YOU_GO) and usage limit for a company.
 *     tags: [Admin - AI Usage]
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
 *               ai_plan:
 *                 type: string
 *                 enum: [FREE, SUBSCRIPTION, PAY_AS_YOU_GO]
 *                 example: SUBSCRIPTION
 *               usage_limit:
 *                 type: integer
 *                 example: 50000
 *                 description: Token usage limit
 *     responses:
 *       200:
 *         description: Company AI plan updated successfully
 *       404:
 *         description: Company not found
 *       422:
 *         description: Invalid ai_plan or usage_limit
 */
router.patch("/companies/:id/plan", updateCompanyAIPlan);

/**
 * @swagger
 * /admin/ai-usage/companies/{id}/reset-credit:
 *   post:
 *     summary: Reset company credit cost to 0
 *     description: Reset the credit_cost field for a company to zero.
 *     tags: [Admin - AI Usage]
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
 *         description: Company credit cost reset successfully
 *       404:
 *         description: Company not found
 */
router.post("/companies/:id/reset-credit", resetCompanyCreditCost);

/**
 * @swagger
 * /admin/ai-usage/companies/{id}/summary:
 *   get:
 *     summary: Get company AI usage summary
 *     description: Get comprehensive AI usage statistics for a company including current usage, last 30 days, and monthly history.
 *     tags: [Admin - AI Usage]
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
 *         description: Company AI usage summary retrieved successfully
 *       404:
 *         description: Company not found
 */
router.get("/companies/:id/summary", getCompanyAIUsageSummary);

/**
 * @swagger
 * /admin/ai-usage/logs:
 *   get:
 *     summary: Get AI usage logs with filters
 *     description: Get paginated AI usage logs with various filters for monitoring.
 *     tags: [Admin - AI Usage]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: company_id
 *         schema:
 *           type: integer
 *         description: Filter by company ID
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
 */
router.get("/logs", getAIUsageLogs);

/**
 * @swagger
 * /admin/ai-usage/total-cost:
 *   get:
 *     summary: Calculate total cost with filters
 *     description: Calculate total credit cost and token usage with various filters. Returns summary and breakdown by status and model.
 *     tags: [Admin - AI Usage]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: company_id
 *         schema:
 *           type: integer
 *         description: Filter by company ID
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
 *     responses:
 *       200:
 *         description: Total cost calculated successfully
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
 *                     summary:
 *                       type: object
 *                       properties:
 *                         total_cost:
 *                           type: number
 *                         total_input_tokens:
 *                           type: integer
 *                         total_output_tokens:
 *                           type: integer
 *                         total_tokens:
 *                           type: integer
 *                         total_requests:
 *                           type: integer
 *                     by_status:
 *                       type: array
 *                       items:
 *                         type: object
 *                     by_model:
 *                       type: array
 *                       items:
 *                         type: object
 */
router.get("/total-cost", calculateTotalCost);

export default router;
