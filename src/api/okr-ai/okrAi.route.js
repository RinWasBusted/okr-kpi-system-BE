import express from "express";
import { authenticate } from "../../middlewares/auth.js";
import * as okrAiController from "./okrAi.controller.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: OKR AI
 *     description: AI suggestions for Key Results
 */

// Generate Key Result suggestions + fit evaluation for an Objective
/**
 * @swagger
 * /objectives/{objectiveId}/key-results/generate:
 *   post:
 *     summary: Generate key result suggestions for an objective
 *     description: Generate measurable Key Results and fit evaluation for a specific objective.
 *     tags: [OKR AI]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: objectiveId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Objective ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [count, language]
 *             properties:
 *               count:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 10
 *                 example: 5
 *               language:
 *                 type: string
 *                 enum: [vi, en]
 *                 example: vi
 *               constraints:
 *                 type: object
 *                 properties:
 *                   due_date:
 *                     type: string
 *                     format: date
 *                     example: "2026-12-31"
 *                   unit:
 *                     type: string
 *                     example: "%"
 *     responses:
 *       200:
 *         description: Generated key results successfully
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
 *                   example: Generated key results successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     objective:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                           example: 10
 *                         title:
 *                           type: string
 *                           example: Increase customer retention
 *                     suggestions:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           title:
 *                             type: string
 *                             example: Increase 90-day retention rate to 75%
 *                           target_value:
 *                             type: number
 *                             example: 75
 *                           unit:
 *                             type: string
 *                             example: "%"
 *                           weight:
 *                             type: number
 *                             example: 0.25
 *                           due_date:
 *                             type: string
 *                             format: date
 *                             example: "2026-12-31"
 *                           evaluation:
 *                             type: object
 *                             properties:
 *                               fit_score:
 *                                 type: integer
 *                                 example: 92
 *                               fit_reason:
 *                                 type: string
 *                                 example: Directly supports objective with measurable outcome.
 *                               issues:
 *                                 type: array
 *                                 items:
 *                                   type: string
 *                                 example: []
 *                     overall_feedback:
 *                       type: string
 *                       example: Suggested KRs are balanced and measurable.
 *       400:
 *         description: Invalid objectiveId or invalid payload
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Objective not found
 *       422:
 *         description: Validation error
 *       502:
 *         description: AI provider error
 */
router.post(
  "/objectives/:objectiveId/key-results/generate",
  authenticate,
  okrAiController.generateKeyResultsForObjective
);

// Generate test key results without auth / without objectiveId
/**
 * @swagger
 * /okr-ai/generate-test:
 *   post:
 *     summary: Generate test key result suggestions (no auth)
 *     description: Generate Key Results from free objective text for testing purpose.
 *     tags: [OKR AI]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [objective, count, language]
 *             properties:
 *               objective:
 *                 type: string
 *                 example: Improve product activation rate in Q4
 *               count:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 10
 *                 example: 4
 *               language:
 *                 type: string
 *                 enum: [vi, en]
 *                 example: en
 *               constraints:
 *                 type: object
 *                 properties:
 *                   due_date:
 *                     type: string
 *                     format: date
 *                     example: "2026-12-31"
 *                   unit:
 *                     type: string
 *                     example: "%"
 *     responses:
 *       200:
 *         description: Generate Test completed
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
 *                   example: Generate Test completed
 *                 data:
 *                   type: object
 *                   properties:
 *                     objective:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                           example: 0
 *                         title:
 *                           type: string
 *                           example: Improve product activation rate in Q4
 *                     suggestions:
 *                       type: array
 *                       items:
 *                         type: object
 *                     overall_feedback:
 *                       type: string
 *       422:
 *         description: Validation error
 *       502:
 *         description: AI provider error
 */
// router.post("/okr-ai/generate-test", okrAiController.generateTest);

export default router;

