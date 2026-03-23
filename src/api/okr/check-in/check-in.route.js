import express from "express";
import { createCheckIn, getCheckIns } from "./check-in.controller.js";
import { authenticate } from "../../../middlewares/auth.js";

const router = express.Router();

router.use(authenticate);

/**
 * @swagger
 * tags:
 *   - name: CheckIns
 *     description: OKR check-in APIs
 */

/**
 * @swagger
 * /key-results/{kr_id}/check-ins:
 *   post:
 *     summary: Create a check-in for a key result
 *     tags: [CheckIns]
 *     parameters:
 *       - in: path
 *         name: kr_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The key result ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - achieved_value
 *               - evidence_url
 *             properties:
 *               achieved_value:
 *                 type: number
 *                 description: The achieved value for this check-in
 *               evidence_url:
 *                 type: string
 *                 description: URL to evidence of achievement
 *               comment:
 *                 type: string
 *                 description: Optional comment about the check-in
 *     responses:
 *       200:
 *         description: Check-in created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     achieved_value:
 *                       type: number
 *                     progress_snapshot:
 *                       type: number
 *                       description: Progress percentage at time of check-in (2 decimal places)
 *                     kr_progress:
 *                       type: number
 *                       description: Current key result progress percentage (2 decimal places)
 *                     objective_progress:
 *                       type: number
 *                       description: Updated objective progress percentage (2 decimal places)
 *                     evidence_url:
 *                       type: string
 *                     comment:
 *                       type: string
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Invalid key result ID
 *       403:
 *         description: No permission to check in to this objective
 *       404:
 *         description: Key result not found
 *       422:
 *         description: Validation error (missing or invalid fields)
 */
router.post("/key-results/:kr_id/check-ins", createCheckIn);

/**
 * @swagger
 * /key-results/{kr_id}/check-ins:
 *   get:
 *     summary: Get check-in history for a key result
 *     tags: [CheckIns]
 *     parameters:
 *       - in: path
 *         name: kr_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The key result ID
 *     responses:
 *       200:
 *         description: Check-ins retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       achieved_value:
 *                         type: number
 *                       progress_snapshot:
 *                         type: number
 *                         description: Progress percentage at time of this check-in (2 decimal places)
 *                       evidence_url:
 *                         type: string
 *                       comment:
 *                         type: string
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *       400:
 *         description: Invalid key result ID
 *       403:
 *         description: No permission to view this objective
 *       404:
 *         description: Key result not found
 */
router.get("/key-results/:kr_id/check-ins", getCheckIns);

export default router;
