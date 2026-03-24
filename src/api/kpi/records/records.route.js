import express from "express";
import { createKPIRecord, getKPIRecords } from "./records.controller.js";
import { authenticate } from "../../../middlewares/auth.js";

const router = express.Router();

router.use(authenticate);

/**
 * @swagger
 * tags:
 *   - name: KPIRecords
 *     description: KPI Record management APIs
 */

/**
 * @swagger
 * /kpi-assignments/{assignment_id}/records:
 *   post:
 *     summary: Create a KPI Record
 *     tags: [KPIRecords]
 *     parameters:
 *       - in: path
 *         name: assignment_id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - period_start
 *               - period_end
 *               - actual_value
 *             properties:
 *               period_start:
 *                 type: string
 *                 format: date
 *                 description: Period start date (YYYY-MM-DD)
 *               period_end:
 *                 type: string
 *                 format: date
 *                 description: Period end date (YYYY-MM-DD)
 *               actual_value:
 *                 type: number
 *                 description: Actual achieved value
 *     responses:
 *       200:
 *         description: KPI Record created successfully
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
 *                     progress_percentage:
 *                       type: number
 *                       description: Progress percentage (2 decimal places)
 *                     time_elapsed_percentage:
 *                       type: number
 *                       description: Time elapsed in cycle (2 decimal places)
 *                     ratio:
 *                       type: number
 *                       description: Progress to time ratio (2 decimal places)
 *                     status:
 *                       type: string
 *                       enum: [OnTrack, AtRisk, Behind, Critical]
 *                     trend:
 *                       type: string
 *                       enum: [Upward, Downward, Stable]
 *       400:
 *         description: Invalid request or logic error
 *       403:
 *         description: No permission to create records
 *       404:
 *         description: Assignment not found
 *       422:
 *         description: Validation error
 */
router.post("/kpi-assignments/:assignment_id/records", createKPIRecord);

/**
 * @swagger
 * /kpi-assignments/{assignment_id}/records:
 *   get:
 *     summary: Get KPI Records history
 *     tags: [KPIRecords]
 *     parameters:
 *       - in: path
 *         name: assignment_id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: KPI Records retrieved successfully
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
 *                       actual_value:
 *                         type: number
 *                       period_start:
 *                         type: string
 *                         format: date
 *                       period_end:
 *                         type: string
 *                         format: date
 *                       progress_percentage:
 *                         type: number
 *                       status:
 *                         type: string
 *                         enum: [OnTrack, AtRisk, Behind, Critical]
 *                       trend:
 *                         type: string
 *                         enum: [Upward, Downward, Stable]
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *       404:
 *         description: Assignment not found
 */
router.get("/kpi-assignments/:assignment_id/records", getKPIRecords);

export default router;
